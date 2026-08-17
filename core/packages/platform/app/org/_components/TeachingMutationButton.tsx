"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { TeachingMutationResult } from "@/app/org/actions";
import { MutationResultMessage } from "./MutationResultMessage";

export function TeachingMutationButton({
  action,
  label,
  pendingLabel,
  confirmMessage,
}: {
  action: (formData: FormData) => Promise<TeachingMutationResult>;
  label: string;
  pendingLabel: string;
  confirmMessage?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<TeachingMutationResult | null>(null);
  const operationKey = useRef<string | null>(null);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || (confirmMessage && !window.confirm(confirmMessage))) return;
    operationKey.current ??= crypto.randomUUID();
    const data = new FormData();
    data.set("operationKey", operationKey.current);
    setResult(null);
    startTransition(async () => {
      const next = await action(data);
      setResult(next);
      if (next.ok) {
        operationKey.current = null;
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={submit} aria-busy={pending} className="flex min-w-0 flex-wrap items-center gap-2">
      <fieldset disabled={pending} className="contents">
        <button type="submit" disabled={pending} className="rounded-md border border-line px-3 py-1.5 text-[13px] text-ink-2 transition hover:text-ink disabled:opacity-50">
          {pending ? pendingLabel : label}
        </button>
      </fieldset>
      <MutationResultMessage result={result} />
    </form>
  );
}
