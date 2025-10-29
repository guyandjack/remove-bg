-- User
CREATE TABLE IF NOT EXISTS `remove_bg`.`User` (
  id            VARCHAR(36)  NOT NULL PRIMARY KEY,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;


-- Plan
CREATE TABLE IF NOT EXISTS `remove_bg`.`Plan` (
  id          VARCHAR(36)  NOT NULL PRIMARY KEY,
  name        VARCHAR(191) NOT NULL UNIQUE,
  price       INT          NOT NULL,
  is_archived TINYINT(1)   NOT NULL DEFAULT 0,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Subscription
-- MySQL : on utilise ENUM pour le statut et le "trick" is_active (NULL = inactif, TRUE = actif)
CREATE TABLE IF NOT EXISTS `remove_bg`.`Subscription` (
  id            VARCHAR(36) NOT NULL PRIMARY KEY,
  user_id       VARCHAR(36) NOT NULL,
  plan_id       VARCHAR(36) NOT NULL,
  status        ENUM('active','canceled','past_due','expired') NOT NULL DEFAULT 'active',
  is_active     TINYINT(1) NULL, -- TRUE pour actif, NULL pour inactif
  period_start  DATETIME    NOT NULL,
  period_end    DATETIME    NOT NULL,
  created_at    TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_sub_user FOREIGN KEY (user_id) REFERENCES User(id) ON DELETE CASCADE,
  CONSTRAINT fk_sub_plan FOREIGN KEY (plan_id) REFERENCES Plan(id)  ON DELETE RESTRICT
) ENGINE=InnoDB;

-- Index usuels
CREATE INDEX idx_sub_user_status   ON Subscription (user_id, status);
CREATE INDEX idx_sub_plan_status   ON Subscription (plan_id, status);
CREATE INDEX idx_sub_period_start  ON Subscription (period_start);
CREATE INDEX idx_sub_period_end    ON Subscription (period_end);

-- "Un seul abonnement actif par user" :
-- UNIQUE(user_id, is_active). MySQL autorise plusieurs NULL, donc 1 seul TRUE par user.
CREATE UNIQUE INDEX uniq_user_active ON Subscription (user_id, is_active);

-- EmailVerification (OTP basé sur code à 6 chiffres stocké haché)
CREATE TABLE IF NOT EXISTS `remove_bg`.`EmailVerification` (
  id           VARCHAR(36)  NOT NULL PRIMARY KEY,
  email        VARCHAR(255) NOT NULL,
  code_hash    VARBINARY(64) NOT NULL, -- scrypt/pbkdf2 hash (ex: 64 bytes)
  salt         VARBINARY(16) NOT NULL,
  password_hash VARCHAR(72) NOT NULL, -- bcrypt hash (typ. 60 chars)
  expires_at   DATETIME      NOT NULL,
  consumed_at  DATETIME      NULL,
  attempts     TINYINT UNSIGNED NOT NULL DEFAULT 0,
  active       TINYINT(1)    NOT NULL DEFAULT 1, -- 1 = actif, 0 = inactif/consommé/expiré
  created_at   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  account      TINYINT UNSIGNED NOT NULL DEFAULT 0,
  INDEX idx_email (email),
  INDEX idx_expires (expires_at),
  UNIQUE KEY uniq_email_active (email, active)
) ENGINE=InnoDB;


CREATE TABLE IF NOT EXISTS `remove_bg`.`customer` (
  id           VARCHAR(36)  NOT NULL PRIMARY KEY,
  plan_id       VARCHAR(36) NOT NULL,
  user_id       VARCHAR(36) NOT NULL,
  email        VARCHAR(255) NOT NULL,
  last_name     VARCHAR(36)  NOT NULL,
  first_name    VARCHAR(36)  NOT NULL,
  adress        VARCHAR(128)  NOT NULL,
  postal_code   VARCHAR(36)  NOT NULL,
  town          VARCHAR(36)  NOT NULL,
  INDEX idx_email (email),
  INDEX idx_expires (expires_at),
  UNIQUE KEY uniq_email_active (email, active)
) ENGINE=InnoDB;

