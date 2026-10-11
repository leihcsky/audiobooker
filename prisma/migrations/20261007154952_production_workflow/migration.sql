-- AlterTable
ALTER TABLE `Chapter` ADD COLUMN `audioOutdated` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `GenerationJob` ADD COLUMN `parentJobId` CHAR(36) NULL,
    MODIFY `type` ENUM('PARSE_SOURCE', 'GENERATE_TTS', 'GENERATE_PROJECT', 'GENERATE_PREVIEW', 'EXPORT_MP3', 'EXPORT_M4B', 'EXPORT_ZIP', 'MASTER_AUDIO') NOT NULL;

-- CreateIndex
CREATE INDEX `GenerationJob_parentJobId_idx` ON `GenerationJob`(`parentJobId`);

-- AddForeignKey
ALTER TABLE `GenerationJob` ADD CONSTRAINT `GenerationJob_parentJobId_fkey` FOREIGN KEY (`parentJobId`) REFERENCES `GenerationJob`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;
