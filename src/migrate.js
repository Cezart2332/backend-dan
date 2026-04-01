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
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_users_created_at (created_at)
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
      admin_response TEXT NULL,
      responded_at TIMESTAMP NULL,
      responded_by BIGINT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_questions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
      CONSTRAINT fk_questions_responded_by FOREIGN KEY (responded_by) REFERENCES users(id) ON DELETE SET NULL,
      INDEX idx_questions_created_at (created_at),
      INDEX idx_questions_user (user_id),
      INDEX idx_questions_status_created (status, created_at)
    )
  `);

  // Backward-compatible schema upgrades for older deployments
  try {
    await mysqlPool.query(`ALTER TABLE questions ADD COLUMN admin_response TEXT NULL`);
  } catch {}
  try {
    await mysqlPool.query(`ALTER TABLE questions ADD COLUMN responded_at TIMESTAMP NULL`);
  } catch {}
  try {
    await mysqlPool.query(`ALTER TABLE questions ADD COLUMN responded_by BIGINT NULL`);
  } catch {}
  try {
    await mysqlPool.query(`ALTER TABLE questions ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`);
  } catch {}
  try {
    await mysqlPool.query(`ALTER TABLE questions ADD INDEX idx_questions_status_created (status, created_at)`);
  } catch {}

  await mysqlPool.query(`
    CREATE TABLE IF NOT EXISTS user_push_tokens (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      user_id BIGINT NOT NULL,
      expo_push_token VARCHAR(255) NOT NULL,
      platform ENUM('ios','android','unknown') NOT NULL DEFAULT 'unknown',
      enabled TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_user_push_tokens_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE KEY uq_user_push_token (expo_push_token),
      INDEX idx_user_push_tokens_user_enabled (user_id, enabled)
    )
  `);
  try {
    await mysqlPool.query(`ALTER TABLE user_push_tokens ADD COLUMN platform ENUM('ios','android','unknown') NOT NULL DEFAULT 'unknown'`);
  } catch {}
  try {
    await mysqlPool.query(`ALTER TABLE user_push_tokens ADD COLUMN enabled TINYINT(1) NOT NULL DEFAULT 1`);
  } catch {}
  try {
    await mysqlPool.query(`ALTER TABLE user_push_tokens ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`);
  } catch {}
  try {
    await mysqlPool.query(`ALTER TABLE user_push_tokens ADD UNIQUE INDEX uq_user_push_token (expo_push_token)`);
  } catch {}
  try {
    await mysqlPool.query(`ALTER TABLE user_push_tokens ADD INDEX idx_user_push_tokens_user_enabled (user_id, enabled)`);
  } catch {}

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

  // meetings table
  await mysqlPool.query(`
    CREATE TABLE IF NOT EXISTS meetings (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      user_id BIGINT NULL,
      title VARCHAR(255) NOT NULL DEFAULT 'Ședință',
      notes TEXT NULL,
      scheduled_at DATETIME NOT NULL,
      duration_min INT NOT NULL DEFAULT 60,
      status ENUM('scheduled','completed','cancelled') NOT NULL DEFAULT 'scheduled',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_meetings_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
      INDEX idx_meetings_scheduled (scheduled_at),
      INDEX idx_meetings_user (user_id)
    )
  `);

  // Add is_admin column to users if not present
  try {
    await mysqlPool.query(`ALTER TABLE users ADD COLUMN is_admin TINYINT(1) NOT NULL DEFAULT 0`);
  } catch {
    // Column already exists
  }
  try {
    await mysqlPool.query(`ALTER TABLE users ADD INDEX idx_users_created_at (created_at)`);
  } catch {}

  // subscriptions table
  await mysqlPool.query(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      user_id BIGINT NOT NULL,
      type ENUM('trial','basic','premium','vip') NOT NULL,
      starts_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      ends_at TIMESTAMP NULL,
      revenuecat_app_user_id VARCHAR(255) NULL,
      revenuecat_product_id VARCHAR(255) NULL,
      revenuecat_entitlement_id VARCHAR(255) NULL,
      revenuecat_store VARCHAR(64) NULL,
      revenuecat_will_renew TINYINT(1) NULL,
      revenuecat_event_type VARCHAR(64) NULL,
      stripe_customer_id VARCHAR(255) NULL,
      stripe_subscription_id VARCHAR(255) NULL,
      stripe_price_id VARCHAR(255) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_subscriptions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_subscriptions_user (user_id),
      INDEX idx_subscriptions_active (user_id, ends_at),
      INDEX idx_subscriptions_stripe_sub (stripe_subscription_id),
      INDEX idx_subscriptions_revenuecat_app_user (revenuecat_app_user_id),
      INDEX idx_subscriptions_revenuecat_product (revenuecat_product_id),
      INDEX idx_subscriptions_user_starts (user_id, starts_at DESC)
    )
  `);

  // RevenueCat columns for pre-existing deployments
  try {
    await mysqlPool.query(`ALTER TABLE subscriptions ADD COLUMN revenuecat_app_user_id VARCHAR(255) NULL`);
  } catch {}
  try {
    await mysqlPool.query(`ALTER TABLE subscriptions ADD COLUMN revenuecat_product_id VARCHAR(255) NULL`);
  } catch {}
  try {
    await mysqlPool.query(`ALTER TABLE subscriptions ADD COLUMN revenuecat_entitlement_id VARCHAR(255) NULL`);
  } catch {}
  try {
    await mysqlPool.query(`ALTER TABLE subscriptions ADD COLUMN revenuecat_store VARCHAR(64) NULL`);
  } catch {}
  try {
    await mysqlPool.query(`ALTER TABLE subscriptions ADD COLUMN revenuecat_will_renew TINYINT(1) NULL`);
  } catch {}
  try {
    await mysqlPool.query(`ALTER TABLE subscriptions ADD COLUMN revenuecat_event_type VARCHAR(64) NULL`);
  } catch {}
  try {
    await mysqlPool.query(`ALTER TABLE subscriptions ADD INDEX idx_subscriptions_revenuecat_app_user (revenuecat_app_user_id)`);
  } catch {}
  try {
    await mysqlPool.query(`ALTER TABLE subscriptions ADD INDEX idx_subscriptions_revenuecat_product (revenuecat_product_id)`);
  } catch {}

  // bug_reports table
  await mysqlPool.query(`
    CREATE TABLE IF NOT EXISTS bug_reports (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      user_id BIGINT NULL,
      user_email VARCHAR(255) NULL,
      contact_email VARCHAR(255) NULL,
      description TEXT NOT NULL,
      status ENUM('new', 'in_progress', 'resolved', 'closed') DEFAULT 'new',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_bug_reports_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
      INDEX idx_bug_reports_created_at (created_at),
      INDEX idx_bug_reports_status_created (status, created_at),
      INDEX idx_bug_reports_user_id (user_id)
    )
  `);
  try {
    await mysqlPool.query(`ALTER TABLE bug_reports ADD INDEX idx_bug_reports_created_at (created_at)`);
  } catch {}
  try {
    await mysqlPool.query(`ALTER TABLE bug_reports ADD INDEX idx_bug_reports_status_created (status, created_at)`);
  } catch {}
  try {
    await mysqlPool.query(`ALTER TABLE bug_reports ADD INDEX idx_bug_reports_user_id (user_id)`);
  } catch {}
}
