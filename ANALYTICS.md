# Dashboard analytics

## Rollout

Deploy this backend before the panel and mobile build. Startup runs additive migrations for the revenue ledger, daily activity, challenge attempts and subscription period type. Existing API routes remain available. MySQL connections and reporting use UTC.

Set `REVENUECAT_WEBHOOK_AUTH` in the backend environment and configure the same secret as the Authorization header of the RevenueCat webhook targeting `/api/subscriptions/webhook`. Both the plain secret and `Bearer <secret>` are accepted. Missing configuration returns 503; incorrect authorization returns 401. Never put this secret in the mobile app or panel build.

The webhook stores normalized production/sandbox events and financial transactions. Only production lifecycle events update subscription access. Retried events apply their subscription snapshot once, per-user updates serialize in a transaction, and older events cannot revoke newer access. Cancelling renewal keeps access until its known expiry. Native RevenueCat trials remain trials.

## API

Admin routes use the existing `X-Admin-Token` authentication:

- `GET /api/admin/analytics?from=YYYY-MM-DD&to=YYYY-MM-DD&group=day|month&currency=USD&compare=previous|year`
- `GET /api/admin/subscriptions?page=1&limit=25&plan=basic|premium|pro|vip&search=...`
- `POST /api/admin/analytics/import` with JSON `{ "csv": "..." }`.

Dates include the entire final UTC day. Maximum range is 1096 days; future ranges are rejected. Year comparison uses the same dates in the previous year, with leap-day clamping. Active subscriptions are a **current** snapshot, one paid plan per account, excluding trials and future/expired rows; they do not represent a historical count for the selected period.

Authenticated mobile routes derive the owner from JWT:

- `POST /api/activity/visit`: `{ day, platform }`, one UTC day per account, up to 90 days old.
- `POST /api/activity/challenge`: `{ clientId, challengeId, startedAt, completedAt? }`, stable UUID v4, monotonic completion and conflict detection.

The phone saves these events before upload and retries at startup, foreground and reconnection. Logout preserves unsent events for the same account; account deletion removes its activity. Anonymous financial totals are retained with `user_id = NULL` after deletion.

## Historical revenues

In the panel's Venituri tab, import the official RevenueCat **Transactions** CSV (not the Virtual Currency feed). Maximum: 4 MB, 10,000 rows per import. Imports validate all rows before an atomic transaction and can be repeated without duplicating sales. They do not grant or revoke access.

Required columns: `store_transaction_id`, `start_time`, `product_identifier`, `store`, explicit `is_sandbox` and `is_trial_period`. Prices use `purchase_price_in_usd` / `purchase_price_in_purchased_currency` for gross and `price_in_usd` / `price_in_purchased_currency` for amounts after refunds. Optional fields include `purchased_currency`, `updated_at`, `refunded_at`, `renewal_number`, `is_trial_conversion`, `unsubscribe_detected_at`, and numeric account aliases. Stripe exports require `renewal_number` because subscription transaction identifiers repeat across renewals. Refunded rows need original gross prices; absent prices remain unknown and trigger a coverage warning.

USD aggregates use RevenueCat's USD values across stores/currencies. Selecting RON or another purchased currency includes only matching transactions; the backend never invents an exchange rate. Revenue is gross sales minus known refunds, **before store commissions and taxes**, not the bank payout. Refunds represent the latest known adjustment per store transaction, including reversals, rather than a full cash-movement ledger. Free trials, promotional grants, family shares and sandbox payments are excluded from revenue.

First payments and trial conversion use known transaction history. Renewal/unsubscribe summaries can be backfilled from exports; expiration counts require native lifecycle webhooks. The dashboard shows recording coverage. Import all available history before interpreting first-payment totals or comparisons.

## Activity definitions

Video consumption uses existing playback activity, including video playback in audio-only mode; seeking does not count as listening. Existing challenge feedback remains visible, while start/completion rates use new UUID-based attempts. SOS techniques and optional feedback come from wellbeing sessions; no automatic text analysis occurs.

Day-7/day-30 return means a recorded visit on that exact UTC calendar day after registration. Cohorts contain accounts registered in the selected period, after activity recording began, and old enough to reach the chosen day. No eligible cohort displays `—`. This tracking starts with the new mobile build; historical visits and unrecorded challenge starts cannot be reconstructed.

Unanswered questions and open bugs are current backlogs. Response time concerns questions created in the selected period; completed meetings are grouped by scheduled date.

## Verification

Run `npm run test:analytics` for pure tests. The MySQL integration test skips unless `ANALYTICS_TEST_MYSQL_URL` points to a disposable database named `dan_analytics` on localhost/127.0.0.1; it resets fixture data in that database. It checks migrations twice, native webhook retries/order, sandbox isolation, refunds/reimport, authorization, pagination, conversion and deletion. Never point it at production.

Reference: [RevenueCat webhook fields](https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields), [scheduled exports](https://www.revenuecat.com/docs/integrations/scheduled-data-exports).
