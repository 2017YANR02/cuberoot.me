import "server-only";
import { randomUUID } from "node:crypto";
import {
  monthFolder,
  pickExt,
  type StorageProvider,
  type StoragePutResult,
} from "../types";
import { signS3PutRequest } from "../sigv4";

function readEnv() {
  const accountId = process.env.STORAGE_R2_ACCOUNT_ID ?? "";
  const accessKeyId = process.env.STORAGE_R2_ACCESS_KEY_ID ?? "";
  const secretAccessKey = process.env.STORAGE_R2_SECRET_ACCESS_KEY ?? "";
  const bucket = process.env.STORAGE_R2_BUCKET ?? "";
  const publicBase = (process.env.STORAGE_R2_PUBLIC_BASE ?? "").replace(/\/$/, "");
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !publicBase) {
    throw new Error("storage provider r2 not configured");
  }
  return { accountId, accessKeyId, secretAccessKey, bucket, publicBase };
}

async function putImpl(
  buf: Buffer,
  filename: string,
  contentType: string,
): Promise<StoragePutResult> {
  const cfg = readEnv();
  const folder = monthFolder();
  const ext = pickExt(filename);
  const key = `${folder}/${randomUUID()}.${ext}`;

  const host = `${cfg.bucket}.${cfg.accountId}.r2.cloudflarestorage.com`;
  const signed = signS3PutRequest({
    method: "PUT",
    host,
    region: "auto",
    service: "s3",
    accessKeyId: cfg.accessKeyId,
    secretAccessKey: cfg.secretAccessKey,
    pathKey: key,
    body: buf,
    contentType,
  });

  const res = await fetch(signed.url, {
    method: "PUT",
    headers: signed.headers,
    body: new Uint8Array(buf),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`r2 put failed ${res.status}: ${text.slice(0, 200)}`);
  }
  return { url: `${cfg.publicBase}/${key}`, key };
}

export const r2Provider: StorageProvider = {
  id: "r2",
  put: putImpl,
};
