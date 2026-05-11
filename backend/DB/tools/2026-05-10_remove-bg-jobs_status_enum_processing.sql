-- Fix RemoveBgJobs.status enum to include 'processing'
-- Date: 2026-05-10
--
-- Symptom:
--   Data truncated for column 'status' at row 1
-- when backend tries to set status='processing' but the table was created with an older ENUM set.

ALTER TABLE `RemoveBgJobs`
  MODIFY COLUMN `status`
    ENUM('pending','processing','succeeded','failed','canceled')
    NOT NULL DEFAULT 'pending';

