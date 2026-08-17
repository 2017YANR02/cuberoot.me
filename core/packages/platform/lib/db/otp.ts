import "server-only";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import type { OtpCode } from "@/db/schema";

const OTP_TTL_SEC = 60 * 5; // 5 minutes
const OTP_RESEND_COOLDOWN = 60; // 60 seconds

export function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function lastSentWithin(
  phone: string,
  windowSec: number,
): Promise<boolean> {
  const cutoff = Math.floor(Date.now() / 1000) - windowSec;
  const rows = db
    .select()
    .from(schema.otpCodes)
    .where(and(eq(schema.otpCodes.phone, phone), gt(schema.otpCodes.createdAt, cutoff)))
    .all();
  return rows.length > 0;
}

export async function createCode(phone: string): Promise<{ code: string; expiresAt: number }> {
  const code = generateCode();
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + OTP_TTL_SEC;
  await db.insert(schema.otpCodes).values({
    phone,
    code,
    expiresAt,
    consumedAt: null,
    createdAt: now,
  });
  return { code, expiresAt };
}

export async function findActive(phone: string, code: string): Promise<OtpCode | undefined> {
  const now = Math.floor(Date.now() / 1000);
  const rows = db
    .select()
    .from(schema.otpCodes)
    .where(
      and(
        eq(schema.otpCodes.phone, phone),
        eq(schema.otpCodes.code, code),
        isNull(schema.otpCodes.consumedAt),
        gt(schema.otpCodes.expiresAt, now),
      ),
    )
    .orderBy(desc(schema.otpCodes.createdAt))
    .all();
  return rows[0];
}

export async function consume(id: number): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  await db
    .update(schema.otpCodes)
    .set({ consumedAt: now })
    .where(eq(schema.otpCodes.id, id));
}

export const OTP_CONFIG = { TTL_SEC: OTP_TTL_SEC, COOLDOWN: OTP_RESEND_COOLDOWN };
