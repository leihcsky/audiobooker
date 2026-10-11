-- CreateTable
CREATE TABLE `SourceFile` (
    `id` CHAR(36) NOT NULL,
    `projectId` CHAR(36) NOT NULL,
    `type` ENUM('EPUB', 'PDF', 'TXT', 'DOCX') NOT NULL,
    `originalFilename` VARCHAR(512) NOT NULL,
    `objectKey` VARCHAR(1024) NOT NULL,
    `mimeType` VARCHAR(255) NOT NULL,
    `sizeBytes` BIGINT NOT NULL,
    `checksum` VARCHAR(128) NULL,
    `status` ENUM('UPLOADING', 'UPLOADED', 'PARSING', 'PARSED', 'FAILED', 'DELETED') NOT NULL DEFAULT 'UPLOADED',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `SourceFile_projectId_createdAt_idx`(`projectId`, `createdAt`),
    INDEX `SourceFile_projectId_status_idx`(`projectId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Chapter` (
    `id` CHAR(36) NOT NULL,
    `projectId` CHAR(36) NOT NULL,
    `title` VARCHAR(500) NOT NULL,
    `orderIndex` INTEGER NOT NULL,
    `sourceText` LONGTEXT NOT NULL,
    `characterCount` INTEGER NOT NULL DEFAULT 0,
    `status` ENUM('PENDING', 'GENERATING', 'READY', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `selectedVoiceId` VARCHAR(255) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Chapter_projectId_orderIndex_idx`(`projectId`, `orderIndex`),
    INDEX `Chapter_projectId_status_idx`(`projectId`, `status`),
    UNIQUE INDEX `Chapter_projectId_orderIndex_key`(`projectId`, `orderIndex`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GenerationJob` (
    `id` CHAR(36) NOT NULL,
    `projectId` CHAR(36) NOT NULL,
    `chapterId` CHAR(36) NULL,
    `type` ENUM('PARSE_SOURCE', 'GENERATE_TTS', 'GENERATE_PREVIEW', 'EXPORT_MP3', 'EXPORT_M4B', 'EXPORT_ZIP', 'MASTER_AUDIO') NOT NULL,
    `status` ENUM('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED') NOT NULL DEFAULT 'QUEUED',
    `provider` VARCHAR(100) NULL,
    `voiceId` VARCHAR(255) NULL,
    `inputCharacters` INTEGER NULL,
    `estimatedCost` DECIMAL(12, 4) NULL,
    `actualCost` DECIMAL(12, 4) NULL,
    `errorCode` VARCHAR(100) NULL,
    `errorMessage` TEXT NULL,
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `startedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `GenerationJob_projectId_createdAt_idx`(`projectId`, `createdAt`),
    INDEX `GenerationJob_chapterId_createdAt_idx`(`chapterId`, `createdAt`),
    INDEX `GenerationJob_status_createdAt_idx`(`status`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `SourceFile` ADD CONSTRAINT `SourceFile_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Chapter` ADD CONSTRAINT `Chapter_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GenerationJob` ADD CONSTRAINT `GenerationJob_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GenerationJob` ADD CONSTRAINT `GenerationJob_chapterId_fkey` FOREIGN KEY (`chapterId`) REFERENCES `Chapter`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
