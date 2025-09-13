import { sql } from "kysely";
import { db } from "./mysql.js";

export async function runMigrations() {
  try {
    // Log current database
    const dbNameRes = await sql`SELECT DATABASE() as dbname`.execute(db);
    const dbName = dbNameRes.rows?.[0]?.dbname || "<unknown>";
    console.log(`[DB] Running migrations on database: ${dbName}`);

    // Ensure tables
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id BIGINT PRIMARY KEY AUTO_INCREMENT,
        email VARCHAR(255) UNIQUE,
        password_hash VARCHAR(255),
        name VARCHAR(255),
        provider ENUM('local','google','facebook','apple') NOT NULL DEFAULT 'local',
        provider_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `.execute(db);

    await sql`
      CREATE TABLE IF NOT EXISTS sessions (
        id BIGINT PRIMARY KEY AUTO_INCREMENT,
        user_id BIGINT NOT NULL,
        token VARCHAR(1024) UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NULL,
        CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `.execute(db);

    console.log("[DB] Migrations ensured ✅");
  } catch (err) {
    console.error("[DB] Migration error ❌", err?.message || err);
    throw err;
  }
}
