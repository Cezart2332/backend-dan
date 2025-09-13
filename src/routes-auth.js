import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { sql } from "kysely";
import { db } from "../src/mysql.js";
import { OAuth2Client } from "google-auth-library";
import * as jose from "jose";

const JWT_SECRET = process.env.JWT_SECRET || process.env.CORE_JWT_SECRET || "dev_change_me";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

const googleClient = process.env.GOOGLE_CLIENT_ID ? new OAuth2Client(process.env.GOOGLE_CLIENT_ID) : null;

function signToken(user) {
  const payload = { sub: String(user.id), email: user.email, name: user.name };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export async function registerAuthRoutes(app) {
  app.post("/api/custom-auth/register", async (request, reply) => {
    const { email, password, name } = request.body || {};
    if (!email || !password) return reply.code(400).send({ error: "Email și parolă necesare" });
    const existing = await sql`select id from users where email = ${email} limit 1`.execute(db);
    if (existing.rows.length) return reply.code(409).send({ error: "Email deja folosit" });
    const hash = await bcrypt.hash(password, 10);
    const res = await sql`insert into users (email, password_hash, name, provider) values (${email}, ${hash}, ${name || null}, 'local')`.execute(db);
    const id = res.insertId || res[0]?.insertId; // mysql2 returns insertId
    const token = signToken({ id, email, name });
    return reply.send({ token, user: { id, email, name } });
  });

  app.post("/api/custom-auth/login", async (request, reply) => {
    const { email, password } = request.body || {};
    if (!email || !password) return reply.code(400).send({ error: "Email și parolă necesare" });
    const q = await sql`select id, email, name, password_hash from users where email = ${email} limit 1`.execute(db);
    if (!q.rows.length) return reply.code(401).send({ error: "Credențiale invalide" });
    const u = q.rows[0];
    const ok = await bcrypt.compare(password, u.password_hash || "");
    if (!ok) return reply.code(401).send({ error: "Credențiale invalide" });
    const token = signToken(u);
    return reply.send({ token, user: { id: u.id, email: u.email, name: u.name } });
  });

  app.post("/api/custom-auth/oauth/google", async (request, reply) => {
    const { id_token } = request.body || {};
    if (!googleClient) return reply.code(500).send({ error: "GOOGLE_CLIENT_ID not set" });
    if (!id_token) return reply.code(400).send({ error: "id_token missing" });
    const ticket = await googleClient.verifyIdToken({ idToken: id_token, audience: process.env.GOOGLE_CLIENT_ID });
    const payload = ticket.getPayload();
    const email = payload?.email;
    if (!email) return reply.code(400).send({ error: "Google token invalid" });
    const name = payload?.name || null;
    const providerId = payload?.sub;
    let q = await sql`select id, email, name from users where email = ${email} limit 1`.execute(db);
    let user;
    if (!q.rows.length) {
      const res = await sql`insert into users (email, name, provider, provider_id) values (${email}, ${name}, 'google', ${providerId})`.execute(db);
      const id = res.insertId || res[0]?.insertId;
      user = { id, email, name };
    } else {
      user = q.rows[0];
    }
    const token = signToken(user);
    return reply.send({ token, user });
  });

  // Facebook OAuth token verification typically requires hitting the Graph API.
  // For now, accept payload and upsert (you can harden this by verifying with FB Graph).
  app.post("/api/custom-auth/oauth/facebook", async (request, reply) => {
    const { email, name, provider_id } = request.body || {};
    if (!email) return reply.code(400).send({ error: "Email required" });
    let q = await sql`select id, email, name from users where email = ${email} limit 1`.execute(db);
    let user;
    if (!q.rows.length) {
      const res = await sql`insert into users (email, name, provider, provider_id) values (${email}, ${name || null}, 'facebook', ${provider_id || null})`.execute(db);
      const id = res.insertId || res[0]?.insertId;
      user = { id, email, name };
    } else {
      user = q.rows[0];
    }
    const token = signToken(user);
    return reply.send({ token, user });
  });

  // Apple Sign In: verify the identity token using Apple public keys (jose)
  app.post("/api/custom-auth/oauth/apple", async (request, reply) => {
    const { id_token } = request.body || {};
    if (!id_token) return reply.code(400).send({ error: "id_token missing" });
    try {
      const JWKS = jose.createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys"));
      const { payload } = await jose.jwtVerify(id_token, JWKS, {
        issuer: "https://appleid.apple.com",
        audience: process.env.APPLE_CLIENT_ID,
      });
      const email = payload?.email || null; // sometimes Apple doesn't pass email on subsequent sign-ins
      const providerId = payload?.sub;
      let user;
      if (email) {
        const q = await sql`select id, email, name from users where email = ${email} limit 1`.execute(db);
        if (!q.rows.length) {
          const res = await sql`insert into users (email, provider, provider_id) values (${email}, 'apple', ${providerId})`.execute(db);
          const id = res.insertId || res[0]?.insertId;
          user = { id, email, name: null };
        } else {
          user = q.rows[0];
        }
      } else {
        // If email missing, try match by provider_id
        const q = await sql`select id, email, name from users where provider = 'apple' and provider_id = ${providerId} limit 1`.execute(db);
        if (!q.rows.length) {
          const res = await sql`insert into users (email, provider, provider_id) values (NULL, 'apple', ${providerId})`.execute(db);
          const id = res.insertId || res[0]?.insertId;
          user = { id, email: null, name: null };
        } else {
          user = q.rows[0];
        }
      }
      const token = signToken(user);
      return reply.send({ token, user });
    } catch (e) {
      request.log.error(e, "apple_verify_error");
      return reply.code(400).send({ error: "Apple token invalid" });
    }
  });
}
