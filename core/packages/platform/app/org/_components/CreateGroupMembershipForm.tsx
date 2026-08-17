"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createGroupMembershipAction, type TeachingMutationResult } from "@/app/org/actions";
import type { TeachingStudent } from "@/lib/teaching-api";
import { resolveTeachingEffectiveRange } from "@/lib/teaching-stage1";
import { EffectiveRangeFields, teachingInputClass } from "./EffectiveRangeFields";
import { MutationResultMessage } from "./MutationResultMessage";

export function CreateGroupMembershipForm({
  orgSlug,
  groupId,
  timezone,
  students,
  studentsTruncated,
}: {
  orgSlug: string;
  groupId: string;
  timezone: string;
  students: TeachingStudent[];
  studentsTruncated: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<TeachingMutationResult | null>(null);
  const operationKey = useRef<string | null>(null);
  const stableRange = useRef<{ effectiveFrom: string; effectiveTo?: string } | null>(null);

  function resetRetryIdentity() {
    if (pending) return;
    operationKey.current = null;
    stableRange.current = null;
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const range = stableRange.current ?? resolveTeachingEffectiveRange(
      String(data.get("localFrom") ?? ""),
      String(data.get("localTo") ?? ""),
      timezone,
    );
    if (!range) {
      setResult({ ok: false, error: "有效期无效，结束时间必须晚于开始时间" });
      return;
    }
    operationKey.current ??= crypto.randomUUID();
    stableRange.current = range;
    data.set("operationKey", operationKey.current);
    data.set("effectiveFrom", range.effectiveFrom);
    data.set("effectiveTo", range.effectiveTo ?? "");
    setResult(null);
    startTransition(async () => {
      const next = await createGroupMembershipAction(orgSlug, groupId, data);
      setResult(next);
      if (next.ok) {
        operationKey.current = null;
        stableRange.current = null;
        form.reset();
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={submit} onChange={resetRetryIdentity} aria-busy={pending} className="mt-4 max-w-3xl">
      <fieldset disabled={pending} className="grid min-w-0 gap-3 sm:grid-cols-2">
        <label className="block min-w-0 sm:col-span-2">
          <span className="mb-1.5 block text-[13px] font-medium text-ink">学员</span>
          <select name="studentId" required defaultValue="" className={teachingInputClass}>
            <option value="" disabled>选择学员</option>
            {students.map((student) => (
              <option key={student.id} value={student.id}>
                {student.displayName}{student.externalRef ? `（${student.externalRef}）` : ""}
              </option>
            ))}
          </select>
        </label>
        <EffectiveRangeFields timezone={timezone} />
        <div className="flex min-w-0 flex-wrap items-center gap-3 sm:col-span-2">
          <button type="submit" disabled={pending || students.length === 0} className="rounded-md bg-brand px-4 py-2 text-[14px] font-medium text-white transition hover:bg-brand-dark disabled:opacity-50">
            {pending ? "加入中…" : "加入班级"}
          </button>
          <MutationResultMessage result={result} />
        </div>
        {students.length === 0 ? <p className="text-[12px] text-ink-3 sm:col-span-2">暂无可选择的学员，请先创建学员档案。</p> : null}
        {studentsTruncated ? <p className="text-[12px] text-ink-3 sm:col-span-2">学员选择器仅显示前 100 项；其余学员暂不能从此表单选择。</p> : null}
      </fieldset>
    </form>
  );
}
