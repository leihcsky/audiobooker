-- AlterTable
ALTER TABLE `Chapter`
    ADD COLUMN `selectedSpeed` DECIMAL(3, 2) NOT NULL DEFAULT 1.00,
    ADD COLUMN `included` BOOLEAN NOT NULL DEFAULT true;
