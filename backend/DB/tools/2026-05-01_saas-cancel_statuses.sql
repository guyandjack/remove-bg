-- SaaS cancellation: add independent flags + canceling state
-- Date: 2026-05-01
--
-- IMPORTANT:
-- - Run once on the target database (DEV/PREPROD/PROD).
-- - If you already applied part of it, some ALTERs may fail (duplicate column).
--   In that case, remove the already-applied lines and re-run.

-- 1) User: marketing consent + deletion request (independent from subscription)
ALTER TABLE `User`
  ADD COLUMN `marketing_consent` TINYINT(1) NOT NULL DEFAULT 0 AFTER `password_hash`,
  ADD COLUMN `marketing_consent_updated_at` DATETIME NULL AFTER `marketing_consent`,
  ADD COLUMN `account_deletion_requested` TINYINT(1) NOT NULL DEFAULT 0 AFTER `marketing_consent_updated_at`,
  ADD COLUMN `account_deletion_requested_at` DATETIME NULL AFTER `account_deletion_requested`;

-- 2) Subscription: add canceling + Stripe cancel_at_period_end mirror + access window
-- Add new enum value `canceling` (MySQL requires restating the full enum list)
ALTER TABLE `Subscription`
  MODIFY COLUMN `status` ENUM(
    'active',
    'canceling',
    'canceled',
    'past_due',
    'expired',
    'incomplete',
    'incomplete_expired',
    'trialing',
    'unpaid',
    'paused'
  ) NOT NULL DEFAULT 'active';

ALTER TABLE `Subscription`
  ADD COLUMN `stripe_cancel_at_period_end` TINYINT(1) NOT NULL DEFAULT 0 AFTER `canceled_at`,
  ADD COLUMN `current_period_end` DATETIME NULL AFTER `stripe_cancel_at_period_end`,
  ADD COLUMN `plan_access_until` DATETIME NULL AFTER `current_period_end`;

-- 3) Backfill for existing rows (safe defaults)
UPDATE `Subscription`
SET
  `current_period_end` = COALESCE(`current_period_end`, `period_end`),
  `plan_access_until` = COALESCE(`plan_access_until`, `period_end`)
WHERE `period_end` IS NOT NULL;

