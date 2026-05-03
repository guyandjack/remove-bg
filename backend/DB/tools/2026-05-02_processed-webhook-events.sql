-- Webhook idempotency table (Stripe)
-- Date: 2026-05-02

CREATE TABLE IF NOT EXISTS `ProcessedWebhookEvent` (
  id           VARCHAR(255) NOT NULL PRIMARY KEY,
  provider     VARCHAR(32)  NOT NULL DEFAULT 'stripe',
  event_type   VARCHAR(255) NOT NULL,
  received_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at DATETIME     NULL,
  INDEX idx_pwe_type_time (event_type, received_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

