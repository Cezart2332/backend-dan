import { mysqlPool } from "./mysql.js";

export async function runMigrations() {
  // Ensure tables
  await mysqlPool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      email VARCHAR(255) UNIQUE,
      password_hash VARCHAR(255),
      name VARCHAR(255),
      provider ENUM('local','google','facebook','apple') NOT NULL DEFAULT 'local',
      provider_id VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await mysqlPool.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      user_id BIGINT NOT NULL,
      token VARCHAR(255) UNIQUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      expires_at TIMESTAMP NULL,
      CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // progress entries table
  await mysqlPool.query(`
    CREATE TABLE IF NOT EXISTS progress_entries (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      user_id BIGINT NOT NULL,
      level TINYINT NOT NULL,
      description TEXT NULL,
      actions TEXT NULL,
      client_date DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_progress_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_progress_user_created_at (user_id, created_at)
    )
  `);

  // questions table (for "Trimite-mi o întrebare")
  await mysqlPool.query(`
    CREATE TABLE IF NOT EXISTS questions (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      user_id BIGINT NULL,
      name VARCHAR(255) NULL,
      email VARCHAR(255) NULL,
      question TEXT NOT NULL,
      consent TINYINT(1) NOT NULL DEFAULT 0,
      status ENUM('new','read','answered','archived') NOT NULL DEFAULT 'new',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_questions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
      INDEX idx_questions_created_at (created_at),
      INDEX idx_questions_user (user_id)
    )
  `);

  // challenge runs table
  await mysqlPool.query(`
    CREATE TABLE IF NOT EXISTS challenge_runs (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      user_id BIGINT NOT NULL,
      challenge_id VARCHAR(128) NOT NULL,
      difficulty TINYINT NULL,
      notes TEXT NULL,
      client_date DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_challenge_runs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_challenge_runs_user_created (user_id, created_at),
      INDEX idx_challenge_runs_challenge (challenge_id)
    )
  `);

  // subscriptions table
  await mysqlPool.query(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      user_id BIGINT NOT NULL,
      type ENUM('trial','basic','premium','vip') NOT NULL,
      starts_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      ends_at TIMESTAMP NULL,
      stripe_customer_id VARCHAR(255) NULL,
      stripe_subscription_id VARCHAR(255) NULL,
      stripe_price_id VARCHAR(255) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_subscriptions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_subscriptions_user (user_id),
      INDEX idx_subscriptions_active (user_id, ends_at),
      INDEX idx_subscriptions_stripe_sub (stripe_subscription_id),
      INDEX idx_subscriptions_user_starts (user_id, starts_at DESC)
    )
  `);
}
