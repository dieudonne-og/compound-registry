-- Keep an existing row with id 0 as 0 instead of renumbering it during the conversion.
SET SESSION sql_mode = CONCAT(@@SESSION.sql_mode, ',NO_AUTO_VALUE_ON_ZERO');
--> statement-breakpoint
ALTER TABLE `Compound` MODIFY `id` INT NOT NULL AUTO_INCREMENT;
--> statement-breakpoint
SET SESSION sql_mode = REPLACE(@@SESSION.sql_mode, 'NO_AUTO_VALUE_ON_ZERO', '');
--> statement-breakpoint
CREATE INDEX `idx_compound_purchase_id` ON `Compound` (`purchase_id`);
