// Edge-safe verification (uses Web Crypto only).
// Server-side signing lives in lib/auth.ts (uses node:crypto).

export const SESSION_COOKIE = "cube_admin";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

function getSecret(): string {
  return process.env.SESSION_SECRET ?? "dev-cube-secret-change-me";
}

async function hmac(secret: string, payload: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  const bytes = new Uint8Array(sig);
  let hex = "";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return hex;
}

function timingSafeEqHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function verifySessionEdge(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [ver, issuedAtStr, sig] = parts;
  const payload = `${ver}.${issuedAtStr}`;
  const expected = await hmac(getSecret(), payload);
  if (!timingSafeEqHex(sig, expected)) return false;
  const issuedAt = Number(issuedAtStr);
  if (!Number.isFinite(issuedAt)) return false;
  const now = Math.floor(Date.now() / 1000);
  if (now - issuedAt > SESSION_MAX_AGE) return false;
  return true;
}
