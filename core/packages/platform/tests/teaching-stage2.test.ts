import { describe, expect, it } from "vitest";
import {
  canCompleteTeachingSession,
  localDateTimeToIso,
  teachingAttendanceStatusLabel,
  teachingCreditLabel,
  teachingLedgerReasonLabel,
  teachingSessionStatusLabel,
} from "@/lib/teaching-stage2";

describe("teaching stage 2 UI rules", () => {
  it("only enables completion after every attendee has a final result", () => {
    expect(canCompleteTeachingSession("scheduled", [
      { attendanceStatus: "present" },
      { attendanceStatus: "excused" },
    ])).toBe(true);
    expect(canCompleteTeachingSession("scheduled", [
      { attendanceStatus: "present" },
      { attendanceStatus: "expected" },
    ])).toBe(false);
    expect(canCompleteTeachingSession("completed", [
      { attendanceStatus: "present" },
    ])).toBe(false);
    expect(canCompleteTeachingSession("in_progress", [])).toBe(false);
  });

  it("rejects ambiguous or invalid local date-time input before mutation", () => {
    expect(localDateTimeToIso("2026-08-22T09:30", "America/Los_Angeles")).toBe("2026-08-22T16:30:00.000Z");
    expect(localDateTimeToIso("2026-08-22T09:30", "Asia/Shanghai")).toBe("2026-08-22T01:30:00.000Z");
    expect(localDateTimeToIso("2026-03-08T02:30", "America/Los_Angeles")).toBeNull();
    expect(localDateTimeToIso("2026-08-22", "Asia/Shanghai")).toBeNull();
    expect(localDateTimeToIso("not-a-date", "Asia/Shanghai")).toBeNull();
    expect(localDateTimeToIso("2026-08-22T09:30", "Not/A_Timezone")).toBeNull();
  });

  it("keeps teaching status and ledger copy Chinese-first", () => {
    expect(teachingSessionStatusLabel("in_progress")).toBe("上课中");
    expect(teachingAttendanceStatusLabel("excused")).toBe("请假");
    expect(teachingCreditLabel(45, "minute")).toBe("45 分钟");
    expect(teachingLedgerReasonLabel("Session attendance")).toBe("课堂完课扣减");
  });
});
