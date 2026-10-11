ALTER TABLE `Compound` MODIFY `id` INT NOT NULL AUTO_INCREMENT;
--> statement-breakpoint
CREATE INDEX `idx_compound_purchase_id` ON `Compound` (`purchase_id`);
