import { betterAuth } from "better-auth";
import { Kysely, MysqlDialect, sql } from "kysely";
import mysql from "mysql2/promise";

// Build MySQL connection from env (supports Coolify internal networking)
const {
  DATABASE_URL,
  MYSQL_HOST,
  MYSQL_PORT = "3306",
  MYSQL_DATABASE,
  MYSQL_USER,
  MYSQL_PASSWORD,
  MYSQL_ALLOW_PUBLIC_KEY_RETRIEVAL,
  MYSQL_SSL,
  MYSQL_SSL_MODE,
  MYSQL, // optional DSN-like string (e.g., Server=host;Database=db;User=root;Password=...;Port=3306;)
  CORE_MYSQL, // same but under CORE_*
} = process.env;

function parseMysqlDsn(raw) {
  if (!raw) return null;
  // Accept both ';' and newlines as separators
  const tokens = raw
    .split(";")
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
  const host = out.host || out.server || out.hostname;
  const database = out.database || out.db || out.schema || out.initialcatalog;
  const user = out.user || out.username || out["user id"] || out.uid;
  const password = out.password || out.pwd;
  const port = out.port ? Number(out.port) : 3306;
  const sslMode = out.sslmode || out["ssl mode"]; // e.g., None, Required
  const allowPkRaw = out.allowpublickeyretrieval || out["allow public key retrieval"];
  const allowPublicKeyRetrieval =
    typeof allowPkRaw === "string" && ["true", "1", "yes"].includes(allowPkRaw.toLowerCase());
  const ssl = out.ssl || out["use ssl"];
  const useSSL = typeof ssl === "string" && ["true", "1", "yes"].includes(ssl.toLowerCase());
  return { host, database, user, password, port, sslMode, allowPublicKeyRetrieval, useSSL };
}

function createMysqlDialect() {
  // Prefer DATABASE_URL if provided; otherwise use discrete MYSQL_* vars
  // 1) Accept single DSN-like env first if provided
  const dsn = parseMysqlDsn(CORE_MYSQL || MYSQL);
  if (dsn && dsn.host && dsn.database && dsn.user) {
    const poolOptions = {
      host: dsn.host,
      port: dsn.port || 3306,
      database: dsn.database,
      user: dsn.user,
      password: dsn.password || "",
    };
    if (dsn.allowPublicKeyRetrieval) Object.assign(poolOptions, { allowPublicKeyRetrieval: true });
    if (dsn.useSSL && (!dsn.sslMode || dsn.sslMode.toLowerCase() !== "none")) {
      Object.assign(poolOptions, { ssl: { rejectUnauthorized: false } });
    }
    return new MysqlDialect({ pool: mysql.createPool(poolOptions) });
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

    return new MysqlDialect({ pool: mysql.createPool(poolOptions) });
  }
  if (!MYSQL_HOST || !MYSQL_DATABASE || !MYSQL_USER) {
    throw new Error(
      "Missing MySQL configuration. Set DATABASE_URL or MYSQL_HOST, MYSQL_DATABASE, MYSQL_USER, MYSQL_PASSWORD."
    );
  }
  const poolOptions = {
    host: MYSQL_HOST,
    port: Number(MYSQL_PORT),
    database: MYSQL_DATABASE,
    user: MYSQL_USER,
    password: MYSQL_PASSWORD || "",
  };
  const allowPk = String(MYSQL_ALLOW_PUBLIC_KEY_RETRIEVAL || "").toLowerCase();
  if (allowPk === "true" || allowPk === "1") Object.assign(poolOptions, { allowPublicKeyRetrieval: true });
  const sslMode = (MYSQL_SSL_MODE || "").toLowerCase();
  const sslFlag = (MYSQL_SSL || "").toLowerCase();
  if ((sslFlag === "true" || sslFlag === "1") && sslMode !== "none") {
    Object.assign(poolOptions, { ssl: { rejectUnauthorized: false } });
  }
  return new MysqlDialect({ pool: mysql.createPool(poolOptions) });
}

// Create Kysely instance
const db = new Kysely({ dialect: createMysqlDialect() });

// Optional: connection test helper
export async function testDbConnection() {
  try {
    await sql`select 1`.execute(db);
    console.log("[DB] MySQL connection established ✅");
  } catch (err) {
    console.error("[DB] MySQL connection failed ❌", err);
    throw err;
  }
}

// Configure Better Auth
export const auth = betterAuth({
  secret: process.env.CORE_BETTER_AUTH_SECRET || process.env.BETTER_AUTH_SECRET,
  // Use Better Auth's built-in Kysely integration by passing the Kysely instance
  // Better Auth will create and manage tables via its CLI (see package.json migrate script)
  database: db,
  baseURL: process.env.CORE_BETTER_AUTH_URL || process.env.BETTER_AUTH_URL || "http://localhost:4000",
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
  },
  trustedOrigins: (
    process.env.CORE_CLIENT_ORIGINS ||
    process.env.CLIENT_ORIGINS ||
    process.env.CORE_CLIENT_ORIGIN ||
    process.env.CLIENT_ORIGIN ||
    "http://localhost:19006"
  )
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
});
