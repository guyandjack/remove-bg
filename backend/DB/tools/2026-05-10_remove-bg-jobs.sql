-- Remove BG jobs table (Replicate async flow source of truth)
-- Date: 2026-05-10
--
-- Notes:
-- - request_id is a client-generated UUID (idempotency key).
-- - replicate_prediction_id is nullable until the prediction is created.
-- - output_url is stored as TEXT to support long signed URLs.
-- - Webhook idempotency is handled separately via ProcessedWebhookEvent
--   (provider='replicate', id=<webhook-id>), to be wired in step C.

CREATE TABLE IF NOT EXISTS `RemoveBgJobs` (
  id                      VARCHAR(36)  NOT NULL PRIMARY KEY,
  user_id                 VARCHAR(36)  NULL,
  request_id              VARCHAR(64)  NOT NULL,
  idempotency_key         VARCHAR(64)  NOT NULL,
  replicate_prediction_id VARCHAR(255) NULL,
  status                  ENUM('pending','processing','succeeded','failed','canceled') NOT NULL DEFAULT 'pending',
  replicate_status        VARCHAR(32)  NULL,
  input_image_url         TEXT         NULL,
  output_image_url        TEXT         NULL,
  replicate_payload       JSON         NULL,
  error_message           TEXT         NULL,
  credits_debited_at      DATETIME     NULL,
  created_at              TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at              TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  completed_at            DATETIME     NULL,

  UNIQUE KEY uniq_remove_bg_user_idempotency (user_id, idempotency_key),
  UNIQUE KEY uniq_remove_bg_request (request_id),
  UNIQUE KEY uniq_remove_bg_prediction (replicate_prediction_id),
  INDEX idx_remove_bg_user (user_id),
  INDEX idx_remove_bg_status (status),
  INDEX idx_remove_bg_created_at (created_at),

  CONSTRAINT fk_remove_bg_job_user
    FOREIGN KEY (user_id) REFERENCES `User`(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
