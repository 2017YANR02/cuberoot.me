export type OtpRateLimitScope =
  | "send-phone"
  | "send-ip"
  | "verify-phone"
  | "verify-ip";

export type OtpRateLimitPolicy = {
  windowSec: number;
  maxAttempts: number;
  blockSec: number;
};

export const OTP_RATE_LIMIT_POLICIES: Record<
  OtpRateLimitScope,
  OtpRateLimitPolicy
> = {
  "send-phone": { windowSec: 60 * 60, maxAttempts: 5, blockSec: 60 * 60 },
  "send-ip": { windowSec: 60 * 60, maxAttempts: 20, blockSec: 60 * 60 },
  "verify-phone": { windowSec: 15 * 60, maxAttempts: 6, blockSec: 15 * 60 },
  "verify-ip": { windowSec: 15 * 60, maxAttempts: 40, blockSec: 15 * 60 },
};

export type OtpRateLimitState = {
  windowStartedAt: number;
  attempts: number;
  blockedUntil: number | null;
};

export type OtpRateLimitDecision =
  | { allowed: true; state: OtpRateLimitState }
  | { allowed: false; retryAfter: number; state: OtpRateLimitState };

export function nextOtpRateLimitState(
  current: OtpRateLimitState | null,
  policy: OtpRateLimitPolicy,
  now: number,
): OtpRateLimitDecision {
  if (current?.blockedUntil && current.blockedUntil > now) {
    return {
      allowed: false,
      retryAfter: current.blockedUntil - now,
      state: current,
    };
  }

  const activeWindow =
    current && now - current.windowStartedAt < policy.windowSec
      ? current
      : { windowStartedAt: now, attempts: 0, blockedUntil: null };

  if (activeWindow.attempts >= policy.maxAttempts) {
    const state = {
      ...activeWindow,
      blockedUntil: now + policy.blockSec,
    };
    return { allowed: false, retryAfter: policy.blockSec, state };
  }

  return {
    allowed: true,
    state: {
      ...activeWindow,
      attempts: activeWindow.attempts + 1,
      blockedUntil: null,
    },
  };
}
