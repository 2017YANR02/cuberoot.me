"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { TeachingOrganizationRole } from "@cuberoot/shared/teaching";
import {
  createTeacherAssignmentAction,
  type TeachingAssignmentTarget,
  type TeachingMutationResult,
} from "@/app/org/actions";
import { teachingRoleLabel } from "@/lib/teaching-labels";
import { resolveTeachingEffectiveRange } from "@/lib/teaching-stage1";
import { EffectiveRangeFields, teachingInputClass } from "./EffectiveRangeFields";
import { MutationResultMessage } from "./MutationResultMessage";

export interface TeachingStaffOption {
  userId: number;
  displayName: string;
  role: Extract<TeachingOrganizationRole, "owner" | "admin" | "teacher" | "assistant">;
}

export function CreateTeacherAssignmentForm({
  orgSlug,
  target,
  timezone,
  staff,
  staffTruncated,
}: {
  orgSlug: string;
  target: TeachingAssignmentTarget;
  timezone: string;
  staff: TeachingStaffOption[];
  staffTruncated: boolean;
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
      const next = await createTeacherAssignmentAction(orgSlug, target, data);
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
          <span className="mb-1.5 block text-[13px] font-medium text-ink">负责人</span>
          <select name="teacherUserId" required defaultValue="" className={teachingInputClass}>
            <option value="" disabled>选择负责人</option>
            {staff.map((member) => (
              <option key={member.userId} value={member.userId}>
                {member.displayName || `账号 ${member.userId}`}（{teachingRoleLabel(member.role)}）
              </option>
            ))}
          </select>
        </label>
        <EffectiveRangeFields timezone={timezone} />
        <div className="flex min-w-0 flex-wrap items-center gap-3 sm:col-span-2">
          <button type="submit" disabled={pending || staff.length === 0} className="rounded-md bg-brand px-4 py-2 text-[14px] font-medium text-white transition hover:bg-brand-dark disabled:opacity-50">
            {pending ? "分配中…" : "分配负责范围"}
          </button>
          <MutationResultMessage result={result} />
        </div>
        {staff.length === 0 ? <p className="text-[12px] text-ink-3 sm:col-span-2">暂无可分配的在职教学成员。</p> : null}
        {staffTruncated ? <p className="text-[12px] text-ink-3 sm:col-span-2">负责人选择器仅显示成员列表前 100 项；其余成员暂不能从此表单选择。</p> : null}
      </fieldset>
    </form>
  );
}
