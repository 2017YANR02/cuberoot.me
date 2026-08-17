"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createPackageProductAction,
  type TeachingMutationResult,
} from "@/app/org/actions";
import { MutationResultMessage } from "./MutationResultMessage";

const inputClass = "w-full min-w-0 rounded-md border border-line bg-white px-3 py-2 text-[14px] text-ink outline-none placeholder:text-ink-3 focus:border-brand focus:ring-2 focus:ring-brand/15";

export function CreatePackageProductForm({ orgSlug }: { orgSlug: string }) {
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
      const next = await createPackageProductAction(orgSlug, data);
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
      className="mt-5 max-w-4xl"
    >
      <h3 className="text-[15px] font-semibold text-ink">创建课包</h3>
      <fieldset disabled={pending} className="mt-3 grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block min-w-0 lg:col-span-2">
          <span className="mb-1.5 block text-[13px] font-medium text-ink">课包名称</span>
          <input name="name" required maxLength={160} placeholder="例如 10 节一对一课程" className={inputClass} />
        </label>
        <label className="block min-w-0">
          <span className="mb-1.5 block text-[13px] font-medium text-ink">课包代码</span>
          <input name="code" required maxLength={64} pattern="[a-z0-9][a-z0-9_-]{0,63}" placeholder="private_10" className={inputClass} />
        </label>
        <label className="block min-w-0">
          <span className="mb-1.5 block text-[13px] font-medium text-ink">课时类型</span>
          <input name="creditType" required maxLength={64} pattern="[a-z][a-z0-9_-]{0,63}" defaultValue="general" className={inputClass} />
        </label>
        <label className="block min-w-0">
          <span className="mb-1.5 block text-[13px] font-medium text-ink">课时单位</span>
          <select name="creditUnit" defaultValue="lesson" className={inputClass}>
            <option value="lesson">按课时</option>
            <option value="minute">按分钟</option>
          </select>
        </label>
        <label className="block min-w-0">
          <span className="mb-1.5 block text-[13px] font-medium text-ink">总量</span>
          <input name="totalCredits" type="number" required min={1} max={1_000_000} step={1} defaultValue={10} className={inputClass} />
        </label>
        <label className="block min-w-0">
          <span className="mb-1.5 block text-[13px] font-medium text-ink">有效天数（可选）</span>
          <input name="validityDays" type="number" min={1} max={36_500} step={1} placeholder="留空长期有效" className={inputClass} />
        </label>
        <label className="block min-w-0">
          <span className="mb-1.5 block text-[13px] font-medium text-ink">价格（分）</span>
          <input name="priceAmountMinor" type="number" required min={0} step={1} defaultValue={0} className={inputClass} />
          <input type="hidden" name="currency" value="CNY" />
        </label>
        <div className="flex min-w-0 flex-wrap items-end gap-3 sm:col-span-2 lg:col-span-4">
          <button type="submit" disabled={pending} className="rounded-md bg-brand px-4 py-2 text-[14px] font-medium text-white transition hover:bg-brand-dark disabled:opacity-50">
            {pending ? "创建中…" : "创建课包"}
          </button>
          <MutationResultMessage result={result} />
        </div>
      </fieldset>
    </form>
  );
}
