import jwt from "jsonwebtoken";
import { mysqlPool } from "./mysql.js";

const PRODUCT_IDS = {
  basic: "dan_basic",
  premium: "dan_premium",
  vip: "dan_vip",
};

const KNOWN_PRODUCT_ALIASES = {
  basic: ["dan_basic", "basic"],
  premium: ["dan_premium", "premium"],
  vip: ["dan_vip", "vip"],
};

const PRO_ENTITLEMENT_ID = process.env.REVENUECAT_ENTITLEMENT_ID || "Dan Fost Anxios Pro";
const REVENUECAT_SECRET_API_KEY = process.env.REVENUECAT_SECRET_API_KEY || "";

const ACTIVE_EVENT_TYPES = new Set([
  "INITIAL_PURCHASE",
  "NON_RENEWING_PURCHASE",
  "RENEWAL",
  "PRODUCT_CHANGE",
  "UNCANCELLATION",
  "TRANSFER",
]);

const INACTIVE_EVENT_TYPES = new Set([
  "EXPIRATION",
  "CANCELLATION",
  "REFUND",
  "SUBSCRIPTION_PAUSED",
]);

function requireAuth(request) {
  const auth = request.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) throw new Error("NO_AUTH");
  const secret = process.env.JWT_SECRET || process.env.CORE_JWT_SECRET;
  if (!secret) throw new Error("SERVER_CONFIG_ERROR");
  try {
    const decoded = jwt.verify(token, secret);
    return decoded;
  } catch {
    throw new Error("BAD_TOKEN");
  }
}

async function getUserById(userId) {
  const [rows] = await mysqlPool.query(`SELECT id, email FROM users WHERE id = ? LIMIT 1`, [userId]);
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

function normalizeProductType(productId) {
  const normalized = String(productId || "").toLowerCase().trim();
  if (!normalized) return "premium";
  if (KNOWN_PRODUCT_ALIASES.basic.includes(normalized)) return "basic";
  if (KNOWN_PRODUCT_ALIASES.vip.includes(normalized)) return "vip";
  if (KNOWN_PRODUCT_ALIASES.premium.includes(normalized)) return "premium";
  if (normalized.includes("basic")) return "basic";
  if (normalized.includes("vip")) return "vip";
  return "premium";
}

function parseNullableDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function parseMillisOrDate(value) {
  if (!value) return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === "string" && /^\d+$/.test(value)) {
    const d = new Date(Number(value));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return parseNullableDate(value);
}

function computeStatusFromDates(startsAt, endsAt) {
  const start = parseNullableDate(startsAt);
  const end = parseNullableDate(endsAt);
  if (!start && !end) return "none";
  if (!end || end.getTime() > Date.now()) return "active";
  return "expired";
}

function getEntitlementFromRevenueCat(subscriber, entitlementId) {
  if (!subscriber) return null;

  const entitlements = subscriber.entitlements || {};

  const sdkLikeActive = entitlements.active?.[entitlementId];
  if (sdkLikeActive) {
    return {
      raw: sdkLikeActive,
      isActive: true,
      productIdentifier: sdkLikeActive.productIdentifier,
      latestPurchaseDate: sdkLikeActive.latestPurchaseDate,
      expirationDate: sdkLikeActive.expirationDate,
      store: sdkLikeActive.store,
      willRenew: sdkLikeActive.willRenew,
      entitlementId,
    };
  }

  const sdkLikeAll = entitlements.all?.[entitlementId];
  if (sdkLikeAll) {
    const expirationDate = parseNullableDate(sdkLikeAll.expirationDate);
    const isActive = !expirationDate || expirationDate.getTime() > Date.now();
    return {
      raw: sdkLikeAll,
      isActive,
      productIdentifier: sdkLikeAll.productIdentifier,
      latestPurchaseDate: sdkLikeAll.latestPurchaseDate,
      expirationDate: sdkLikeAll.expirationDate,
      store: sdkLikeAll.store,
      willRenew: sdkLikeAll.willRenew,
      entitlementId,
    };
  }

  const restEntitlement = entitlements?.[entitlementId];
  if (restEntitlement && typeof restEntitlement === "object") {
    const expirationDate = parseNullableDate(restEntitlement.expires_date);
    const isActive = !expirationDate || expirationDate.getTime() > Date.now();
    return {
      raw: restEntitlement,
      isActive,
      productIdentifier: restEntitlement.product_identifier,
      latestPurchaseDate: restEntitlement.purchase_date,
      expirationDate: restEntitlement.expires_date,
      store: restEntitlement.store,
      willRenew: restEntitlement.unsubscribe_detected_at ? false : null,
      entitlementId,
    };
  }

  return null;
}

async function fetchRevenueCatSubscriber(appUserId) {
  if (!REVENUECAT_SECRET_API_KEY) return null;
  const safeUserId = encodeURIComponent(String(appUserId || "").trim());
  if (!safeUserId) return null;

  const response = await fetch(`https://api.revenuecat.com/v1/subscribers/${safeUserId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${REVENUECAT_SECRET_API_KEY}`,
      "Content-Type": "application/json",
    },
  });

  if (response.status === 404) return null;
  if (!response.ok) {
    const payload = await response.text().catch(() => "");
    throw new Error(`REVENUECAT_FETCH_FAILED:${response.status}:${payload}`);
  }

  const payload = await response.json();
  return payload?.subscriber || null;
}

async function getLatestSubscriptionRow(userId) {
  const [rows] = await mysqlPool.query(
    `SELECT
      id,
      type,
      starts_at,
      ends_at,
      revenuecat_product_id,
      revenuecat_store,
      revenuecat_will_renew,
      revenuecat_entitlement_id,
      revenuecat_app_user_id,
      created_at,
      updated_at
     FROM subscriptions
     WHERE user_id = ?
     ORDER BY starts_at DESC, id DESC
     LIMIT 1`,
    [userId]
  );
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function getActiveTrialRow(userId) {
  const [rows] = await mysqlPool.query(
    `SELECT
      id,
      type,
      starts_at,
      ends_at,
      revenuecat_product_id,
      revenuecat_store,
      revenuecat_will_renew,
      revenuecat_entitlement_id,
      revenuecat_app_user_id,
      created_at,
      updated_at
     FROM subscriptions
     WHERE user_id = ?
       AND type = 'trial'
       AND (ends_at IS NULL OR ends_at > NOW())
     ORDER BY starts_at DESC, id DESC
     LIMIT 1`,
    [userId]
  );
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function getTrialEligible(userId) {
  const [rows] = await mysqlPool.query(
    `SELECT id FROM subscriptions WHERE user_id = ? AND type IN ('trial','basic','premium','vip') LIMIT 1`,
    [userId]
  );
  return !Array.isArray(rows) || rows.length === 0;
}

async function persistRevenueCatSnapshot({
  userId,
  appUserId,
  entitlementId,
  productId,
  status,
  startsAt,
  endsAt,
  store,
  willRenew,
  eventType,
}) {
  const nextStatus = ["active", "expired", "none"].includes(status) ? status : "none";
  const normalizedProductId = productId ? String(productId).trim() : null;
  const normalizedType = normalizedProductId ? normalizeProductType(normalizedProductId) : "premium";

  const startDate = parseNullableDate(startsAt) || new Date();
  const parsedEndsAt = parseNullableDate(endsAt);
  const endDate =
    nextStatus === "active"
      ? parsedEndsAt
      : parsedEndsAt || new Date();

  if (nextStatus !== "active") {
    await mysqlPool.query(
      `UPDATE subscriptions
       SET ends_at = IFNULL(ends_at, NOW())
       WHERE user_id = ?
         AND type <> 'trial'
         AND (ends_at IS NULL OR ends_at > NOW())`,
      [userId]
    );

    if (normalizedProductId) {
      await mysqlPool.query(
        `INSERT INTO subscriptions (
          user_id,
          type,
          starts_at,
          ends_at,
          revenuecat_app_user_id,
          revenuecat_product_id,
          revenuecat_entitlement_id,
          revenuecat_store,
          revenuecat_will_renew,
          revenuecat_event_type,
          stripe_price_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          normalizedType,
          startDate,
          endDate,
          appUserId || null,
          normalizedProductId,
          entitlementId || null,
          store || null,
          typeof willRenew === "boolean" ? Number(willRenew) : null,
          eventType || null,
          normalizedProductId,
        ]
      );
    }

    return;
  }

  const [existingRows] = await mysqlPool.query(
    `SELECT id, starts_at, ends_at
     FROM subscriptions
     WHERE user_id = ?
       AND revenuecat_product_id <=> ?
       AND revenuecat_entitlement_id <=> ?
     ORDER BY id DESC
     LIMIT 1`,
    [userId, normalizedProductId, entitlementId || null]
  );

  const existing = Array.isArray(existingRows) && existingRows.length ? existingRows[0] : null;
  if (existing) {
    await mysqlPool.query(
      `UPDATE subscriptions
       SET
         type = ?,
         starts_at = ?,
         ends_at = ?,
         revenuecat_app_user_id = ?,
         revenuecat_store = ?,
         revenuecat_will_renew = ?,
         revenuecat_event_type = ?,
         stripe_price_id = ?
       WHERE id = ?`,
      [
        normalizedType,
        startDate,
        endDate,
        appUserId || null,
        store || null,
        typeof willRenew === "boolean" ? Number(willRenew) : null,
        eventType || null,
        normalizedProductId,
        existing.id,
      ]
    );
    return;
  }

  await mysqlPool.query(
    `INSERT INTO subscriptions (
      user_id,
      type,
      starts_at,
      ends_at,
      revenuecat_app_user_id,
      revenuecat_product_id,
      revenuecat_entitlement_id,
      revenuecat_store,
      revenuecat_will_renew,
      revenuecat_event_type,
      stripe_price_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      normalizedType,
      startDate,
      endDate,
      appUserId || null,
      normalizedProductId,
      entitlementId || null,
      store || null,
      typeof willRenew === "boolean" ? Number(willRenew) : null,
      eventType || null,
      normalizedProductId,
    ]
  );
}

function formatCurrentResponse(row, trialEligible) {
  const status = row
    ? computeStatusFromDates(row.starts_at, row.ends_at)
    : "none";

  const subscription = row
    ? {
        type: row.type,
        product_id: row.revenuecat_product_id || row.stripe_price_id || null,
        starts_at: row.starts_at || null,
        ends_at: row.ends_at || null,
        store: row.revenuecat_store || null,
        will_renew:
          row.revenuecat_will_renew === null || row.revenuecat_will_renew === undefined
            ? null
            : Boolean(row.revenuecat_will_renew),
      }
    : null;

  return { subscription, status, trialEligible };
}

function getWebhookToken(request) {
  const auth = request.headers.authorization || "";
  if (auth.startsWith("Bearer ")) return auth.slice(7).trim();
  const xToken = request.headers["x-revenuecat-auth"] || request.headers["x-webhook-auth"];
  if (typeof xToken === "string") return xToken.trim();
  return auth.trim();
}

export async function registerSubscriptionRoutes(app) {
  app.get("/api/subscriptions/current", async (request, reply) => {
    try {
      const user = requireAuth(request);
      const userRow = await getUserById(user.sub);
      if (!userRow) {
        return reply.code(401).send({ error: "Neautorizat", code: "USER_NOT_FOUND" });
      }

      const appUserId = String(user.sub || userRow.email || "").trim();

      try {
        const subscriber = await fetchRevenueCatSubscriber(appUserId);
        const entitlement = getEntitlementFromRevenueCat(subscriber, PRO_ENTITLEMENT_ID);
        const status = entitlement
          ? entitlement.isActive
            ? "active"
            : "expired"
          : "none";

        if (entitlement) {
          await persistRevenueCatSnapshot({
            userId: user.sub,
            appUserId,
            entitlementId: entitlement.entitlementId,
            productId: entitlement.productIdentifier,
            status,
            startsAt: entitlement.latestPurchaseDate,
            endsAt: entitlement.expirationDate,
            store: entitlement.store,
            willRenew: entitlement.willRenew,
            eventType: "API_SYNC",
          });
        } else {
          await persistRevenueCatSnapshot({
            userId: user.sub,
            appUserId,
            entitlementId: PRO_ENTITLEMENT_ID,
            productId: null,
            status: "none",
            startsAt: null,
            endsAt: new Date(),
            store: null,
            willRenew: null,
            eventType: "API_SYNC",
          });
        }
      } catch (error) {
        request.log.warn({ err: error }, "RevenueCat fetch failed, falling back to local subscription snapshot");
      }

      const [latestRow, activeTrialRow, trialEligible] = await Promise.all([
        getLatestSubscriptionRow(user.sub),
        getActiveTrialRow(user.sub),
        getTrialEligible(user.sub),
      ]);

      const rowToSend = activeTrialRow || latestRow;
      reply.send(formatCurrentResponse(rowToSend, activeTrialRow ? false : trialEligible));
    } catch (e) {
      if (e.message === "NO_AUTH" || e.message === "BAD_TOKEN") {
        return reply.code(401).send({ error: "Neautorizat" });
      }
      request.log.error(e);
      reply.code(500).send({ error: "Eroare server" });
    }
  });

  app.post("/api/subscriptions/sync", async (request, reply) => {
    try {
      const user = requireAuth(request);
      const userRow = await getUserById(user.sub);
      if (!userRow) {
        return reply.code(401).send({ error: "Neautorizat", code: "USER_NOT_FOUND" });
      }

      const {
        status = "none",
        productId = null,
        startsAt = null,
        endsAt = null,
        store = null,
        willRenew = null,
        entitlementId = PRO_ENTITLEMENT_ID,
        appUserId = null,
      } = request.body || {};

      await persistRevenueCatSnapshot({
        userId: user.sub,
        appUserId: appUserId || String(user.sub),
        entitlementId,
        productId,
        status,
        startsAt,
        endsAt,
        store,
        willRenew,
        eventType: "APP_SYNC",
      });

      const [latestRow, activeTrialRow, trialEligible] = await Promise.all([
        getLatestSubscriptionRow(user.sub),
        getActiveTrialRow(user.sub),
        getTrialEligible(user.sub),
      ]);

      const rowToSend = activeTrialRow || latestRow;
      reply.send(formatCurrentResponse(rowToSend, activeTrialRow ? false : trialEligible));
    } catch (e) {
      if (e.message === "NO_AUTH" || e.message === "BAD_TOKEN") {
        return reply.code(401).send({ error: "Neautorizat" });
      }
      request.log.error(e);
      reply.code(500).send({ error: "Eroare server" });
    }
  });

  app.get("/api/subscriptions/history", async (request, reply) => {
    try {
      const user = requireAuth(request);
      const [rows] = await mysqlPool.query(
        `SELECT
          id,
          type,
          starts_at,
          ends_at,
          revenuecat_product_id,
          revenuecat_store,
          revenuecat_entitlement_id,
          revenuecat_event_type,
          revenuecat_will_renew,
          stripe_subscription_id,
          stripe_price_id,
          created_at,
          updated_at
         FROM subscriptions
         WHERE user_id = ?
         ORDER BY starts_at DESC, id DESC
         LIMIT 50`,
        [user.sub]
      );
      reply.send({ history: rows });
    } catch (e) {
      if (e.message === "NO_AUTH" || e.message === "BAD_TOKEN") {
        return reply.code(401).send({ error: "Neautorizat" });
      }
      request.log.error(e);
      reply.code(500).send({ error: "Eroare server" });
    }
  });

  // Standalone free trial endpoint (not bound to RevenueCat).
  app.post("/api/subscriptions/start-trial", async (request, reply) => {
    try {
      const user = requireAuth(request);
      const userRow = await getUserById(user.sub);
      if (!userRow) {
        return reply.code(401).send({ error: "Neautorizat", code: "USER_NOT_FOUND" });
      }

      const activeTrial = await getActiveTrialRow(user.sub);
      if (activeTrial) {
        return reply.send({ subscription: activeTrial, status: "active", trialEligible: false, note: "TRIAL_ALREADY_ACTIVE" });
      }

      const [activePaidRows] = await mysqlPool.query(
        `SELECT id
         FROM subscriptions
         WHERE user_id = ?
           AND type IN ('basic','premium','vip')
           AND (ends_at IS NULL OR ends_at > NOW())
         LIMIT 1`,
        [user.sub]
      );

      if (Array.isArray(activePaidRows) && activePaidRows.length) {
        return reply.code(409).send({
          error: "Ai deja un abonament activ.",
          code: "PAID_SUBSCRIPTION_ALREADY_ACTIVE",
        });
      }

      const [pastTrialRows] = await mysqlPool.query(
        `SELECT id FROM subscriptions WHERE user_id = ? AND type = 'trial' LIMIT 1`,
        [user.sub]
      );
      if (Array.isArray(pastTrialRows) && pastTrialRows.length) {
        return reply.code(400).send({
          error: "Trial-ul gratuit este disponibil o singura data.",
          code: "TRIAL_NOT_ELIGIBLE",
        });
      }

      await mysqlPool.query(
        `INSERT INTO subscriptions (
          user_id,
          type,
          starts_at,
          ends_at,
          revenuecat_event_type
        ) VALUES (?, 'trial', NOW(), DATE_ADD(NOW(), INTERVAL 3 DAY), 'TRIAL_START')`,
        [user.sub]
      );

      const createdTrial = await getActiveTrialRow(user.sub);
      reply.send({ subscription: createdTrial, status: "active", trialEligible: false, note: "TRIAL_STARTED" });
    } catch (e) {
      if (e.message === "NO_AUTH" || e.message === "BAD_TOKEN") {
        return reply.code(401).send({ error: "Neautorizat" });
      }
      request.log.error(e);
      reply.code(500).send({ error: "Eroare server" });
    }
  });

  app.post("/api/subscriptions/create-checkout", async (_request, reply) => {
    return reply.code(410).send({
      error: "Checkout-ul Stripe este dezactivat. Folosește RevenueCat purchases în aplicație.",
      code: "REVENUECAT_MANAGED",
    });
  });

  app.post("/api/subscriptions/create-payment-sheet", async (_request, reply) => {
    return reply.code(410).send({
      error: "PaymentSheet Stripe este dezactivat. Folosește RevenueCat purchases în aplicație.",
      code: "REVENUECAT_MANAGED",
    });
  });

  // RevenueCat webhook endpoint.
  app.post("/api/subscriptions/webhook", async (request, reply) => {
    try {
      const expectedToken = process.env.REVENUECAT_WEBHOOK_AUTH || "";
      if (expectedToken) {
        const provided = getWebhookToken(request);
        if (!provided || provided !== expectedToken) {
          return reply.code(401).send({ error: "Unauthorized webhook" });
        }
      }

      const event = request.body?.event || request.body || {};
      const eventType = String(event?.type || "").toUpperCase();
      const appUserId = String(event?.app_user_id || "").trim();
      const productId = event?.product_id || null;
      const entitlementIds = Array.isArray(event?.entitlement_ids) ? event.entitlement_ids : [];
      const entitlementId = entitlementIds[0] || PRO_ENTITLEMENT_ID;
      const store = event?.store || null;

      if (!appUserId) {
        return reply.code(400).send({ error: "Missing app_user_id" });
      }

      const userId = Number(appUserId);
      if (!Number.isFinite(userId) || userId <= 0) {
        // We identify users by numeric appUserID (user.id). Ignore other aliases safely.
        return reply.send({ received: true, ignored: true, reason: "NON_NUMERIC_APP_USER_ID" });
      }

      const userRow = await getUserById(userId);
      if (!userRow) {
        return reply.send({ received: true, ignored: true, reason: "USER_NOT_FOUND" });
      }

      let status = "none";
      if (ACTIVE_EVENT_TYPES.has(eventType)) status = "active";
      if (INACTIVE_EVENT_TYPES.has(eventType)) status = "expired";
      if (eventType === "BILLING_ISSUE") status = "active";

      const startsAt =
        parseMillisOrDate(event?.purchased_at_ms) ||
        parseMillisOrDate(event?.purchased_at) ||
        parseMillisOrDate(event?.event_timestamp_ms) ||
        new Date();
      const endsAt =
        parseMillisOrDate(event?.expiration_at_ms) ||
        parseMillisOrDate(event?.expiration_at) ||
        null;

      await persistRevenueCatSnapshot({
        userId,
        appUserId,
        entitlementId,
        productId,
        status,
        startsAt,
        endsAt,
        store,
        willRenew: status === "active" ? true : false,
        eventType: eventType || "WEBHOOK",
      });

      reply.send({ received: true });
    } catch (err) {
      request.log.error({ err }, "RevenueCat webhook handling failed");
      reply.code(500).send({ error: "Webhook processing error" });
    }
  });
}
