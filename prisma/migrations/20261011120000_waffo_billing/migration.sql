-- AlterTable
ALTER TABLE `CreditLedger` MODIFY `type` ENUM('MONTHLY_GRANT', 'PURCHASE', 'GENERATION_RESERVE', 'GENERATION_REFUND', 'PURCHASE_REVERSAL', 'PROMOTION', 'ADMIN_ADJUSTMENT') NOT NULL;

-- CreateTable
CREATE TABLE `BillingOrder` (
    `id` CHAR(36) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `provider` VARCHAR(50) NOT NULL,
    `kind` ENUM('SUBSCRIPTION', 'MINUTE_PACK') NOT NULL,
    `itemId` VARCHAR(50) NOT NULL,
    `creatorPrice` BOOLEAN NOT NULL DEFAULT false,
    `productId` VARCHAR(255) NOT NULL,
    `amountUsd` DECIMAL(10, 2) NOT NULL,
    `premiumSeconds` INTEGER NOT NULL DEFAULT 0,
    `checkoutSessionId` VARCHAR(255) NULL,
    `providerOrderId` VARCHAR(255) NULL,
    `status` ENUM('PENDING', 'PAID', 'REFUNDED') NOT NULL DEFAULT 'PENDING',
    `paidAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `BillingOrder_userId_createdAt_idx`(`userId`, `createdAt`),
    UNIQUE INDEX `BillingOrder_provider_providerOrderId_key`(`provider`, `providerOrderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BillingEvent` (
    `id` CHAR(36) NOT NULL,
    `provider` VARCHAR(50) NOT NULL,
    `providerEventId` VARCHAR(191) NOT NULL,
    `eventType` VARCHAR(100) NOT NULL,
    `businessEventId` VARCHAR(255) NULL,
    `providerOrderId` VARCHAR(255) NULL,
    `outcome` ENUM('PROCESSED', 'IGNORED') NOT NULL,
    `note` VARCHAR(255) NULL,
    `payloadHash` CHAR(64) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `BillingEvent_providerOrderId_idx`(`providerOrderId`),
    UNIQUE INDEX `BillingEvent_provider_providerEventId_key`(`provider`, `providerEventId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `BillingOrder` ADD CONSTRAINT `BillingOrder_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
