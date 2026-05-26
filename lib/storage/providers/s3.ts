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
  const accessKeyId = process.env.STORAGE_S3_ACCESS_KEY_ID ?? "";
  const secretAccessKey = process.env.STORAGE_S3_SECRET_ACCESS_KEY ?? "";
  const bucket = process.env.STORAGE_S3_BUCKET ?? "";
  const region = process.env.STORAGE_S3_REGION ?? "";
  const endpoint = (process.env.STORAGE_S3_ENDPOINT ?? "").replace(/\/$/, "");
  const publicBase = (process.env.STORAGE_S3_PUBLIC_BASE ?? "").replace(/\/$/, "");
  if (!accessKeyId || !secretAccessKey || !bucket || !region || !publicBase) {
    throw new Error("storage provider s3 not configured");
  }
  return { accessKeyId, secretAccessKey, bucket, region, endpoint, publicBase };
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

  // Host: custom endpoint or vhost form on s3.<region>.amazonaws.com.
  const host = cfg.endpoint
    ? new URL(cfg.endpoint).host
    : `${cfg.bucket}.s3.${cfg.region}.amazonaws.com`;
  const pathKey = cfg.endpoint ? `${cfg.bucket}/${key}` : key;

  const signed = signS3PutRequest({
    method: "PUT",
    host,
    region: cfg.region,
    service: "s3",
    accessKeyId: cfg.accessKeyId,
    secretAccessKey: cfg.secretAccessKey,
    pathKey,
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
    throw new Error(`s3 put failed ${res.status}: ${text.slice(0, 200)}`);
  }
  return { url: `${cfg.publicBase}/${key}`, key };
}

export const s3Provider: StorageProvider = {
  id: "s3",
  put: putImpl,
};
