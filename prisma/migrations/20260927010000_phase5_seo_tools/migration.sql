-- CreateTable
CREATE TABLE `AnonymousSession` (
    `id` CHAR(36) NOT NULL,
    `tokenHash` VARCHAR(128) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NOT NULL,
    `lastSeenAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `AnonymousSession_tokenHash_key`(`tokenHash`),
    INDEX `AnonymousSession_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AlterTable
ALTER TABLE `Project` MODIFY `userId` CHAR(36) NULL,
    ADD COLUMN `anonymousSessionId` CHAR(36) NULL,
    ADD COLUMN `expiresAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `UsageRecord` MODIFY `userId` CHAR(36) NULL,
    ADD COLUMN `anonymousSessionId` CHAR(36) NULL;

-- CreateTable
CREATE TABLE `ToolEvent` (
    `id` CHAR(36) NOT NULL,
    `anonymousSessionId` CHAR(36) NULL,
    `userId` CHAR(36) NULL,
    `projectId` CHAR(36) NULL,
    `name` VARCHAR(80) NOT NULL,
    `path` VARCHAR(255) NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ToolEvent_name_createdAt_idx`(`name`, `createdAt`),
    INDEX `ToolEvent_anonymousSessionId_createdAt_idx`(`anonymousSessionId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Project_anonymousSessionId_createdAt_idx` ON `Project`(`anonymousSessionId`, `createdAt`);

-- CreateIndex
CREATE INDEX `Project_expiresAt_idx` ON `Project`(`expiresAt`);

-- CreateIndex
CREATE INDEX `UsageRecord_anonymousSessionId_type_createdAt_idx` ON `UsageRecord`(`anonymousSessionId`, `type`, `createdAt`);

-- AddForeignKey
ALTER TABLE `Project` ADD CONSTRAINT `Project_anonymousSessionId_fkey` FOREIGN KEY (`anonymousSessionId`) REFERENCES `AnonymousSession`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UsageRecord` ADD CONSTRAINT `UsageRecord_anonymousSessionId_fkey` FOREIGN KEY (`anonymousSessionId`) REFERENCES `AnonymousSession`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ToolEvent` ADD CONSTRAINT `ToolEvent_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ToolEvent` ADD CONSTRAINT `ToolEvent_anonymousSessionId_fkey` FOREIGN KEY (`anonymousSessionId`) REFERENCES `AnonymousSession`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
