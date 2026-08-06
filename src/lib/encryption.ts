import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

function encryptionKey() {
  const configured = process.env.SUPPLIER_PASSWORD_KEY;
  if (configured && /^[0-9a-fA-F]{64}$/.test(configured)) {
    return Buffer.from(configured, "hex");
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("SUPPLIER_PASSWORD_KEY 必须配置为 64 位十六进制字符串");
  }
  return createHash("sha256").update("development-supplier-password-key").digest();
}

export function encryptSupplierPassword(password: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(password, "utf8"), cipher.final()]);
  return {
    encryptedPassword: encrypted.toString("base64"),
    passwordIv: iv.toString("hex"),
    passwordTag: cipher.getAuthTag().toString("hex"),
  };
}

export function decryptSupplierPassword(encryptedPassword: string, iv: string, tag: string) {
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "hex"));
  decipher.setAuthTag(Buffer.from(tag, "hex"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedPassword, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
