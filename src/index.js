import "dotenv/config";
import Fastify from "fastify";
import fastifyCors from "@fastify/cors";
import fastifyCompress from "@fastify/compress";
import fastifyRawBody from "fastify-raw-body";
import fastifyMultipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import websocket from "@fastify/websocket";
import { auth } from "./auth.js";
import { mysqlPool, testDbConnection } from "./mysql.js";
import { registerProgressRoutes } from "./routes-progress.js";
import { registerQuestionRoutes } from "./routes-questions.js";
import { registerMeetingRoutes } from "./routes-meetings.js";
import { registerChallengeRoutes } from "./routes-challenges.js";
import { registerMediaRoutes } from "./routes-media.js";
import { registerSubscriptionRoutes } from "./routes-subscriptions.js";
import { registerVideoRoutes } from "./routes-videos.js";
import { registerWebinarRoutes } from "./routes-webinars.js";
import { registerNotificationRoutes } from "./routes-notifications.js";
import { registerChatRoutes } from "./chat/routes.js";
import { runMigrations } from "./migrate.js";
import { registerAuthRoutes } from "./routes-auth.js";
import { registerAdminRoutes } from "./routes-admin.js";
import { registerAdminCmsRoutes } from "./routes-admin-cms.js";
import { registerCmsRoutes } from "./routes-cms.js";
import { registerProfileRoutes } from "./routes-profile.js";
import { scheduleChatUnreadNotifications } from "./chat-notifications.js";

const logLevel = process.env.LOG_LEVEL || "info";
const app = Fastify({ logger: { level: logLevel }, bodyLimit: 5 * 1024 * 1024 }); // 5MB max body
let isShuttingDown = false;
let isReady = false;

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

// Rate limiting — global default + stricter on auth routes
await app.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute',
  keyGenerator: (request) => request.ip,
});

// Stricter rate limits on authentication endpoints
app.after(() => {
  const authRateLimit = { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } };
  app.addHook('onRoute', (routeOptions) => {
    const authPaths = ['/api/custom-auth/login', '/api/custom-auth/register', '/api/custom-auth/oauth/google', '/api/custom-auth/oauth/apple', '/api/admin/login'];
    if (authPaths.includes(routeOptions.url) && routeOptions.method === 'POST') {
      routeOptions.config = { ...routeOptions.config, rateLimit: { max: 10, timeWindow: '1 minute' } };
    }
  });
});

const configuredClientOrigins = (
  process.env.CORE_CLIENT_ORIGINS ||
  process.env.CLIENT_ORIGINS ||
  process.env.CORE_CLIENT_ORIGIN ||
  process.env.CLIENT_ORIGIN ||
  "http://localhost:19006"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const baseCorsOptions = {
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "X-Admin-Token"],
  exposedHeaders: ["X-RateLimit-Limit", "X-RateLimit-Remaining"],
  credentials: true,
  maxAge: 86400,
};

await app.register(fastifyCors, {
  // Use a request-aware delegator so websocket route checks can be handled explicitly.
  delegator: (req, cb) => {
    const reqOrigin = req.headers?.origin;
    const reqUrl = String(req.url || '');
    const isChatWebSocketRoute = reqUrl.startsWith('/chat/connect');

    if (isChatWebSocketRoute) {
      // Chat websocket auth is enforced by route preValidation + JWT/subscription checks.
      return cb(null, { ...baseCorsOptions, origin: true });
    }

    if (!reqOrigin) {
      // Native apps/Postman often send no Origin; allow them.
      return cb(null, { ...baseCorsOptions, origin: true });
    }

    if (configuredClientOrigins.includes(reqOrigin)) {
      return cb(null, { ...baseCorsOptions, origin: true });
    }

    return cb(new Error("CORS origin not allowed"));
  },
});

const compressionThreshold = Number(process.env.COMPRESS_THRESHOLD_BYTES || 1024);
await app.register(fastifyCompress, {
  global: true,
  threshold: Number.isFinite(compressionThreshold) && compressionThreshold >= 0 ? compressionThreshold : 1024,
});

await app.register(fastifyMultipart, {
  limits: { fileSize: 2 * 1024 * 1024 * 1024 }, // 2GB max file size
});

await app.register(websocket);

// Health check
app.get("/health", async () => ({ ok: true, shuttingDown: isShuttingDown }));

// Readiness check for orchestrators
app.get("/health/ready", async (_request, reply) => {
  if (!isReady || isShuttingDown) {
    return reply.code(503).send({ ok: false, ready: false, shuttingDown: isShuttingDown });
  }
  return { ok: true, ready: true };
});

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
await registerProfileRoutes(app);
await registerProgressRoutes(app);
await registerQuestionRoutes(app);
await registerMeetingRoutes(app);
await registerChallengeRoutes(app);

const enableNodeMediaStreamingRaw = process.env.ENABLE_NODE_MEDIA_STREAMING;
const enableNodeMediaStreaming =
  (typeof enableNodeMediaStreamingRaw === "string" && enableNodeMediaStreamingRaw.toLowerCase() === "true") ||
  (enableNodeMediaStreamingRaw === undefined && process.env.NODE_ENV !== "production");

if (enableNodeMediaStreaming) {
  await registerMediaRoutes(app);
  app.log.info("Node media byte serving enabled");
} else {
  app.log.info("Node media byte serving disabled; expecting Nginx to serve /api/media/*");
}

await registerSubscriptionRoutes(app);
await registerVideoRoutes(app);
await registerWebinarRoutes(app);
await registerNotificationRoutes(app);
await registerChatRoutes(app);
await registerAdminRoutes(app);
await registerCmsRoutes(app);
await registerAdminCmsRoutes(app);

// Start background task for chat unread notifications (every 6 hours)
scheduleChatUnreadNotifications({ log: app.log });

async function shutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  app.log.warn({ signal }, "Shutdown signal received");
  try {
    await app.close();
  } catch (err) {
    app.log.error({ err }, "Failed to close Fastify app cleanly");
  }
  try {
    await mysqlPool.end();
  } catch (err) {
    app.log.error({ err }, "Failed to close MySQL pool cleanly");
  }
  process.exit(0);
}

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

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
    isReady = true;
  } catch (e) {
    app.log.error({ err: e }, "DB migrations failed");
    isReady = false;
  }
  app.log.info(`Auth server running on port ${port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
