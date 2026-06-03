import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const KEY_HEX   = process.env.VAULT_ENCRYPTION_KEY!;

function getKey(): Buffer {
  if (!KEY_HEX || KEY_HEX.length !== 64) {
    throw new Error("VAULT_ENCRYPTION_KEY inválida ou ausente no .env");
  }
  return Buffer.from(KEY_HEX, "hex");
}

export interface Encrypted {
  enc: string; // ciphertext hex
  iv:  string; // IV hex
  tag: string; // GCM auth tag hex
}

export function encrypt(plaintext: string): Encrypted {
  const key = getKey();
  const iv  = crypto.randomBytes(12); // 96 bits recomendado para GCM
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    enc: encrypted.toString("hex"),
    iv:  iv.toString("hex"),
    tag: tag.toString("hex"),
  };
}

export function decrypt(enc: string, iv: string, tag: string): string {
  const key     = getKey();
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(iv, "hex"));
  decipher.setAuthTag(Buffer.from(tag, "hex"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(enc, "hex")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}
