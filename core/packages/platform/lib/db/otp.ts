import "server-only";
import { createHmac, randomInt } from "node:crypto";
import { and, desc, eq, gt, isNull, lt } from "drizzle-orm";
import { db, schema } from "@/db";
import type { OtpCode } from "@/db/schema";
import { getSessionSecret } from "@/lib/auth-config";
import {
  nextOtpRateLimitState,
  OTP_RATE_LIMIT_POLICIES,
  type OtpRateLimitDecision,
  type OtpRateLimitScope,
} from "@/lib/otp-rate-limit";

const OTP_TTL_SEC = 60 * 5; // 5 minutes
const OTP_RESEND_COOLDOWN = 60; // 60 seconds
const OTP_RATE_LIMIT_RETENTION_SEC = 60 * 60 * 24 * 7;

function rateLimitKey(scope: OtpRateLimitScope, identifier: string): string {
  return createHmac("sha256", getSessionSecret())
    .update(`${scope}\0${identifier}`)
    .digest("hex");
}

export async function takeOtpAttempt(
  scope: OtpRateLimitScope,
  identifier: string,
): Promise<OtpRateLimitDecision> {
  const now = Math.floor(Date.now() / 1000);
  const policy = OTP_RATE_LIMIT_POLICIES[scope];
  const keyHash = rateLimitKey(scope, identifier);

  return db.transaction((tx) => {
    tx.delete(schema.otpRateLimits)
      .where(
        and(
          eq(schema.otpRateLimits.scope, scope),
          lt(schema.otpRateLimits.updatedAt, now - OTP_RATE_LIMIT_RETENTION_SEC),
        ),
      )
      .run();
    const current = tx
      .select()
      .from(schema.otpRateLimits)
      .where(eq(schema.otpRateLimits.keyHash, keyHash))
      .get();
    const decision = nextOtpRateLimitState(current ?? null, policy, now);

    tx.insert(schema.otpRateLimits)
      .values({
        keyHash,
        scope,
        windowStartedAt: decision.state.windowStartedAt,
        attempts: decision.state.attempts,
        blockedUntil: decision.state.blockedUntil,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: schema.otpRateLimits.keyHash,
        set: {
          scope,
          windowStartedAt: decision.state.windowStartedAt,
          attempts: decision.state.attempts,
          blockedUntil: decision.state.blockedUntil,
          updatedAt: now,
        },
      })
      .run();

    return decision;
  });
}

export async function resetOtpRateLimit(
  scope: OtpRateLimitScope,
  identifier: string,
): Promise<void> {
  await db
    .delete(schema.otpRateLimits)
    .where(eq(schema.otpRateLimits.keyHash, rateLimitKey(scope, identifier)));
}

export function generateCode(): string {
  return String(randomInt(100000, 1000000));
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
  db.transaction((tx) => {
    tx.update(schema.otpCodes)
      .set({ consumedAt: now })
      .where(and(eq(schema.otpCodes.phone, phone), isNull(schema.otpCodes.consumedAt)))
      .run();
    tx.insert(schema.otpCodes).values({
      phone,
      code,
      expiresAt,
      consumedAt: null,
      createdAt: now,
    }).run();
  });
  return { code, expiresAt };
}

export async function consumeActiveCode(
  phone: string,
  code: string,
): Promise<OtpCode | undefined> {
  const now = Math.floor(Date.now() / 1000);
  return db.transaction((tx) => {
    const otp = tx
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
      .get();
    if (!otp) return undefined;
    const result = tx
      .update(schema.otpCodes)
      .set({ consumedAt: now })
      .where(
        and(
          eq(schema.otpCodes.id, otp.id),
          isNull(schema.otpCodes.consumedAt),
        ),
      )
      .run();
    return result.changes === 1 ? otp : undefined;
  });
}

export const OTP_CONFIG = { TTL_SEC: OTP_TTL_SEC, COOLDOWN: OTP_RESEND_COOLDOWN };
