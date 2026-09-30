import { createHash } from "node:crypto";

export const PAID_PLANS = ["basic", "premium", "pro", "vip"];
export function productPlan(product) {
  const value = String(product || "").toLowerCase();
  return (
    PAID_PLANS.find((plan) =>
      new RegExp(`(^|[^a-z])${plan}([^a-z]|$)`).test(value),
    ) || "premium"
  );
}
export function storeName(store) {
  const value = String(store || "unknown").toUpperCase();
  return value === "PLAY_STORE" ? "GOOGLE_PLAY" : value;
}
const sqlDate = (date) => date.toISOString().slice(0, 23).replace("T", " ");
const dateOf = (value) => {
  if (value == null || value === "") return null;
  const date = new Date(
    typeof value === "string" && !/[TZ+]/.test(value)
      ? `${value.replace(" ", "T")}Z`
      : value,
  );
  return Number.isFinite(date.getTime()) ? date : null;
};
const amount = (value) =>
  value == null || value === "" || !Number.isFinite(Number(value))
    ? null
    : Number(value);
const yes = (value) => value === true || value === "true" || value === "1";
const digest = (value) => createHash("sha256").update(value).digest("hex");

export async function migrateAnalytics(pool) {
  await pool.query(`CREATE TABLE IF NOT EXISTS revenue_events (
    event_id VARCHAR(190) PRIMARY KEY, user_id BIGINT NULL, event_type VARCHAR(48) NOT NULL,
    plan VARCHAR(16) NOT NULL, store VARCHAR(48) NOT NULL, environment VARCHAR(16) NOT NULL,
    period_type VARCHAR(16) NULL, trial_conversion TINYINT(1) NOT NULL DEFAULT 0,
    occurred_at DATETIME(3) NOT NULL, transaction_id VARCHAR(190) NULL, snapshot_applied TINYINT(1) NOT NULL DEFAULT 0,
    INDEX idx_revenue_events_date (environment, occurred_at), INDEX idx_revenue_events_user (user_id, occurred_at),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL)`);
  try {
    await pool.query(
      "ALTER TABLE revenue_events ADD COLUMN snapshot_applied TINYINT(1) NOT NULL DEFAULT 0",
    );
  } catch (error) {
    if (error.code !== "ER_DUP_FIELDNAME") throw error;
  }
  await pool.query(`CREATE TABLE IF NOT EXISTS revenue_transactions (
    transaction_key CHAR(64) NOT NULL, kind ENUM('payment','refund') NOT NULL,
    user_id BIGINT NULL, transaction_id VARCHAR(190) NOT NULL, product_id VARCHAR(190) NOT NULL,
    plan VARCHAR(16) NOT NULL, store VARCHAR(48) NOT NULL, environment VARCHAR(16) NOT NULL,
    currency CHAR(3) NULL, amount DECIMAL(18,6) NULL, amount_usd DECIMAL(18,6) NULL,
    occurred_at DATETIME(3) NOT NULL, source_updated_at DATETIME(3) NOT NULL,
    PRIMARY KEY (transaction_key, kind), INDEX idx_revenue_date (environment, occurred_at),
    INDEX idx_revenue_user (user_id, occurred_at),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS app_activity_days (
    user_id BIGINT NOT NULL, activity_date DATE NOT NULL, platform VARCHAR(16) NOT NULL,
    PRIMARY KEY (user_id, activity_date), INDEX idx_activity_date (activity_date),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS challenge_attempts (
    user_id BIGINT NOT NULL, client_id CHAR(36) NOT NULL, challenge_id VARCHAR(128) NOT NULL,
    started_at DATETIME(3) NOT NULL, completed_at DATETIME(3) NULL,
    PRIMARY KEY (user_id, client_id), INDEX idx_attempt_date (started_at),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE)`);
  try {
    await pool.query(
      "ALTER TABLE subscriptions ADD COLUMN revenuecat_period_type VARCHAR(16) NULL",
    );
  } catch (error) {
    if (error.code !== "ER_DUP_FIELDNAME") throw error;
  }
  // Existing deployments used the Pro entitlement but omitted Pro from the enum.
  const [columns] = await pool.query(
    "SHOW COLUMNS FROM subscriptions LIKE 'type'",
  );
  if (!columns[0]?.Type.includes("'pro'"))
    await pool.query(
      "ALTER TABLE subscriptions MODIFY type ENUM('trial','basic','premium','vip','pro') NOT NULL",
    );
  for (const [table, field] of [
    ["audio_activity", "occurred_at"],
    ["wellbeing_sessions", "occurred_at"],
    ["wellbeing_checkins", "occurred_at"],
    ["challenge_runs", "client_date"],
  ]) {
    try {
      await pool.query(
        `CREATE INDEX idx_analytics_date ON ${table} (${field})`,
      );
    } catch (error) {
      if (error.code !== "ER_DUP_KEYNAME") throw error;
    }
  }
}

// Keep only normalized financial fields. Never store subscriber attributes or raw payloads.
export function normalizeRevenueEvent(event) {
  const type = String(event?.type || "").toUpperCase();
  if (!event?.id || !type || type === "TEST") return null;
  const occurred = dateOf(event.event_timestamp_ms);
  if (!occurred) throw new Error("Evenimentul nu are un moment valid.");
  const environment = String(event.environment || "UNKNOWN").toUpperCase();
  const period = String(event.period_type || "NORMAL").toUpperCase();
  const transactionId = String(event.transaction_id || "");
  const store = storeName(event.store);
  const uniqueTransaction =
    store === "STRIPE"
      ? `${transactionId}:renewal:${Number(event.renewal_number) || 1}`
      : transactionId;
  const record = {
    eventId: String(event.id).slice(0, 190),
    type,
    plan: productPlan(event.product_id),
    store,
    environment,
    period,
    trialConversion: event.is_trial_conversion === true,
    occurred,
    transactionId: uniqueTransaction.slice(0, 190),
    entries: [],
  };
  if (
    !transactionId ||
    event.is_family_share ||
    store === "PROMOTIONAL" ||
    period === "TRIAL"
  )
    return record;
  const native = amount(event.price_in_purchased_currency),
    usd = amount(event.price);
  const currency = /^[A-Z]{3}$/.test(String(event.currency || "").toUpperCase())
    ? String(event.currency).toUpperCase()
    : null;
  const common = {
    key: digest(`${environment}:${store}:${uniqueTransaction}`),
    transactionId: record.transactionId,
    productId: String(event.product_id || "").slice(0, 190),
    plan: record.plan,
    store,
    environment,
    currency,
    occurred,
    updated: occurred,
  };
  if (["INITIAL_PURCHASE", "RENEWAL", "NON_RENEWING_PURCHASE"].includes(type)) {
    record.entries.push({
      ...common,
      kind: "payment",
      native: native == null ? null : Math.max(0, native),
      usd: usd == null ? null : Math.max(0, usd),
    });
  } else if (
    type === "REFUND" ||
    (type === "CANCELLATION" &&
      (event.cancel_reason === "CUSTOMER_SUPPORT" || native < 0 || usd < 0))
  ) {
    record.entries.push({
      ...common,
      kind: "refund",
      native: native == null ? null : Math.abs(native),
      usd: usd == null ? null : Math.abs(usd),
    });
  } else if (type === "REFUND_REVERSED") {
    record.entries.push({ ...common, kind: "refund", native: 0, usd: 0 });
  }
  return record;
}

export async function saveRevenueTransaction(db, userId, entry) {
  // One payment and one current refund adjustment per store transaction, shared
  // by webhook and CSV ingestion. A late delivery cannot undo a newer refund.
  await db.query(
    `INSERT INTO revenue_transactions
    (transaction_key,kind,user_id,transaction_id,product_id,plan,store,environment,currency,amount,amount_usd,occurred_at,source_updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE
    user_id = COALESCE(user_id, VALUES(user_id)),
    amount = IF(VALUES(source_updated_at) >= source_updated_at, COALESCE(VALUES(amount),amount), amount),
    amount_usd = IF(VALUES(source_updated_at) >= source_updated_at, COALESCE(VALUES(amount_usd),amount_usd), amount_usd),
    currency = IF(VALUES(source_updated_at) >= source_updated_at, COALESCE(VALUES(currency),currency),currency),
    occurred_at = IF(VALUES(source_updated_at) >= source_updated_at, VALUES(occurred_at),occurred_at),
    source_updated_at = GREATEST(source_updated_at,VALUES(source_updated_at))`,
    [
      entry.key,
      entry.kind,
      userId,
      entry.transactionId,
      entry.productId,
      entry.plan,
      entry.store,
      entry.environment,
      entry.currency,
      entry.native,
      entry.usd,
      sqlDate(entry.occurred),
      sqlDate(entry.updated),
    ],
  );
}

export async function recordRevenueEvent(pool, event, userId = null) {
  const record = normalizeRevenueEvent(event);
  if (!record) return { ignored: true };
  const db = await pool.getConnection();
  try {
    await db.beginTransaction();
    await saveRevenueLifecycle(db, record, userId);
    for (const entry of record.entries)
      await saveRevenueTransaction(db, userId, entry);
    await db.commit();
    return { ignored: false };
  } catch (error) {
    await db.rollback();
    throw error;
  } finally {
    db.release();
  }
}

export async function saveRevenueLifecycle(db, record, userId) {
  await db.query(
    `INSERT INTO revenue_events
      (event_id,user_id,event_type,plan,store,environment,period_type,trial_conversion,occurred_at,transaction_id)
      VALUES (?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE event_id = event_id`,
    [
      record.eventId,
      userId,
      record.type,
      record.plan,
      record.store,
      record.environment,
      record.period,
      record.trialConversion ? 1 : 0,
      sqlDate(record.occurred),
      record.transactionId || null,
    ],
  );
}

export function exportLifecycle(row) {
  const purchased = dateOf(row.start_time),
    store = storeName(row.store);
  const transactionId = (
    store === "STRIPE"
      ? `${row.store_transaction_id}:renewal:${row.renewal_number}`
      : String(row.store_transaction_id || "")
  ).slice(0, 190);
  const environment = yes(row.is_sandbox) ? "SANDBOX" : "PRODUCTION";
  const base = {
    plan: productPlan(row.product_identifier),
    store,
    environment,
    period: yes(row.is_trial_period) ? "TRIAL" : "NORMAL",
    trialConversion: yes(row.is_trial_conversion),
    transactionId,
  };
  const make = (type, occurred) => ({
    ...base,
    eventId: `export:${digest(`${environment}:${store}:${transactionId}:${type}`)}`,
    type,
    occurred,
    entries: [],
  });
  const events = [
    make(
      Number(row.renewal_number) > 1 ? "RENEWAL" : "INITIAL_PURCHASE",
      purchased,
    ),
  ];
  if (dateOf(row.unsubscribe_detected_at))
    events.push(make("CANCELLATION", dateOf(row.unsubscribe_detected_at)));
  return events;
}

// Official RevenueCat Transactions CSV, not the Virtual Currency feed.
export function normalizeExportRow(row) {
  const transactionId = String(row.store_transaction_id || "");
  const purchased = dateOf(row.start_time),
    updated = dateOf(row.updated_at) || purchased;
  if (!transactionId || !purchased || !row.product_identifier || !row.store)
    throw new Error(
      "Exportul necesită store_transaction_id, start_time, product_identifier și store.",
    );
  if (
    !["true", "false", "1", "0", true, false].includes(row.is_sandbox) ||
    !["true", "false", "1", "0", true, false].includes(row.is_trial_period)
  )
    throw new Error(
      "Exportul necesită is_sandbox și is_trial_period explicite.",
    );
  if (
    yes(row.is_trial_period) ||
    row.ownership_type === "FAMILY_SHARED" ||
    storeName(row.store) === "PROMOTIONAL"
  )
    return [];
  const environment = yes(row.is_sandbox) ? "SANDBOX" : "PRODUCTION",
    store = storeName(row.store);
  if (
    store === "STRIPE" &&
    (!Number.isInteger(Number(row.renewal_number)) ||
      Number(row.renewal_number) < 1)
  )
    throw new Error("Exportul Stripe necesită renewal_number.");
  const uniqueTransaction =
    store === "STRIPE"
      ? `${transactionId}:renewal:${row.renewal_number}`
      : transactionId;
  const currency = /^[A-Z]{3}$/.test(
    String(row.purchased_currency || "").toUpperCase(),
  )
    ? String(row.purchased_currency).toUpperCase()
    : null;
  const grossUsd = amount(row.purchase_price_in_usd),
    netUsd = amount(row.price_in_usd);
  const grossNative = amount(row.purchase_price_in_purchased_currency),
    netNative = amount(row.price_in_purchased_currency);
  if (
    [grossUsd, grossNative, netUsd, netNative].some(
      (value) => value != null && value < 0,
    )
  )
    throw new Error(
      "Prețurile din exportul Transactions trebuie să fie pozitive.",
    );
  // Old exports without gross prices cannot reconstruct refunded purchases.
  if (row.refunded_at && grossUsd == null && grossNative == null)
    throw new Error("Exportul rambursat necesită coloanele purchase_price.");
  const common = {
    key: digest(`${environment}:${store}:${uniqueTransaction}`),
    transactionId: uniqueTransaction.slice(0, 190),
    productId: String(row.product_identifier || "").slice(0, 190),
    plan: productPlan(row.product_identifier),
    store,
    environment,
    currency,
    updated,
  };
  const refunded =
    Boolean(row.refunded_at) ||
    (grossUsd != null && netUsd != null && grossUsd > netUsd) ||
    (grossNative != null && netNative != null && grossNative > netNative);
  const payment = {
    ...common,
    kind: "payment",
    native: grossNative ?? (refunded ? null : netNative),
    usd: grossUsd ?? (refunded ? null : netUsd),
    occurred: purchased,
  };
  const refundNative =
    grossNative != null && netNative != null
      ? Math.max(0, grossNative - netNative)
      : null;
  const refundUsd =
    grossUsd != null && netUsd != null ? Math.max(0, grossUsd - netUsd) : null;
  const entries = [payment];
  if (row.refunded_at || refundNative != null || refundUsd != null)
    entries.push({
      ...common,
      kind: "refund",
      native: refundNative,
      usd: refundUsd,
      occurred: dateOf(row.refunded_at) || updated,
    });
  return entries;
}
