import "server-only";
import { createHash, createHmac } from "node:crypto";

// AWS SigV4 (used by S3 and S3-compatible providers like R2 / OSS-S3-mode).

export function hexSha256(buf: string | Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac("sha256", key).update(data, "utf8").digest();
}

function uriEncodeSegment(s: string): string {
  // S3 expects encoded path segments but `/` kept as-is in the canonical URI.
  return encodeURIComponent(s).replace(/[!'()*]/g, (c) =>
    `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

export interface SignArgs {
  method: "PUT" | "GET" | "DELETE";
  host: string; // e.g. "<bucket>.<account>.r2.cloudflarestorage.com"
  region: string; // r2 fixed "auto", s3 region, oss "<region>"
  service: string; // usually "s3"
  accessKeyId: string;
  secretAccessKey: string;
  pathKey: string; // object key, without leading "/"
  body: Buffer;
  contentType: string;
  extraHeaders?: Record<string, string>;
}

export interface SignedRequest {
  url: string;
  headers: Record<string, string>;
}

export function signS3PutRequest(args: SignArgs): SignedRequest {
  const now = new Date();
  const amzDate = now
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
  const dateStamp = amzDate.slice(0, 8);

  const payloadHash = hexSha256(args.body);

  const canonicalUri =
    "/" + args.pathKey.split("/").map(uriEncodeSegment).join("/");

  const headers: Record<string, string> = {
    host: args.host,
    "content-type": args.contentType,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
    ...(args.extraHeaders ?? {}),
  };

  const headerKeys = Object.keys(headers)
    .map((k) => k.toLowerCase())
    .sort();
  const canonicalHeaders = headerKeys
    .map((k) => `${k}:${headers[k].trim()}\n`)
    .join("");
  const signedHeaders = headerKeys.join(";");

  const canonicalRequest = [
    args.method,
    canonicalUri,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const credentialScope = `${dateStamp}/${args.region}/${args.service}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    hexSha256(canonicalRequest),
  ].join("\n");

  const kDate = hmac("AWS4" + args.secretAccessKey, dateStamp);
  const kRegion = hmac(kDate, args.region);
  const kService = hmac(kRegion, args.service);
  const kSigning = hmac(kService, "aws4_request");
  const signature = hmac(kSigning, stringToSign).toString("hex");

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${args.accessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    url: `https://${args.host}${canonicalUri}`,
    headers: {
      ...headers,
      Authorization: authorization,
    },
  };
}
