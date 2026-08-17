CREATE TABLE `algorithms` (
	`id` text PRIMARY KEY NOT NULL,
	`category` text NOT NULL,
	`name` text NOT NULL,
	`notation` text NOT NULL,
	`puzzle` text DEFAULT '333' NOT NULL,
	`case_group` text,
	`description` text,
	`hint` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `algorithms_category_idx` ON `algorithms` (`category`,`sort_order`);--> statement-breakpoint
CREATE INDEX `algorithms_puzzle_idx` ON `algorithms` (`puzzle`);--> statement-breakpoint
CREATE TABLE `certificates` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`user_id` text NOT NULL,
	`course_id` text NOT NULL,
	`user_name` text NOT NULL,
	`course_title` text NOT NULL,
	`issued_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `certificates_code_unique` ON `certificates` (`code`);--> statement-breakpoint
CREATE UNIQUE INDEX `certificates_user_course_unique` ON `certificates` (`user_id`,`course_id`);--> statement-breakpoint
CREATE INDEX `certificates_code_idx` ON `certificates` (`code`);--> statement-breakpoint
CREATE TABLE `collection_items` (
	`id` text PRIMARY KEY NOT NULL,
	`collection_id` text NOT NULL,
	`course_id` text NOT NULL,
	`idx` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `collection_items_collection_idx` ON `collection_items` (`collection_id`,`idx`);--> statement-breakpoint
CREATE UNIQUE INDEX `collection_items_unique` ON `collection_items` (`collection_id`,`course_id`);--> statement-breakpoint
CREATE TABLE `collections` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`subtitle` text,
	`description` text,
	`cover_url` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `quiz_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`quiz_id` text NOT NULL,
	`lesson_id` text NOT NULL,
	`selected_idx` integer NOT NULL,
	`correct` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `quiz_attempts_user_lesson_idx` ON `quiz_attempts` (`user_id`,`lesson_id`);--> statement-breakpoint
CREATE TABLE `quizzes` (
	`id` text PRIMARY KEY NOT NULL,
	`lesson_id` text NOT NULL,
	`course_id` text NOT NULL,
	`question` text NOT NULL,
	`options` text NOT NULL,
	`answer_idx` integer NOT NULL,
	`explain` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `quizzes_lesson_idx` ON `quizzes` (`lesson_id`,`sort_order`);--> statement-breakpoint
ALTER TABLE `products` ADD `member_only` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `member_price` integer;