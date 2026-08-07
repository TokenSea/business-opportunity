ALTER TABLE `Supplier`
  ADD COLUMN `bankAccount` VARCHAR(191) NULL,
  ADD COLUMN `websiteAccount` VARCHAR(191) NULL,
  ADD COLUMN `encryptedWebsitePassword` TEXT NULL,
  ADD COLUMN `websitePasswordIv` VARCHAR(64) NULL,
  ADD COLUMN `websitePasswordTag` VARCHAR(64) NULL,
  ADD COLUMN `websiteUrl` TEXT NULL;
