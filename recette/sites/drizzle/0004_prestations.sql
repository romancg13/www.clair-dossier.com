CREATE TABLE `service_drafts` (
	`run_id` text NOT NULL,
	`kind` text NOT NULL,
	`result` text NOT NULL,
	`updated` text NOT NULL,
	PRIMARY KEY(`run_id`, `kind`),
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE cascade
);
