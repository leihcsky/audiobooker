-- AlterTable
ALTER TABLE `AnonymousSession` ADD COLUMN `ipHash` CHAR(64) NULL;

-- CreateIndex
CREATE INDEX `AnonymousSession_ipHash_idx` ON `AnonymousSession`(`ipHash`);
