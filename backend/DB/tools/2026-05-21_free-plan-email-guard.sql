-- 2026-05-21: Free plan email guard (anti-abuse)
-- Prevents the same email from benefiting from the free plan multiple times within 30 days,
-- even after account deletion, without storing the email in clear.
--
-- Table stores: HMAC-SHA256(normalized_email, EMAIL_GUARD_SECRET) as hex (64 chars).

CREATE TABLE IF NOT EXISTS `free_plan_email_guard` (
  email_hmac   CHAR(64)   NOT NULL PRIMARY KEY,
  created_at   DATETIME   NOT NULL,
  expires_at   DATETIME   NOT NULL,
  INDEX idx_fpeg_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

