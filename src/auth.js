import { betterAuth } from "better-auth";
import { sql } from "kysely";
import { mysqlPool } from "./mysql.js";

// Build MySQL connection info (only for optional CORE key parsing); actual pool comes from mysql.js
const { DATABASE_URL, MYSQL, CORE_MYSQL } = process.env;

function parseMysqlDsn(raw) {
  if (!raw) return null;
  // Accept both ';' and newlines as separators
  const tokens = raw
    .split(/;|\r?\n/)
    .map((t) => t.trim())
    .filter(Boolean);
  const out = {};
  for (const t of tokens) {
    // Support key=value OR key:value
    const sepIndexEq = t.indexOf("=");
    const sepIndexCol = t.indexOf(":");
    let k = "";
    let v = "";
    if (sepIndexEq > -1 && (sepIndexCol === -1 || sepIndexEq < sepIndexCol)) {
      k = t.slice(0, sepIndexEq).trim();
      v = t.slice(sepIndexEq + 1).trim();
    } else if (sepIndexCol > -1) {
      k = t.slice(0, sepIndexCol).trim();
      v = t.slice(sepIndexCol + 1).trim();
    } else {
      continue;
    }
    const key = k.toLowerCase();
    out[key] = v;
  }
  // Map common aliases
  const host = out.host || out.server || out.hostname || out.mysql_host;
  const database = out.database || out.db || out.schema || out.initialcatalog || out.mysql_database;
  const user = out.user || out.username || out["user id"] || out.uid || out.mysql_user;
  const password = out.password || out.pwd || out.mysql_password;
  const port = out.port ? Number(out.port) : (out.mysql_port ? Number(out.mysql_port) : 3306);
  const sslMode = out.sslmode || out["ssl mode"]; // e.g., None, Required
  const allowPkRaw = out.allowpublickeyretrieval || out["allow public key retrieval"];
  const allowPublicKeyRetrieval =
    typeof allowPkRaw === "string" && ["true", "1", "yes"].includes(allowPkRaw.toLowerCase());
  const ssl = out.ssl || out["use ssl"];
  const useSSL = typeof ssl === "string" && ["true", "1", "yes"].includes(ssl.toLowerCase());
  return { host, database, user, password, port, sslMode, allowPublicKeyRetrieval, useSSL };
}

function resolveMysqlPoolOptions() {
  // Prefer DATABASE_URL if provided; otherwise use discrete MYSQL_* vars
  // 1) Accept single DSN-like env first if provided
  const dsn = parseMysqlDsn(CORE_MYSQL || MYSQL);
  if (dsn && dsn.host && dsn.database && dsn.user) {
    return {
      host: dsn.host,
      port: dsn.port || 3306,
      database: dsn.database,
      user: dsn.user,
      password: dsn.password || "",
    };
  }

  // 2) DATABASE_URL (mysql://...)
  if (DATABASE_URL) {
    // Parse mysql://user:pass@host:port/dbname
    const url = new URL(DATABASE_URL);
    const host = url.hostname;
    const port = Number(url.port || 3306);
    const database = url.pathname.replace(/^\//, "");
    const user = decodeURIComponent(url.username);
    const password = decodeURIComponent(url.password || "");
    // Optional flags from query params
    const allowPublicKeyRetrievalParam = url.searchParams.get("allowPublicKeyRetrieval");
    const sslModeParam = url.searchParams.get("SslMode") || url.searchParams.get("sslmode");
    const sslParam = url.searchParams.get("ssl");
    const allowPublicKeyRetrieval =
      allowPublicKeyRetrievalParam === "true" || allowPublicKeyRetrievalParam === "1";
    const useSSL = (sslParam === "true" || sslParam === "1") && (!sslModeParam || sslModeParam.toLowerCase() !== "none");

    const poolOptions = { host, port, database, user, password };
    if (allowPublicKeyRetrieval) Object.assign(poolOptions, { allowPublicKeyRetrieval: true });
    if (useSSL) Object.assign(poolOptions, { ssl: { rejectUnauthorized: false } });

    return poolOptions;
  }
  return null;
}

// We now import mysqlPool from mysql.js and do not create a second pool here

function parseKeyValueBlock(raw) {
  if (!raw) return null;
  const tokens = raw
    .split(/;|\r?\n/)
    .map((t) => t.trim())
    .filter(Boolean);
  const out = {};
  for (const t of tokens) {
    const eq = t.indexOf("=");
    const col = t.indexOf(":");
    let k = "";
    let v = "";
    if (eq > -1 && (col === -1 || eq < col)) {
      k = t.slice(0, eq).trim();
      v = t.slice(eq + 1).trim();
    } else if (col > -1) {
      k = t.slice(0, col).trim();
      v = t.slice(col + 1).trim();
    } else continue;
    out[k.toLowerCase()] = v;
  }
  return out;
}

const coreKV = parseKeyValueBlock(process.env.CORE);

// Configure Better Auth
let authInstance;
try {
  // Configure social providers from env if present
  const socialProviders = {};
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    socialProviders.google = {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    };
  }
  if (process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET) {
    socialProviders.facebook = {
      clientId: process.env.FACEBOOK_CLIENT_ID,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
    };
  }
  if (process.env.APPLE_CLIENT_ID && process.env.APPLE_TEAM_ID && process.env.APPLE_KEY_ID && process.env.APPLE_PRIVATE_KEY) {
    socialProviders.apple = {
      clientId: process.env.APPLE_CLIENT_ID,
      teamId: process.env.APPLE_TEAM_ID,
      keyId: process.env.APPLE_KEY_ID,
      privateKey: process.env.APPLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    };
  }

  authInstance = betterAuth({
    secret:
      (process.env.CORE_BETTER_AUTH_SECRET || (coreKV && coreKV["better_auth_secret"])) ||
      process.env.BETTER_AUTH_SECRET,
  // Pass shared mysql2 pool directly
  database: mysqlPool,
    baseURL:
      (process.env.CORE_BETTER_AUTH_URL || (coreKV && coreKV["better_auth_url"])) ||
      process.env.BETTER_AUTH_URL ||
      "http://localhost:4000",
    emailAndPassword: {
      enabled: true,
      autoSignIn: true,
    },
    // Add providers only if any are configured
    ...(Object.keys(socialProviders).length > 0 ? { socialProviders } : {}),
    trustedOrigins: (
      (process.env.CORE_CLIENT_ORIGINS || (coreKV && coreKV["client_origins"])) ||
      process.env.CLIENT_ORIGINS ||
      process.env.CORE_CLIENT_ORIGIN ||
      process.env.CLIENT_ORIGIN || (coreKV && coreKV["client_origin"]) ||
      "http://localhost:19006"
    )
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  });
  console.log("[Auth] Better Auth initialized ✅");
} catch (e) {
  console.error("[Auth] Better Auth initialization failed ❌", e?.message, e?.cause ?? "no-cause");
  throw e;
}

export const auth = authInstance;
