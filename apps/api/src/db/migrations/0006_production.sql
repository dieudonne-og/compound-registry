CREATE TABLE `production` (
  `id` BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `production_code` VARCHAR(32) NOT NULL,
  `tag_number` VARCHAR(32) NOT NULL,
  `production_date` DATE NOT NULL,
  `mineral_type_id` BIGINT NOT NULL,
  `weight_kg` DECIMAL(12,3) NOT NULL,
  `business_location_id` BIGINT NOT NULL,
  `traceability_agent_id` BIGINT NOT NULL,
  `company_id` BIGINT NOT NULL,
  `operator_representative` VARCHAR(120) NOT NULL,
  `version` INT NOT NULL DEFAULT 1,
  `created_by` BIGINT NOT NULL,
  `updated_by` BIGINT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY `uq_production_code` (`production_code`),
  UNIQUE KEY `uq_production_tag` (`tag_number`),
  KEY `idx_production_date` (`production_date`),
  CONSTRAINT `chk_production_weight` CHECK (`weight_kg` > 0),
  CONSTRAINT `fk_production_mineral` FOREIGN KEY (`mineral_type_id`) REFERENCES `mineral_types` (`id`),
  CONSTRAINT `fk_production_location` FOREIGN KEY (`business_location_id`) REFERENCES `business_locations` (`id`),
  CONSTRAINT `fk_production_agent` FOREIGN KEY (`traceability_agent_id`) REFERENCES `traceability_agents` (`id`),
  CONSTRAINT `fk_production_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`),
  CONSTRAINT `fk_production_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_production_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`)
);
--> statement-breakpoint
CREATE TABLE `production_audit_event` (
  `id` BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `production_id` BIGINT NOT NULL,
  `seq` INT NOT NULL,
  `event_type` ENUM('CREATE','UPDATE') NOT NULL,
  `changes` JSON NOT NULL,
  `reason` TEXT NULL,
  `actor_id` BIGINT NOT NULL,
  `actor_label` VARCHAR(160) NOT NULL,
  `occurred_at` DATETIME(3) NOT NULL,
  `prev_hash` CHAR(64) NOT NULL,
  `hash` CHAR(64) NOT NULL,
  UNIQUE KEY `uq_audit_production_seq` (`production_id`, `seq`),
  KEY `idx_audit_occurred_at` (`occurred_at`),
  CONSTRAINT `fk_audit_production` FOREIGN KEY (`production_id`) REFERENCES `production` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_audit_actor` FOREIGN KEY (`actor_id`) REFERENCES `users` (`id`)
);
--> statement-breakpoint
CREATE TRIGGER `trg_audit_no_update` BEFORE UPDATE ON `production_audit_event` FOR EACH ROW
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'production_audit_event is append-only';
--> statement-breakpoint
CREATE TRIGGER `trg_audit_no_delete` BEFORE DELETE ON `production_audit_event` FOR EACH ROW
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'production_audit_event is append-only';
--> statement-breakpoint
CREATE TABLE `idempotency_keys` (
  `idem_key` VARCHAR(64) NOT NULL,
  `user_id` BIGINT NOT NULL,
  `request_hash` CHAR(64) NOT NULL,
  `status_code` INT NULL,
  `response` JSON NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`idem_key`, `user_id`),
  KEY `idx_idempotency_created_at` (`created_at`)
);
