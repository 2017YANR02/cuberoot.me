import { createHmac, randomUUID } from "node:crypto";

export type FaceErrorCode = "FACE_UNAVAILABLE" | "FACE_PENDING" | "FACE_RETRY_SOON" | "FACE_DAILY_LIMIT" | "FACE_SITE_LIMIT" | "FACE_PROVIDER_PERMISSION" | "FACE_PROVIDER_BALANCE" | "FACE_SESSION_CHANGED" | "FACE_CHECK_TOO_SOON";
export class FaceVerificationError extends Error {
  constructor(message: string, public readonly status = 400, public readonly code: FaceErrorCode = "FACE_UNAVAILABLE") { super(message); }
}

export function faceVerificationEnabled() {
  return process.env.CUBEROOT_FACE_ENABLED === "true"
    && process.env.CUBEROOT_FACE_CONSENT_APPROVED === "true"
    && (process.env.CUBEROOT_FACE_IDENTITY_PEPPER?.length ?? 0) >= 32
    && Boolean(process.env.CUBEROOT_FACE_ACCESS_KEY_ID && process.env.CUBEROOT_FACE_ACCESS_KEY_SECRET)
    && /^\d{1,20}$/u.test(process.env.CUBEROOT_FACE_SCENE_ID ?? "");
}

export function faceConfiguration() {
  if (!faceVerificationEnabled()) throw new FaceVerificationError("刷脸认证暂未开放，请稍后再试", 503);
  const origin = process.env.CUBEROOT_FACE_APP_ORIGIN ?? "";
  if (!["https://cuberoot.me", "https://www.cuberoot.me"].includes(origin)) throw new FaceVerificationError("认证回跳地址未配置", 503);
  return {
    accessKey: process.env.CUBEROOT_FACE_ACCESS_KEY_ID!, secret: process.env.CUBEROOT_FACE_ACCESS_KEY_SECRET!,
    sceneId: process.env.CUBEROOT_FACE_SCENE_ID!, returnUrl: new URL("/zh/account/verify", origin).href,
  };
}

const encode = (value: string) => encodeURIComponent(value).replace(/[!'()*]/gu, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

// POST keeps identity fields out of URL/access logs. Never return provider messages or materials.
async function rpc(action: "InitFaceVerify" | "DescribeFaceVerify", parameters: Record<string, string>) {
  const config = faceConfiguration();
  const params: Record<string, string> = {
    Action: action, Version: "2019-03-07", Format: "JSON", AccessKeyId: config.accessKey,
    SignatureMethod: "HMAC-SHA1", SignatureVersion: "1.0", SignatureNonce: randomUUID(),
    Timestamp: new Date().toISOString().replace(/\.\d{3}Z$/u, "Z"), ...parameters,
  };
  const canonical = Object.keys(params).sort().map(key => `${encode(key)}=${encode(params[key])}`).join("&");
  const signature = createHmac("sha1", `${config.secret}&`).update(`POST&%2F&${encode(canonical)}`).digest("base64");
  try {
    const response = await fetch("https://cloudauth.cn-shanghai.aliyuncs.com/", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `${canonical}&Signature=${encode(signature)}`, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15_000),
    });
    const data = await response.json();
    if (response.ok && action === "DescribeFaceVerify" && ["403", "424"].includes(String(data?.Code))) return null;
    if (!response.ok || String(data.Code) !== "200" || !data.ResultObject) {
      // Only bounded diagnostic codes/UUIDs; never log provider messages, request bodies or results.
      const providerCode = String(data?.Code ?? "");
      console.error(JSON.stringify({ event: "face_provider_failure", action, httpStatus: response.status,
        code: /^\d{3}$/u.test(providerCode) ? providerCode : "unknown",
        requestId: typeof data?.RequestId === "string" && /^[a-f0-9-]{36}$/iu.test(data.RequestId) ? data.RequestId : undefined }));
      if (providerCode === "411") throw new FaceVerificationError("Provider permissions unavailable.", 503, "FACE_PROVIDER_PERMISSION");
      if (providerCode === "412") throw new FaceVerificationError("Provider balance unavailable.", 503, "FACE_PROVIDER_BALANCE");
      throw new FaceVerificationError("Provider unavailable.", 503);
    }
    return data.ResultObject as Record<string, unknown>;
  } catch (error) {
    if (error instanceof FaceVerificationError) throw error;
    console.error(JSON.stringify({ event: "face_provider_transport_failure", action }));
    throw new FaceVerificationError("认证服务暂时不可用，请稍后重试", 503);
  }
}

export const aliyunFaceProvider = {
  async init(input: { id: string; realName: string; idCard: string; metaInfo: string; sceneId: string; returnUrl: string }) {
    const data = await rpc("InitFaceVerify", {
      SceneId: input.sceneId, OuterOrderNo: input.id, ProductCode: "ID_PRO", Model: "MOVE_ACTION",
      CertType: "IDENTITY_CARD", CertName: input.realName, CertNo: input.idCard,
      MetaInfo: input.metaInfo, ReturnUrl: input.returnUrl,
      VideoEvidence: "false", ProcedurePriority: "url", NeedMultiFaceCheck: "Y", RarelyCharacters: "N",
    });
    if (!data || typeof data.CertifyId !== "string" || !/^[A-Za-z0-9_-]{1,128}$/u.test(data.CertifyId)
      || typeof data.CertifyUrl !== "string") throw new FaceVerificationError("认证服务未返回有效链接", 503);
    const url = new URL(data.CertifyUrl);
    if (url.protocol !== "https:" || url.username || url.password) throw new FaceVerificationError("认证链接无效", 503);
    return { certifyId: data.CertifyId, certifyUrl: url.href };
  },
  async query(sceneId: string, certifyId: string) {
    const data = await rpc("DescribeFaceVerify", { SceneId: sceneId, CertifyId: certifyId });
    if (data === null) return { status: "pending" as const };
    if (data.Passed !== "T" && data.Passed !== "F") throw new FaceVerificationError("认证结果暂时不可用", 503);
    return { status: data.Passed === "T" ? "passed" as const : "failed" as const };
  },
};
export type FaceProvider = typeof aliyunFaceProvider;
