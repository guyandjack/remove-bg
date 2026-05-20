-- Image conversion credits (per subscription billing period)
-- Keeps this separate from `CreditUsage` to avoid mixing AI credits with conversion credits.

CREATE TABLE IF NOT EXISTS `SubscriptionConversionQuota` (
  `subscription_id` VARCHAR(36) NOT NULL,
  `period_start` DATETIME NOT NULL,
  `period_end` DATETIME NOT NULL,
  `used` INT NOT NULL DEFAULT 0,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`subscription_id`),
  INDEX `idx_subscription_conversion_quota_period` (`subscription_id`, `period_start`, `period_end`),
  CONSTRAINT `fk_subscription_conversion_quota_subscription`
    FOREIGN KEY (`subscription_id`) REFERENCES `Subscription`(`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
