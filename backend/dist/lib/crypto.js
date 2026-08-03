"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ENC_PREFIX = void 0;
exports.encrypt = encrypt;
exports.decrypt = decrypt;
exports.dec = dec;
exports.encField = encField;
const crypto_1 = __importDefault(require("crypto"));
// Criptografia AES-256-GCM para tokens/segredos em repouso.
// Chave derivada de TOKEN_ENC_KEY (ou JWT_SECRET como fallback).
const RAW = process.env.TOKEN_ENC_KEY || process.env.JWT_SECRET || "dev-secret-change-me";
const KEY = crypto_1.default.createHash("sha256").update(RAW).digest(); // 32 bytes
const PREFIX = "enc:v1:";
function encrypt(plain) {
    const iv = crypto_1.default.randomBytes(12);
    const cipher = crypto_1.default.createCipheriv("aes-256-gcm", KEY, iv);
    const enc = Buffer.concat([cipher.update(String(plain), "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return PREFIX + Buffer.concat([iv, tag, enc]).toString("base64");
}
// Descriptografa; valores sem o prefixo (legado/texto puro) são retornados como estão.
function decrypt(val) {
    if (typeof val !== "string" || !val.startsWith(PREFIX))
        return val;
    try {
        const buf = Buffer.from(val.slice(PREFIX.length), "base64");
        const iv = buf.subarray(0, 12);
        const tag = buf.subarray(12, 28);
        const data = buf.subarray(28);
        const decipher = crypto_1.default.createDecipheriv("aes-256-gcm", KEY, iv);
        decipher.setAuthTag(tag);
        return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
    }
    catch {
        return val;
    }
}
// Leitura segura de campo possivelmente nulo.
function dec(val) {
    if (val === null || val === undefined || val === "")
        return null;
    return decrypt(val);
}
// Prepara valor para gravação: criptografa só se necessário (pula nulo/vazio/mascarado/já-cifrado).
function encField(val) {
    if (val === undefined)
        return undefined;
    if (val === null || val === "")
        return val;
    if (typeof val !== "string")
        return val;
    if (val === "••••••••")
        return val; // valor mascarado — não sobrescrever
    if (val.startsWith(PREFIX))
        return val; // já criptografado
    return encrypt(val);
}
exports.ENC_PREFIX = PREFIX;
//# sourceMappingURL=crypto.js.map