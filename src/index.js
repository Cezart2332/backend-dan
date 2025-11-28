import "dotenv/config";
import Fastify from "fastify";
import fastifyCors from "@fastify/cors";
import fastifyRawBody from "fastify-raw-body";
import { auth } from "./auth.js";
import { mysqlPool, testDbConnection } from "./mysql.js";
import { registerProgressRoutes } from "./routes-progress.js";
import { registerQuestionRoutes } from "./routes-questions.js";
import { registerChallengeRoutes } from "./routes-challenges.js";
import { registerMediaRoutes } from "./routes-media.js";
import { registerSubscriptionRoutes } from "./routes-subscriptions.js";
import { runMigrations } from "./migrate.js";
import { registerAuthRoutes } from "./routes-auth.js";

const app = Fastify({ logger: true });

// Allow empty JSON bodies (treat as {}) instead of throwing parser errors
app.removeContentTypeParser("application/json");
app.addContentTypeParser(/^application\/json($|;)/, { parseAs: "string" }, (request, body, done) => {
  if (!body || body.trim().length === 0) {
    return done(null, {});
  }
  try {
    const json = JSON.parse(body);
    done(null, json);
  } catch (err) {
    err.statusCode = 400;
    done(err, undefined);
  }
});

// Register raw body plugin (needed for Stripe webhook signature verification)
await app.register(fastifyRawBody, {
  field: 'rawBody',      // request.rawBody
  global: false,         // only enabled per-route via config.rawBody
  encoding: 'utf8',
  runFirst: true,        // parse before any other body parsers
});


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

// DB health check (simple status only - no sensitive info)
app.get("/health/db", async (request, reply) => {
  try {
    await mysqlPool.query("SELECT 1");
    return { ok: true };
  } catch (err) {
    request.log.error({ err }, "DB health check failed");
    reply.status(500).send({ ok: false, error: "Database connection failed" });
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
await registerQuestionRoutes(app);
await registerChallengeRoutes(app);
await registerMediaRoutes(app);
await registerSubscriptionRoutes(app);

const port = Number(process.env.CORE_PORT || process.env.PORT || 3000);
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
  app.log.info(`Auth server running on port ${port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
