CREATE TABLE `learning_progress` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`lesson_id` text NOT NULL,
	`course_id` text NOT NULL,
	`position_sec` integer DEFAULT 0 NOT NULL,
	`completed` integer DEFAULT false NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `learning_progress_user_lesson_unique` ON `learning_progress` (`user_id`,`lesson_id`);--> statement-breakpoint
CREATE INDEX `learning_progress_user_course_idx` ON `learning_progress` (`user_id`,`course_id`);--> statement-breakpoint
CREATE TABLE `lessons` (
	`id` text PRIMARY KEY NOT NULL,
	`course_id` text NOT NULL,
	`idx` integer NOT NULL,
	`title` text NOT NULL,
	`duration_sec` integer,
	`video_key` text,
	`video_url` text,
	`free` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `lessons_course_idx` ON `lessons` (`course_id`,`idx`);