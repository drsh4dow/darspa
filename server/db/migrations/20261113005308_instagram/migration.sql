CREATE TABLE `instagramConnection` (
	`id` integer PRIMARY KEY,
	`token` text NOT NULL,
	`seed` text NOT NULL,
	`expiresAt` integer NOT NULL,
	`status` text NOT NULL,
	`lastSuccessAt` integer,
	`nextRefreshAt` integer DEFAULT 0 NOT NULL,
	`lease` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `instagramPosts` (
	`id` text PRIMARY KEY,
	`caption` text NOT NULL,
	`mediaType` text NOT NULL,
	`thumbnailUrl` text NOT NULL,
	`permalink` text NOT NULL,
	`postedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `instagram_post_recent` ON `instagramPosts` (`postedAt`);