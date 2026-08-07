ALTER TABLE `Supplier`
  DROP COLUMN `account`,
  DROP COLUMN `encryptedPassword`,
  DROP COLUMN `passwordIv`,
  DROP COLUMN `passwordTag`;
