-- AlterTable
ALTER TABLE `GenerationJob` ADD COLUMN `cachedChunks` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `completedChunks` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `currency` VARCHAR(3) NULL,
    ADD COLUMN `providerModel` VARCHAR(100) NULL,
    ADD COLUMN `tier` ENUM('STANDARD', 'PREMIUM') NULL,
    ADD COLUMN `totalChunks` INTEGER NULL;

-- AlterTable
ALTER TABLE `UsageRecord` MODIFY `type` ENUM('TTS_CHARACTERS', 'PREMIUM_TTS_CHARACTERS', 'AUDIO_SECONDS', 'EXPORT', 'STORAGE_BYTES') NOT NULL;

-- CreateTable
CREATE TABLE `TtsCacheEntry` (
    `id` CHAR(36) NOT NULL,
    `cacheKey` CHAR(64) NOT NULL,
    `provider` VARCHAR(100) NOT NULL,
    `providerModel` VARCHAR(100) NOT NULL,
    `providerVoiceId` VARCHAR(255) NOT NULL,
    `textHash` CHAR(64) NOT NULL,
    `characters` INTEGER NOT NULL,
    `objectKey` VARCHAR(1024) NOT NULL,
    `sizeBytes` BIGINT NOT NULL,
    `durationSeconds` DECIMAL(12, 3) NULL,
    `hitCount` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lastUsedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `TtsCacheEntry_cacheKey_key`(`cacheKey`),
    INDEX `TtsCacheEntry_lastUsedAt_idx`(`lastUsedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
