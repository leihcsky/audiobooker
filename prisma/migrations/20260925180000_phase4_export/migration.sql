-- AlterTable
ALTER TABLE `Project` ADD COLUMN `copyright` VARCHAR(255) NULL,
    ADD COLUMN `narrator` VARCHAR(255) NULL,
    ADD COLUMN `publisher` VARCHAR(255) NULL;

-- CreateTable
CREATE TABLE `Export` (
    `id` CHAR(36) NOT NULL,
    `projectId` CHAR(36) NOT NULL,
    `type` ENUM('MP3', 'M4B', 'ZIP') NOT NULL,
    `status` ENUM('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'EXPIRED') NOT NULL DEFAULT 'QUEUED',
    `objectKey` VARCHAR(1024) NULL,
    `format` VARCHAR(20) NOT NULL,
    `sizeBytes` BIGINT NULL,
    `durationSeconds` DECIMAL(12, 3) NULL,
    `errorMessage` TEXT NULL,
    `expiresAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `completedAt` DATETIME(3) NULL,
    `generationJobId` CHAR(36) NULL,

    INDEX `Export_projectId_createdAt_idx`(`projectId`, `createdAt`),
    INDEX `Export_status_createdAt_idx`(`status`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Export` ADD CONSTRAINT `Export_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Export` ADD CONSTRAINT `Export_generationJobId_fkey` FOREIGN KEY (`generationJobId`) REFERENCES `GenerationJob`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
