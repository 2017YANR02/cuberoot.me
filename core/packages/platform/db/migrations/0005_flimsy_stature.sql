CREATE TABLE `payment_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`kind` text NOT NULL,
	`payload` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `payment_logs_order_created_idx` ON `payment_logs` (`order_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `orders` ADD `refunded_at` integer;--> statement-breakpoint
ALTER TABLE `orders` ADD `refund_amount` integer;