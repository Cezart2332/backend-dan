import "dotenv/config";
import Fastify from "fastify";
import fastifyCors from "@fastify/cors";
import { auth, testDbConnection } from "./auth.js";

const app = Fastify({ logger: true });

await app.register(fastifyCors, {
  origin: process.env.CLIENT_ORIGIN || "http://localhost:19006",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  credentials: true,
  maxAge: 86400,
});

// Health check
app.get("/health", async () => ({ ok: true }));

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

const port = Number(process.env.PORT || 4000);
app.listen({ port, host: "0.0.0.0" }, async (err) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
  // Try DB connection on startup (non-fatal for server start, but will log errors)
  try {
    await testDbConnection();
  } catch {}
  console.log(`Auth server running on http://localhost:${port}`);
});
