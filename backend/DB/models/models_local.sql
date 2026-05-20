-- WizPix schema (utf8mb4) - Local development (VS Code)
-- ------------------------------------------------------------------
-- Ce fichier est destinÃ© au dÃ©veloppement local.
-- Il peut contenir CREATE DATABASE / USE pour bootstrap rapide.
--
-- IMPORTANT:
-- - Adapte le nom de base `wiz_pix` Ã  ta variable d'env `DB_NAME_DEV` si besoin.
-- - Les scripts destructifs (DROP) sont volontairement commentÃ©s.
-- ------------------------------------------------------------------

-- -- Reset DEV (optionnel) :
-- DROP DATABASE IF EXISTS `wiz_pix`;

-- NOTE (prod parity):
-- En production tu es sur MariaDB 10.6.x avec `character_set_server=latin1` et `collation_server=latin1_swedish_ci`.
-- On garde les tables en utf8mb4 (comme en prod via DEFAULT CHARSET=utf8mb4), mais on aligne la base sur latin1
-- pour reproduire les comportements "par défaut" (charset/collation) lorsque non spécifiés.
CREATE DATABASE IF NOT EXISTS `wiz_pix`
  CHARACTER SET latin1
  COLLATE latin1_swedish_ci;

USE `wiz_pix`;

-- Tables / vues
-- (mÃªme schÃ©ma que `models_pre_prod.sql`, mais sans contrainte PlanetHoster)

CREATE TABLE IF NOT EXISTS `User` (
  id            VARCHAR(36)  NOT NULL PRIMARY KEY,
  email         VARCHAR(191) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  marketing_consent             TINYINT(1) NOT NULL DEFAULT 0,
  marketing_consent_updated_at  DATETIME   NULL,
  account_deletion_requested            TINYINT(1) NOT NULL DEFAULT 0,
  account_deletion_requested_at         DATETIME   NULL,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `TokenRefresh` (
  id               VARCHAR(36)   NOT NULL PRIMARY KEY,
  jti              VARCHAR(191)  NOT NULL,
  user_id          VARCHAR(36)   NOT NULL,
  revoked          TINYINT(1)    NOT NULL DEFAULT 0,
  revoked_at       DATETIME      NULL,
  replaced_by_jti  VARCHAR(191)  NULL,
  token_hash       VARBINARY(64) NULL,
  ip               VARCHAR(45)   NULL,
  user_agent       VARCHAR(255)  NULL,
  issued_at        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at       DATETIME      NOT NULL,
  created_at       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_refresh_user FOREIGN KEY (user_id) REFERENCES `User`(id) ON DELETE CASCADE,
  UNIQUE KEY uniq_refresh_jti (jti),
  INDEX idx_refresh_user_revoked (user_id, revoked),
  INDEX idx_refresh_expires (expires_at),
  INDEX idx_refresh_replaced (replaced_by_jti)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Plan` (
  id                 VARCHAR(36)  NOT NULL PRIMARY KEY,
  code               VARCHAR(64)  NOT NULL UNIQUE,
  name               VARCHAR(191) NOT NULL UNIQUE,
  price              INT          NOT NULL,
  currency_code      CHAR(3)      NOT NULL DEFAULT 'CHF',
  billing_interval   ENUM('day','week','month','year') NOT NULL DEFAULT 'month',
  daily_credit_quota INT UNSIGNED NOT NULL DEFAULT 0,
  stripe_price_id    VARCHAR(255) NULL,
  is_archived        TINYINT(1)   NOT NULL DEFAULT 0,
  created_at         TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_plan_active (is_archived),
  INDEX idx_plan_price (price),
  INDEX idx_plan_stripe_price (stripe_price_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Subscription` (
  id                      VARCHAR(36) NOT NULL PRIMARY KEY,
  user_id                 VARCHAR(36) NOT NULL,
  plan_id                 VARCHAR(36) NOT NULL,
  status                  ENUM('active','canceling','canceled','past_due','expired','incomplete','incomplete_expired','trialing','unpaid','paused') NOT NULL DEFAULT 'active',
  is_active               TINYINT(1) NULL,
  period_start            DATETIME    NOT NULL,
  period_end              DATETIME    NOT NULL,
  cancel_at               DATETIME    NULL,
  canceled_at             DATETIME    NULL,
  stripe_cancel_at_period_end TINYINT(1) NOT NULL DEFAULT 0,
  current_period_end          DATETIME   NULL,
  plan_access_until           DATETIME   NULL,
  pending_plan_id             VARCHAR(36) NULL,
  pending_change_type         ENUM('upgrade','downgrade') NULL,
  pending_change_effective_at DATETIME NULL,
  stripe_schedule_id          VARCHAR(255) NULL,
  stripe_subscription_id  VARCHAR(255) NULL,
  stripe_customer_id      VARCHAR(255) NULL,
  credit_initial          INT UNSIGNED NOT NULL DEFAULT 0,
  credit_used             INT UNSIGNED NOT NULL DEFAULT 0,
  created_at              TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at              TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_sub_user FOREIGN KEY (user_id) REFERENCES `User`(id) ON DELETE CASCADE,
  CONSTRAINT fk_sub_plan FOREIGN KEY (plan_id) REFERENCES `Plan`(id) ON DELETE RESTRICT,
  CONSTRAINT fk_sub_pending_plan FOREIGN KEY (pending_plan_id) REFERENCES `Plan`(id) ON DELETE SET NULL,

  UNIQUE KEY uniq_user_active (user_id, is_active),
  UNIQUE KEY uniq_stripe_subscription (stripe_subscription_id),
  INDEX idx_sub_user_status   (user_id, status),
  INDEX idx_sub_plan_status   (plan_id, status),
  INDEX idx_sub_period_start  (period_start),
  INDEX idx_sub_period_end    (period_end),
  INDEX idx_sub_user_active   (user_id, is_active),
  INDEX idx_sub_stripe_cus    (stripe_customer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `CreditUsage` (
  id               VARCHAR(36)  NOT NULL PRIMARY KEY,
  subscription_id  VARCHAR(36)  NOT NULL,
  used             INT UNSIGNED NOT NULL,
  reason           VARCHAR(64)  NOT NULL DEFAULT 'api_call',
  request_id       VARCHAR(128) NULL,
  occurred_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_usage_subscription FOREIGN KEY (subscription_id) REFERENCES `Subscription`(id) ON DELETE CASCADE,
  UNIQUE KEY uniq_usage_request (request_id),
  INDEX idx_usage_sub_time (subscription_id, occurred_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Image conversion credits (per subscription billing period)
-- Keeps this separate from `CreditUsage` to avoid mixing AI credits with conversion credits.
CREATE TABLE IF NOT EXISTS `SubscriptionConversionQuota` (
  subscription_id VARCHAR(36) NOT NULL,
  period_start    DATETIME    NOT NULL,
  period_end      DATETIME    NOT NULL,
  used            INT         NOT NULL DEFAULT 0,
  updated_at      TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (subscription_id),
  INDEX idx_subscription_conversion_quota_period (subscription_id, period_start, period_end),
  CONSTRAINT fk_subscription_conversion_quota_subscription
    FOREIGN KEY (subscription_id) REFERENCES `Subscription`(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE OR REPLACE VIEW `v_subscription_usage_24h` AS
SELECT
  s.id AS subscription_id,
  s.user_id,
  s.plan_id,
  p.code AS plan_code,
  p.daily_credit_quota,
  COALESCE(SUM(CASE WHEN cu.occurred_at >= (NOW() - INTERVAL 1 DAY) THEN cu.used ELSE 0 END), 0) AS used_last_24h,
  GREATEST(
    p.daily_credit_quota
      - COALESCE(SUM(CASE WHEN cu.occurred_at >= (NOW() - INTERVAL 1 DAY) THEN cu.used ELSE 0 END), 0),
    0
  ) AS remaining_last_24h
FROM `Subscription` s
JOIN `Plan` p ON p.id = s.plan_id
LEFT JOIN `CreditUsage` cu ON cu.subscription_id = s.id
WHERE s.is_active = 1
GROUP BY s.id, s.user_id, s.plan_id, p.code, p.daily_credit_quota;

CREATE TABLE IF NOT EXISTS `EmailVerification` (
  id             VARCHAR(36)   NOT NULL PRIMARY KEY,
  email          VARCHAR(191)  NOT NULL,
  code_hash      VARBINARY(64) NOT NULL,
  salt           VARBINARY(16) NOT NULL,
  password_hash  VARCHAR(72)   NOT NULL,
  expires_at     DATETIME      NOT NULL,
  plan_type      VARCHAR(64)   NULL,
  currency_code  CHAR(3)       NOT NULL DEFAULT 'CHF',
  consumed_at    DATETIME      NULL,
  attempts       TINYINT UNSIGNED NOT NULL DEFAULT 0,
  active         TINYINT(1)    NULL DEFAULT 1, -- 1 actif, NULL inactif (historique)
  created_at     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  account        TINYINT UNSIGNED NOT NULL DEFAULT 0,
  INDEX idx_email (email),
  INDEX idx_expires (expires_at),
  UNIQUE KEY uniq_email_active (email, active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `StripeCheckoutSession` (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `ProcessedWebhookEvent` (
  id           VARCHAR(255) NOT NULL PRIMARY KEY,
  provider     VARCHAR(32)  NOT NULL DEFAULT 'stripe',
  event_type   VARCHAR(255) NOT NULL,
  received_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at DATETIME     NULL,
  INDEX idx_pwe_type_time (event_type, received_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Remove BG jobs (Replicate async flow source of truth)
-- request_id: UUID client-side (idempotency key)
-- replicate_prediction_id: filled once the prediction is created
CREATE TABLE IF NOT EXISTS `RemoveBgJobs` (
  id                     VARCHAR(36)  NOT NULL PRIMARY KEY,
  user_id                VARCHAR(36)  NULL,
  request_id             VARCHAR(64)  NOT NULL,
  idempotency_key        VARCHAR(64)  NOT NULL,
  replicate_prediction_id VARCHAR(255) NULL,
  status                 ENUM('pending','processing','succeeded','failed','canceled') NOT NULL DEFAULT 'pending',
  replicate_status       VARCHAR(32)  NULL,
  input_image_url        TEXT         NULL,
  output_image_url       TEXT         NULL,
  -- MariaDB 10.6: `JSON` est un alias de LONGTEXT avec un CHECK `json_valid(...)`.
  -- Pour coller au `SHOW CREATE TABLE` prod et reproduire les différences MySQL vs MariaDB en local,
  -- on déclare explicitement la forme matérialisée.
  replicate_payload      LONGTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`replicate_payload`)),
  error_message          TEXT         NULL,
  credits_debited_at     DATETIME     NULL,
  created_at             TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at             TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  completed_at           DATETIME     NULL,

  UNIQUE KEY uniq_remove_bg_repl_user_idempotency (user_id, idempotency_key),
  UNIQUE KEY uniq_remove_bg_repl_request (request_id),
  UNIQUE KEY uniq_remove_bg_repl_prediction (replicate_prediction_id),
  INDEX idx_remove_bg_repl_user (user_id),
  INDEX idx_remove_bg_repl_status (status),
  INDEX idx_remove_bg_repl_created_at (created_at),

  CONSTRAINT fk_remove_bg_job_user
    FOREIGN KEY (user_id) REFERENCES `User`(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Remove BG visitor jobs (Replicate async flow, no auth)
-- visitor_hashed_ip: sha256(ip + SECRET_SALT)
-- access_token: opaque token returned to the client to authorize SSE/status reads
CREATE TABLE IF NOT EXISTS `RemoveBgVisitorJobs` (
  id                     VARCHAR(36)  NOT NULL PRIMARY KEY,
  visitor_hashed_ip       CHAR(64)     NOT NULL,
  request_id              VARCHAR(64)  NOT NULL,
  idempotency_key         VARCHAR(64)  NOT NULL,
  access_token            VARCHAR(64)  NOT NULL,
  replicate_prediction_id VARCHAR(255) NULL,
  status                  ENUM('pending','processing','succeeded','failed','canceled') NOT NULL DEFAULT 'pending',
  replicate_status        VARCHAR(32)  NULL,
  output_image_url        TEXT         NULL,
  replicate_payload       LONGTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`replicate_payload`)),
  error_message           TEXT         NULL,
  created_at              TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at              TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  completed_at            DATETIME     NULL,

  UNIQUE KEY uniq_remove_bg_visitor_idempotency (visitor_hashed_ip, idempotency_key),
  UNIQUE KEY uniq_remove_bg_visitor_request (request_id),
  UNIQUE KEY uniq_remove_bg_visitor_prediction (replicate_prediction_id),
  INDEX idx_remove_bg_visitor_hash (visitor_hashed_ip),
  INDEX idx_remove_bg_visitor_status (status),
  INDEX idx_remove_bg_visitor_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Customer` (
  id                VARCHAR(36)   NOT NULL PRIMARY KEY,
  user_id            VARCHAR(36)   NOT NULL,
  email              VARCHAR(191)  NOT NULL,
  first_name         VARCHAR(100)  NULL,
  last_name          VARCHAR(100)  NULL,
  address_line1      VARCHAR(191)  NULL,
  address_line2      VARCHAR(191)  NULL,
  postal_code        VARCHAR(32)   NULL,
  city               VARCHAR(100)  NULL,
  country            VARCHAR(2)    NULL,
  phone              VARCHAR(32)   NULL,
  stripe_customer_id VARCHAR(255)  NULL,
  total_spent_cents  BIGINT UNSIGNED NOT NULL DEFAULT 0,
  created_at         TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_customer_user FOREIGN KEY (user_id) REFERENCES `User`(id) ON DELETE CASCADE,
  UNIQUE KEY uniq_customer_user (user_id),
  UNIQUE KEY uniq_customer_stripe (stripe_customer_id),
  INDEX idx_customer_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Invoice` (
  id                        VARCHAR(36)   NOT NULL PRIMARY KEY,
  user_id                   VARCHAR(36)   NOT NULL,
  subscription_id           VARCHAR(36)   NULL,
  plan_id                   VARCHAR(36)   NULL,
  stripe_invoice_id         VARCHAR(255)  NULL,
  stripe_payment_intent_id  VARCHAR(255)  NULL,
  amount_due_cents          INT           NOT NULL DEFAULT 0,
  amount_paid_cents         INT           NOT NULL DEFAULT 0,
  currency_code             CHAR(3)       NOT NULL DEFAULT 'CHF',
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Visitor quotas (NO raw IP stored)
-- Identifiant: sha256(ip + SECRET_SALT) (computed server-side).
CREATE TABLE IF NOT EXISTS `VisitorQuota` (
  hashed_ip            CHAR(64)     NOT NULL PRIMARY KEY,
  remove_bg_used       INT UNSIGNED NOT NULL DEFAULT 0,
  image_convert_month  CHAR(7)      NULL,
  image_convert_used   INT UNSIGNED NOT NULL DEFAULT 0,
  created_at           TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at           TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_vq_month_used (image_convert_month, image_convert_used)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Account deletion feedback (post-deletion survey)
-- token_hash: sha256(token) (raw token is only returned once to the client)
CREATE TABLE IF NOT EXISTS `AccountDeletionFeedback` (
  id            VARCHAR(36)   NOT NULL PRIMARY KEY,
  user_id       VARCHAR(36)   NULL,
  token_hash    CHAR(64)      NOT NULL UNIQUE,
  reasons_json  TEXT          NULL,
  other_text    TEXT          NULL,
  user_agent    VARCHAR(255)  NULL,
  submitted_ip_hash CHAR(64)  NULL,
  requested_at  DATETIME      NOT NULL,
  expires_at    DATETIME      NOT NULL,
  submitted_at  DATETIME      NULL,
  created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_adf_user (user_id),
  INDEX idx_adf_submitted (submitted_at),
  INDEX idx_adf_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
