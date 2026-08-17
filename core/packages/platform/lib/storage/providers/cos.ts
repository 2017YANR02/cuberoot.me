import "server-only";
import { createHash, createHmac, randomUUID } from "node:crypto";
import {
  monthFolder,
  pickExt,
  type StorageProvider,
  type StoragePutResult,
} from "../types";

// StorageProviderD: COS request signing (q-sign-algorithm=sha1).

function readEnv() {
  const secretId = process.env.STORAGE_COS_SECRET_ID ?? "";
  const secretKey = process.env.STORAGE_COS_SECRET_KEY ?? "";
  const bucket = process.env.STORAGE_COS_BUCKET ?? ""; // <name>-<appid>
  const region = process.env.STORAGE_COS_REGION ?? "";
  const publicBase = (process.env.STORAGE_COS_PUBLIC_BASE ?? "").replace(/\/$/, "");
  if (!secretId || !secretKey || !bucket || !region || !publicBase) {
    throw new Error("storage provider cos not configured");
  }
  return { secretId, secretKey, bucket, region, publicBase };
}

function hmacSha1(key: string, data: string): string {
  return createHmac("sha1", key).update(data, "utf8").digest("hex");
}

function sha1(data: string): string {
  return createHash("sha1").update(data, "utf8").digest("hex");
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

  const host = `${cfg.bucket}.cos.${cfg.region}.myqcloud.com`;
  const startTs = Math.floor(Date.now() / 1000);
  const endTs = startTs + 600;
  const keyTime = `${startTs};${endTs}`;

  const headers: Record<string, string> = {
    host,
    "content-type": contentType,
  };
  const headerKeys = Object.keys(headers)
    .map((k) => k.toLowerCase())
    .sort();
  const headerList = headerKeys.join(";");
  const httpHeaders = headerKeys
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(headers[k])}`)
    .join("&");

  const httpString = ["put", `/${key}`, "", httpHeaders, ""].join("\n");
  const stringToSign = ["sha1", keyTime, sha1(httpString), ""].join("\n");
  const signKey = hmacSha1(cfg.secretKey, keyTime);
  const signature = hmacSha1(signKey, stringToSign);

  const authorization = [
    "q-sign-algorithm=sha1",
    `q-ak=${cfg.secretId}`,
    `q-sign-time=${keyTime}`,
    `q-key-time=${keyTime}`,
    "q-header-list=" + headerList,
    "q-url-param-list=",
    `q-signature=${signature}`,
  ].join("&");

  const url = `https://${host}/${key}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Host: host,
      "Content-Type": contentType,
      Authorization: authorization,
    },
    body: new Uint8Array(buf),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`cos put failed ${res.status}: ${text.slice(0, 200)}`);
  }
  return { url: `${cfg.publicBase}/${key}`, key };
}

export const cosProvider: StorageProvider = {
  id: "cos",
  put: putImpl,
};
