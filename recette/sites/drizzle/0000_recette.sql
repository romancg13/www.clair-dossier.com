CREATE TABLE `sandboxes` (
	`id` text PRIMARY KEY NOT NULL,
	`persona` text NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `runs` (
	`id` text PRIMARY KEY NOT NULL,
	`sandbox` text NOT NULL,
	`persona` text NOT NULL,
	`status` text NOT NULL,
	`submitted` integer NOT NULL,
	`due` integer NOT NULL,
	`input_pdf` blob NOT NULL,
	`input_scan` blob NOT NULL,
	`lease` text,
	`lease_end` integer,
	`attempts` integer DEFAULT 0 NOT NULL,
	`published_at` integer,
	`summary` text,
	`draft` text,
	`output_pdf` blob,
	`notifications` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`sandbox`) REFERENCES `sandboxes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `one_pair_per_persona` ON `runs` (`sandbox`,`persona`);--> statement-breakpoint
CREATE INDEX `ready_runs` ON `runs` (`status`,`due`);