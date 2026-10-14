ALTER TABLE `users`
  ADD COLUMN `preferences` JSON NULL,
  ADD COLUMN `must_change_password` BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN `last_sign_in_at` DATETIME(3) NULL;
--> statement-breakpoint
CREATE TABLE `admin_activity` (
  `id` BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `actor_id` BIGINT NOT NULL,
  `actor_label` VARCHAR(160) NOT NULL,
  `action` VARCHAR(40) NOT NULL,
  `target_type` VARCHAR(20) NOT NULL,
  `target_id` BIGINT NOT NULL,
  `target_label` VARCHAR(190) NOT NULL,
  `before` JSON NULL,
  `after` JSON NULL,
  `occurred_at` DATETIME(3) NOT NULL,
  KEY `idx_admin_activity_occurred` (`occurred_at`),
  CONSTRAINT `fk_admin_activity_actor` FOREIGN KEY (`actor_id`) REFERENCES `users` (`id`)
);
