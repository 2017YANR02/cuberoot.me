import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import type { User } from "@/db/schema";

export const USER_COOKIE = "cube_user";
export const USER_SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function getSecret(): string {
  return process.env.SESSION_SECRET ?? "dev-cube-secret-change-me";
}

function b64url(input: Buffer): string {
  return input
    .toString("base64")
    .replace(/=+$/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function b64urlDecode(input: string): Buffer {
  const pad = input.length % 4 === 0 ? "" : "=".repeat(4 - (input.length % 4));
  const normal = input.replace(/-/g, "+").replace(/_/g, "/") + pad;
  return Buffer.from(normal, "base64");
}

export function signUserToken(userId: string): string {
  const issuedAt = Math.floor(Date.now() / 1000);
  const payloadObj = { sub: userId, iat: issuedAt };
  const payload = b64url(Buffer.from(JSON.stringify(payloadObj), "utf8"));
  const sig = b64url(
    createHmac("sha256", getSecret()).update(payload).digest(),
  );
  return `${payload}.${sig}`;
}

export function verifyUserToken(token: string | undefined): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expected = b64url(
    createHmac("sha256", getSecret()).update(payload).digest(),
  );
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  if (!timingSafeEqual(a, b)) return null;
  try {
    const obj = JSON.parse(b64urlDecode(payload).toString("utf8")) as {
      sub?: string;
      iat?: number;
    };
    if (!obj.sub || typeof obj.iat !== "number") return null;
    const now = Math.floor(Date.now() / 1000);
    if (now - obj.iat > USER_SESSION_MAX_AGE) return null;
    return obj.sub;
  } catch {
    return null;
  }
}

export async function getCurrentUser(): Promise<User | null> {
  const c = await cookies();
  const token = c.get(USER_COOKIE)?.value;
  const userId = verifyUserToken(token);
  if (!userId) return null;
  const rows = db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .all();
  return rows[0] ?? null;
}

export async function requireUser(nextPath?: string): Promise<User> {
  const u = await getCurrentUser();
  if (!u) {
    const q = nextPath ? `?next=${encodeURIComponent(nextPath)}` : "";
    redirect(`/login${q}`);
  }
  return u;
}

export function newUserId(): string {
  return "u_" + b64url(randomBytes(9));
}

export function newOrderId(): string {
  return "o_" + b64url(randomBytes(9));
}

export function newApplicationId(): string {
  return "a_" + b64url(randomBytes(9));
}

export function newInstructorId(): string {
  return "i_" + b64url(randomBytes(6));
}
