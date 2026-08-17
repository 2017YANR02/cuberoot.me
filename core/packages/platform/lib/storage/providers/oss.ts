import "server-only";
import { createHmac, randomUUID } from "node:crypto";
import {
  monthFolder,
  pickExt,
  type StorageProvider,
  type StoragePutResult,
} from "../types";

// StorageProviderC: v1-style signature (Authorization: OSS ak:sig).
// Signature = base64(HMAC-SHA1(secret, stringToSign)).

function readEnv() {
  const accessKeyId = process.env.STORAGE_OSS_ACCESS_KEY_ID ?? "";
  const accessKeySecret = process.env.STORAGE_OSS_ACCESS_KEY_SECRET ?? "";
  const bucket = process.env.STORAGE_OSS_BUCKET ?? "";
  const region = process.env.STORAGE_OSS_REGION ?? "";
  const publicBase = (process.env.STORAGE_OSS_PUBLIC_BASE ?? "").replace(/\/$/, "");
  if (!accessKeyId || !accessKeySecret || !bucket || !region || !publicBase) {
    throw new Error("storage provider oss not configured");
  }
  return { accessKeyId, accessKeySecret, bucket, region, publicBase };
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

  const host = `${cfg.bucket}.oss-${cfg.region}.aliyuncs.com`;
  const date = new Date().toUTCString();

  // CanonicalizedResource = /<bucket>/<key>
  const canonicalResource = `/${cfg.bucket}/${key}`;
  const stringToSign = [
    "PUT",
    "", // Content-MD5
    contentType,
    date,
    canonicalResource,
  ].join("\n");

  const signature = createHmac("sha1", cfg.accessKeySecret)
    .update(stringToSign, "utf8")
    .digest("base64");

  const url = `https://${host}/${key}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Date: date,
      "Content-Type": contentType,
      Authorization: `OSS ${cfg.accessKeyId}:${signature}`,
    },
    body: new Uint8Array(buf),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`oss put failed ${res.status}: ${text.slice(0, 200)}`);
  }
  return { url: `${cfg.publicBase}/${key}`, key };
}

export const ossProvider: StorageProvider = {
  id: "oss",
  put: putImpl,
};
