"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createOrganizationAction,
  type CreateOrganizationResult,
} from "@/app/org/actions";

export function CreateOrganizationForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<CreateOrganizationResult | null>(null);
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
      const next = await createOrganizationAction(data);
      setResult(next);
      if (next.ok) {
        operationKey.current = null;
        // allow-button-nav: 创建成功后的定向跳转属于 post-mutation 流程。
        router.push(`/org/${encodeURIComponent(next.slug)}`);
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
      className="mt-5 max-w-xl"
    >
      <fieldset disabled={pending} className="min-w-0 space-y-4">
        <label className="block min-w-0">
          <span className="mb-1.5 block text-[13px] font-medium text-ink">机构名称</span>
          <input
            name="name"
            required
            maxLength={160}
            autoComplete="organization"
            placeholder="例如 CubeRoot 上海训练中心"
            className="w-full min-w-0 rounded-md border border-line bg-white px-3 py-2 text-[14px] text-ink outline-none placeholder:text-ink-3 focus:border-brand focus:ring-2 focus:ring-brand/15"
          />
        </label>
        <label className="block min-w-0">
          <span className="mb-1.5 block text-[13px] font-medium text-ink">机构网址标识</span>
          <input
            name="slug"
            required
            maxLength={64}
            pattern="[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?"
            autoCapitalize="none"
            autoCorrect="off"
            placeholder="例如 cuberoot-shanghai"
            className="w-full min-w-0 rounded-md border border-line bg-white px-3 py-2 font-mono text-[14px] text-ink outline-none placeholder:text-ink-3 focus:border-brand focus:ring-2 focus:ring-brand/15"
          />
          <span className="mt-1 block text-[12px] text-ink-3">仅限小写字母、数字和中间连字符，创建后用于工作台地址。</span>
        </label>
        {result && !result.ok ? (
          <p role="alert" className="break-words text-[13px] text-red-600">{result.error}</p>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-brand px-4 py-2 text-[14px] font-medium text-white transition hover:bg-brand-dark disabled:opacity-50"
        >
          {pending ? "创建中…" : "创建机构"}
        </button>
      </fieldset>
    </form>
  );
}
