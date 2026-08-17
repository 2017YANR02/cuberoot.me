import { describe, expect, it } from "vitest";
import {
  nextOtpRateLimitState,
  OTP_RATE_LIMIT_POLICIES,
} from "@/lib/otp-rate-limit";
import { getClientIp } from "@/lib/request-ip";

describe("OTP rate limits", () => {
  it("blocks the next verification after the configured attempts", () => {
    const policy = OTP_RATE_LIMIT_POLICIES["verify-phone"];
    let state = null;
    for (let attempt = 0; attempt < policy.maxAttempts; attempt += 1) {
      const decision = nextOtpRateLimitState(state, policy, 1_000 + attempt);
      expect(decision.allowed).toBe(true);
      state = decision.state;
    }

    const blocked = nextOtpRateLimitState(state, policy, 1_100);
    expect(blocked.allowed).toBe(false);
    if (!blocked.allowed) {
      expect(blocked.retryAfter).toBe(policy.blockSec);
    }
  });

  it("starts a clean window after the old window expires", () => {
    const policy = OTP_RATE_LIMIT_POLICIES["send-phone"];
    const decision = nextOtpRateLimitState(
      { windowStartedAt: 1_000, attempts: policy.maxAttempts, blockedUntil: null },
      policy,
      1_000 + policy.windowSec,
    );
    expect(decision).toEqual({
      allowed: true,
      state: {
        windowStartedAt: 1_000 + policy.windowSec,
        attempts: 1,
        blockedUntil: null,
      },
    });
  });
});

describe("client IP extraction", () => {
  it("prefers the proxy-overwritten real IP", () => {
    const headers = new Headers({
      "x-real-ip": "192.0.2.10",
      "x-forwarded-for": "198.51.100.1, 198.51.100.2",
    });
    expect(getClientIp({ headers })).toBe("192.0.2.10");
  });

  it("uses only the first forwarded value and rejects header injection", () => {
    expect(
      getClientIp({ headers: new Headers({ "x-forwarded-for": "198.51.100.1, 203.0.113.2" }) }),
    ).toBe("198.51.100.1");
    expect(
      getClientIp({ headers: new Headers({ "x-real-ip": "a".repeat(101) }) }),
    ).toBe("unknown");
  });
});
