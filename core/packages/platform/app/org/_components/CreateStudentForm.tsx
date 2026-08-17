"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createStudentAction,
  type CreateStudentResult,
} from "@/app/org/actions";

export function CreateStudentForm({ orgSlug }: { orgSlug: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<CreateStudentResult | null>(null);
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
      const next = await createStudentAction(orgSlug, data);
      setResult(next);
      if (next.ok) {
        operationKey.current = null;
        form.reset();
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
      className="mt-4 max-w-2xl"
    >
      <fieldset
        disabled={pending}
        className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end"
      >
        <label className="block min-w-0">
          <span className="mb-1.5 block text-[13px] font-medium text-ink">学员姓名</span>
          <input
            name="displayName"
            required
            maxLength={160}
            autoComplete="off"
            placeholder="姓名或常用昵称"
            className="w-full min-w-0 rounded-md border border-line bg-white px-3 py-2 text-[14px] text-ink outline-none placeholder:text-ink-3 focus:border-brand focus:ring-2 focus:ring-brand/15"
          />
        </label>
        <label className="block min-w-0">
          <span className="mb-1.5 block text-[13px] font-medium text-ink">机构内编号（可选）</span>
          <input
            name="externalRef"
            maxLength={100}
            autoComplete="off"
            placeholder="例如 S-2026-001"
            className="w-full min-w-0 rounded-md border border-line bg-white px-3 py-2 text-[14px] text-ink outline-none placeholder:text-ink-3 focus:border-brand focus:ring-2 focus:ring-brand/15"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-brand px-4 py-2 text-[14px] font-medium text-white transition hover:bg-brand-dark disabled:opacity-50"
        >
          {pending ? "添加中…" : "添加学员"}
        </button>
        {result && !result.ok ? (
          <p role="alert" className="break-words text-[13px] text-red-600 sm:col-span-3">{result.error}</p>
        ) : null}
        {result?.ok ? (
          <p role="status" className="text-[13px] text-brand-dark sm:col-span-3">学员已添加。</p>
        ) : null}
      </fieldset>
    </form>
  );
}
