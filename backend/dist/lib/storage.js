"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isStorageConfigured = isStorageConfigured;
exports.uploadFile = uploadFile;
exports.uploadStream = uploadStream;
exports.uploadTempFile = uploadTempFile;
exports.getFile = getFile;
exports.deleteFile = deleteFile;
const client_s3_1 = require("@aws-sdk/client-s3");
const companySettings_1 = require("./companySettings");
const fs_1 = __importDefault(require("fs"));
// Cria um cliente S3 apontando para o Cloudflare R2 usando as credenciais da empresa.
async function r2Client() {
    const s = (await (0, companySettings_1.getCompanySettings)());
    if (!s?.r2_account_id || !s?.r2_access_key_id || !s?.r2_secret_key || !s?.r2_bucket)
        return null;
    const client = new client_s3_1.S3Client({
        region: "auto",
        endpoint: `https://${s.r2_account_id}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId: s.r2_access_key_id, secretAccessKey: s.r2_secret_key },
    });
    return { client, bucket: s.r2_bucket };
}
async function isStorageConfigured() {
    return !!(await r2Client());
}
async function uploadFile(key, body, mime) {
    const r2 = await r2Client();
    if (!r2)
        throw new Error("Armazenamento (R2) não configurado nas Configurações.");
    await r2.client.send(new client_s3_1.PutObjectCommand({ Bucket: r2.bucket, Key: key, Body: body, ContentType: mime }));
}
// Envia por streaming (sem carregar o arquivo inteiro na RAM). Precisa do tamanho exato.
async function uploadStream(key, body, mime, contentLength) {
    const r2 = await r2Client();
    if (!r2)
        throw new Error("Armazenamento (R2) não configurado nas Configurações.");
    await r2.client.send(new client_s3_1.PutObjectCommand({ Bucket: r2.bucket, Key: key, Body: body, ContentType: mime, ContentLength: contentLength }));
}
// Envia um arquivo temporário (do multer em disco) por streaming e SEMPRE o remove ao final.
async function uploadTempFile(key, filePath, mime, size) {
    try {
        await uploadStream(key, fs_1.default.createReadStream(filePath), mime, size);
    }
    finally {
        fs_1.default.promises.unlink(filePath).catch(() => { });
    }
}
async function getFile(key) {
    const r2 = await r2Client();
    if (!r2)
        throw new Error("Armazenamento não configurado.");
    const resp = await r2.client.send(new client_s3_1.GetObjectCommand({ Bucket: r2.bucket, Key: key }));
    return { body: resp.Body, mime: resp.ContentType };
}
async function deleteFile(key) {
    const r2 = await r2Client();
    if (!r2)
        return;
    await r2.client.send(new client_s3_1.DeleteObjectCommand({ Bucket: r2.bucket, Key: key }));
}
//# sourceMappingURL=storage.js.map