CREATE TABLE `matches` (
	`id` text PRIMARY KEY NOT NULL,
	`state` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `moves` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`match_id` text NOT NULL,
	`piece_id` text NOT NULL,
	`to_x` integer NOT NULL,
	`to_y` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE no action
);
