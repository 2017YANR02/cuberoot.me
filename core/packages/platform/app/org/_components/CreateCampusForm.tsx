"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createCampusAction, type TeachingMutationResult } from "@/app/org/actions";
import { teachingInputClass } from "./EffectiveRangeFields";
import { MutationResultMessage } from "./MutationResultMessage";

export function CreateCampusForm({ orgSlug, organizationTimezone }: { orgSlug: string; organizationTimezone: string }) {
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
      const next = await createCampusAction(orgSlug, data);
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
      <h3 className="text-[15px] font-semibold text-ink">创建校区</h3>
      <fieldset disabled={pending} className="mt-3 grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.5fr)_auto] lg:items-end">
        <label className="block min-w-0">
          <span className="mb-1.5 block text-[13px] font-medium text-ink">校区名称</span>
          <input name="name" required maxLength={160} autoComplete="off" placeholder="例如 城西校区" className={teachingInputClass} />
        </label>
        <label className="block min-w-0">
          <span className="mb-1.5 block text-[13px] font-medium text-ink">校区代码（可选）</span>
          <input name="code" maxLength={64} pattern="[a-z0-9][a-z0-9_-]{0,63}" autoComplete="off" placeholder="west" className={teachingInputClass} />
        </label>
        <label className="block min-w-0">
          <span className="mb-1.5 block text-[13px] font-medium text-ink">时区（可选）</span>
          <input name="timezone" maxLength={64} autoComplete="off" placeholder={`留空继承 ${organizationTimezone}`} className={teachingInputClass} />
        </label>
        <button type="submit" disabled={pending} className="rounded-md bg-brand px-4 py-2 text-[14px] font-medium text-white transition hover:bg-brand-dark disabled:opacity-50">
          {pending ? "创建中…" : "创建校区"}
        </button>
        <div className="min-w-0 sm:col-span-2 lg:col-span-4"><MutationResultMessage result={result} /></div>
      </fieldset>
    </form>
  );
}
