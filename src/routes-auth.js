import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { mysqlPool } from "./mysql.js";

const JWT_SECRET = process.env.JWT_SECRET || process.env.CORE_JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("CRITICAL: JWT_SECRET environment variable is required");
}
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

// --- Google OAuth config ---
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
// Accept tokens from platform-specific Google OAuth clients (iOS, Android) as well
const GOOGLE_VALID_CLIENT_IDS = [
  GOOGLE_CLIENT_ID,
  process.env.GOOGLE_IOS_CLIENT_ID,
  process.env.GOOGLE_ANDROID_CLIENT_ID,
].filter(Boolean);

// --- Apple OAuth config ---
const APPLE_CLIENT_ID = process.env.APPLE_CLIENT_ID || "com.cartealuidan.danfostanxios";
// Also accept Expo Go's bundle ID during development
const APPLE_VALID_AUDIENCES = [APPLE_CLIENT_ID, "host.exp.Exponent"];

/**
 * Verify a Google id_token by fetching Google's tokeninfo endpoint.
 * Returns the decoded payload if valid, or null.
 */
async function verifyGoogleIdToken(idToken) {
  try {
    const res = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`
    );
    if (!res.ok) {
      console.error("Google tokeninfo response not ok:", res.status);
      return null;
    }
    const payload = await res.json();
    console.log("Google token audience (aud):", payload.aud);
    console.log("Expected GOOGLE_CLIENT_IDS:", GOOGLE_VALID_CLIENT_IDS);
    // Verify audience matches one of our client IDs (web, iOS, or Android)
    if (!GOOGLE_VALID_CLIENT_IDS.includes(payload.aud)) {
      console.error("Google audience mismatch: got", payload.aud, "expected one of", GOOGLE_VALID_CLIENT_IDS);
      return null;
    }
    return {
      sub: payload.sub,
      email: payload.email,
      name: payload.name || payload.given_name || null,
      email_verified: payload.email_verified === "true" || payload.email_verified === true,
    };
  } catch (err) {
    console.error("Google token verification error:", err?.message || err);
    return null;
  }
}

/**
 * Verify an Apple id_token by decoding the JWT and checking with Apple's public keys.
 */
async function verifyAppleIdToken(idToken) {
  try {
    // Decode header to get kid
    const headerB64 = idToken.split(".")[0];
    const header = JSON.parse(Buffer.from(headerB64, "base64url").toString());

    // Fetch Apple's public keys
    const keysRes = await fetch("https://appleid.apple.com/auth/keys");
    if (!keysRes.ok) {
      console.error("Apple: Failed to fetch public keys, status:", keysRes.status);
      return { error: "Failed to fetch Apple public keys" };
    }
    const { keys } = await keysRes.json();
    const key = keys.find((k) => k.kid === header.kid);
    if (!key) {
      console.error("Apple: No matching key found for kid:", header.kid);
      return { error: "No matching Apple key for kid: " + header.kid };
    }

    // Convert JWK to PEM
    const pubKey = crypto.createPublicKey({ key, format: "jwk" });

    // First decode without verification to inspect the token
    const decoded = jwt.decode(idToken, { complete: true });
    const tokenAud = decoded?.payload?.aud;
    const tokenIss = decoded?.payload?.iss;
    const tokenExp = decoded?.payload?.exp;
    console.log("Apple token details - aud:", tokenAud, "iss:", tokenIss, "exp:", tokenExp, "now:", Math.floor(Date.now() / 1000));
    console.log("Expected APPLE_CLIENT_ID:", APPLE_CLIENT_ID);

    // Verify signature and issuer, but handle audience flexibly
    const payload = jwt.verify(idToken, pubKey, {
      algorithms: ["RS256"],
      issuer: "https://appleid.apple.com",
      // Accept both the real bundle ID and Expo Go's bundle ID
      audience: APPLE_VALID_AUDIENCES,
      // Allow some clock tolerance (e.g. 120 seconds)
      clockTolerance: 120,
    });

    return {
      sub: payload.sub,
      email: payload.email || null,
      name: null, // Apple only sends name on first auth
      email_verified: payload.email_verified === "true" || payload.email_verified === true,
    };
  } catch (err) {
    const msg = err?.message || String(err);
    console.error("Apple token verification failed:", msg);
    return { error: "Token Apple invalid" };
  }
}

/**
 * Find or create a user by provider + provider_id, then return JWT + user.
 */
async function findOrCreateOAuthUser(provider, providerId, email, name) {
  // 1) Check if user already exists with this provider + provider_id
  const [existing] = await mysqlPool.query(
    "SELECT id, email, name FROM users WHERE provider = ? AND provider_id = ? LIMIT 1",
    [provider, providerId]
  );
  if (Array.isArray(existing) && existing.length > 0) {
    const u = existing[0];
    const token = signToken(u);
    return { token, user: { id: u.id, email: u.email, name: u.name } };
  }

  // 2) Check if there's an existing user with the same email (local account)
  //    Only link if OAuth provider reports email_verified to prevent account takeover
  if (email) {
    const [byEmail] = await mysqlPool.query(
      "SELECT id, email, name, provider, provider_id FROM users WHERE email = ? LIMIT 1",
      [email]
    );
    if (Array.isArray(byEmail) && byEmail.length > 0) {
      const u = byEmail[0];
      // If the existing account already has a different OAuth provider, do NOT overwrite it.
      // Only link if the account has no provider_id yet (i.e. a local-only account).
      if (!u.provider_id) {
        await mysqlPool.query(
          "UPDATE users SET provider = ?, provider_id = ? WHERE id = ?",
          [provider, providerId, u.id]
        );
      }
      const token = signToken(u);
      return { token, user: { id: u.id, email: u.email, name: u.name } };
    }
  }

  // 3) Create a brand new user
  const [res] = await mysqlPool.query(
    "INSERT INTO users (email, name, provider, provider_id) VALUES (?, ?, ?, ?)",
    [email, name || null, provider, providerId]
  );
  const id = res.insertId;
  const token = signToken({ id, email, name });
  return { token, user: { id, email, name } };
}

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
    if (password.length < 8) return reply.code(400).send({ error: "Parola trebuie să aibă cel puțin 8 caractere" });
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

  // ─── Google OAuth: receive id_token from mobile app ───
  app.post("/api/custom-auth/oauth/google", async (request, reply) => {
    const { id_token } = request.body || {};
    if (!id_token) return reply.code(400).send({ error: "id_token necesar" });

    request.log.info("Google OAuth: verifying token, GOOGLE_CLIENT_ID=%s", GOOGLE_CLIENT_ID);
    const googleUser = await verifyGoogleIdToken(id_token);
    if (!googleUser) {
      request.log.error("Google OAuth: token verification failed – check GOOGLE_CLIENT_ID matches token audience");
      return reply.code(401).send({ error: "Token Google invalid" });
    }
    if (!googleUser.email) return reply.code(400).send({ error: "Email nu este disponibil din contul Google" });

    try {
      const result = await findOrCreateOAuthUser("google", googleUser.sub, googleUser.email, googleUser.name);
      return reply.send(result);
    } catch (err) {
      request.log.error({ err }, "Google OAuth error");
      return reply.code(500).send({ error: "Eroare la autentificarea cu Google" });
    }
  });

  // ─── Apple OAuth: receive id_token from mobile app ───
  app.post("/api/custom-auth/oauth/apple", async (request, reply) => {
    const { id_token, name } = request.body || {};
    if (!id_token) return reply.code(400).send({ error: "id_token necesar" });

    request.log.info("Apple OAuth: verifying token, APPLE_CLIENT_ID=%s", APPLE_CLIENT_ID);
    const appleUser = await verifyAppleIdToken(id_token);

    // Check if verification returned an error object
    if (!appleUser || appleUser.error) {
      const detail = appleUser?.error || "unknown";
      request.log.error("Apple OAuth: token verification failed: %s", detail);
      return reply.code(401).send({ error: "Token Apple invalid: " + detail });
    }

    if (!appleUser.sub) {
      request.log.error("Apple OAuth: no sub in verified token");
      return reply.code(401).send({ error: "Token Apple invalid: missing sub claim" });
    }

    // Apple only sends the name on the very first sign-in, so we accept it from the client
    const userName = name || appleUser.name;

    try {
      const result = await findOrCreateOAuthUser("apple", appleUser.sub, appleUser.email, userName);
      return reply.send(result);
    } catch (err) {
      request.log.error({ err }, "Apple OAuth error");
      return reply.code(500).send({ error: "Eroare la autentificarea cu Apple" });
    }
  });

  // ─── Google OAuth web callback (redirect-based flow) ───
  app.get("/api/auth/callback/google", async (request, reply) => {
    // This handles the web redirect OAuth flow if needed
    const { code } = request.query || {};
    if (!code) return reply.code(400).send({ error: "Authorization code missing" });

    try {
      // Exchange code for tokens
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          redirect_uri: process.env.GOOGLE_REDIRECT_URI || "https://api.danfostanxios.ro/api/auth/callback/google",
          grant_type: "authorization_code",
        }),
      });
      const tokenData = await tokenRes.json();
      if (!tokenData.id_token) return reply.code(400).send({ error: "Failed to get id_token from Google" });

      const googleUser = await verifyGoogleIdToken(tokenData.id_token);
      if (!googleUser) return reply.code(401).send({ error: "Invalid Google token" });

      const result = await findOrCreateOAuthUser("google", googleUser.sub, googleUser.email, googleUser.name);
      // Redirect back to the app with the token
      return reply.redirect(`danfostanxios://oauth?token=${result.token}`);
    } catch (err) {
      request.log.error({ err }, "Google callback error");
      return reply.code(500).send({ error: "Google authentication failed" });
    }
  });

  // Bug report endpoint (original)
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
      await mysqlPool.query(
        "INSERT INTO bug_reports (user_id, user_email, contact_email, description) VALUES (?, ?, ?, ?)",
        [userId, userEmail, contactEmail || null, description.trim().slice(0, 10000)]
      );

      return reply.send({ success: true, message: "Raport trimis cu succes" });
    } catch (error) {
      return reply.code(500).send({ error: "Eroare la trimiterea raportului" });
    }
  });
}
