import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { sql } from "kysely";
import { db } from "./mysql.js";

const JWT_SECRET = process.env.JWT_SECRET || process.env.CORE_JWT_SECRET || "dev_change_me";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

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
}
