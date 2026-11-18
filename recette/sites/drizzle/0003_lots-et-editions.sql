CREATE TABLE `lot_events` (
	`run_id` text NOT NULL,
	`revision` integer NOT NULL,
	`submitted` integer NOT NULL,
	`published_at` integer,
	`published_revision` integer,
	PRIMARY KEY(`run_id`, `revision`),
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `runs` ADD `lot_command` text;--> statement-breakpoint
ALTER TABLE `deliveries` ADD `pack` blob;--> statement-breakpoint
ALTER TABLE `deliveries` ADD `file_count` integer DEFAULT 1 NOT NULL;