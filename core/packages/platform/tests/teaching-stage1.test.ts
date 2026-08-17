import { describe, expect, it } from "vitest";
import {
  resolveTeachingEffectiveRange,
  teachingEffectiveRangeLabel,
  teachingEffectiveState,
} from "@/lib/teaching-stage1";

describe("teaching stage 1 helpers", () => {
  it("keeps the half-open range and rejects reversed bounds", () => {
    expect(resolveTeachingEffectiveRange(
      "2026-08-18T09:00",
      "2026-08-18T10:00",
      "Asia/Shanghai",
    )).toEqual({
      effectiveFrom: "2026-08-18T01:00:00.000Z",
      effectiveTo: "2026-08-18T02:00:00.000Z",
    });
    expect(resolveTeachingEffectiveRange(
      "2026-08-18T10:00",
      "2026-08-18T10:00",
      "Asia/Shanghai",
    )).toBeNull();
  });

  it("uses the provided instant for a blank start so callers can keep retries stable", () => {
    expect(resolveTeachingEffectiveRange("", "", "Asia/Shanghai", new Date("2026-08-17T00:00:00.000Z"))).toEqual({
      effectiveFrom: "2026-08-17T00:00:00.000Z",
    });
  });

  it("treats effectiveTo as the only canonical end", () => {
    const from = "2026-08-17T00:00:00.000Z";
    const to = "2026-08-18T00:00:00.000Z";
    expect(teachingEffectiveState(from, to, Date.parse(from) - 1)).toBe("upcoming");
    expect(teachingEffectiveState(from, to, Date.parse(from))).toBe("active");
    expect(teachingEffectiveState(from, to, Date.parse(to))).toBe("ended");
    expect(teachingEffectiveState(from, null, Date.parse(to))).toBe("active");
    expect(teachingEffectiveState(to, to, Date.parse(from))).toBe("ended");
    expect(teachingEffectiveRangeLabel(from, null, "Asia/Shanghai")).toContain("长期有效");
  });
});
