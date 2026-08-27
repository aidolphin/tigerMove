ALTER TABLE `matches` ADD `status` text DEFAULT 'waiting' NOT NULL;--> statement-breakpoint
ALTER TABLE `matches` ADD `host_token` text NOT NULL;--> statement-breakpoint
ALTER TABLE `matches` ADD `guest_token` text;