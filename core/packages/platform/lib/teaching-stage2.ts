import type {
  TeachingAttendanceStatus,
  TeachingCreditUnit,
  TeachingPackageProductStatus,
  TeachingSessionStatus,
  TeachingStudentPackageStatus,
} from "@cuberoot/shared/teaching";

const SESSION_LABELS: Record<TeachingSessionStatus, string> = {
  scheduled: "待上课",
  in_progress: "上课中",
  completed: "已完课",
  cancelled: "已取消",
};

const ATTENDANCE_LABELS: Record<TeachingAttendanceStatus, string> = {
  expected: "待记录",
  present: "出勤",
  late: "迟到",
  absent: "缺勤",
  excused: "请假",
};

const PACKAGE_LABELS: Record<TeachingPackageProductStatus | TeachingStudentPackageStatus, string> = {
  active: "正常",
  retired: "已停用",
  frozen: "已冻结",
  cancelled: "已取消",
};

const LEDGER_LABELS: Record<string, string> = {
  purchase: "购买入账",
  grant: "发放入账",
  adjustment: "人工调整",
  consume: "完课扣减",
  refund: "退回课时",
  reversal: "冲正",
};

export const RECORDED_ATTENDANCE_STATUSES = [
  "present",
  "late",
  "absent",
  "excused",
] as const;

export function teachingSessionStatusLabel(status: TeachingSessionStatus): string {
  return SESSION_LABELS[status];
}

export function teachingAttendanceStatusLabel(status: TeachingAttendanceStatus): string {
  return ATTENDANCE_LABELS[status];
}

export function teachingPackageStatusLabel(
  status: TeachingPackageProductStatus | TeachingStudentPackageStatus,
): string {
  return PACKAGE_LABELS[status];
}

export function teachingLedgerEntryLabel(entryType: string): string {
  return LEDGER_LABELS[entryType] ?? entryType;
}

export function teachingLedgerReasonLabel(reason: string): string {
  if (reason === "Initial entitlement") return "初始课时入账";
  if (reason === "Session attendance") return "课堂完课扣减";
  return reason;
}

export function teachingCreditLabel(value: number, unit: TeachingCreditUnit): string {
  return unit === "minute" ? `${value} 分钟` : `${value} 课时`;
}

export function teachingMoneyLabel(amountMinor: number, currency: string): string {
  try {
    return new Intl.NumberFormat("zh-CN", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
    }).format(amountMinor / 100);
  } catch {
    return `${currency} ${(amountMinor / 100).toFixed(2)}`;
  }
}

export function teachingDateTimeLabel(value: string, timezone: string): string {
  try {
    return new Intl.DateTimeFormat("zh-CN", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export function localDateTimeToIso(value: string, timezone: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const [year, month, day, hour, minute] = match.slice(1).map(Number);
  if (year < 1000 || year > 9999) return null;

  const wallClock = new Date(0);
  wallClock.setUTCFullYear(year, month - 1, day);
  wallClock.setUTCHours(hour, minute, 0, 0);
  if (
    wallClock.getUTCFullYear() !== year ||
    wallClock.getUTCMonth() !== month - 1 ||
    wallClock.getUTCDate() !== day ||
    wallClock.getUTCHours() !== hour ||
    wallClock.getUTCMinutes() !== minute
  ) return null;

  try {
    const formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      calendar: "gregory",
      numberingSystem: "latn",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
    const target = wallClock.getTime();
    let instant = target;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const parts = Object.fromEntries(
        formatter.formatToParts(new Date(instant)).map((part) => [part.type, part.value]),
      );
      const rendered = Date.UTC(
        Number(parts.year),
        Number(parts.month) - 1,
        Number(parts.day),
        Number(parts.hour),
        Number(parts.minute),
        Number(parts.second),
      );
      const adjustment = target - rendered;
      if (adjustment === 0) return new Date(instant).toISOString();
      instant += adjustment;
    }
    return null;
  } catch {
    return null;
  }
}

export function canCompleteTeachingSession(
  status: TeachingSessionStatus,
  attendance: readonly { attendanceStatus: TeachingAttendanceStatus }[],
): boolean {
  return (
    (status === "scheduled" || status === "in_progress") &&
    attendance.length > 0 &&
    attendance.every((item) => item.attendanceStatus !== "expected")
  );
}
