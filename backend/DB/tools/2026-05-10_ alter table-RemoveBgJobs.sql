ALTER TABLE `RemoveBgJobs`
  MODIFY COLUMN `status`
    ENUM('pending','processing','succeeded','failed','canceled')
    NOT NULL DEFAULT 'pending';
