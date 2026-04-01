import { createHash, timingSafeEqual } from "crypto";

export function constantTimeCompare(value, expected) {
  const hashA = createHash("sha256").update(String(value || "")).digest();
  const hashB = createHash("sha256").update(String(expected || "")).digest();
  return timingSafeEqual(hashA, hashB);
}

export function getWebhookAuthToken(request) {
  const auth = request.headers.authorization || "";
  if (auth.startsWith("Bearer ")) return auth.slice(7).trim();
  const xToken = request.headers["x-revenuecat-auth"] || request.headers["x-webhook-auth"];
  if (typeof xToken === "string") return xToken.trim();
  return auth.trim();
}

export function getWebhookEventKey(event, eventType, appUserId) {
  const explicitId = [
    event?.id,
    event?.event_id,
    event?.idempotency_key,
    event?.transaction_id,
    event?.original_transaction_id,
    event?.store_transaction_id,
  ]
    .map((value) => String(value || "").trim())
    .find(Boolean);

  if (explicitId) return `id:${explicitId}`;

  const timestamp =
    event?.event_timestamp_ms ||
    event?.purchased_at_ms ||
    event?.expiration_at_ms ||
    event?.event_timestamp ||
    "";
  const productId = String(event?.product_id || "").trim();
  if (!timestamp && !productId) return null;

  return `fp:${String(eventType || "").trim()}:${String(appUserId || "").trim()}:${productId}:${timestamp}`;
}

export function createWebhookDeduper({ ttlMs, maxEntries }) {
  const effectiveTtlMs = Math.max(0, Number(ttlMs || 0));
  const effectiveMaxEntries = Math.max(100, Number(maxEntries || 0));
  const cache = new Map();

  function isDuplicate(eventKey) {
    if (!eventKey || effectiveTtlMs <= 0) return false;
    const expiresAt = cache.get(eventKey);
    if (!expiresAt) return false;
    if (expiresAt <= Date.now()) {
      cache.delete(eventKey);
      return false;
    }
    return true;
  }

  function markProcessed(eventKey) {
    if (!eventKey || effectiveTtlMs <= 0) return;
    cache.set(eventKey, Date.now() + effectiveTtlMs);

    if (cache.size > effectiveMaxEntries) {
      for (const [key, expiresAt] of cache) {
        if (expiresAt <= Date.now()) cache.delete(key);
      }
    }

    if (cache.size > effectiveMaxEntries) {
      const oldestKey = cache.keys().next().value;
      if (oldestKey) cache.delete(oldestKey);
    }
  }

  return {
    isDuplicate,
    markProcessed,
  };
}
