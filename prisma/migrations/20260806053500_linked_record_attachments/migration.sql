-- Add optional ownership columns so contracts and payments can manage multiple attachments.
ALTER TABLE `Attachment`
    ADD COLUMN `contractId` VARCHAR(191) NULL,
    ADD COLUMN `paymentId` VARCHAR(191) NULL;

-- Preserve files uploaded through the previous single-record-file design.
UPDATE `Attachment` AS a
INNER JOIN `Contract` AS c ON c.`recordFileId` = a.`id`
SET a.`contractId` = c.`id`;

UPDATE `Attachment` AS a
INNER JOIN `Payment` AS p ON p.`recordFileId` = a.`id`
SET a.`paymentId` = p.`id`;

CREATE INDEX `Attachment_contractId_idx` ON `Attachment`(`contractId`);
CREATE INDEX `Attachment_paymentId_idx` ON `Attachment`(`paymentId`);

ALTER TABLE `Attachment`
    ADD CONSTRAINT `Attachment_contractId_fkey`
    FOREIGN KEY (`contractId`) REFERENCES `Contract`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `Attachment`
    ADD CONSTRAINT `Attachment_paymentId_fkey`
    FOREIGN KEY (`paymentId`) REFERENCES `Payment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
