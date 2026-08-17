"use client";

import type { TeachingAttendanceStatus } from "@cuberoot/shared/teaching";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  saveAttendanceBatchAction,
  type TeachingMutationResult,
} from "@/app/org/actions";
import {
  RECORDED_ATTENDANCE_STATUSES,
  teachingAttendanceStatusLabel,
} from "@/lib/teaching-stage2";
import { MutationResultMessage } from "./MutationResultMessage";

type AttendanceRow = {
  id: string;
  studentName: string;
  attendanceStatus: TeachingAttendanceStatus;
  creditCost: number;
};

export function AttendanceForm({
  orgSlug,
  sessionId,
  attendance,
}: {
  orgSlug: string;
  sessionId: string;
  attendance: AttendanceRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<TeachingMutationResult | null>(null);
  const operationKey = useRef<string | null>(null);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const records = attendance.map((item) => ({
      attendanceId: item.id,
      status: String(data.get(`attendance-${item.id}`) ?? ""),
    }));
    if (records.some((item) => !RECORDED_ATTENDANCE_STATUSES.includes(item.status as (typeof RECORDED_ATTENDANCE_STATUSES)[number]))) {
      setResult({ ok: false, error: "请为每位学员选择出勤结果" });
      return;
    }
    operationKey.current ??= crypto.randomUUID();
    data.set("operationKey", operationKey.current);
    data.set("records", JSON.stringify(records));
    setResult(null);
    startTransition(async () => {
      const next = await saveAttendanceBatchAction(orgSlug, sessionId, data);
      setResult(next);
      if (next.ok) {
        operationKey.current = null;
        router.refresh();
      }
    });
  }

  return (
    <form
      onSubmit={submit}
      onChange={() => {
        if (!pending) operationKey.current = null;
      }}
      aria-busy={pending}
      className="mt-5"
    >
      <fieldset disabled={pending} className="min-w-0">
        <div className="divide-y divide-line border-y border-line">
          {attendance.map((item) => (
            <div key={item.id} className="grid min-w-0 gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(9rem,auto)] sm:items-center sm:gap-4">
              <span className="min-w-0 [overflow-wrap:anywhere] text-[14px] font-medium text-ink">{item.studentName}</span>
              <span className="text-[12px] text-ink-3">扣课 {item.creditCost}</span>
              <label className="min-w-0">
                <span className="sr-only">{item.studentName}的出勤结果</span>
                <select
                  name={`attendance-${item.id}`}
                  required
                  defaultValue={item.attendanceStatus === "expected" ? "" : item.attendanceStatus}
                  className="w-full min-w-0 rounded-md border border-line bg-white px-3 py-2 text-[14px] text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
                >
                  <option value="" disabled>请选择出勤结果</option>
                  {RECORDED_ATTENDANCE_STATUSES.map((status) => (
                    <option key={status} value={status}>{teachingAttendanceStatusLabel(status)}</option>
                  ))}
                </select>
              </label>
            </div>
          ))}
        </div>
        <div className="mt-3 flex min-w-0 flex-wrap items-center gap-3">
          <button type="submit" disabled={pending} className="rounded-md bg-brand px-4 py-2 text-[14px] font-medium text-white transition hover:bg-brand-dark disabled:opacity-50">
            {pending ? "保存中…" : "保存全部出勤"}
          </button>
          <MutationResultMessage result={result} />
        </div>
      </fieldset>
    </form>
  );
}
