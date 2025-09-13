import "dotenv/config";
import Fastify from "fastify";
import { sql } from "kysely";
import fastifyCors from "@fastify/cors";
import { auth } from "./auth.js";
import { db, testDbConnection, effectiveDbConfig } from "./mysql.js";
import net from "node:net";
import { runMigrations } from "./migrate.js";
import { registerAuthRoutes } from "./routes-auth.js";

const app = Fastify({ logger: true, ignoreTrailingSlash: true });

await app.register(fastifyCors, {
  // Allow native apps (no Origin header) and a whitelist of web origins
  origin: (origin, cb) => {
    const allowAll = (
      process.env.CORE_CORS_ALLOW_ALL ||
      process.env.CORS_ALLOW_ALL ||
      "false"
    )
      .toString()
      .toLowerCase();

    // Support comma-separated CLIENT_ORIGINS or fallback to single CLIENT_ORIGIN or dev default
    const configured = (
      process.env.CORE_CLIENT_ORIGINS ||
      process.env.CLIENT_ORIGINS ||
      process.env.CORE_CLIENT_ORIGIN ||
      process.env.CLIENT_ORIGIN ||
      "http://localhost:19006"
    )
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    // Support wildcard domain patterns like *.sslip.io (scheme-specific)
    const wildcards = configured.filter((o) => o.includes("*"));
    const exacts = configured.filter((o) => !o.includes("*"));

    if (!origin) {
      // Native apps/Postman often send no Origin; allow them
      return cb(null, true);
    }
    if (allowAll === "true" || allowAll === "1") {
      return cb(null, true);
    }
    if (exacts.includes(origin)) return cb(null, true);
    try {
      const u = new URL(origin);
      const host = u.hostname;
      const scheme = u.protocol.replace(":", ""); // http or https
      const match = wildcards.some((pat) => {
        // pat may look like http://*.sslip.io or https://*.example.com
        try {
          const pu = new URL(pat);
          const pScheme = pu.protocol.replace(":", "");
          if (pScheme && pScheme !== scheme) return false;
          const pHost = pu.hostname; // e.g., *.sslip.io
          if (!pHost.includes("*")) return false;
          const suffix = pHost.replace(/^\*\./, "");
          return host === suffix || host.endsWith("." + suffix);
        } catch (_) {
          return false;
        }
      });
      if (match) return cb(null, true);
    } catch (_) {
      // fallthrough to deny
    }
    return cb(new Error("CORS origin not allowed"), false);
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  credentials: true,
  maxAge: 86400,
});

// Health check
app.get("/health", async () => ({ ok: true }));

// Raw TCP socket check to DB host:port
app.get("/health/db/socket", async (request, reply) => {
  const host = effectiveDbConfig.host;
  const port = effectiveDbConfig.port || 3306;
  const timeoutMs = Number(process.env.HEALTH_DB_SOCKET_TIMEOUT || 1500);
  const start = Date.now();
  const result = await new Promise((resolve) => {
    const socket = new net.Socket();
    let timedOut = false;
    const onDone = (ok, err) => {
      try { socket.destroy(); } catch {}
      const ms = Date.now() - start;
      resolve({ ok, host, port, ms, error: err ? (err.message || String(err)) : undefined });
    };
    socket.setTimeout(timeoutMs);
    socket.once("timeout", () => { timedOut = true; onDone(false, new Error("TCP timeout")); });
    socket.once("error", (err) => onDone(false, err));
    socket.connect(port, host, () => onDone(true));
  });
  if (!result.ok) return reply.code(500).send(result);
  return result;
});

// Lightweight DB ping (fast SELECT 1)
app.get("/health/db/ping", async (request, reply) => {
  const qp = request.query || {};
  const routeTimeoutMs = Number(qp.timeout || qp.t || process.env.HEALTH_DB_PING_TIMEOUT || 6000);
  let timeoutId;
  const withTimeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error("DB ping timed out")), routeTimeoutMs);
  });
  async function ping() {
    await sql`SELECT 1`.execute(db);
    return { ok: true };
  }
  try {
    const res = await Promise.race([ping(), withTimeout]);
    if (timeoutId) clearTimeout(timeoutId);
    return res;
  } catch (err) {
    request.log.error({ err, db: effectiveDbConfig }, "DB ping failed");
    reply.status(500).send({ ok: false, error: err?.message || String(err) });
  }
});

// DB health to inspect current database and tables (always enabled)
app.get("/health/db", async (request, reply) => {
  // Per-request timeout safeguard so the route never hangs indefinitely
  const routeTimeoutMs = Number(process.env.HEALTH_DB_TIMEOUT || 5000);

  async function checkDb() {
    const dbNameRes = await sql`SELECT DATABASE() as dbname`.execute(db);
    const dbName = dbNameRes.rows?.[0]?.dbname || null;
    const tablesRes = await sql`SHOW TABLES`.execute(db);
    const tables = (tablesRes.rows || []).map((row) => Object.values(row)[0]);
    return { ok: true, database: dbName, tables };
  }

  let timeoutId;
  const withTimeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error("DB health check timed out")), routeTimeoutMs);
  });

  try {
    const result = await Promise.race([checkDb(), withTimeout]);
    if (timeoutId) clearTimeout(timeoutId);
    return result;
  } catch (err) {
    request.log.error({ err, db: effectiveDbConfig }, "DB health check failed");
    reply.status(500).send({ ok: false, error: err?.message || String(err) });
  }
});

// Optional debug route to inspect sanitized DB config (no secrets)
const __enableDebugRoutes = (
  process.env.CORE_DEBUG_ROUTES || process.env.DEBUG_ROUTES || "true"
)
  .toString()
  .toLowerCase() === "true";

if (__enableDebugRoutes) {
  app.get("/__debug/db-config", async () => ({ ok: true, db: effectiveDbConfig }));
}

// Better Auth handler catch-all
app.route({
  method: ["GET", "POST"],
  url: "/api/auth/*",
  async handler(request, reply) {
    try {
      const url = new URL(request.url, `http://${request.headers.host}`);
      const headers = new Headers();
      Object.entries(request.headers).forEach(([key, value]) => {
        if (value) headers.append(key, value.toString());
      });
      const req = new Request(url.toString(), {
        method: request.method,
        headers,
        body: request.body ? JSON.stringify(request.body) : undefined,
      });
      const response = await auth.handler(req);
      reply.status(response.status);
      response.headers.forEach((value, key) => reply.header(key, value));
      reply.send(response.body ? await response.text() : null);
    } catch (err) {
      request.log.error({ err }, "Authentication Error");
      reply.status(500).send({ error: "Internal authentication error", code: "AUTH_FAILURE" });
    }
  },
});

// Register custom endpoints (email/password + social helpers)
await registerAuthRoutes(app);

const port = Number(process.env.CORE_PORT || process.env.PORT || 4000);
try {
  await app.listen({ port, host: "0.0.0.0" });
  // Try DB connection on startup (non-fatal for server start, but will log errors)
  try {
    app.log.info({ db: effectiveDbConfig }, "Effective DB config");
    await testDbConnection();
  } catch (e) {
    app.log.error({ err: e }, "DB connection test failed");
  }
  try {
    await runMigrations();
  } catch (e) {
    app.log.error({ err: e }, "DB migrations failed");
  }
  console.log(`Auth server running on http://localhost:${port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
