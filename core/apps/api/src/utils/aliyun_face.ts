import { createAliyunFaceClient, FaceVerificationError as ProtocolError, type InitFaceVerificationInput } from "@app-foundation/face-verification";

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

async function providerCall<T>(call: (client: ReturnType<typeof createAliyunFaceClient>) => Promise<T>): Promise<T> {
  const config = faceConfiguration();
  try { return await call(createAliyunFaceClient({ accessKeyId: config.accessKey, accessKeySecret: config.secret })); }
  catch (error) {
    if (error instanceof ProtocolError) {
      console.error(JSON.stringify({ event: "face_provider_failure", code: error.code, ...error.diagnostic }));
      if (error.code === "PERMISSION") throw new FaceVerificationError("Provider permissions unavailable.", 503, "FACE_PROVIDER_PERMISSION");
      if (error.code === "BALANCE") throw new FaceVerificationError("Provider balance unavailable.", 503, "FACE_PROVIDER_BALANCE");
    }
    throw new FaceVerificationError("认证服务暂时不可用，请稍后重试", 503);
  }
}

export const aliyunFaceProvider = {
  init: (input: InitFaceVerificationInput) => providerCall(client => client.init(input)),
  query: (sceneId: string, certifyId: string) => providerCall(client => client.query(sceneId, certifyId)),
};
export type FaceProvider = typeof aliyunFaceProvider;
