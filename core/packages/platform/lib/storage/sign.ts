import "server-only";
import { getActive } from "./registry";

/**
 * Return a URL to play a stored video by its storage key.
 *
 * Local provider: public/uploads/<key> is statically served at /uploads/<key>,
 * so we return the public path directly.
 *
 * Remote providers (s3 / r2 / oss / cos): for now return the public URL form
 * each provider exposes. Real signed URLs depend on per-provider credentials
 * (sigv4 GetObject query string for s3 / r2, OSS sign, COS sign) and we
 * keep them as a follow-up.
 *
 * TODO: 签名 URL 防盗链 - implement provider.signedGet(key, ttl) for s3 / r2 / oss / cos.
 */
export function signedVideoUrl(key: string, _ttl = 3600): string {
  void _ttl;
  if (!key) return "";
  // If the key looks like an absolute URL the caller already has a usable link.
  if (/^https?:\/\//i.test(key)) return key;

  const provider = getActive();
  const safeKey = key.replace(/^\/+/, "");

  switch (provider.id) {
    case "local":
      return `/uploads/${safeKey}`;
    case "r2": {
      const base = (process.env.STORAGE_R2_PUBLIC_BASE ?? "").replace(/\/$/, "");
      return base ? `${base}/${safeKey}` : `/uploads/${safeKey}`;
    }
    case "s3": {
      const base = (process.env.STORAGE_S3_PUBLIC_BASE ?? "").replace(/\/$/, "");
      return base ? `${base}/${safeKey}` : `/uploads/${safeKey}`;
    }
    case "oss": {
      const base = (process.env.STORAGE_OSS_PUBLIC_BASE ?? "").replace(/\/$/, "");
      return base ? `${base}/${safeKey}` : `/uploads/${safeKey}`;
    }
    case "cos": {
      const base = (process.env.STORAGE_COS_PUBLIC_BASE ?? "").replace(/\/$/, "");
      return base ? `${base}/${safeKey}` : `/uploads/${safeKey}`;
    }
    default:
      return `/uploads/${safeKey}`;
  }
}
