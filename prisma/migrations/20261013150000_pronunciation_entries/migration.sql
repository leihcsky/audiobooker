-- CreateTable
CREATE TABLE `PronunciationEntry` (
    `id` CHAR(36) NOT NULL,
    `projectId` CHAR(36) NOT NULL,
    `term` VARCHAR(100) NOT NULL,
    `replacement` VARCHAR(200) NOT NULL,
    `caseSensitive` BOOLEAN NOT NULL DEFAULT false,
    `wholeWord` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PronunciationEntry_projectId_term_key`(`projectId`, `term`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `PronunciationEntry` ADD CONSTRAINT `PronunciationEntry_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
