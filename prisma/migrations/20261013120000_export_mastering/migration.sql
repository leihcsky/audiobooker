-- AlterTable
ALTER TABLE `Export` ADD COLUMN `masteringPreset` VARCHAR(50) NULL,
    ADD COLUMN `qcReport` JSON NULL;
