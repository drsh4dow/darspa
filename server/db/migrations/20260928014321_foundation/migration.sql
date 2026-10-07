CREATE TABLE `account` (
	`id` text PRIMARY KEY,
	`accountId` text NOT NULL,
	`providerId` text NOT NULL,
	`userId` text NOT NULL,
	`accessToken` text,
	`refreshToken` text,
	`idToken` text,
	`scope` text,
	`password` text,
	`accessTokenExpiresAt` integer,
	`refreshTokenExpiresAt` integer,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	CONSTRAINT `fk_account_userId_user_id_fk` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `budgets` (
	`key` text PRIMARY KEY,
	`tokens` real NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `deliveries` (
	`id` text PRIMARY KEY,
	`userId` text NOT NULL,
	`voucherId` text NOT NULL,
	`requestId` text NOT NULL,
	`recipient` text NOT NULL,
	`createdAt` integer NOT NULL,
	`status` text NOT NULL,
	`providerId` text,
	`attempts` integer DEFAULT 0 NOT NULL,
	`lease` integer DEFAULT 0 NOT NULL,
	`nextAttemptAt` integer,
	CONSTRAINT `fk_deliveries_userId_user_id_fk` FOREIGN KEY (`userId`) REFERENCES `user`(`id`),
	CONSTRAINT `fk_deliveries_voucherId_vouchers_id_fk` FOREIGN KEY (`voucherId`) REFERENCES `vouchers`(`id`)
);
--> statement-breakpoint
CREATE TABLE `purchases` (
	`id` text PRIMARY KEY,
	`userId` text NOT NULL,
	`requestId` text NOT NULL,
	`createdAt` integer NOT NULL,
	`lines` text NOT NULL,
	`totalClp` integer NOT NULL,
	`buyOrder` text NOT NULL UNIQUE,
	`sessionId` text NOT NULL,
	`environment` text NOT NULL,
	`status` text NOT NULL,
	`token` text UNIQUE,
	`checkoutUrl` text,
	`returnKind` text,
	`result` text,
	`attempts` integer DEFAULT 0 NOT NULL,
	`lease` integer DEFAULT 0 NOT NULL,
	`nextCheckAt` integer,
	`lastCheckedAt` integer,
	`problem` text,
	CONSTRAINT `fk_purchases_userId_user_id_fk` FOREIGN KEY (`userId`) REFERENCES `user`(`id`),
	CONSTRAINT "purchase_amount_positive" CHECK("totalClp" > 0)
);
--> statement-breakpoint
CREATE TABLE `rateLimit` (
	`id` text PRIMARY KEY,
	`key` text NOT NULL UNIQUE,
	`count` integer NOT NULL,
	`lastRequest` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `roleChanges` (
	`id` text PRIMARY KEY,
	`userId` text NOT NULL,
	`from` text NOT NULL,
	`to` text NOT NULL,
	`operator` text NOT NULL,
	`reason` text NOT NULL,
	`at` integer NOT NULL,
	CONSTRAINT `fk_roleChanges_userId_user_id_fk` FOREIGN KEY (`userId`) REFERENCES `user`(`id`)
);
--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY,
	`token` text NOT NULL UNIQUE,
	`userId` text NOT NULL,
	`expiresAt` integer NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`ipAddress` text,
	`userAgent` text,
	CONSTRAINT `fk_session_userId_user_id_fk` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`email` text NOT NULL UNIQUE,
	`emailVerified` integer DEFAULT false NOT NULL,
	`image` text,
	`role` text DEFAULT 'customer' NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expiresAt` integer NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `voucherEvents` (
	`id` text PRIMARY KEY,
	`voucherId` text NOT NULL,
	`kind` text NOT NULL,
	`actorId` text NOT NULL,
	`at` integer NOT NULL,
	`reason` text,
	CONSTRAINT `fk_voucherEvents_voucherId_vouchers_id_fk` FOREIGN KEY (`voucherId`) REFERENCES `vouchers`(`id`),
	CONSTRAINT `fk_voucherEvents_actorId_user_id_fk` FOREIGN KEY (`actorId`) REFERENCES `user`(`id`)
);
--> statement-breakpoint
CREATE TABLE `vouchers` (
	`id` text PRIMARY KEY,
	`code` text NOT NULL UNIQUE,
	`source` text NOT NULL,
	`userId` text,
	`purchaseId` text,
	`unit` integer,
	`terms` text NOT NULL,
	`issuedAt` integer NOT NULL,
	`expiresAt` integer NOT NULL,
	`redeemed` integer DEFAULT false NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`category` text,
	`issuanceReason` text,
	`issuedBy` text,
	`requestId` text,
	CONSTRAINT `fk_vouchers_userId_user_id_fk` FOREIGN KEY (`userId`) REFERENCES `user`(`id`),
	CONSTRAINT `fk_vouchers_purchaseId_purchases_id_fk` FOREIGN KEY (`purchaseId`) REFERENCES `purchases`(`id`),
	CONSTRAINT `fk_vouchers_issuedBy_user_id_fk` FOREIGN KEY (`issuedBy`) REFERENCES `user`(`id`),
	CONSTRAINT "voucher_source_fields" CHECK(("source" = 'webpay' AND "userId" IS NOT NULL AND "purchaseId" IS NOT NULL AND "unit" IS NOT NULL) OR ("source" = 'manual' AND "issuedBy" IS NOT NULL AND "requestId" IS NOT NULL AND "category" IS NOT NULL AND "issuanceReason" IS NOT NULL))
);
--> statement-breakpoint
CREATE INDEX `account_user` ON `account` (`userId`);--> statement-breakpoint
CREATE UNIQUE INDEX `account_provider` ON `account` (`providerId`,`accountId`);--> statement-breakpoint
CREATE UNIQUE INDEX `delivery_request` ON `deliveries` (`userId`,`requestId`);--> statement-breakpoint
CREATE INDEX `delivery_voucher` ON `deliveries` (`voucherId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `delivery_due` ON `deliveries` (`nextAttemptAt`);--> statement-breakpoint
CREATE UNIQUE INDEX `purchases_request` ON `purchases` (`userId`,`requestId`);--> statement-breakpoint
CREATE INDEX `purchases_customer` ON `purchases` (`userId`,`createdAt`,`id`);--> statement-breakpoint
CREATE INDEX `purchases_created` ON `purchases` (`createdAt`,`id`);--> statement-breakpoint
CREATE INDEX `purchases_due` ON `purchases` (`nextCheckAt`);--> statement-breakpoint
CREATE INDEX `session_user` ON `session` (`userId`);--> statement-breakpoint
CREATE INDEX `verification_identifier` ON `verification` (`identifier`);--> statement-breakpoint
CREATE INDEX `voucher_event_history` ON `voucherEvents` (`voucherId`,`at`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `voucher_paid_unit` ON `vouchers` (`purchaseId`,`unit`);--> statement-breakpoint
CREATE UNIQUE INDEX `voucher_issuance` ON `vouchers` (`issuedBy`,`requestId`);--> statement-breakpoint
CREATE INDEX `voucher_customer` ON `vouchers` (`userId`,`issuedAt`,`id`);--> statement-breakpoint
CREATE INDEX `voucher_source` ON `vouchers` (`source`,`issuedAt`,`id`);--> statement-breakpoint
CREATE INDEX `voucher_issued` ON `vouchers` (`issuedAt`,`id`);