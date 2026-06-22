"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.encrypt = encrypt;
exports.decrypt = decrypt;
const crypto_1 = __importDefault(require("crypto"));
const ALGORITHM = "aes-256-gcm";
const KEY_HEX = process.env.VAULT_ENCRYPTION_KEY;
function getKey() {
    if (!KEY_HEX || KEY_HEX.length !== 64) {
        throw new Error("VAULT_ENCRYPTION_KEY inválida ou ausente no .env");
    }
    return Buffer.from(KEY_HEX, "hex");
}
function encrypt(plaintext) {
    const key = getKey();
    const iv = crypto_1.default.randomBytes(12); // 96 bits recomendado para GCM
    const cipher = crypto_1.default.createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return {
        enc: encrypted.toString("hex"),
        iv: iv.toString("hex"),
        tag: tag.toString("hex"),
    };
}
function decrypt(enc, iv, tag) {
    const key = getKey();
    const decipher = crypto_1.default.createDecipheriv(ALGORITHM, key, Buffer.from(iv, "hex"));
    decipher.setAuthTag(Buffer.from(tag, "hex"));
    const decrypted = Buffer.concat([
        decipher.update(Buffer.from(enc, "hex")),
        decipher.final(),
    ]);
    return decrypted.toString("utf8");
}
//# sourceMappingURL=vault.js.map