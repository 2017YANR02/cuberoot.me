CREATE TABLE `coupons` (
	`code` text PRIMARY KEY NOT NULL,
	`discount_type` text NOT NULL,
	`discount_value` integer NOT NULL,
	`applies_to` text DEFAULT 'any' NOT NULL,
	`min_amount` integer DEFAULT 0 NOT NULL,
	`max_uses` integer DEFAULT 0 NOT NULL,
	`uses` integer DEFAULT 0 NOT NULL,
	`expires_at` integer,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `events_track` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`payload` text,
	`user_id` text,
	`anon_id` text,
	`url` text,
	`referer` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `events_track_name_created_idx` ON `events_track` (`name`,`created_at`);--> statement-breakpoint
CREATE TABLE `invite_codes` (
	`code` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`uses` integer DEFAULT 0 NOT NULL,
	`reward_coupon` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `invite_codes_owner_idx` ON `invite_codes` (`owner_id`);--> statement-breakpoint
CREATE TABLE `qr_codes` (
	`code` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`target` text DEFAULT '/' NOT NULL,
	`scans` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `orders` ADD `discount` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `coupon_code` text;