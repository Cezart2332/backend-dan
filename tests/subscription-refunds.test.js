import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import jwt from 'jsonwebtoken';

process.env.REVENUECAT_SECRET_API_KEY = 'sk_refund_test';
process.env.REVENUECAT_CURRENT_CACHE_TTL_MS = '0';
process.env.REVENUECAT_WEBHOOK_AUTH = 'refund-test';
process.env.JWT_SECRET = 'subscription-refund-test-secret';
// Run the database test with REFUND_TEST_MYSQL_URL=mysql://user:pass@127.0.0.1:3306/dan_subscription_refunds_test
const uri = process.env.REFUND_TEST_MYSQL_URL;
process.env.CORE_MYSQL = '';
process.env.MYSQL = '';
process.env.DATABASE_URL = uri || 'mysql://unused:unused@127.0.0.1:1/unused';
const { mysqlPool: pool } = await import('../src/mysql.js');
test.after(() => pool.end());
const { getEntitlementFromRevenueCat, registerSubscriptionRoutes } = await import('../src/routes-subscriptions.js');

const DAY = 86400000;
const iso = (offset) => new Date(Date.now() + offset).toISOString();
// RevenueCat REST v1 subscriber: the entitlement names the product, the
// product's entry in `subscriptions` carries store, refund and renewal state.
function subscriber({ product = 'premium_subscription', key = product, refundedAt = null, unsubscribedAt = null, expires = iso(30 * DAY) } = {}) {
  return {
    entitlements: { 'Dan Fost Anxios Pro': { expires_date: expires, product_identifier: product, purchase_date: iso(-DAY) } },
    subscriptions: { [key]: { store: 'app_store', period_type: 'normal', expires_date: expires, purchase_date: iso(-DAY), refunded_at: refundedAt, unsubscribe_detected_at: unsubscribedAt, billing_issues_detected_at: null } },
  };
}

test('REST state: a refund ends access, renewal and store come from the product entry', async () => {
  const active = getEntitlementFromRevenueCat(subscriber(), 'Dan Fost Anxios Pro');
  assert.equal(active.isActive, true);
  assert.equal(active.willRenew, true);
  assert.equal(active.store, 'app_store');

  const refundedAt = iso(-60000);
  const refunded = getEntitlementFromRevenueCat(subscriber({ refundedAt }), 'Dan Fost Anxios Pro');
  assert.equal(refunded.isActive, false);
  assert.equal(refunded.willRenew, false);
  assert.equal(refunded.expirationDate, refundedAt);

  const optedOut = getEntitlementFromRevenueCat(subscriber({ unsubscribedAt: iso(-60000) }), 'Dan Fost Anxios Pro');
  assert.equal(optedOut.isActive, true);
  assert.equal(optedOut.willRenew, false);

  // Google: the entitlement may say "sku" while the entry is "sku:base-plan".
  const google = getEntitlementFromRevenueCat(subscriber({ product: 'premium_monthly', key: 'premium_monthly:premiumplan' }), 'Dan Fost Anxios Pro');
  assert.equal(google.store, 'app_store');
  assert.equal(google.willRenew, true);
});

test('Apple refund, reversed refund and RevenueCat outage on an isolated MySQL database', { skip: !uri }, async (t) => {
  const url = new URL(uri);
  assert.equal(url.hostname, '127.0.0.1');
  assert.equal(url.pathname, '/dan_subscription_refunds_test');
  const { runMigrations } = await import('../src/migrate.js');
  await runMigrations();
  await pool.query('DELETE FROM revenue_events');
  await pool.query('DELETE FROM users');
  await pool.query('INSERT INTO users (id,email,name) VALUES (1,?,?)', ['refund-1@example.invalid', 'Refund 1']);

  let current = subscriber();
  let revenueCatDown = false;
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    assert.match(String(input), /api\.revenuecat\.com\/v1\/subscribers\/1$/);
    if (revenueCatDown) return { ok: false, status: 503, text: async () => 'down', json: async () => ({}) };
    return { ok: true, status: 200, json: async () => ({ subscriber: current }), text: async () => '' };
  };
  t.after(() => { globalThis.fetch = realFetch; });

  const app = Fastify();
  t.after(() => app.close());
  await registerSubscriptionRoutes(app);

  const base = Date.now();
  let sequence = 0;
  const webhook = (event) => app.inject({
    method: 'POST', url: '/api/subscriptions/webhook', headers: { authorization: 'Bearer refund-test' },
    payload: { event: { id: `refund-${++sequence}`, environment: 'PRODUCTION', store: 'APP_STORE', app_user_id: '1', product_id: 'premium_subscription', entitlement_ids: ['Dan Fost Anxios Pro'], event_timestamp_ms: base + sequence * 1000, purchased_at_ms: base - DAY, expiration_at_ms: base + 30 * DAY, ...event } },
  });
  const rows = async () => (await pool.query('SELECT * FROM subscriptions WHERE user_id=1 ORDER BY id'))[0];
  const only = async () => { const all = await rows(); assert.equal(all.length, 1); return all[0]; };
  const active = (row) => +new Date(row.ends_at) > Date.now();

  assert.equal((await webhook({ type: 'INITIAL_PURCHASE' })).statusCode, 200);
  assert.equal(active(await only()), true);

  // Opting out of renewal keeps access until the period ends.
  current = subscriber({ unsubscribedAt: iso(-60000) });
  assert.equal((await webhook({ type: 'CANCELLATION', cancel_reason: 'UNSUBSCRIBE' })).statusCode, 200);
  let row = await only();
  assert.equal(active(row), true);
  assert.equal(Number(row.revenuecat_will_renew), 0);
  assert.equal(row.revenuecat_store, 'app_store');

  // Apple refund: the event still carries the period's future expiry.
  current = subscriber({ refundedAt: iso(-60000) });
  assert.equal((await webhook({ type: 'CANCELLATION', cancel_reason: 'CUSTOMER_SUPPORT' })).statusCode, 200);
  row = await only();
  assert.equal(active(row), false);
  assert.equal(Number(row.revenuecat_will_renew), 0);
  assert.equal(row.revenuecat_event_type, 'CANCELLATION');

  // Repeated access checks of the refunded purchase neither revive nor duplicate it.
  const auth = { authorization: `Bearer ${jwt.sign({ sub: 1 }, process.env.JWT_SECRET)}` };
  for (let i = 0; i < 3; i++) {
    const response = await app.inject({ url: '/api/subscriptions/current', headers: auth });
    assert.equal(response.statusCode, 200);
    assert.equal(response.json().status, 'expired');
  }
  assert.equal(active(await only()), false);

  // Apple reverses the refund.
  current = subscriber();
  assert.equal((await webhook({ type: 'REFUND_REVERSED' })).statusCode, 200);
  row = await only();
  assert.equal(active(row), true);
  assert.equal(Number(row.revenuecat_will_renew), 1);

  // RevenueCat unreachable: a refund event still ends access at once.
  revenueCatDown = true;
  assert.equal((await webhook({ type: 'CANCELLATION', cancel_reason: 'CUSTOMER_SUPPORT' })).statusCode, 200);
  assert.equal(active(await only()), false);
  const [[pending]] = await pool.query("SELECT COUNT(*) AS total FROM revenue_events WHERE user_id=1 AND snapshot_applied=0");
  assert.equal(Number(pending.total), 0);
});
