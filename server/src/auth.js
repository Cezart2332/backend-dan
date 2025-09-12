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
} = process.env;

function createMysqlDialect() {
  // Prefer DATABASE_URL if provided; otherwise use discrete MYSQL_* vars
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
