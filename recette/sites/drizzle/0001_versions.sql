CREATE TABLE `deliveries` (
	`run_id` text NOT NULL,
	`revision` integer NOT NULL,
	`published_at` integer NOT NULL,
	`summary` text NOT NULL,
	`draft` text NOT NULL,
	`deadline` text,
	`date_source` text NOT NULL,
	`action` text NOT NULL,
	`extraction` text NOT NULL,
	`pdf` blob NOT NULL,
	PRIMARY KEY(`run_id`, `revision`),
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `runs` ADD `revision` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `runs` ADD `published_revision` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `runs` ADD `closed` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `runs` ADD `lots` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `runs` ADD `last_added` integer DEFAULT 2 NOT NULL;--> statement-breakpoint
ALTER TABLE `runs` ADD `retained_date` text;--> statement-breakpoint
ALTER TABLE `runs` ADD `corrections` text DEFAULT '[]' NOT NULL;