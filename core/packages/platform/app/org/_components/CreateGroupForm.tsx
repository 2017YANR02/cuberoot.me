"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createGroupAction, type TeachingMutationResult } from "@/app/org/actions";
import type { TeachingCampus } from "@/lib/teaching-api";
import { teachingInputClass } from "./EffectiveRangeFields";
import { MutationResultMessage } from "./MutationResultMessage";

export function CreateGroupForm({ orgSlug, campuses, campusesTruncated }: { orgSlug: string; campuses: TeachingCampus[]; campusesTruncated: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<TeachingMutationResult | null>(null);
  const operationKey = useRef<string | null>(null);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    operationKey.current ??= crypto.randomUUID();
    data.set("operationKey", operationKey.current);
    setResult(null);
    startTransition(async () => {
      const next = await createGroupAction(orgSlug, data);
      setResult(next);
      if (next.ok) {
        operationKey.current = null;
        form.reset();
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={submit} onChange={() => { if (!pending) operationKey.current = null; }} aria-busy={pending} className="mt-5 max-w-4xl">
      <h3 className="text-[15px] font-semibold text-ink">创建班级</h3>
      <fieldset disabled={pending} className="mt-3 grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.5fr)_auto] lg:items-end">
        <label className="block min-w-0">
          <span className="mb-1.5 block text-[13px] font-medium text-ink">班级名称</span>
          <input name="name" required maxLength={160} autoComplete="off" placeholder="例如 周六进阶班" className={teachingInputClass} />
        </label>
        <label className="block min-w-0">
          <span className="mb-1.5 block text-[13px] font-medium text-ink">班级代码（可选）</span>
          <input name="code" maxLength={64} pattern="[a-z0-9][a-z0-9_-]{0,63}" autoComplete="off" placeholder="sat-advanced" className={teachingInputClass} />
        </label>
        <label className="block min-w-0">
          <span className="mb-1.5 block text-[13px] font-medium text-ink">所属校区（可选）</span>
          <select name="campusId" defaultValue="" className={teachingInputClass}>
            <option value="">未设置校区</option>
            {campuses.map((campus) => <option key={campus.id} value={campus.id}>{campus.name}</option>)}
          </select>
        </label>
        <button type="submit" disabled={pending} className="rounded-md bg-brand px-4 py-2 text-[14px] font-medium text-white transition hover:bg-brand-dark disabled:opacity-50">
          {pending ? "创建中…" : "创建班级"}
        </button>
        {campusesTruncated ? <p className="text-[12px] text-ink-3 sm:col-span-2 lg:col-span-4">校区选择器仅显示前 100 项；请先归档不再使用的校区，或暂不设置校区。</p> : null}
        <div className="min-w-0 sm:col-span-2 lg:col-span-4"><MutationResultMessage result={result} /></div>
      </fieldset>
    </form>
  );
}
