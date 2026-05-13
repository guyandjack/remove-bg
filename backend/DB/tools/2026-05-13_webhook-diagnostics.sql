-- Webhook diagnostics (Stripe + Replicate)
-- Date: 2026-05-13
--
-- Goal:
-- - Verify that webhooks are received and marked processed
-- - Identify retries (received but not processed, duplicates)
--
-- Tables:
-- - ProcessedWebhookEvent:
--   - provider: 'stripe' or 'replicate'
--   - id: Stripe event id OR 'replicate:<webhook-id>'
--   - received_at / processed_at

-- Pick your DB
USE `wiz_pix`;

-- 1) Quick health: pending (received but not processed yet)
SELECT
  provider,
  event_type,
  COUNT(*) AS pending_count,
  MIN(received_at) AS oldest_pending_at,
  MAX(received_at) AS newest_pending_at
FROM ProcessedWebhookEvent
WHERE processed_at IS NULL
GROUP BY provider, event_type
ORDER BY pending_count DESC, oldest_pending_at ASC;

-- 2) Volumes last 24h (received vs processed)
SELECT
  provider,
  event_type,
  COUNT(*) AS received_24h,
  SUM(processed_at IS NOT NULL) AS processed_24h
FROM ProcessedWebhookEvent
WHERE received_at >= (NOW() - INTERVAL 24 HOUR)
GROUP BY provider, event_type
ORDER BY received_24h DESC;

-- 3) Processing latency last 24h (p95-ish using ordering)
-- Note: MySQL/MariaDB without window functions: approximate by sorting and reading results.
SELECT
  provider,
  event_type,
  TIMESTAMPDIFF(SECOND, received_at, processed_at) AS processing_seconds,
  received_at,
  processed_at,
  id
FROM ProcessedWebhookEvent
WHERE processed_at IS NOT NULL
  AND received_at >= (NOW() - INTERVAL 24 HOUR)
ORDER BY processing_seconds DESC
LIMIT 200;

-- 4) Drilldown: recent Stripe events
SELECT
  id,
  event_type,
  received_at,
  processed_at,
  TIMESTAMPDIFF(SECOND, received_at, processed_at) AS processing_seconds
FROM ProcessedWebhookEvent
WHERE provider = 'stripe'
ORDER BY received_at DESC
LIMIT 200;

-- 5) Drilldown: recent Replicate webhooks
SELECT
  id,
  event_type,
  received_at,
  processed_at,
  TIMESTAMPDIFF(SECOND, received_at, processed_at) AS processing_seconds
FROM ProcessedWebhookEvent
WHERE provider = 'replicate'
ORDER BY received_at DESC
LIMIT 200;

