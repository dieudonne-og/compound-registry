CREATE TABLE `companies` (
  `id` BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(120) NOT NULL,
  `active` BOOLEAN NOT NULL DEFAULT TRUE,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY `uq_companies_name` (`name`)
);
--> statement-breakpoint
CREATE TABLE `business_locations` (
  `id` BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(120) NOT NULL,
  `active` BOOLEAN NOT NULL DEFAULT TRUE,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY `uq_business_locations_name` (`name`)
);
--> statement-breakpoint
CREATE TABLE `traceability_agents` (
  `id` BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(120) NOT NULL,
  `active` BOOLEAN NOT NULL DEFAULT TRUE,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY `uq_traceability_agents_name` (`name`)
);
--> statement-breakpoint
CREATE TABLE `mineral_types` (
  `id` BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `code` VARCHAR(8) NOT NULL,
  `name` VARCHAR(120) NOT NULL,
  `active` BOOLEAN NOT NULL DEFAULT TRUE,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY `uq_mineral_types_code` (`code`),
  UNIQUE KEY `uq_mineral_types_name` (`name`)
);
