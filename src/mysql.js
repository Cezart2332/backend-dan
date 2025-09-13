import { Kysely, MysqlDialect } from "kysely";
import mysql from "mysql2/promise";

function resolveOptions() {
  const url = process.env.DATABASE_URL;
  if (url) {
    const u = new URL(url);
    return {
      host: u.hostname,
      port: Number(u.port || 3306),
      database: u.pathname.replace(/^\//, ""),
      user: decodeURIComponent(u.username),
      password: decodeURIComponent(u.password || ""),
    };
  }
  const { MYSQL_HOST, MYSQL_PORT = 3306, MYSQL_DATABASE, MYSQL_USER, MYSQL_PASSWORD } = process.env;
  if (!MYSQL_HOST || !MYSQL_DATABASE || !MYSQL_USER) {
    throw new Error("Missing MySQL env vars. Set DATABASE_URL or MYSQL_* variables.");
  }
  return {
    host: MYSQL_HOST,
    port: Number(MYSQL_PORT),
    database: MYSQL_DATABASE,
    user: MYSQL_USER,
    password: MYSQL_PASSWORD || "",
  };
}

const pool = mysql.createPool(resolveOptions());
export const db = new Kysely({ dialect: new MysqlDialect({ pool }) });
