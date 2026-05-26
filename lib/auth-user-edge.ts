// Edge-safe user-cookie verification (Web Crypto only).
// Server-side signing/verification lives in lib/auth-user.ts.

export const USER_COOKIE = "cube_user";
export const USER_SESSION_MAX_AGE = 60 * 60 * 24 * 30;

function getSecret(): string {
  return process.env.SESSION_SECRET ?? "dev-cube-secret-change-me";
}

function b64urlDecode(input: string): Uint8Array {
  const pad = input.length % 4 === 0 ? "" : "=".repeat(4 - (input.length % 4));
  const normal = input.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const bin = atob(normal);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function b64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/=+$/g, "").replace(/\+/g, "-").replace(/\//g, "_");
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
  return b64url(new Uint8Array(sig));
}

function timingSafeEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function verifyUserTokenEdge(
  token: string | undefined,
): Promise<string | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expected = await hmac(getSecret(), payload);
  if (!timingSafeEq(sig, expected)) return null;
  try {
    const decoded = b64urlDecode(payload);
    const text = new TextDecoder().decode(decoded);
    const obj = JSON.parse(text) as { sub?: string; iat?: number };
    if (!obj.sub || typeof obj.iat !== "number") return null;
    const now = Math.floor(Date.now() / 1000);
    if (now - obj.iat > USER_SESSION_MAX_AGE) return null;
    return obj.sub;
  } catch {
    return null;
  }
}
