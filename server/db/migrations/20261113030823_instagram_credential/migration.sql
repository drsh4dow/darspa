ALTER TABLE `instagramConnection` ADD `credential` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `instagramConnection` DROP COLUMN `token`;--> statement-breakpoint
ALTER TABLE `instagramConnection` DROP COLUMN `seed`;--> statement-breakpoint
ALTER TABLE `instagramConnection` DROP COLUMN `expiresAt`;