CREATE TABLE `instructor_payouts` (
	`id` text PRIMARY KEY NOT NULL,
	`instructor_id` text NOT NULL,
	`period` text NOT NULL,
	`order_count` integer DEFAULT 0 NOT NULL,
	`gross_amount` integer DEFAULT 0 NOT NULL,
	`share_rate` real NOT NULL,
	`share_amount` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`method` text,
	`reference` text,
	`note` text,
	`created_at` integer NOT NULL,
	`paid_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `instructor_payouts_inst_period_unique` ON `instructor_payouts` (`instructor_id`,`period`);--> statement-breakpoint
CREATE INDEX `instructor_payouts_status_idx` ON `instructor_payouts` (`status`);--> statement-breakpoint
CREATE TABLE `memberships` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`plan` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`started_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`order_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `memberships_user_idx` ON `memberships` (`user_id`);--> statement-breakpoint
CREATE INDEX `memberships_expires_idx` ON `memberships` (`expires_at`);