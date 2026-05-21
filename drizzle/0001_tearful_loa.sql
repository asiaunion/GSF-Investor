CREATE TABLE `dividend_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`stock_id` integer NOT NULL,
	`ex_date` text,
	`pay_date` text,
	`amount_per_share` real NOT NULL,
	`currency` text DEFAULT 'KRW' NOT NULL,
	`source` text,
	`fetched_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`stock_id`) REFERENCES `stocks`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_dividend_events` ON `dividend_events` (`stock_id`,`ex_date`,`pay_date`);--> statement-breakpoint
CREATE TABLE `user_preferences` (
	`id` integer PRIMARY KEY NOT NULL,
	`base_currency` text DEFAULT 'KRW' NOT NULL,
	`updated_at` text DEFAULT (datetime('now'))
);
