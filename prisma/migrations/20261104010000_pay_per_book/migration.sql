-- AlterEnum
ALTER TABLE `BillingOrder` MODIFY `kind` ENUM('SUBSCRIPTION', 'MINUTE_PACK', 'PAY_PER_BOOK') NOT NULL;

-- AlterTable
ALTER TABLE `BillingOrder` ADD COLUMN `projectId` CHAR(36) NULL;

-- AlterTable
ALTER TABLE `GenerationJob` ADD COLUMN `billingSource` ENUM('MINUTES', 'PAY_PER_BOOK') NULL,
    ADD COLUMN `payPerBookOrderId` CHAR(36) NULL;

-- CreateTable
CREATE TABLE `PayPerBookQuote` (
    `id` CHAR(36) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `projectId` CHAR(36) NOT NULL,
    `selectedChapterIds` JSON NOT NULL,
    `selectedWordCount` INTEGER NOT NULL,
    `estimatedMinutes` DECIMAL(12, 4) NOT NULL,
    `billableMinutes` INTEGER NOT NULL,
    `pricePerMinute` DECIMAL(10, 4) NOT NULL,
    `totalAmount` DECIMAL(10, 2) NOT NULL,
    `currency` VARCHAR(3) NOT NULL DEFAULT 'USD',
    `provider` VARCHAR(100) NOT NULL,
    `voiceId` VARCHAR(255) NOT NULL,
    `voiceName` VARCHAR(255) NOT NULL,
    `speed` DECIMAL(3, 2) NOT NULL DEFAULT 1.00,
    `chapterHashes` JSON NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `PayPerBookQuote_userId_createdAt_idx`(`userId`, `createdAt`),
    INDEX `PayPerBookQuote_projectId_createdAt_idx`(`projectId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PayPerBookOrder` (
    `id` CHAR(36) NOT NULL,
    `billingOrderId` CHAR(36) NOT NULL,
    `quoteId` CHAR(36) NULL,
    `userId` CHAR(36) NOT NULL,
    `projectId` CHAR(36) NOT NULL,
    `selectedWordCount` INTEGER NOT NULL,
    `estimatedMinutes` DECIMAL(12, 4) NOT NULL,
    `billableMinutes` INTEGER NOT NULL,
    `pricePerMinute` DECIMAL(10, 4) NOT NULL,
    `totalAmount` DECIMAL(10, 2) NOT NULL,
    `currency` VARCHAR(3) NOT NULL DEFAULT 'USD',
    `provider` VARCHAR(100) NOT NULL,
    `voiceId` VARCHAR(255) NOT NULL,
    `voiceName` VARCHAR(255) NOT NULL,
    `speed` DECIMAL(3, 2) NOT NULL DEFAULT 1.00,
    `status` ENUM('PENDING_PAYMENT', 'PAID', 'GENERATING', 'COMPLETED', 'PARTIALLY_COMPLETED', 'FAILED', 'CANCELLED', 'REFUNDED') NOT NULL DEFAULT 'PENDING_PAYMENT',
    `generationJobId` CHAR(36) NULL,
    `paidAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PayPerBookOrder_billingOrderId_key`(`billingOrderId`),
    INDEX `PayPerBookOrder_userId_createdAt_idx`(`userId`, `createdAt`),
    INDEX `PayPerBookOrder_projectId_createdAt_idx`(`projectId`, `createdAt`),
    INDEX `PayPerBookOrder_status_createdAt_idx`(`status`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PayPerBookOrderChapter` (
    `id` CHAR(36) NOT NULL,
    `orderId` CHAR(36) NOT NULL,
    `chapterId` CHAR(36) NULL,
    `title` VARCHAR(500) NOT NULL,
    `wordCount` INTEGER NOT NULL,
    `characterCount` INTEGER NOT NULL,
    `textHash` CHAR(64) NOT NULL,
    `sourceText` LONGTEXT NOT NULL,
    `voiceId` VARCHAR(255) NOT NULL,
    `status` ENUM('PENDING', 'QUEUED', 'GENERATING', 'COMPLETED', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `generationJobId` CHAR(36) NULL,
    `audioFileId` CHAR(36) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `PayPerBookOrderChapter_orderId_status_idx`(`orderId`, `status`),
    UNIQUE INDEX `PayPerBookOrderChapter_orderId_chapterId_key`(`orderId`, `chapterId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `BillingOrder_projectId_createdAt_idx` ON `BillingOrder`(`projectId`, `createdAt`);

-- CreateIndex
CREATE INDEX `GenerationJob_payPerBookOrderId_idx` ON `GenerationJob`(`payPerBookOrderId`);

-- AddForeignKey
ALTER TABLE `BillingOrder` ADD CONSTRAINT `BillingOrder_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GenerationJob` ADD CONSTRAINT `GenerationJob_payPerBookOrderId_fkey` FOREIGN KEY (`payPerBookOrderId`) REFERENCES `PayPerBookOrder`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PayPerBookQuote` ADD CONSTRAINT `PayPerBookQuote_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PayPerBookQuote` ADD CONSTRAINT `PayPerBookQuote_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PayPerBookOrder` ADD CONSTRAINT `PayPerBookOrder_billingOrderId_fkey` FOREIGN KEY (`billingOrderId`) REFERENCES `BillingOrder`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PayPerBookOrder` ADD CONSTRAINT `PayPerBookOrder_quoteId_fkey` FOREIGN KEY (`quoteId`) REFERENCES `PayPerBookQuote`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PayPerBookOrder` ADD CONSTRAINT `PayPerBookOrder_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PayPerBookOrder` ADD CONSTRAINT `PayPerBookOrder_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PayPerBookOrderChapter` ADD CONSTRAINT `PayPerBookOrderChapter_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `PayPerBookOrder`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PayPerBookOrderChapter` ADD CONSTRAINT `PayPerBookOrderChapter_chapterId_fkey` FOREIGN KEY (`chapterId`) REFERENCES `Chapter`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
