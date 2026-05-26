import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "cube_admin";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export function getAdminPassword(): string {
  return process.env.ADMIN_PASSWORD ?? "admin123";
}

function getSecret(): string {
  return process.env.SESSION_SECRET ?? "dev-cube-secret-change-me";
}

export function signSession(): string {
  const issuedAt = Math.floor(Date.now() / 1000);
  const payload = `1.${issuedAt}`;
  const sig = createHmac("sha256", getSecret()).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

export function verifySession(token: string | undefined): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [ver, issuedAtStr, sig] = parts;
  const payload = `${ver}.${issuedAtStr}`;
  const expected = createHmac("sha256", getSecret()).update(payload).digest("hex");
  const a = Buffer.from(sig, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length) return false;
  if (!timingSafeEqual(a, b)) return false;
  const issuedAt = Number(issuedAtStr);
  if (!Number.isFinite(issuedAt)) return false;
  const now = Math.floor(Date.now() / 1000);
  if (now - issuedAt > SESSION_MAX_AGE) return false;
  return true;
}
