CREATE TABLE `circle_members` (
	`user_id` text NOT NULL,
	`circle_id` text NOT NULL,
	`joined_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `circle_id`)
);
--> statement-breakpoint
CREATE INDEX `circle_members_circle_idx` ON `circle_members` (`circle_id`);--> statement-breakpoint
CREATE TABLE `lesson_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`lesson_id` text NOT NULL,
	`course_id` text NOT NULL,
	`position_sec` integer DEFAULT 0 NOT NULL,
	`body` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `lesson_notes_user_lesson_idx` ON `lesson_notes` (`user_id`,`lesson_id`,`position_sec`);--> statement-breakpoint
CREATE INDEX `lesson_notes_user_created_idx` ON `lesson_notes` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`actor_id` text,
	`title` text NOT NULL,
	`body` text,
	`href` text,
	`ref_type` text,
	`ref_id` text,
	`read_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `notifications_user_created_idx` ON `notifications` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `notifications_user_read_idx` ON `notifications` (`user_id`,`read_at`);--> statement-breakpoint
CREATE TABLE `user_achievements` (
	`user_id` text NOT NULL,
	`achievement_key` text NOT NULL,
	`unlocked_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `achievement_key`)
);
--> statement-breakpoint
CREATE INDEX `user_achievements_user_idx` ON `user_achievements` (`user_id`);