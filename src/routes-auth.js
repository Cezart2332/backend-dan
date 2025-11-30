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

// Middleware to verify JWT token
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
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

  // Delete account endpoint
  app.delete("/api/custom-auth/account", async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return reply.code(401).send({ error: "Token necesar" });
    }
    const token = authHeader.split(" ")[1];
    const decoded = verifyToken(token);
    if (!decoded || !decoded.sub) {
      return reply.code(401).send({ error: "Token invalid" });
    }
    const userId = decoded.sub;

    try {
      // Delete user's related data first (due to foreign key constraints)
      await mysqlPool.query("DELETE FROM user_questions WHERE user_id = ?", [userId]);
      await mysqlPool.query("DELETE FROM user_challenge_progress WHERE user_id = ?", [userId]);
      await mysqlPool.query("DELETE FROM user_challenge_completions WHERE user_id = ?", [userId]);
      await mysqlPool.query("DELETE FROM progress_entries WHERE user_id = ?", [userId]);
      await mysqlPool.query("DELETE FROM subscriptions WHERE user_id = ?", [userId]);
      
      // Finally delete the user
      const [result] = await mysqlPool.query("DELETE FROM users WHERE id = ?", [userId]);
      
      if (result.affectedRows === 0) {
        return reply.code(404).send({ error: "Utilizator negăsit" });
      }
      
      return reply.send({ success: true, message: "Cont șters cu succes" });
    } catch (error) {
      return reply.code(500).send({ error: "Eroare la ștergerea contului" });
    }
  });

  // Bug report endpoint
  app.post("/api/bug-report", async (request, reply) => {
    const { description, contactEmail } = request.body || {};
    
    if (!description || !description.trim()) {
      return reply.code(400).send({ error: "Descrierea este necesară" });
    }

    // Get user info from token if available
    let userId = null;
    let userEmail = null;
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      const decoded = verifyToken(token);
      if (decoded) {
        userId = decoded.sub;
        userEmail = decoded.email;
      }
    }

    try {
      // Create bug_reports table if it doesn't exist
      await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS bug_reports (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NULL,
          user_email VARCHAR(255) NULL,
          contact_email VARCHAR(255) NULL,
          description TEXT NOT NULL,
          status ENUM('new', 'in_progress', 'resolved', 'closed') DEFAULT 'new',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
        )
      `);

      await mysqlPool.query(
        "INSERT INTO bug_reports (user_id, user_email, contact_email, description) VALUES (?, ?, ?, ?)",
        [userId, userEmail, contactEmail || null, description.trim()]
      );

      return reply.send({ success: true, message: "Raport trimis cu succes" });
    } catch (error) {
      return reply.code(500).send({ error: "Eroare la trimiterea raportului" });
    }
  });
}
