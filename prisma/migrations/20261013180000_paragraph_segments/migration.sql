-- AlterTable
ALTER TABLE `AudioFile` ADD COLUMN `segmentManifest` JSON NULL;

-- AlterTable
ALTER TABLE `GenerationJob` ADD COLUMN `retryParagraphs` JSON NULL;
