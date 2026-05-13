-- Remove BG visitor jobs table (Replicate async flow, no auth)
-- Date: 2026-05-13
--
-- Notes:
-- - visitor_hashed_ip is sha256(ip + SECRET_SALT_IP_VISITOR), computed server-side.
-- - access_token is an opaque token returned to the client to authorize:
--   - GET /api/services/public/remove-bg/jobs/:requestId?token=...
--   - GET /api/services/public/remove-bg/jobs/:requestId/events?token=...
-- - replicate_prediction_id is nullable until the prediction is created.
-- - output_image_url stores a one-shot download URL (tokenized) to an optimized PNG stored server-side.
-- - No foreign keys: visitors are anonymous.

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
  replicate_payload       JSON         NULL,
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

