import assert from "node:assert/strict";
import test from "node:test";

import {
  constantTimeCompare,
  createWebhookDeduper,
  getWebhookAuthToken,
  getWebhookEventKey,
} from "../src/webhook-security.js";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test("constantTimeCompare returns true for equal strings and false otherwise", () => {
  assert.equal(constantTimeCompare("abc", "abc"), true);
  assert.equal(constantTimeCompare("abc", "abd"), false);
});

test("getWebhookAuthToken supports Bearer token and x-revenuecat-auth header", () => {
  const bearerRequest = { headers: { authorization: "Bearer secret123" } };
  const xHeaderRequest = { headers: { "x-revenuecat-auth": "hook-secret" } };

  assert.equal(getWebhookAuthToken(bearerRequest), "secret123");
  assert.equal(getWebhookAuthToken(xHeaderRequest), "hook-secret");
});

test("getWebhookEventKey prefers explicit identifiers", () => {
  const event = { id: "evt_1", product_id: "dan_premium" };
  assert.equal(getWebhookEventKey(event, "RENEWAL", "12"), "id:evt_1");
});

test("getWebhookEventKey falls back to fingerprint and returns null when insufficient data", () => {
  const eventWithFingerprintData = { product_id: "dan_basic", event_timestamp_ms: 1700000000000 };
  const eventWithoutData = {};

  assert.equal(
    getWebhookEventKey(eventWithFingerprintData, "INITIAL_PURCHASE", "5"),
    "fp:INITIAL_PURCHASE:5:dan_basic:1700000000000"
  );
  assert.equal(getWebhookEventKey(eventWithoutData, "RENEWAL", "7"), null);
});

test("createWebhookDeduper marks duplicates and expires keys by ttl", async () => {
  const deduper = createWebhookDeduper({ ttlMs: 25, maxEntries: 100 });
  const key = "id:evt_test";

  assert.equal(deduper.isDuplicate(key), false);
  deduper.markProcessed(key);
  assert.equal(deduper.isDuplicate(key), true);

  await sleep(35);
  assert.equal(deduper.isDuplicate(key), false);
});

test("createWebhookDeduper evicts oldest keys when max entries is exceeded", () => {
  const deduper = createWebhookDeduper({ ttlMs: 10000, maxEntries: 100 });

  for (let i = 0; i < 101; i += 1) {
    deduper.markProcessed(`id:evt_${i}`);
  }

  assert.equal(deduper.isDuplicate("id:evt_0"), false);
  assert.equal(deduper.isDuplicate("id:evt_100"), true);
});
