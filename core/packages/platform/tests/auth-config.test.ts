import { afterEach, describe, expect, it, vi } from "vitest";
import { getAdminPassword, getSessionSecret } from "@/lib/auth-config";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("production auth configuration", () => {
  it("rejects missing production credentials", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ADMIN_PASSWORD", "");
    vi.stubEnv("SESSION_SECRET", "");

    expect(() => getAdminPassword()).toThrow("ADMIN_PASSWORD is required in production");
    expect(() => getSessionSecret()).toThrow("SESSION_SECRET is required in production");
  });

  it("accepts explicit production credentials", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ADMIN_PASSWORD", "configured-password");
    vi.stubEnv("SESSION_SECRET", "configured-session-secret");

    expect(getAdminPassword()).toBe("configured-password");
    expect(getSessionSecret()).toBe("configured-session-secret");
  });
});
