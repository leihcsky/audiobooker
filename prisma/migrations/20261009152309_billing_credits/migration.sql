-- CreateTable
CREATE TABLE `Subscription` (
    `id` CHAR(36) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `provider` VARCHAR(50) NOT NULL,
    `customerId` VARCHAR(255) NULL,
    `subscriptionId` VARCHAR(255) NULL,
    `planId` VARCHAR(100) NOT NULL,
    `status` ENUM('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'EXPIRED') NOT NULL DEFAULT 'ACTIVE',
    `currentPeriodStart` DATETIME(3) NULL,
    `currentPeriodEnd` DATETIME(3) NULL,
    `cancelAtPeriodEnd` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Subscription_userId_status_idx`(`userId`, `status`),
    UNIQUE INDEX `Subscription_provider_subscriptionId_key`(`provider`, `subscriptionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CreditLedger` (
    `id` CHAR(36) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `type` ENUM('MONTHLY_GRANT', 'PURCHASE', 'GENERATION_RESERVE', 'GENERATION_REFUND', 'PROMOTION', 'ADMIN_ADJUSTMENT') NOT NULL,
    `bucket` ENUM('MONTHLY', 'PURCHASED') NOT NULL,
    `amountSeconds` INTEGER NOT NULL,
    `expiresAt` DATETIME(3) NULL,
    `referenceType` VARCHAR(50) NULL,
    `referenceId` VARCHAR(255) NULL,
    `idempotencyKey` VARCHAR(191) NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `CreditLedger_idempotencyKey_key`(`idempotencyKey`),
    INDEX `CreditLedger_userId_bucket_expiresAt_idx`(`userId`, `bucket`, `expiresAt`),
    INDEX `CreditLedger_userId_createdAt_idx`(`userId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CreditReservation` (
    `id` CHAR(36) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `jobId` CHAR(36) NULL,
    `status` ENUM('RESERVED', 'CAPTURED', 'RELEASED') NOT NULL DEFAULT 'RESERVED',
    `reservedSeconds` INTEGER NOT NULL,
    `monthlySeconds` INTEGER NOT NULL DEFAULT 0,
    `purchasedSeconds` INTEGER NOT NULL DEFAULT 0,
    `monthlyExpiresAt` DATETIME(3) NULL,
    `capturedSeconds` INTEGER NULL,
    `settledAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CreditReservation_jobId_key`(`jobId`),
    INDEX `CreditReservation_userId_status_idx`(`userId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Subscription` ADD CONSTRAINT `Subscription_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CreditLedger` ADD CONSTRAINT `CreditLedger_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CreditReservation` ADD CONSTRAINT `CreditReservation_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CreditReservation` ADD CONSTRAINT `CreditReservation_jobId_fkey` FOREIGN KEY (`jobId`) REFERENCES `GenerationJob`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
