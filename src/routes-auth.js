import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { mysqlPool } from "./mysql.js";

const JWT_SECRET = process.env.JWT_SECRET || process.env.CORE_JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("CRITICAL: JWT_SECRET environment variable is required");
}
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function signToken(user) {
  const payload = { sub: String(user.id), email: user.email, name: user.name };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export async function registerAuthRoutes(app) {
  app.post("/api/custom-auth/register", async (request, reply) => {
    const { email, password, name } = request.body || {};
    if (!email || !password) return reply.code(400).send({ error: "Email și parolă necesare" });
    if (!EMAIL_REGEX.test(email)) return reply.code(400).send({ error: "Format email invalid" });
    if (password.length < 6) return reply.code(400).send({ error: "Parola trebuie să aibă cel puțin 6 caractere" });
    const [existing] = await mysqlPool.query("SELECT id FROM users WHERE email = ? LIMIT 1", [email]);
    if (Array.isArray(existing) && existing.length) return reply.code(409).send({ error: "Email deja folosit" });
    const hash = await bcrypt.hash(password, 10);
    const [res] = await mysqlPool.query(
      "INSERT INTO users (email, password_hash, name, provider) VALUES (?, ?, ?, 'local')",
      [email, hash, name || null]
    );
    const id = res.insertId;
    const token = signToken({ id, email, name });
    return reply.send({ token, user: { id, email, name } });
  });

  app.post("/api/custom-auth/login", async (request, reply) => {
    const { email, password } = request.body || {};
    if (!email || !password) return reply.code(400).send({ error: "Email și parolă necesare" });
    if (!EMAIL_REGEX.test(email)) return reply.code(400).send({ error: "Format email invalid" });
    const [rows] = await mysqlPool.query(
      "SELECT id, email, name, password_hash FROM users WHERE email = ? LIMIT 1",
      [email]
    );
    if (!Array.isArray(rows) || rows.length === 0) return reply.code(401).send({ error: "Credențiale invalide" });
    const u = rows[0];
    const ok = await bcrypt.compare(password, u.password_hash || "");
    if (!ok) return reply.code(401).send({ error: "Credențiale invalide" });
    const token = signToken(u);
    return reply.send({ token, user: { id: u.id, email: u.email, name: u.name } });
  });
}
