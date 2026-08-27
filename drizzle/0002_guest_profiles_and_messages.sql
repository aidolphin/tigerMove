CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`guest_id` text NOT NULL UNIQUE,
	`name` text DEFAULT 'Guest' NOT NULL,
	`email` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`match_id` text NOT NULL,
	`sender_token` text NOT NULL,
	`sender_name` text NOT NULL,
	`body` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE no action
);