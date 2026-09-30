import test from "node:test";
import assert from "node:assert/strict";
import { analyticsPeriod, fillSeries } from "../src/analytics.js";
import {
  normalizeRevenueEvent,
  normalizeExportRow,
  exportLifecycle,
  productPlan,
} from "../src/revenue-ledger.js";

const event = {
  id: "e1",
  type: "INITIAL_PURCHASE",
  event_timestamp_ms: Date.parse("2026-09-10T12:00:00Z"),
  transaction_id: "tx1",
  product_id: "dan_basic",
  store: "APP_STORE",
  environment: "PRODUCTION",
  currency: "RON",
  price: 10,
  price_in_purchased_currency: 45,
};
const exported = {
  store_transaction_id: "tx1",
  product_identifier: "dan_basic",
  store: "app_store",
  start_time: "2026-09-10 12:00:00",
  updated_at: "2026-09-12 12:00:00",
  is_sandbox: "false",
  is_trial_period: "false",
  purchased_currency: "RON",
  purchase_price_in_usd: "10",
  price_in_usd: "8",
  purchase_price_in_purchased_currency: "45",
  price_in_purchased_currency: "36",
  refunded_at: "2026-09-12 12:00:00",
  renewal_number: "1",
};
test("period boundaries include the entire last day and compare equal intervals", () => {
  const p = analyticsPeriod(
    { from: "2024-02-01", to: "2024-02-29" },
    new Date("2026-09-30"),
  );
  assert.equal(p.to.toISOString(), "2024-03-01T00:00:00.000Z");
  assert.equal((+p.to - +p.from) / 86400000, 29);
  assert.equal(+p.from - +p.previousFrom, +p.to - +p.from);
  for (const query of [
    { from: "2026-02-29" },
    { from: "2026-09-30", to: "2026-09-01" },
    { from: "2020-01-01", to: "2026-09-30" },
    { group: "hour" },
    { currency: "USD;DROP" },
    { to: "2027-01-01" },
  ])
    assert.throws(() => analyticsPeriod(query, new Date("2026-09-30")));
});
test("daily and monthly series include empty buckets without inventing activity", () => {
  const p = analyticsPeriod(
    { from: "2026-07-15", to: "2026-09-30", group: "month" },
    new Date("2026-09-30"),
  );
  assert.deepEqual(
    fillSeries([{ bucket: "2026-08", net: "2.35" }], p, ["net"]),
    [
      { bucket: "2026-07", net: 0 },
      { bucket: "2026-08", net: 2.35 },
      { bucket: "2026-09", net: 0 },
    ],
  );
});
test("annual comparison uses the same interval in the previous year and clamps leap days", () => {
  const p = analyticsPeriod(
    { from: "2026-01-01", to: "2026-09-30", compare: "year" },
    new Date("2026-09-30"),
  );
  assert.equal(p.previousFrom.toISOString(), "2025-01-01T00:00:00.000Z");
  assert.equal(p.previousTo.toISOString(), "2025-10-01T00:00:00.000Z");
  assert.equal(
    analyticsPeriod(
      { from: "2024-02-29", to: "2024-02-29", compare: "year" },
      new Date("2026-09-30"),
    ).previousFrom.toISOString(),
    "2023-02-28T00:00:00.000Z",
  );
});
test("webhooks distinguish trials, refunds, cancellations, missing prices and plans", () => {
  assert.equal(productPlan("dan_pro:monthly"), "pro");
  assert.equal(productPlan("dan_vip"), "vip");
  assert.equal(
    normalizeRevenueEvent({ ...event, period_type: "TRIAL" }).entries.length,
    0,
  );
  assert.equal(
    normalizeRevenueEvent({ ...event, is_family_share: true }).entries.length,
    0,
  );
  assert.equal(
    normalizeRevenueEvent({
      ...event,
      type: "CANCELLATION",
      cancel_reason: "UNSUBSCRIBE",
    }).entries.length,
    0,
  );
  const refund = normalizeRevenueEvent({
    ...event,
    type: "CANCELLATION",
    cancel_reason: "CUSTOMER_SUPPORT",
    price: -10,
  });
  assert.equal(refund.entries[0].usd, 10);
  assert.equal(refund.entries[0].kind, "refund");
  assert.equal(
    normalizeRevenueEvent({ ...event, type: "REFUND_REVERSED" }).entries[0].usd,
    0,
  );
  assert.equal(
    normalizeRevenueEvent({
      ...event,
      price: null,
      price_in_purchased_currency: null,
    }).entries[0].usd,
    null,
  );
  assert.equal(normalizeRevenueEvent({ ...event, type: "TEST" }), null);
});
test("official export shares webhook keys, accounts for partial refunds, and validates mandatory columns", () => {
  const rows = normalizeExportRow(exported);
  assert.equal(rows[0].key, normalizeRevenueEvent(event).entries[0].key);
  assert.equal(rows[0].usd, 10);
  assert.equal(rows[1].usd, 2);
  assert.equal(rows[1].native, 9);
  assert.equal(exportLifecycle(exported)[0].type, "INITIAL_PURCHASE");
  assert.equal(
    exportLifecycle({ ...exported, renewal_number: "2" })[0].type,
    "RENEWAL",
  );
  assert.throws(() =>
    normalizeExportRow({ ...exported, is_sandbox: undefined }),
  );
  assert.throws(() =>
    normalizeExportRow({
      ...exported,
      purchase_price_in_usd: null,
      purchase_price_in_purchased_currency: null,
    }),
  );
  assert.equal(
    normalizeExportRow({ ...exported, is_trial_period: "true" }).length,
    0,
  );
});
test("Stripe subscription transaction identifiers remain unique across renewals and export/import", () => {
  const first = normalizeRevenueEvent({
    ...event,
    store: "STRIPE",
    renewal_number: 1,
  }).entries[0];
  const renewal = normalizeRevenueEvent({
    ...event,
    store: "STRIPE",
    renewal_number: 2,
  }).entries[0];
  assert.notEqual(first.key, renewal.key);
  assert.equal(
    renewal.key,
    normalizeExportRow({ ...exported, store: "stripe", renewal_number: "2" })[0]
      .key,
  );
});
