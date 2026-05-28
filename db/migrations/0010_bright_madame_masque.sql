ALTER TABLE `qr_codes` ADD `type` text DEFAULT 'redirect' NOT NULL;--> statement-breakpoint
ALTER TABLE `qr_codes` ADD `title` text;--> statement-breakpoint
ALTER TABLE `qr_codes` ADD `intro` text;--> statement-breakpoint
ALTER TABLE `qr_codes` ADD `links` text;--> statement-breakpoint
ALTER TABLE `qr_codes` ADD `term` text;