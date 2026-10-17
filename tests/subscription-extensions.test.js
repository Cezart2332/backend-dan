import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import Fastify from 'fastify';
import jwt from 'jsonwebtoken';
import {
  validateExtension, preserveAdminExtensionEnd, extendSubscriptions,
  migrateSubscriptionExtensions, registerSubscriptionExtensionRoutes,
} from '../src/subscription-extensions.js';

const payload = (patch = {}) => ({ scope: 'user', userId: 1, days: 2, operationId: randomUUID(), ...patch });

test('extension requests reject invalid durations, targets and operation IDs', () => {
  for (const days of [0, -1, 1.5, 366, true, '2', null]) assert.throws(() => validateExtension(payload({ days })), { statusCode: 400 });
  for (const userId of [0, -1, 1.5, true, null, 'invalid', '1.5', Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => validateExtension(payload({ userId })), { statusCode: 400 });
  }
  for (const value of [null, [], 'invalid', {}, payload({ scope: 'unknown' }), payload({ operationId: 'bad' }), payload({ scope: 'all' })]) {
    assert.throws(() => validateExtension(value), { statusCode: 400 });
  }
  assert.equal(validateExtension(payload({ scope: 'all', userId: undefined, days: 365 })).days, 365);
});

test('RevenueCat snapshots preserve the granted expiry and can advance it on renewal', () => {
  const store = new Date('2026-10-10T12:00:00Z'), bonus = new Date('2026-10-12T12:00:00Z');
  assert.equal(+preserveAdminExtensionEnd(store, bonus), +bonus);
  assert.equal(+preserveAdminExtensionEnd(new Date('2026-11-10T12:00:00Z'), bonus), +new Date('2026-11-10T12:00:00Z'));
  assert.equal(+preserveAdminExtensionEnd(store, null), +store);
  assert.equal(preserveAdminExtensionEnd(null, bonus), null);
});

test('preview and mutations require administrator authentication before accessing the database', async (t) => {
  const app = Fastify();
  await registerSubscriptionExtensionRoutes(app, { pool: { query: () => { throw new Error('Database should not be reached'); } }, adminAuth: async () => null });
  t.after(() => app.close());
  assert.equal((await app.inject('/api/admin/subscriptions/extension-preview?scope=all')).statusCode, 403);
  assert.equal((await app.inject({ method: 'POST', url: '/api/admin/subscriptions/extend', payload: payload() })).statusCode, 403);
});

test('migration ignores only a duplicate column, not a failed schema change', async () => {
  const sql = [];
  await migrateSubscriptionExtensions({ query: async (statement) => {
    sql.push(statement);
    if (statement.startsWith('ALTER')) throw Object.assign(new Error('duplicate'), { code: 'ER_DUP_FIELDNAME' });
  } });
  assert.equal(sql.length, 3);
  await assert.rejects(migrateSubscriptionExtensions({ query: async () => { throw new Error('Connection lost'); } }), /Connection lost/);
});

const uri = process.env.SUBSCRIPTIONS_TEST_MYSQL_URL;
test('extensions, retries, concurrency, audit and RevenueCat sync on an isolated MySQL database', { skip: !uri }, async (t) => {
  const url = new URL(uri);
  assert.equal(url.hostname, '127.0.0.1');
  assert.equal(url.pathname, '/dan_subscription_extensions_test');
  process.env.CORE_MYSQL = '';
  process.env.MYSQL = '';
  process.env.DATABASE_URL = uri;
  process.env.JWT_SECRET = 'subscription-extension-test-secret';
  process.env.REVENUECAT_SECRET_API_KEY = '';
  const { mysqlPool: pool, effectiveDbConfig } = await import('../src/mysql.js');
  assert.equal(effectiveDbConfig.host, '127.0.0.1');
  assert.equal(effectiveDbConfig.database, 'dan_subscription_extensions_test');
  t.after(() => pool.end());
  const { runMigrations } = await import('../src/migrate.js');
  await runMigrations();
  await runMigrations();
  await pool.query('DELETE FROM subscription_extension_operations');
  await pool.query('DELETE FROM users');
  for (let id = 1; id <= 10; id++) {
    await pool.query('INSERT INTO users (id,email,name) VALUES (?,?,?)', [id, `extension-${id}@example.invalid`, `Test ${id}`]);
  }
  const now = Math.floor(Date.now() / 1000) * 1000, day = (offset) => new Date(now + offset * 86400000);
  async function subscription(userId, type, start, end, period = 'NORMAL') {
    const [result] = await pool.query('INSERT INTO subscriptions (user_id,type,starts_at,ends_at,revenuecat_period_type) VALUES (?,?,?,?,?)', [userId, type, day(start), end == null ? null : day(end), period]);
    return result.insertId;
  }
  const paid = await subscription(1, 'pro', -5, 10);
  await pool.query("UPDATE subscriptions SET revenuecat_product_id='dan_pro',revenuecat_entitlement_id='Dan Fost Anxios Pro' WHERE id=?", [paid]);
  const trial = await subscription(2, 'trial', -1, 7);
  const expired = await subscription(3, 'premium', -10, -1);
  const future = await subscription(5, 'basic', 2, 7);
  const lifetime = await subscription(6, 'vip', -10, null);
  const older = await subscription(7, 'basic', -6, 12);
  const newer = await subscription(7, 'premium', -5, 9);
  const storeTrial = await subscription(8, 'premium', -1, 5, 'TRIAL');
  const sameStartOlder = await subscription(9, 'basic', -3, 8);
  const sameStartNewer = await subscription(9, 'pro', -3, 8);
  const concurrent = await subscription(10, 'pro', -5, 30);
  const read = async (id) => (await pool.query('SELECT * FROM subscriptions WHERE id=?', [id]))[0][0];
  const before = new Map();
  for (const id of [paid, trial, expired, future, lifetime, older, newer, storeTrial, sameStartOlder, sameStartNewer, concurrent]) before.set(id, await read(id));

  const app = Fastify();
  t.after(() => app.close());
  await registerSubscriptionExtensionRoutes(app, { pool, adminAuth: async (req) => req.headers['x-admin-token'] === 'extension-test' ? { method: 'token' } : null });
  const { registerSubscriptionRoutes } = await import('../src/routes-subscriptions.js');
  await registerSubscriptionRoutes(app);
  const headers = { 'x-admin-token': 'extension-test' };
  const post = (body) => app.inject({ method: 'POST', url: '/api/admin/subscriptions/extend', headers, payload: body });
  const preview = await app.inject({ url: '/api/admin/subscriptions/extension-preview?scope=all', headers });
  assert.equal(preview.statusCode, 200);
  assert.deepEqual(preview.json(), { eligibleCount: 4, skippedLifetimeCount: 1 });
  const individualPreview = await app.inject({ url: '/api/admin/subscriptions/extension-preview?scope=user&user_id=1', headers });
  assert.equal(individualPreview.statusCode, 200);
  assert.equal(individualPreview.json().eligibleCount, 1);
  assert.equal(+new Date(individualPreview.json().endsAt), +new Date(before.get(paid).ends_at));
  for (const userId of [2, 3, 4, 5, 6, 8]) assert.equal((await post(payload({ userId }))).statusCode, 409);
  assert.equal((await post(payload({ userId: 99 }))).statusCode, 404);
  assert.equal((await post(null)).statusCode, 400);

  const individual = payload();
  const first = await post(individual);
  assert.equal(first.statusCode, 200);
  assert.equal(first.json().affectedCount, 1);
  assert.equal(+new Date((await read(paid)).ends_at), +new Date(before.get(paid).ends_at) + 2 * 86400000);
  assert.equal((await post(individual)).json().replayed, true);
  assert.equal((await post({ ...individual, days: 3 })).statusCode, 409);
  const global = await post(payload({ scope: 'all', userId: undefined, days: 1 }));
  assert.equal(global.statusCode, 200);
  assert.equal(global.json().affectedCount, 4);
  assert.equal(global.json().skippedLifetimeCount, 1);
  for (const id of [trial, expired, future, lifetime, older, storeTrial, sameStartOlder]) {
    assert.equal(+new Date((await read(id)).ends_at), +new Date(before.get(id).ends_at));
  }
  for (const id of [newer, sameStartNewer]) assert.equal(+new Date((await read(id)).ends_at), +new Date(before.get(id).ends_at) + 86400000);

  const duplicate = payload({ userId: 10, days: 2 });
  const duplicateResults = await Promise.all([post(duplicate), post(duplicate)]);
  assert.ok(duplicateResults.every((result) => result.statusCode === 200));
  assert.equal(duplicateResults.filter((result) => result.json().replayed).length, 1);
  const separateResults = await Promise.all([post(payload({ userId: 10, days: 1 })), post(payload({ userId: 10, days: 3 }))]);
  assert.ok(separateResults.every((result) => result.statusCode === 200));
  assert.equal(+new Date((await read(concurrent)).ends_at), +new Date(before.get(concurrent).ends_at) + 7 * 86400000);
  const [[audit]] = await pool.query('SELECT COUNT(*) AS total FROM subscription_extension_changes WHERE subscription_id=?', [concurrent]);
  assert.equal(audit.total, 4);

  const auth = { authorization: `Bearer ${jwt.sign({ sub: 1 }, process.env.JWT_SECRET)}` };
  const sync = (status, endsAt) => app.inject({ method: 'POST', url: '/api/subscriptions/sync', headers: auth, payload: {
    status, productId: 'dan_pro', entitlementId: 'Dan Fost Anxios Pro', appUserId: '1',
    startsAt: before.get(paid).starts_at, endsAt, store: 'GOOGLE_PLAY', periodType: 'NORMAL',
  } });
  const grantedEnd = +new Date(before.get(paid).ends_at) + 3 * 86400000;
  for (const status of ['active', 'expired', 'active', 'none']) {
    const response = await sync(status, before.get(paid).ends_at);
    assert.equal(response.statusCode, 200);
    assert.equal(response.json().status, 'active');
    assert.equal(+new Date(response.json().subscription.ends_at), grantedEnd, status);
  }
  const current = await app.inject({ url: '/api/subscriptions/current', headers: auth });
  assert.equal(current.statusCode, 200);
  assert.equal(+new Date(current.json().subscription.ends_at), grantedEnd);
  const renewal = await sync('active', day(45));
  assert.equal(renewal.statusCode, 200);
  assert.equal(+new Date(renewal.json().subscription.ends_at), +day(45));

  // An audit failure rolls back the grant and the operation claim together.
  const rollbackRequest = payload({ userId: 10 });
  const beforeRollback = +new Date((await read(concurrent)).ends_at);
  const failingPool = { getConnection: async () => {
    const db = await pool.getConnection();
    return { beginTransaction: () => db.beginTransaction(), commit: () => db.commit(), rollback: () => db.rollback(), release: () => db.release(), query: (sql, args) => {
      if (sql.startsWith('UPDATE subscription_extension_operations SET result')) throw new Error('Audit unavailable');
      return db.query(sql, args);
    } };
  } };
  await assert.rejects(extendSubscriptions(failingPool, rollbackRequest), /Audit unavailable/);
  assert.equal(+new Date((await read(concurrent)).ends_at), beforeRollback);
  const [[claims]] = await pool.query('SELECT COUNT(*) AS total FROM subscription_extension_operations WHERE id=?', [rollbackRequest.operationId]);
  assert.equal(claims.total, 0);
});
