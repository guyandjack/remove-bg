-- Schema: remove_bg (utf8mb4)
CREATE DATABASE IF NOT EXISTS `remove_bg` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `remove_bg`;

-- ================================================================
-- Utility helper: drop any table safely (run manually when needed)
-- Steps:
--  1. Set @table_to_drop to the target table name (exact case)
--  2. Execute this block; it drops the table if it exists
-- ================================================================
SET @table_to_drop = 'emailverification';
SET @schema_name = 'remove_bg';
SET @sql_drop = CONCAT('DROP TABLE IF EXISTS `', @schema_name, '`.`', @table_to_drop, '`;');
PREPARE stmt_drop FROM @sql_drop;
EXECUTE stmt_drop;
DEALLOCATE PREPARE stmt_drop;
-- ================================================================

-- User
CREATE TABLE IF NOT EXISTS `remove_bg`.`User` (
  id            VARCHAR(36)  NOT NULL PRIMARY KEY,
  email         VARCHAR(191) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- TokenRefresh (stockage des refresh tokens)
CREATE TABLE IF NOT EXISTS `remove_bg`.`TokenRefresh` (
  id               VARCHAR(36)   NOT NULL PRIMARY KEY,
  jti              VARCHAR(191)  NOT NULL,                  -- JWT ID (identifiant unique du refresh token)
  user_id          VARCHAR(36)   NOT NULL,                  -- FK vers User
  revoked          TINYINT(1)    NOT NULL DEFAULT 0,        -- 1 si révoqué (invalidé)
  revoked_at       DATETIME      NULL,                      -- date de révocation
  replaced_by_jti  VARCHAR(191)  NULL,                      -- rotation: jti qui remplace celui-ci
  token_hash       VARBINARY(64) NULL,                      -- optionnel: hash (sha-256) du token si stocké
  ip               VARCHAR(45)   NULL,                      -- IPv4/IPv6
  user_agent       VARCHAR(255)  NULL,                      -- UA au moment de l'émission
  issued_at        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at       DATETIME      NOT NULL,
  created_at       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_refresh_user FOREIGN KEY (user_id) REFERENCES `User`(id) ON DELETE CASCADE,
  UNIQUE KEY uniq_refresh_jti (jti),
  INDEX idx_refresh_user_revoked (user_id, revoked),
  INDEX idx_refresh_expires (expires_at),
  INDEX idx_refresh_replaced (replaced_by_jti)
) ENGINE=InnoDB;

-- Plan (catalogue)
CREATE TABLE IF NOT EXISTS `remove_bg`.`Plan` (
  id                   VARCHAR(36)  NOT NULL PRIMARY KEY,
  code                 VARCHAR(64)  NOT NULL UNIQUE,           -- ex: 'free', 'hobby', 'pro'
  name                 VARCHAR(191) NOT NULL UNIQUE,
  price                INT          NOT NULL,                  -- compatible avec votre code
  currency             CHAR(3)      NOT NULL DEFAULT 'EUR',
  billing_interval     ENUM('day','week','month','year') NOT NULL DEFAULT 'month',
  daily_credit_quota   INT UNSIGNED NOT NULL DEFAULT 0,
  stripe_price_id      VARCHAR(255) NULL,
  is_archived          TINYINT(1)   NOT NULL DEFAULT 0,
  created_at           TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at           TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_plan_active (is_archived),
  INDEX idx_plan_price (price),
  INDEX idx_plan_stripe_price (stripe_price_id)
) ENGINE=InnoDB;

-- Subscription
-- MySQL: ENUM pour le statut et "trick" is_active (NULL = inactif, TRUE = actif)
CREATE TABLE IF NOT EXISTS `remove_bg`.`Subscription` (
  id                      VARCHAR(36) NOT NULL PRIMARY KEY,
  user_id                 VARCHAR(36) NOT NULL,
  plan_id                 VARCHAR(36) NOT NULL,
  status                  ENUM('active','canceled','past_due','expired','incomplete','incomplete_expired','trialing','unpaid','paused') NOT NULL DEFAULT 'active',
  is_active               TINYINT(1) NULL, -- TRUE pour actif, NULL pour inactif
  period_start            DATETIME    NOT NULL,
  period_end              DATETIME    NOT NULL,
  cancel_at               DATETIME    NULL,
  canceled_at             DATETIME    NULL,
  stripe_subscription_id  VARCHAR(255) NULL,
  stripe_customer_id      VARCHAR(255) NULL,
  credit_initial          INT UNSIGNED NOT NULL DEFAULT 0,
  credit_used             INT UNSIGNED NOT NULL DEFAULT 0,
  created_at              TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at              TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_sub_user FOREIGN KEY (user_id) REFERENCES `User`(id) ON DELETE CASCADE,
  CONSTRAINT fk_sub_plan FOREIGN KEY (plan_id) REFERENCES `Plan`(id) ON DELETE RESTRICT,

  UNIQUE KEY uniq_user_active (user_id, is_active),
  UNIQUE KEY uniq_stripe_subscription (stripe_subscription_id),
  INDEX idx_sub_user_status   (user_id, status),
  INDEX idx_sub_plan_status   (plan_id, status),
  INDEX idx_sub_period_start  (period_start),
  INDEX idx_sub_period_end    (period_end),
  INDEX idx_sub_user_active   (user_id, is_active),
  INDEX idx_sub_stripe_cus    (stripe_customer_id)
) ENGINE=InnoDB;

-- Ledger d'usage de crédits (fenêtre 24h par requête)
CREATE TABLE IF NOT EXISTS `remove_bg`.`CreditUsage` (
  id               VARCHAR(36)  NOT NULL PRIMARY KEY,
  subscription_id  VARCHAR(36)  NOT NULL,
  used             INT UNSIGNED NOT NULL,
  reason           VARCHAR(64)  NOT NULL DEFAULT 'api_call',
  request_id       VARCHAR(128) NULL,
  occurred_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_usage_subscription FOREIGN KEY (subscription_id) REFERENCES `Subscription`(id) ON DELETE CASCADE,
  UNIQUE KEY uniq_usage_request (request_id),
  INDEX idx_usage_sub_time (subscription_id, occurred_at)
) ENGINE=InnoDB;

-- Vue pratique: consommation sur 24h et restant
CREATE OR REPLACE VIEW `remove_bg`.`v_subscription_usage_24h` AS
SELECT
  s.id AS subscription_id,
  s.user_id,
  s.plan_id,
  p.code AS plan_code,
  p.daily_credit_quota,
  COALESCE(SUM(CASE WHEN cu.occurred_at >= (NOW() - INTERVAL 1 DAY) THEN cu.used ELSE 0 END), 0) AS used_last_24h,
  GREATEST(p.daily_credit_quota - COALESCE(SUM(CASE WHEN cu.occurred_at >= (NOW() - INTERVAL 1 DAY) THEN cu.used ELSE 0 END), 0), 0) AS remaining_last_24h
FROM Subscription s
JOIN Plan p ON p.id = s.plan_id
LEFT JOIN CreditUsage cu ON cu.subscription_id = s.id
WHERE s.is_active = 1
GROUP BY s.id, s.user_id, s.plan_id, p.code, p.daily_credit_quota;

-- EmailVerification (OTP)
CREATE TABLE IF NOT EXISTS `remove_bg`.`EmailVerification` (
  id             VARCHAR(36)   NOT NULL PRIMARY KEY,
  email          VARCHAR(191)  NOT NULL,
  code_hash      VARBINARY(64) NOT NULL, -- scrypt/pbkdf2 hash (ex: 64 bytes)
  salt           VARBINARY(16) NOT NULL,
  password_hash  VARCHAR(72)   NOT NULL, -- bcrypt hash (typ. 60 chars)
  expires_at     DATETIME      NOT NULL,
  plan_type      VARCHAR(64)   NULL,     -- ex: 'free','hobby','pro' (option: référencer Plan.code)
  currency_code  CHAR(3)       NOT NULL DEFAULT 'CHF',
  consumed_at    DATETIME      NULL,
  attempts       TINYINT UNSIGNED NOT NULL DEFAULT 0,
  active         TINYINT(1)    NOT NULL DEFAULT 1, -- 1 = actif
  created_at     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  account        TINYINT UNSIGNED NOT NULL DEFAULT 0, -- 1 = compte créé
  INDEX idx_email (email),
  INDEX idx_expires (expires_at),
  UNIQUE KEY uniq_email_active (email, active)
) ENGINE=InnoDB;

-- Stripe checkout session state: keeps link between Stripe session and local user/account activation
CREATE TABLE IF NOT EXISTS `remove_bg`.`StripeCheckoutSession` (
  id               VARCHAR(36)   NOT NULL PRIMARY KEY,
  session_id       VARCHAR(255)  NOT NULL,
  email            VARCHAR(191)  NOT NULL,
  plan_code        VARCHAR(64)   NOT NULL,
  plan_id          VARCHAR(36)   NULL,
  currency_code    CHAR(3)       NOT NULL DEFAULT 'CHF',
  status           ENUM('pending','completed','failed') NOT NULL DEFAULT 'pending',
  user_id          VARCHAR(36)   NULL,
  subscription_id  VARCHAR(36)   NULL,
  last_error       TEXT          NULL,
  consumed_at      DATETIME      NULL,
  created_at       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_stripe_session (session_id),
  INDEX idx_stripe_session_email (email),
  INDEX idx_stripe_session_status (status),
  CONSTRAINT fk_stripe_session_user FOREIGN KEY (user_id) REFERENCES `User`(id) ON DELETE SET NULL,
  CONSTRAINT fk_stripe_session_subscription FOREIGN KEY (subscription_id) REFERENCES `Subscription`(id) ON DELETE SET NULL,
  CONSTRAINT fk_stripe_session_plan FOREIGN KEY (plan_id) REFERENCES `Plan`(id) ON DELETE SET NULL
) ENGINE=InnoDB;
 
  -- Customer (profil + Stripe customer)
  CREATE TABLE IF NOT EXISTS `remove_bg`.`Customer` (
    id                  VARCHAR(36)   NOT NULL PRIMARY KEY,
  user_id             VARCHAR(36)   NOT NULL,
  email               VARCHAR(191)  NOT NULL,
  first_name          VARCHAR(100)  NULL,
  last_name           VARCHAR(100)  NULL,
  address_line1       VARCHAR(191)  NULL,
  address_line2       VARCHAR(191)  NULL,
  postal_code         VARCHAR(32)   NULL,
  city                VARCHAR(100)  NULL,
  country             VARCHAR(2)    NULL,
  phone               VARCHAR(32)   NULL,
  stripe_customer_id  VARCHAR(255)  NULL,
  total_spent_cents   BIGINT UNSIGNED NOT NULL DEFAULT 0,
  created_at          TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_customer_user FOREIGN KEY (user_id) REFERENCES `User`(id) ON DELETE CASCADE,
  UNIQUE KEY uniq_customer_user (user_id),
  UNIQUE KEY uniq_customer_stripe (stripe_customer_id),
  INDEX idx_customer_email (email)
) ENGINE=InnoDB;

-- Invoice / Payment records (Stripe)
CREATE TABLE IF NOT EXISTS `remove_bg`.`Invoice` (
  id                        VARCHAR(36)   NOT NULL PRIMARY KEY,
  user_id                   VARCHAR(36)   NOT NULL,
  subscription_id           VARCHAR(36)   NULL,
  plan_id                   VARCHAR(36)   NULL,
  stripe_invoice_id         VARCHAR(255)  NULL,
  stripe_payment_intent_id  VARCHAR(255)  NULL,
  amount_due_cents          INT           NOT NULL DEFAULT 0,
  amount_paid_cents         INT           NOT NULL DEFAULT 0,
  currency                  CHAR(3)       NOT NULL DEFAULT 'EUR',
  status                    ENUM('draft','open','paid','uncollectible','void') NOT NULL DEFAULT 'open',
  hosted_invoice_url        VARCHAR(255)  NULL,
  invoice_pdf               VARCHAR(255)  NULL,
  period_start              DATETIME      NULL,
  period_end                DATETIME      NULL,
  issued_at                 DATETIME      NULL,
  created_at                TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_invoice_user FOREIGN KEY (user_id) REFERENCES `User`(id) ON DELETE CASCADE,
  CONSTRAINT fk_invoice_subscription FOREIGN KEY (subscription_id) REFERENCES `Subscription`(id) ON DELETE SET NULL,
  CONSTRAINT fk_invoice_plan FOREIGN KEY (plan_id) REFERENCES `Plan`(id) ON DELETE SET NULL,

  UNIQUE KEY uniq_stripe_invoice (stripe_invoice_id),
  INDEX idx_invoice_user (user_id),
  INDEX idx_invoice_paid (status, amount_paid_cents),
  INDEX idx_invoice_period (period_start, period_end)
) ENGINE=InnoDB;
