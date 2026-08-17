"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createSessionAction,
  loadStudentPackageOptionsAction,
  type StudentPackageOption,
  type TeachingMutationResult,
} from "@/app/org/actions";
import { localDateTimeToIso, teachingCreditLabel } from "@/lib/teaching-stage2";
import { MutationResultMessage } from "./MutationResultMessage";

type StudentOption = { id: string; name: string };
type TeacherOption = { userId: number; name: string };
type AttendeeDraft = {
  key: string;
  studentId: string;
  studentPackageId: string;
  creditCost: string;
  packages: StudentPackageOption[];
  loading: boolean;
  error: string | null;
  truncated: boolean;
};

function emptyAttendee(key: string): AttendeeDraft {
  return {
    key,
    studentId: "",
    studentPackageId: "",
    creditCost: "1",
    packages: [],
    loading: false,
    error: null,
    truncated: false,
  };
}

const inputClass = "w-full min-w-0 rounded-md border border-line bg-white px-3 py-2 text-[14px] text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 disabled:opacity-60";

export function CreateSessionForm({
  orgSlug,
  timezone,
  students,
  teachers,
}: {
  orgSlug: string;
  timezone: string;
  students: StudentOption[];
  teachers: TeacherOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [loadingPackages, startPackageTransition] = useTransition();
  const [attendees, setAttendees] = useState<AttendeeDraft[]>([emptyAttendee("initial")]);
  const [result, setResult] = useState<TeachingMutationResult | null>(null);
  const operationKey = useRef<string | null>(null);
  const resolvedTimes = useRef<{ startsAt: string; endsAt: string } | null>(null);
  const packageRequests = useRef<Record<string, number>>({});

  function changed() {
    if (!pending) {
      operationKey.current = null;
      resolvedTimes.current = null;
    }
  }

  function changeStudent(rowKey: string, studentId: string) {
    changed();
    const request = (packageRequests.current[rowKey] ?? 0) + 1;
    packageRequests.current[rowKey] = request;
    setAttendees((current) => current.map((item) => item.key === rowKey ? {
      ...item,
      studentId,
      studentPackageId: "",
      packages: [],
      loading: Boolean(studentId),
      error: null,
      truncated: false,
    } : item));
    if (!studentId) return;
    startPackageTransition(async () => {
      const next = await loadStudentPackageOptionsAction(orgSlug, studentId);
      if (packageRequests.current[rowKey] !== request) return;
      setAttendees((current) => current.map((item) => item.key === rowKey ? {
        ...item,
        packages: next.ok ? next.items : [],
        loading: false,
        error: next.ok ? null : next.error,
        truncated: next.ok && next.truncated,
      } : item));
    });
  }

  function updateAttendee(rowKey: string, update: Partial<AttendeeDraft>) {
    changed();
    setAttendees((current) => current.map((item) => item.key === rowKey ? { ...item, ...update } : item));
  }

  function addAttendee() {
    changed();
    setAttendees((current) => current.length >= 100
      ? current
      : [...current, emptyAttendee(crypto.randomUUID())]);
  }

  function removeAttendee(rowKey: string) {
    changed();
    packageRequests.current[rowKey] = (packageRequests.current[rowKey] ?? 0) + 1;
    setAttendees((current) => current.length === 1
      ? [emptyAttendee("initial")]
      : current.filter((item) => item.key !== rowKey));
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || loadingPackages) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const startsAt = localDateTimeToIso(String(data.get("startsAtLocal") ?? ""), timezone);
    const endsAt = localDateTimeToIso(String(data.get("endsAtLocal") ?? ""), timezone);
    if (!startsAt || !endsAt) {
      setResult({ ok: false, error: "上课与下课时间无效，请重新选择" });
      return;
    }
    const attendeePayload = attendees.map((item) => ({
      studentId: item.studentId,
      studentPackageId: item.studentPackageId,
      creditCost: Number(item.creditCost),
    }));
    if (attendeePayload.some((item) => (
      !item.studentId ||
      !item.studentPackageId ||
      !Number.isSafeInteger(item.creditCost) ||
      item.creditCost < 1 ||
      item.creditCost > 1_000_000
    ))) {
      setResult({ ok: false, error: "请为每位学员选择有效课包，并填写正确的扣课数量" });
      return;
    }
    if (new Set(attendeePayload.map((item) => item.studentId)).size !== attendeePayload.length) {
      setResult({ ok: false, error: "同一课堂不能重复添加同一名学员" });
      return;
    }
    operationKey.current ??= crypto.randomUUID();
    resolvedTimes.current ??= { startsAt, endsAt };
    data.set("operationKey", operationKey.current);
    data.set("startsAt", resolvedTimes.current.startsAt);
    data.set("endsAt", resolvedTimes.current.endsAt);
    data.set("timezone", timezone);
    data.set("attendees", JSON.stringify(attendeePayload));
    setResult(null);
    startTransition(async () => {
      const next = await createSessionAction(orgSlug, data);
      setResult(next);
      if (next.ok) {
        operationKey.current = null;
        resolvedTimes.current = null;
        packageRequests.current = {};
        setAttendees([emptyAttendee("initial")]);
        form.reset();
        router.refresh();
      }
    });
  }

  if (!students.length) {
    return <p className="mt-4 text-[13px] text-ink-3">暂无正常学员，请先添加学员并发放课包。</p>;
  }

  return (
    <form onSubmit={submit} onChange={changed} aria-busy={pending} className="mt-5 max-w-5xl">
      <h3 className="text-[15px] font-semibold text-ink">创建课堂</h3>
      <fieldset disabled={pending} className="mt-3 min-w-0">
        <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block min-w-0 sm:col-span-2">
            <span className="mb-1.5 block text-[13px] font-medium text-ink">课堂标题</span>
            <input name="title" required maxLength={160} placeholder="例如 周六一对一训练" className={inputClass} />
          </label>
          <label className="block min-w-0">
            <span className="mb-1.5 block text-[13px] font-medium text-ink">上课时间</span>
            <input name="startsAtLocal" type="datetime-local" required className={inputClass} />
          </label>
          <label className="block min-w-0">
            <span className="mb-1.5 block text-[13px] font-medium text-ink">下课时间</span>
            <input name="endsAtLocal" type="datetime-local" required className={inputClass} />
          </label>
          <label className="block min-w-0 sm:col-span-2 lg:col-span-1">
            <span className="mb-1.5 block text-[13px] font-medium text-ink">授课成员（可选）</span>
            <select name="teacherUserId" defaultValue="" className={inputClass}>
              <option value="">暂不分配</option>
              {teachers.map((teacher) => (
                <option key={teacher.userId} value={teacher.userId}>{teacher.name}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-4 divide-y divide-line border-y border-line">
          {attendees.map((attendee, index) => (
            <div key={attendee.key} className="grid min-w-0 gap-3 py-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_8rem_auto] lg:items-end">
              <label className="block min-w-0">
                <span className="mb-1.5 block text-[13px] font-medium text-ink">学员 {index + 1}</span>
                <select
                  name={`student-${attendee.key}`}
                  required
                  value={attendee.studentId}
                  onChange={(event) => changeStudent(attendee.key, event.currentTarget.value)}
                  className={inputClass}
                >
                  <option value="" disabled>请选择</option>
                  {students.map((student) => <option key={student.id} value={student.id}>{student.name}</option>)}
                </select>
              </label>
              <label className="block min-w-0">
                <span className="mb-1.5 block text-[13px] font-medium text-ink">学员课包</span>
                <select
                  name={`student-package-${attendee.key}`}
                  required
                  value={attendee.studentPackageId}
                  disabled={attendee.loading || !attendee.packages.length}
                  onChange={(event) => updateAttendee(attendee.key, { studentPackageId: event.currentTarget.value })}
                  className={inputClass}
                >
                  <option value="" disabled>
                    {attendee.loading ? "正在读取…" : attendee.packages.length ? "请选择" : attendee.studentId ? "暂无可用课包" : "请先选择学员"}
                  </option>
                  {attendee.packages.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}（剩余 {teachingCreditLabel(item.remainingCredits, item.creditUnit)}）
                    </option>
                  ))}
                </select>
                {attendee.error ? <p role="alert" className="mt-1 text-[12px] text-ink-2">{attendee.error}</p> : null}
                {attendee.truncated ? <p className="mt-1 text-[12px] text-ink-3">这里只显示前 100 个可用课包。</p> : null}
              </label>
              <label className="block min-w-0">
                <span className="mb-1.5 block text-[13px] font-medium text-ink">本次扣课</span>
                <input
                  name={`credit-cost-${attendee.key}`}
                  type="number"
                  required
                  min={1}
                  max={1_000_000}
                  step={1}
                  value={attendee.creditCost}
                  onChange={(event) => updateAttendee(attendee.key, { creditCost: event.currentTarget.value })}
                  className={inputClass}
                />
              </label>
              <button
                type="button"
                onClick={() => removeAttendee(attendee.key)}
                className="self-start rounded-md px-2 py-2 text-[13px] text-ink-3 hover:bg-bg-soft hover:text-ink lg:self-end"
                aria-label={`移除学员 ${index + 1}`}
              >
                移除
              </button>
            </div>
          ))}
        </div>

        <div className="mt-3 flex min-w-0 flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={addAttendee}
            disabled={attendees.length >= 100}
            className="rounded-md px-3 py-2 text-[13px] font-medium text-brand-dark hover:bg-brand-soft disabled:opacity-50"
          >
            添加学员
          </button>
          <button
            type="submit"
            disabled={pending || loadingPackages || attendees.some((item) => !item.studentId || !item.studentPackageId || !item.creditCost)}
            className="rounded-md bg-brand px-4 py-2 text-[14px] font-medium text-white transition hover:bg-brand-dark disabled:opacity-50"
          >
            {pending ? "创建中…" : "创建课堂"}
          </button>
          <MutationResultMessage result={result} />
          {result?.ok && result.entityId ? (
            <Link href={`/org/${orgSlug}/sessions/${result.entityId}`} prefetch={false} className="text-[13px] font-medium text-brand-dark hover:text-brand">
              查看课堂
            </Link>
          ) : null}
        </div>
      </fieldset>
    </form>
  );
}
