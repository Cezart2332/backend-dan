import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import jwt from 'jsonwebtoken';

// Run with WEBHOOK_TEST_MYSQL_URL=mysql://user:pass@127.0.0.1:3306/dan_subscription_webhooks_test
const uri = process.env.WEBHOOK_TEST_MYSQL_URL;
test('product-scoped expirations, Google base plans and transfers on an isolated MySQL database', { skip: !uri }, async (t) => {
  const url = new URL(uri);
  assert.equal(url.hostname, '127.0.0.1');
  assert.equal(url.pathname, '/dan_subscription_webhooks_test');
  process.env.CORE_MYSQL = '';
  process.env.MYSQL = '';
  process.env.DATABASE_URL = uri;
  process.env.JWT_SECRET = 'subscription-webhook-test-secret';
  process.env.REVENUECAT_SECRET_API_KEY = '';
  process.env.REVENUECAT_WEBHOOK_AUTH = 'webhook-test';
  const { mysqlPool: pool } = await import('../src/mysql.js');
  t.after(() => pool.end());
  const { runMigrations } = await import('../src/migrate.js');
  await runMigrations();
  await pool.query('DELETE FROM revenue_events');
  await pool.query('DELETE FROM users');
  for (const id of [1, 2]) await pool.query('INSERT INTO users (id,email,name) VALUES (?,?,?)', [id, `webhook-${id}@example.invalid`, `Test ${id}`]);

  const app = Fastify();
  t.after(() => app.close());
  const { registerSubscriptionRoutes } = await import('../src/routes-subscriptions.js');
  await registerSubscriptionRoutes(app);

  const now = Math.floor(Date.now() / 1000) * 1000;
  let sequence = 0;
  const webhook = (event) => app.inject({
    method: 'POST', url: '/api/subscriptions/webhook', headers: { authorization: 'Bearer webhook-test' },
    payload: { event: { id: `evt-${++sequence}`, environment: 'PRODUCTION', store: 'PLAY_STORE', event_timestamp_ms: now + sequence * 1000, entitlement_ids: ['Dan Fost Anxios Pro'], ...event } },
  });
  const rows = async (userId) => (await pool.query('SELECT * FROM subscriptions WHERE user_id=? ORDER BY id', [userId]))[0];
  const activePaid = async (userId) => (await rows(userId)).filter((row) => row.type !== 'trial' && +new Date(row.ends_at) > Date.now());

  assert.equal((await webhook({ type: 'INITIAL_PURCHASE', app_user_id: '1', product_id: 'premium_monthly:premiumplan', purchased_at_ms: now, expiration_at_ms: now + 30 * 86400000 })).statusCode, 200);
  assert.equal((await webhook({ type: 'INITIAL_PURCHASE', app_user_id: '1', product_id: 'basic_monthly:basic-plan', purchased_at_ms: now, expiration_at_ms: now + 30 * 86400000 })).statusCode, 200);
  assert.equal((await activePaid(1)).length, 2);

  // A refunded Basic must not end the Premium that is still paid.
  assert.equal((await webhook({ type: 'EXPIRATION', app_user_id: '1', product_id: 'basic_monthly:basic-plan', purchased_at_ms: now, expiration_at_ms: now - 1000 })).statusCode, 200);
  const remaining = await activePaid(1);
  assert.deepEqual(remaining.map((row) => row.type), ['premium']);

  // The REST API names the Google product without its base plan; it is the same row.
  const before = (await rows(1)).length;
  const auth = { authorization: `Bearer ${jwt.sign({ sub: 1 }, process.env.JWT_SECRET)}` };
  const sync = await app.inject({ method: 'POST', url: '/api/subscriptions/sync', headers: auth, payload: {
    status: 'active', productId: 'premium_monthly', startsAt: new Date(now).toISOString(), endsAt: new Date(now + 31 * 86400000).toISOString(), appUserId: '1',
  } });
  assert.equal(sync.statusCode, 200);
  assert.equal((await rows(1)).length, before);
  assert.equal(+new Date((await activePaid(1))[0].ends_at), now + 31 * 86400000);

  // TRANSFER events have no app_user_id; they belong to the numeric receiver.
  const transfer = await webhook({ type: 'TRANSFER', store: 'APP_STORE', transferred_from: ['$RCAnonymousID:abc'], transferred_to: ['2'] });
  assert.equal(transfer.statusCode, 200);
  const [[recorded]] = await pool.query("SELECT user_id FROM revenue_events WHERE event_type='TRANSFER'");
  assert.equal(Number(recorded.user_id), 2);
});
