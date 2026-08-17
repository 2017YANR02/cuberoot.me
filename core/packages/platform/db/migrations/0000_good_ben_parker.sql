CREATE TABLE `courses` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`subtitle` text NOT NULL,
	`level` text NOT NULL,
	`format` text NOT NULL,
	`instructor` text NOT NULL,
	`duration_hours` integer NOT NULL,
	`lessons` integer NOT NULL,
	`price` integer NOT NULL,
	`students_enrolled` integer NOT NULL,
	`rating` real NOT NULL,
	`highlights` text NOT NULL,
	`outline` text NOT NULL,
	`tags` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`type` text NOT NULL,
	`status` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text,
	`city` text NOT NULL,
	`venue` text NOT NULL,
	`capacity` integer NOT NULL,
	`registered` integer NOT NULL,
	`fee` integer NOT NULL,
	`events` text NOT NULL,
	`description` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `instructors` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`title` text NOT NULL,
	`city` text NOT NULL,
	`specialty` text NOT NULL,
	`students_taught` integer NOT NULL,
	`years_teaching` integer NOT NULL,
	`best_record` text NOT NULL,
	`bio` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `news` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`date` text NOT NULL,
	`category` text NOT NULL,
	`excerpt` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`brand` text NOT NULL,
	`price` integer NOT NULL,
	`original_price` integer,
	`rating` real NOT NULL,
	`reviews` integer NOT NULL,
	`description` text NOT NULL,
	`features` text NOT NULL,
	`in_stock` integer NOT NULL
);
