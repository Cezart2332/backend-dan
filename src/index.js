import "dotenv/config";
import Fastify from "fastify";
import fastifyCors from "@fastify/cors";
import { auth } from "./auth.js";
import { testDbConnection } from "./mysql.js";
import { registerProgressRoutes } from "./routes-progress.js";
import { runMigrations } from "./migrate.js";
import { registerAuthRoutes } from "./routes-auth.js";

const app = Fastify({ logger: true });

await app.register(fastifyCors, {
  // Allow native apps (no Origin header) and a whitelist of web origins
  origin: (origin, cb) => {
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
    if (!origin) {
      // Native apps/Postman often send no Origin; allow them
      return cb(null, true);
    }
    if (configured.includes(origin)) return cb(null, true);
    return cb(new Error("CORS origin not allowed"), false);
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  credentials: true,
  maxAge: 86400,
});

// Health check
app.get("/health", async () => ({ ok: true }));

// DB health to inspect current database and tables (always enabled)
app.get("/health/db", async (request, reply) => {
  try {
    const dbNameRes = await sql`SELECT DATABASE() as dbname`.execute(db);
    const dbName = dbNameRes.rows?.[0]?.dbname || null;
    const tablesRes = await sql`SHOW TABLES`.execute(db);
    const tables = (tablesRes.rows || []).map((row) => Object.values(row)[0]);
    return { ok: true, database: dbName, tables };
  } catch (err) {
    request.log.error({ err }, "DB health check failed");
    reply.status(500).send({ ok: false, error: err?.message || String(err) });
  }
});

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
await registerProgressRoutes(app);

const port = Number(process.env.CORE_PORT || process.env.PORT || 4000);
try {
  await app.listen({ port, host: "0.0.0.0" });
  // Try DB connection on startup (non-fatal for server start, but will log errors)
  try {
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
