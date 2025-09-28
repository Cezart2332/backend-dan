# Dan Anxiety Auth Server (Fastify + Better Auth)

A minimal Fastify server providing authentication using Better Auth with SQLite.

## Prerequisites
- Node.js 18+

## Setup
1. Install deps
2. Run DB migration (optional: Better Auth manages its own schema internally; custom tables are created by our migrate script using mysql2)
3. Start server

## Scripts
- `npm run dev` — start with watch
- `npm start` — start
- `npm run migrate` — Better Auth CLI migrate (if using Better Auth's CLI-managed migrations)

## Environment Variables

Copy `.env.example` to `.env` and fill in real values (never commit the real `.env`).

Key groups:
- Auth: `BETTER_AUTH_SECRET`, `JWT_SECRET`
- Database: `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_DATABASE`, `MYSQL_USER`, `MYSQL_PASSWORD`
- Stripe: `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`
- Subscription mapping: `SUBSCRIPTION_PRICE_BASIC`, `SUBSCRIPTION_PRICE_PREMIUM`, `SUBSCRIPTION_PRICE_VIP`

Each subscription mapping var can be either:
1. A direct Stripe Price ID (e.g. `price_123`) — used as-is.
2. A Stripe Product ID (e.g. `prod_123`) — backend lazily resolves its `default_price` (or first active price) and caches it.

Diagnostic endpoint to verify resolution before attempting checkout:
`GET /api/subscriptions/prices`

Example response:
```
{
	"prices": {
		"basic": { "source": "prod_abc", "type": "product", "resolvedPriceId": "price_xyz", "ok": true, "reason": null },
		"premium": { "source": "price_def", "type": "price", "resolvedPriceId": "price_def", "ok": true, "reason": null },
		"vip": { "source": null, "type": null, "resolvedPriceId": null, "ok": false, "reason": "no env var set" }
	},
	"stripeConfigured": true
}
```

If a product returns `ok: false` with `reason: could not resolve default/active price`, ensure:
- The product has an active recurring price in Stripe.
- The price is not archived and is set to the desired billing interval.
- Consider setting the product's default price in the Stripe dashboard for faster resolution.

### Checkout Debugging
You can test plan resolution without creating a real session:
`POST /api/subscriptions/create-checkout?debug=1` with body `{ "plan": "basic" }`.
It returns the resolved price ID and mapping details.

## Endpoints
- `GET /health` — quick check
- `GET/POST /api/auth/*` — Better Auth handler

## Client config example
Use `better-auth/client` in your app and set baseURL to the server or same-origin.
