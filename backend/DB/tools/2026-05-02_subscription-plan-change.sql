-- Plan change support (upgrade/downgrade) - Stripe subscription is never recreated.
-- Date: 2026-05-02
--
-- Run on existing databases (DEV/PREPROD/PROD) to support plan changes.

ALTER TABLE `Subscription`
  ADD COLUMN `pending_plan_id` VARCHAR(36) NULL AFTER `plan_access_until`,
  ADD COLUMN `pending_change_type` ENUM('upgrade','downgrade') NULL AFTER `pending_plan_id`,
  ADD COLUMN `pending_change_effective_at` DATETIME NULL AFTER `pending_change_type`,
  ADD COLUMN `stripe_schedule_id` VARCHAR(255) NULL AFTER `pending_change_effective_at`;

ALTER TABLE `Subscription`
  ADD CONSTRAINT `fk_sub_pending_plan`
  FOREIGN KEY (`pending_plan_id`) REFERENCES `Plan`(`id`) ON DELETE SET NULL;

