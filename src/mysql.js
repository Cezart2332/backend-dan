import { Kysely, MysqlDialect, sql } from "kysely";
import mysql from "mysql2/promise";

function parseMysqlDsn(raw) {
  if (!raw) return null;
  const tokens = raw
    .split(/;|\r?\n/)
    .map((t) => t.trim())
    .filter(Boolean);
  const out = {};
  for (const t of tokens) {
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
    } else continue;
    // strip optional trailing commas
    if (v.endsWith(",")) v = v.slice(0, -1);
    out[k.toLowerCase()] = v;
  }
  const host = out.host || out.server || out.hostname || out.mysql_host;
  const database = out.database || out.db || out.schema || out.initialcatalog || out.mysql_database;
  const user = out.user || out.username || out["user id"] || out.uid || out.mysql_user;
  const password = out.password || out.pwd || out.mysql_password;
  const port = out.port ? Number(out.port) : out.mysql_port ? Number(out.mysql_port) : 3306;
  const allowPkRaw = out.allowpublickeyretrieval || out["allow public key retrieval"];
  const allowPublicKeyRetrieval =
    typeof allowPkRaw === "string" && ["true", "1", "yes"].includes(allowPkRaw.toLowerCase());
  const ssl = out.ssl || out["use ssl"];
  const sslMode = out.sslmode || out["ssl mode"];
  const useSSL = typeof ssl === "string" && ["true", "1", "yes"].includes(ssl.toLowerCase());
  return { host, database, user, password, port, allowPublicKeyRetrieval, sslMode, useSSL };
}

function resolveOptions() {
  const { DATABASE_URL, MYSQL, CORE_MYSQL } = process.env;

  // 1) Multiline KV blocks under CORE_MYSQL or MYSQL
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
    return poolOptions;
  }

  // 2) DATABASE_URL style
  if (DATABASE_URL) {
    const url = new URL(DATABASE_URL);
    const host = url.hostname;
    const port = Number(url.port || 3306);
    const database = url.pathname.replace(/^\//, "");
    const user = decodeURIComponent(url.username);
    const password = decodeURIComponent(url.password || "");
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

  // 3) Discrete MYSQL_* or DB_* env vars
  const host = process.env.MYSQL_HOST || process.env.DB_HOST;
  const database = process.env.MYSQL_DATABASE || process.env.DB_NAME;
  const user = process.env.MYSQL_USER || process.env.DB_USER;
  const port = Number(process.env.MYSQL_PORT || process.env.DB_PORT || 3306);
  const password = process.env.MYSQL_PASSWORD || process.env.DB_PASSWORD || "";
  if (!host || !database || !user) {
    const present = {
      DATABASE_URL: Boolean(process.env.DATABASE_URL),
      MYSQL: Boolean(process.env.MYSQL || process.env.CORE_MYSQL),
      MYSQL_HOST: Boolean(process.env.MYSQL_HOST),
      MYSQL_DATABASE: Boolean(process.env.MYSQL_DATABASE),
      MYSQL_USER: Boolean(process.env.MYSQL_USER),
      DB_HOST: Boolean(process.env.DB_HOST),
      DB_NAME: Boolean(process.env.DB_NAME),
      DB_USER: Boolean(process.env.DB_USER),
    };
    console.error("[DB] Missing MySQL envs", present);
    throw new Error("Missing MySQL env vars. Set DATABASE_URL or MYSQL_* variables.");
  }
  const poolOptions = { host, port, database, user, password };
  const allowPk = String(process.env.MYSQL_ALLOW_PUBLIC_KEY_RETRIEVAL || "").toLowerCase();
  if (allowPk === "true" || allowPk === "1") Object.assign(poolOptions, { allowPublicKeyRetrieval: true });
  const sslMode = (process.env.MYSQL_SSL_MODE || "").toLowerCase();
  const sslFlag = (process.env.MYSQL_SSL || "").toLowerCase();
  if ((sslFlag === "true" || sslFlag === "1") && sslMode !== "none") {
    Object.assign(poolOptions, { ssl: { rejectUnauthorized: false } });
  }
  return poolOptions;
}

export const mysqlPool = mysql.createPool(resolveOptions());
export const db = new Kysely({ dialect: new MysqlDialect({ pool: mysqlPool }) });

// Optional: connection test helper (exported for server startup)
export async function testDbConnection() {
  try {
    await sql`select 1`.execute(db);
    console.log("[DB] MySQL connection established ✅");
  } catch (err) {
    console.error("[DB] MySQL connection failed ❌", err);
    throw err;
  }
}
