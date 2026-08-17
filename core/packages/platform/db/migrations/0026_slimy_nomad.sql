CREATE TABLE `course_reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`course_id` text NOT NULL,
	`user_id` text NOT NULL,
	`rating` integer NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `course_reviews_course_user_unique` ON `course_reviews` (`course_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `course_reviews_course_created_idx` ON `course_reviews` (`course_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `favorites` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `favorites_user_target_unique` ON `favorites` (`user_id`,`target_type`,`target_id`);--> statement-breakpoint
CREATE INDEX `favorites_user_created_idx` ON `favorites` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `point_ledger` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`delta` integer NOT NULL,
	`reason` text NOT NULL,
	`ref_id` text,
	`note` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `point_ledger_user_created_idx` ON `point_ledger` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `study_checkins` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`date` text NOT NULL,
	`source` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `study_checkins_user_date_unique` ON `study_checkins` (`user_id`,`date`);--> statement-breakpoint
CREATE INDEX `study_checkins_user_idx` ON `study_checkins` (`user_id`);--> statement-breakpoint
CREATE TABLE `timer_solves` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`event` text DEFAULT '333' NOT NULL,
	`time_ms` integer NOT NULL,
	`scramble` text NOT NULL,
	`penalty` text DEFAULT 'none' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `timer_solves_user_event_idx` ON `timer_solves` (`user_id`,`event`,`created_at`);--> statement-breakpoint
CREATE INDEX `timer_solves_event_idx` ON `timer_solves` (`event`);