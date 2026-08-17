CREATE TABLE `error_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`ts` integer NOT NULL,
	`level` text DEFAULT 'error' NOT NULL,
	`message` text NOT NULL,
	`stack` text,
	`path` text,
	`user_id` text
);
--> statement-breakpoint
CREATE INDEX `error_logs_ts_idx` ON `error_logs` (`ts`);--> statement-breakpoint
CREATE TABLE `request_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`ts` integer NOT NULL,
	`method` text NOT NULL,
	`path` text NOT NULL,
	`status` integer NOT NULL,
	`duration_ms` integer NOT NULL,
	`user_id` text
);
--> statement-breakpoint
CREATE INDEX `request_logs_ts_idx` ON `request_logs` (`ts`);