CREATE TABLE `heirs` (
	`id` varchar(36) NOT NULL,
	`caseId` varchar(36) NOT NULL,
	`personId` varchar(36) NOT NULL,
	`relationType` varchar(100) NOT NULL,
	`share` text,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `heirs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `inheritanceCases` (
	`id` varchar(36) NOT NULL,
	`deceasedId` varchar(36) NOT NULL,
	`totalAsset` text,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `inheritanceCases_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `marriages` (
	`id` varchar(36) NOT NULL,
	`husbandId` varchar(36) NOT NULL,
	`wifeId` varchar(36) NOT NULL,
	`marriageDate` timestamp,
	`marriagePlace` varchar(255),
	`divorceDate` timestamp,
	`isActive` boolean NOT NULL DEFAULT true,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `marriages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `parentChildren` (
	`id` varchar(36) NOT NULL,
	`parentId` varchar(36) NOT NULL,
	`childId` varchar(36) NOT NULL,
	`type` enum('biological','adopted','susuan') NOT NULL DEFAULT 'biological',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `parentChildren_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `persons` (
	`id` varchar(36) NOT NULL,
	`firstName` varchar(255) NOT NULL,
	`lastName` varchar(255),
	`binBinti` varchar(255),
	`prefix` varchar(100),
	`gender` enum('male','female') NOT NULL,
	`birthDate` timestamp,
	`birthPlace` varchar(255),
	`deathDate` timestamp,
	`deathPlace` varchar(255),
	`religion` varchar(100),
	`race` varchar(100),
	`photoUrl` varchar(512),
	`bio` text,
	`isAlive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `persons_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_heirs_caseId` ON `heirs` (`caseId`);--> statement-breakpoint
CREATE INDEX `idx_heirs_personId` ON `heirs` (`personId`);--> statement-breakpoint
CREATE INDEX `idx_inheritanceCases_deceasedId` ON `inheritanceCases` (`deceasedId`);--> statement-breakpoint
CREATE INDEX `idx_marriages_husbandId` ON `marriages` (`husbandId`);--> statement-breakpoint
CREATE INDEX `idx_marriages_wifeId` ON `marriages` (`wifeId`);--> statement-breakpoint
CREATE INDEX `idx_parentChildren_parentId` ON `parentChildren` (`parentId`);--> statement-breakpoint
CREATE INDEX `idx_parentChildren_childId` ON `parentChildren` (`childId`);--> statement-breakpoint
CREATE INDEX `idx_persons_createdAt` ON `persons` (`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_persons_isAlive` ON `persons` (`isAlive`);