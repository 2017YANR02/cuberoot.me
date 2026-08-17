CREATE TABLE `otp_rate_limits` (
	`key_hash` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`window_started_at` integer NOT NULL,
	`attempts` integer NOT NULL,
	`blocked_until` integer,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `otp_rate_limits_scope_updated_idx` ON `otp_rate_limits` (`scope`,`updated_at`);