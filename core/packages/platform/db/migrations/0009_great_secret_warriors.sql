ALTER TABLE `courses` ADD `instructor_id` text;--> statement-breakpoint
CREATE INDEX `courses_instructor_idx` ON `courses` (`instructor_id`);--> statement-breakpoint
ALTER TABLE `instructors` ADD `user_id` text;--> statement-breakpoint
CREATE INDEX `instructors_user_idx` ON `instructors` (`user_id`);--> statement-breakpoint
ALTER TABLE `users` ADD `instructor_id` text;--> statement-breakpoint
CREATE INDEX `users_instructor_idx` ON `users` (`instructor_id`);