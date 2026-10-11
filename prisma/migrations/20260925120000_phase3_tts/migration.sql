-- AlterTable
ALTER TABLE `Chapter` ADD COLUMN `currentAudioFileId` CHAR(36) NULL;

-- CreateTable
CREATE TABLE `AudioFile` (
    `id` CHAR(36) NOT NULL,
    `projectId` CHAR(36) NOT NULL,
    `chapterId` CHAR(36) NULL,
    `type` ENUM('CHAPTER_AUDIO', 'PREVIEW', 'UPLOAD', 'MASTER', 'EXPORT') NOT NULL,
    `objectKey` VARCHAR(1024) NOT NULL,
    `format` ENUM('MP3', 'WAV', 'M4A') NOT NULL,
    `mimeType` VARCHAR(255) NULL,
    `durationSeconds` DECIMAL(12, 3) NULL,
    `sizeBytes` BIGINT NULL,
    `sampleRate` INTEGER NULL,
    `bitrate` INTEGER NULL,
    `provider` VARCHAR(100) NULL,
    `providerVoiceId` VARCHAR(255) NULL,
    `generationJobId` CHAR(36) NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AudioFile_chapterId_createdAt_idx`(`chapterId`, `createdAt`),
    INDEX `AudioFile_projectId_createdAt_idx`(`projectId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UsageRecord` (
    `id` CHAR(36) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `projectId` CHAR(36) NULL,
    `jobId` CHAR(36) NULL,
    `type` ENUM('TTS_CHARACTERS', 'AUDIO_SECONDS', 'EXPORT', 'STORAGE_BYTES') NOT NULL,
    `quantity` DECIMAL(18, 4) NOT NULL,
    `unit` VARCHAR(30) NOT NULL,
    `provider` VARCHAR(100) NULL,
    `periodStart` DATETIME(3) NOT NULL,
    `periodEnd` DATETIME(3) NOT NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `UsageRecord_userId_type_periodStart_idx`(`userId`, `type`, `periodStart`),
    INDEX `UsageRecord_userId_createdAt_idx`(`userId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `Chapter_currentAudioFileId_key` ON `Chapter`(`currentAudioFileId`);

-- AddForeignKey
ALTER TABLE `AudioFile` ADD CONSTRAINT `AudioFile_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AudioFile` ADD CONSTRAINT `AudioFile_chapterId_fkey` FOREIGN KEY (`chapterId`) REFERENCES `Chapter`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AudioFile` ADD CONSTRAINT `AudioFile_generationJobId_fkey` FOREIGN KEY (`generationJobId`) REFERENCES `GenerationJob`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Chapter` ADD CONSTRAINT `Chapter_currentAudioFileId_fkey` FOREIGN KEY (`currentAudioFileId`) REFERENCES `AudioFile`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UsageRecord` ADD CONSTRAINT `UsageRecord_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UsageRecord` ADD CONSTRAINT `UsageRecord_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
