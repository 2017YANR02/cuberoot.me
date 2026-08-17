"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createStudentPackageAction,
  type TeachingMutationResult,
} from "@/app/org/actions";
import { localDateTimeToIso } from "@/lib/teaching-stage2";
import { MutationResultMessage } from "./MutationResultMessage";

type ProductOption = {
  id: string;
  name: string;
  totalCredits: number;
  unitLabel: string;
};

const inputClass = "w-full min-w-0 rounded-md border border-line bg-white px-3 py-2 text-[14px] text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/15";

export function GrantStudentPackageForm({
  orgSlug,
  studentId,
  timezone,
  products,
}: {
  orgSlug: string;
  studentId: string;
  timezone: string;
  products: ProductOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<TeachingMutationResult | null>(null);
  const operationKey = useRef<string | null>(null);
  const resolvedValidFrom = useRef<string | null>(null);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const localValue = String(data.get("validFromLocal") ?? "");
    const converted = localValue ? localDateTimeToIso(localValue, timezone) : new Date().toISOString();
    if (!converted) {
      setResult({ ok: false, error: "生效时间无效，请重新选择" });
      return;
    }
    operationKey.current ??= crypto.randomUUID();
    resolvedValidFrom.current ??= converted;
    data.set("operationKey", operationKey.current);
    data.set("validFrom", resolvedValidFrom.current);
    setResult(null);
    startTransition(async () => {
      const next = await createStudentPackageAction(orgSlug, studentId, data);
      setResult(next);
      if (next.ok) {
        operationKey.current = null;
        resolvedValidFrom.current = null;
        form.reset();
        router.refresh();
      }
    });
  }

  if (!products.length) {
    return <p className="mt-4 text-[13px] text-ink-3">暂无可发放的正常课包，请先在“课包”中创建。</p>;
  }

  return (
    <form
      onSubmit={submit}
      onChange={() => {
        if (!pending) {
          operationKey.current = null;
          resolvedValidFrom.current = null;
        }
      }}
      aria-busy={pending}
      className="mt-5 max-w-3xl"
    >
      <h3 className="text-[15px] font-semibold text-ink">发放课包</h3>
      <fieldset disabled={pending} className="mt-3 grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
        <label className="block min-w-0">
          <span className="mb-1.5 block text-[13px] font-medium text-ink">课包产品</span>
          <select name="productId" required defaultValue="" className={inputClass}>
            <option value="" disabled>请选择</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name}（{product.totalCredits} {product.unitLabel}）
              </option>
            ))}
          </select>
        </label>
        <label className="block min-w-0">
          <span className="mb-1.5 block text-[13px] font-medium text-ink">生效时间（可选）</span>
          <input name="validFromLocal" type="datetime-local" className={inputClass} />
        </label>
        <button type="submit" disabled={pending} className="rounded-md bg-brand px-4 py-2 text-[14px] font-medium text-white transition hover:bg-brand-dark disabled:opacity-50">
          {pending ? "发放中…" : "发放课包"}
        </button>
        <div className="sm:col-span-3">
          <MutationResultMessage result={result} />
        </div>
      </fieldset>
    </form>
  );
}
