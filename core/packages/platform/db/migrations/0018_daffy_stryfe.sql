CREATE TABLE `prompt_templates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`category` text,
	`body` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `prompt_templates_sort_idx` ON `prompt_templates` (`sort_order`);--> statement-breakpoint
ALTER TABLE `qr_codes` ADD `front_art_prompt` text;