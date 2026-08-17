import "server-only";
import { createHash, createHmac } from "node:crypto";
import type { SmsProvider, SmsResult } from "../types";

// SmsProviderB: V3 signed POST. Region default ap-guangzhou.

const HOST = "sms.tencentcloudapi.com";
const SERVICE = "sms";
const ACTION = "SendSms";
const VERSION = "2021-01-11";
const ALGO = "TC3-HMAC-SHA256";

function hexSha256(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

function hmacSha256(key: Buffer | string, data: string): Buffer {
  return createHmac("sha256", key).update(data, "utf8").digest();
}

function readEnv(): {
  secretId: string;
  secretKey: string;
  sdkAppId: string;
  signName: string;
  templateId: string;
  region: string;
} {
  const secretId = process.env.SMS_TENCENT_SECRET_ID ?? "";
  const secretKey = process.env.SMS_TENCENT_SECRET_KEY ?? "";
  const sdkAppId = process.env.SMS_TENCENT_SDK_APP_ID ?? "";
  const signName = process.env.SMS_TENCENT_SIGN_NAME ?? "";
  const templateId = process.env.SMS_TENCENT_TEMPLATE_ID ?? "";
  const region = process.env.SMS_TENCENT_REGION ?? "ap-guangzhou";
  if (!secretId || !secretKey || !sdkAppId || !signName || !templateId) {
    throw new Error("sms provider tencent not configured");
  }
  return { secretId, secretKey, sdkAppId, signName, templateId, region };
}

async function sendOtpImpl(phone: string, code: string): Promise<SmsResult> {
  const cfg = readEnv();
  // Phone must be in +86 E.164 form for this gateway.
  const phoneNumber = phone.startsWith("+") ? phone : `+86${phone}`;

  const body = JSON.stringify({
    PhoneNumberSet: [phoneNumber],
    SmsSdkAppId: cfg.sdkAppId,
    SignName: cfg.signName,
    TemplateId: cfg.templateId,
    TemplateParamSet: [code],
  });
  const bodyHash = hexSha256(body);

  const timestamp = Math.floor(Date.now() / 1000);
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10);

  const canonicalHeaders =
    `content-type:application/json; charset=utf-8\nhost:${HOST}\nx-tc-action:${ACTION.toLowerCase()}\n`;
  const signedHeaders = "content-type;host;x-tc-action";
  const canonicalRequest = [
    "POST",
    "/",
    "",
    canonicalHeaders,
    signedHeaders,
    bodyHash,
  ].join("\n");

  const credentialScope = `${date}/${SERVICE}/tc3_request`;
  const stringToSign = [
    ALGO,
    String(timestamp),
    credentialScope,
    hexSha256(canonicalRequest),
  ].join("\n");

  const kDate = hmacSha256("TC3" + cfg.secretKey, date);
  const kService = hmacSha256(kDate, SERVICE);
  const kSigning = hmacSha256(kService, "tc3_request");
  const signature = hmacSha256(kSigning, stringToSign).toString("hex");

  const authorization =
    `${ALGO} Credential=${cfg.secretId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  let res: Response;
  try {
    res = await fetch(`https://${HOST}`, {
      method: "POST",
      headers: {
        Authorization: authorization,
        "Content-Type": "application/json; charset=utf-8",
        Host: HOST,
        "X-TC-Action": ACTION,
        "X-TC-Timestamp": String(timestamp),
        "X-TC-Version": VERSION,
        "X-TC-Region": cfg.region,
      },
      body,
    });
  } catch (e) {
    return { ok: false, error: `network: ${(e as Error).message}` };
  }
  const text = await res.text();
  if (!res.ok) {
    return { ok: false, error: `http_${res.status}: ${text.slice(0, 200)}` };
  }
  type ResponseBody = {
    Response?: {
      Error?: { Code: string; Message: string };
      SendStatusSet?: { Code: string; Message: string }[];
    };
  };
  let json: ResponseBody = {};
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: `bad_response: ${text.slice(0, 200)}` };
  }
  const r = json.Response ?? {};
  if (r.Error) {
    return { ok: false, error: `${r.Error.Code}: ${r.Error.Message}` };
  }
  const status = r.SendStatusSet?.[0];
  if (status && status.Code !== "Ok") {
    return { ok: false, error: `${status.Code}: ${status.Message}` };
  }
  return { ok: true };
}

export const tencentProvider: SmsProvider = {
  id: "tencent",
  name: "SmsProviderB",
  sendOtp: sendOtpImpl,
};
