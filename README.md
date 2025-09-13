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

## Env
Create `server/.env`:
```
BETTER_AUTH_SECRET=change_me
BETTER_AUTH_URL=http://localhost:4000
CLIENT_ORIGIN=http://localhost:19006
```

## Endpoints
- `GET /health` — quick check
- `GET/POST /api/auth/*` — Better Auth handler

## Client config example
Use `better-auth/client` in your app and set baseURL to the server or same-origin.
