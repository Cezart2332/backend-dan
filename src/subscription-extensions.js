import { activePaidSql } from './analytics.js';

export const MAX_EXTENSION_DAYS = 365;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DAY_MS = 86400000;

function failure(message, statusCode = 400) {
  return Object.assign(new Error(message), { statusCode });
}

function extensionScope(input) {
  if (!['all', 'user'].includes(input.scope)) throw failure('Alege prelungirea globală sau pe utilizator.');
  const userId = input.scope === 'all' ? null : typeof input.userId === 'number'
    ? input.userId : typeof input.userId === 'string' && /^[1-9]\d*$/.test(input.userId) ? Number(input.userId) : NaN;
  if (input.scope === 'user' && (!Number.isSafeInteger(userId) || userId < 1)) {
    throw failure('Utilizator invalid.');
  }
  if (input.scope === 'all' && input.userId != null) throw failure('Prelungirea globală nu acceptă un utilizator.');
  return { scope: input.scope, userId };
}

export function validateExtension(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw failure('Cerere de prelungire invalidă.');
  const target = extensionScope(input);
  if (!Number.isInteger(input.days) || input.days < 1 || input.days > MAX_EXTENSION_DAYS) {
    throw failure(`Perioada trebuie să fie un număr întreg între 1 și ${MAX_EXTENSION_DAYS} de zile.`);
  }
  if (typeof input.operationId !== 'string' || !UUID.test(input.operationId)) {
    throw failure('Identificator de operațiune invalid.');
  }
  return { ...target, days: input.days, operationId: input.operationId.toLowerCase() };
}

// An administrator grants access until a fixed date, independently of store
// billing. Repeated snapshots must not shorten that already granted access.
export function preserveAdminExtensionEnd(storeEnd, adminEnd) {
  if (storeEnd == null) return null; // Lifetime entitlement.
  const storeDate = new Date(storeEnd);
  const adminDate = adminEnd == null ? null : new Date(adminEnd);
  return adminDate && Number.isFinite(+adminDate) && +adminDate > +storeDate ? adminDate : storeDate;
}

export async function migrateSubscriptionExtensions(pool) {
  try {
    await pool.query('ALTER TABLE subscriptions ADD COLUMN admin_extended_until DATETIME NULL');
  } catch (error) {
    if (error.code !== 'ER_DUP_FIELDNAME' && error.errno !== 1060) throw error;
  }
  await pool.query(`CREATE TABLE IF NOT EXISTS subscription_extension_operations (
    id CHAR(36) PRIMARY KEY,
    scope ENUM('all','user') NOT NULL,
    days SMALLINT UNSIGNED NOT NULL,
    target_user_id BIGINT NULL,
    created_by BIGINT NULL,
    auth_method VARCHAR(16) NOT NULL,
    result JSON NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS subscription_extension_changes (
    operation_id CHAR(36) NOT NULL,
    subscription_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    previous_ends_at DATETIME NOT NULL,
    extended_ends_at DATETIME NOT NULL,
    PRIMARY KEY (operation_id, subscription_id),
    FOREIGN KEY (operation_id) REFERENCES subscription_extension_operations(id) ON DELETE CASCADE,
    FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);
}

export async function extendSubscriptions(pool, input, actor = {}) {
  const { scope, userId, days, operationId } = validateExtension(input);
  const db = await pool.getConnection();
  try {
    await db.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');
    await db.beginTransaction();
    try {
      await db.query(
        'INSERT INTO subscription_extension_operations (id,scope,days,target_user_id,created_by,auth_method) VALUES (?,?,?,?,?,?)',
        [operationId, scope, days, userId, actor.user?.id || null, actor.method || 'token'],
      );
    } catch (error) {
      if (error.code !== 'ER_DUP_ENTRY') throw error;
      const [[previous]] = await db.query('SELECT scope,days,target_user_id,result FROM subscription_extension_operations WHERE id=? FOR UPDATE', [operationId]);
      if (!previous || previous.scope !== scope || Number(previous.days) !== days || Number(previous.target_user_id || 0) !== Number(userId || 0)) {
        throw failure('Această operațiune a fost deja folosită pentru altă prelungire.', 409);
      }
      const result = typeof previous.result === 'string' ? JSON.parse(previous.result) : previous.result;
      if (!result) throw failure('Operațiunea nu este încă finalizată. Încearcă din nou.', 409);
      await db.commit();
      return { ...result, replayed: true };
    }

    // RevenueCat also locks users before modifying their subscription rows.
    // Lock users in the same order so a renewal cannot overwrite an extension.
    const [users] = await db.query(
      scope === 'user'
        ? 'SELECT u.id FROM users u WHERE u.id=? FOR UPDATE'
        : `SELECT u.id FROM users u WHERE EXISTS (SELECT 1 FROM subscriptions s WHERE s.user_id=u.id AND ${activePaidSql()}) ORDER BY u.id FOR UPDATE`,
      scope === 'user' ? [userId] : [],
    );
    if (scope === 'user' && !users.length) throw failure('Utilizatorul nu există.', 404);

    let affectedCount = 0, skippedLifetimeCount = 0, subscription = null;
    for (let offset = 0; offset < users.length; offset += 500) {
      const ids = users.slice(offset, offset + 500).map((user) => user.id);
      const [rows] = await db.query(
        `SELECT s.id,s.user_id,s.ends_at FROM subscriptions s WHERE s.user_id IN (${ids.map(() => '?').join(',')}) AND ${activePaidSql()} ORDER BY s.user_id,s.id FOR UPDATE`,
        ids,
      );
      skippedLifetimeCount += rows.filter((row) => row.ends_at == null).length;
      const eligible = rows.filter((row) => row.ends_at != null);
      if (!eligible.length) continue;
      const changes = eligible.map((row) => [
        operationId, row.id, row.user_id, row.ends_at,
        new Date(+new Date(row.ends_at) + days * DAY_MS),
      ]);
      await db.query(
        `INSERT INTO subscription_extension_changes (operation_id,subscription_id,user_id,previous_ends_at,extended_ends_at) VALUES ${changes.map(() => '(?,?,?,?,?)').join(',')}`,
        changes.flat(),
      );
      await db.query(
        `UPDATE subscriptions SET admin_extended_until=DATE_ADD(ends_at, INTERVAL ? DAY),ends_at=DATE_ADD(ends_at, INTERVAL ? DAY) WHERE id IN (${eligible.map(() => '?').join(',')})`,
        [days, days, ...eligible.map((row) => row.id)],
      );
      affectedCount += eligible.length;
      if (scope === 'user') subscription = { userId, endsAt: changes[0][4].toISOString() };
    }
    if (scope === 'user' && !affectedCount) {
      throw failure(skippedLifetimeCount ? 'Abonamentul este fără termen și nu necesită prelungire.' : 'Utilizatorul nu are un abonament plătit activ.', 409);
    }
    const result = { ok: true, operationId, scope, days, affectedCount, skippedLifetimeCount, subscription };
    await db.query('UPDATE subscription_extension_operations SET result=? WHERE id=?', [JSON.stringify(result), operationId]);
    await db.commit();
    return result;
  } catch (error) {
    await db.rollback();
    throw error;
  } finally {
    db.release();
  }
}

export async function registerSubscriptionExtensionRoutes(app, { pool, adminAuth }) {
  const admin = async (request, reply) => {
    const auth = await adminAuth(request);
    if (!auth) return reply.code(403).send({ error: 'Forbidden' });
    request.extensionAdmin = auth;
  };
  app.get('/api/admin/subscriptions/extension-preview', { preHandler: admin }, async (request, reply) => {
    try {
      const { scope, userId } = extensionScope({ scope: request.query.scope, userId: request.query.user_id });
      const [[counts]] = await pool.query(
        `SELECT COALESCE(SUM(s.ends_at IS NOT NULL),0) AS eligibleCount,COALESCE(SUM(s.ends_at IS NULL),0) AS skippedLifetimeCount,MAX(s.ends_at) AS endsAt FROM subscriptions s WHERE ${activePaidSql()}${scope === 'user' ? ' AND s.user_id=?' : ''}`,
        scope === 'user' ? [userId] : [],
      );
      return { eligibleCount: Number(counts.eligibleCount), skippedLifetimeCount: Number(counts.skippedLifetimeCount), ...(scope === 'user' ? { endsAt: counts.endsAt } : {}) };
    } catch (error) {
      if (!error.statusCode) throw error;
      return reply.code(error.statusCode).send({ error: error.message });
    }
  });
  app.post('/api/admin/subscriptions/extend', { preHandler: admin }, async (request, reply) => {
    try {
      return await extendSubscriptions(pool, request.body, request.extensionAdmin);
    } catch (error) {
      if (!error.statusCode) {
        request.log.error({ err: error }, 'Subscription extension failed');
        return reply.code(500).send({ error: 'Prelungirea nu a putut fi finalizată. Încearcă din nou.' });
      }
      return reply.code(error.statusCode).send({ error: error.message });
    }
  });
}
