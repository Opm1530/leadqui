import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getCompanySettings } from "./companySettings";
import fs from "fs";
import { Readable } from "stream";

// Cria um cliente S3 apontando para o Cloudflare R2 usando as credenciais da empresa.
async function r2Client(): Promise<{ client: S3Client; bucket: string } | null> {
  const s = (await getCompanySettings()) as any;
  if (!s?.r2_account_id || !s?.r2_access_key_id || !s?.r2_secret_key || !s?.r2_bucket) return null;
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${s.r2_account_id}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: s.r2_access_key_id, secretAccessKey: s.r2_secret_key },
  });
  return { client, bucket: s.r2_bucket };
}

export async function isStorageConfigured(): Promise<boolean> {
  return !!(await r2Client());
}

export async function uploadFile(key: string, body: Buffer, mime?: string): Promise<void> {
  const r2 = await r2Client();
  if (!r2) throw new Error("Armazenamento (R2) não configurado nas Configurações.");
  await r2.client.send(new PutObjectCommand({ Bucket: r2.bucket, Key: key, Body: body, ContentType: mime }));
}

// Envia por streaming (sem carregar o arquivo inteiro na RAM). Precisa do tamanho exato.
export async function uploadStream(key: string, body: Readable, mime?: string, contentLength?: number): Promise<void> {
  const r2 = await r2Client();
  if (!r2) throw new Error("Armazenamento (R2) não configurado nas Configurações.");
  await r2.client.send(new PutObjectCommand({ Bucket: r2.bucket, Key: key, Body: body, ContentType: mime, ContentLength: contentLength }));
}

// Envia um arquivo temporário (do multer em disco) por streaming e SEMPRE o remove ao final.
export async function uploadTempFile(key: string, filePath: string, mime?: string, size?: number): Promise<void> {
  try {
    await uploadStream(key, fs.createReadStream(filePath), mime, size);
  } finally {
    fs.promises.unlink(filePath).catch(() => {});
  }
}

export async function getFile(key: string): Promise<{ body: any; mime?: string }> {
  const r2 = await r2Client();
  if (!r2) throw new Error("Armazenamento não configurado.");
  const resp = await r2.client.send(new GetObjectCommand({ Bucket: r2.bucket, Key: key }));
  return { body: resp.Body, mime: resp.ContentType };
}

export async function deleteFile(key: string): Promise<void> {
  const r2 = await r2Client();
  if (!r2) return;
  await r2.client.send(new DeleteObjectCommand({ Bucket: r2.bucket, Key: key }));
}
