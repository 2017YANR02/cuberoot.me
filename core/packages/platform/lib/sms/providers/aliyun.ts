import "server-only";
import { createHash, createHmac, randomUUID } from "node:crypto";
import type { SmsProvider, SmsResult } from "../types";

// SmsProviderA: V3-like SMS gateway with HMAC-SHA256 over canonical request.
// Host / action / version pinned by API spec. Env vars use neutral names.

const HOST = "dysmsapi.aliyuncs.com";
const ACTION = "SendSms";
const VERSION = "2017-05-25";
const ALGO = "ACS3-HMAC-SHA256";

function hexSha256(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

function hmacSha256(key: Buffer | string, data: string): Buffer {
  return createHmac("sha256", key).update(data, "utf8").digest();
}

function uriEncode(s: string): string {
  return encodeURIComponent(s).replace(/[!'()*]/g, (c) =>
    `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function canonicalQuery(params: Record<string, string>): string {
  const keys = Object.keys(params).sort();
  return keys.map((k) => `${uriEncode(k)}=${uriEncode(params[k])}`).join("&");
}

function readEnv(): {
  accessKeyId: string;
  accessKeySecret: string;
  signName: string;
  templateCode: string;
} {
  const accessKeyId = process.env.SMS_ALIYUN_ACCESS_KEY_ID ?? "";
  const accessKeySecret = process.env.SMS_ALIYUN_ACCESS_KEY_SECRET ?? "";
  const signName = process.env.SMS_ALIYUN_SIGN_NAME ?? "";
  const templateCode = process.env.SMS_ALIYUN_TEMPLATE_CODE ?? "";
  if (!accessKeyId || !accessKeySecret || !signName || !templateCode) {
    throw new Error("sms provider aliyun not configured");
  }
  return { accessKeyId, accessKeySecret, signName, templateCode };
}

async function sendOtpImpl(phone: string, code: string): Promise<SmsResult> {
  const cfg = readEnv();

  const query: Record<string, string> = {
    PhoneNumbers: phone,
    SignName: cfg.signName,
    TemplateCode: cfg.templateCode,
    TemplateParam: JSON.stringify({ code }),
  };

  const date = new Date().toISOString().replace(/\.\d{3}/, "");
  const nonce = randomUUID();
  const canonicalQs = canonicalQuery(query);

  const headers: Record<string, string> = {
    "host": HOST,
    "x-acs-action": ACTION,
    "x-acs-version": VERSION,
    "x-acs-date": date,
    "x-acs-signature-nonce": nonce,
    "x-acs-content-sha256": hexSha256(""),
  };
  const headerKeys = Object.keys(headers)
    .map((k) => k.toLowerCase())
    .sort();
  const canonicalHeaders = headerKeys
    .map((k) => `${k}:${headers[k].trim()}\n`)
    .join("");
  const signedHeaders = headerKeys.join(";");

  const canonicalRequest = [
    "POST",
    "/",
    canonicalQs,
    canonicalHeaders,
    signedHeaders,
    headers["x-acs-content-sha256"],
  ].join("\n");

  const stringToSign = `${ALGO}\n${hexSha256(canonicalRequest)}`;
  const signature = hmacSha256(cfg.accessKeySecret, stringToSign).toString("hex");

  const authHeader =
    `${ALGO} Credential=${cfg.accessKeyId},SignedHeaders=${signedHeaders},Signature=${signature}`;

  const url = `https://${HOST}/?${canonicalQs}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        ...headers,
        Authorization: authHeader,
        Accept: "application/json",
      },
    });
  } catch (e) {
    return { ok: false, error: `network: ${(e as Error).message}` };
  }
  const text = await res.text();
  if (!res.ok) {
    return { ok: false, error: `http_${res.status}: ${text.slice(0, 200)}` };
  }
  let json: { Code?: string; Message?: string } = {};
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: `bad_response: ${text.slice(0, 200)}` };
  }
  if (json.Code && json.Code !== "OK") {
    return { ok: false, error: `${json.Code}: ${json.Message ?? ""}` };
  }
  return { ok: true };
}

export const aliyunProvider: SmsProvider = {
  id: "aliyun",
  name: "SmsProviderA",
  sendOtp: sendOtpImpl,
};
