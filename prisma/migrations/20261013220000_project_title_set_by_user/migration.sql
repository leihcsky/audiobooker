-- AlterTable
ALTER TABLE `Project` ADD COLUMN `titleSetByUser` BOOLEAN NOT NULL DEFAULT false;

-- Studio projects that have not been parsed yet still carry the title the user typed.
UPDATE `Project` SET `titleSetByUser` = true WHERE `userId` IS NOT NULL AND `status` = 'DRAFT';
