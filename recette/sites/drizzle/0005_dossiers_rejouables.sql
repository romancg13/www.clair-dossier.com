CREATE TABLE `dossier_slots` (
	`sandbox` text NOT NULL,
	`persona` text NOT NULL,
	`dossier_id` text NOT NULL,
	`scenario` text NOT NULL,
	`generation` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`sandbox`, `persona`),
	FOREIGN KEY (`sandbox`) REFERENCES `sandboxes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `run_inputs` (
	`run_id` text NOT NULL,
	`fixture` text NOT NULL,
	`bytes` blob NOT NULL,
	PRIMARY KEY(`run_id`, `fixture`),
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `deliveries` ADD `files` text;--> statement-breakpoint
ALTER TABLE `deliveries` ADD `extracted_date` text;--> statement-breakpoint
ALTER TABLE `deliveries` ADD `extracted_source` text;--> statement-breakpoint
ALTER TABLE `connector_grants` ADD `run_id` text REFERENCES runs(id) ON DELETE cascade;
