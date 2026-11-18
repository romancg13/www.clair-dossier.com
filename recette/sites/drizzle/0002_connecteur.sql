CREATE TABLE `connector_grants` (
	`subject` text PRIMARY KEY NOT NULL,
	`sandbox` text NOT NULL,
	`persona` text NOT NULL,
	`expires` integer NOT NULL,
	FOREIGN KEY (`sandbox`) REFERENCES `sandboxes`(`id`) ON UPDATE no action ON DELETE cascade
);
