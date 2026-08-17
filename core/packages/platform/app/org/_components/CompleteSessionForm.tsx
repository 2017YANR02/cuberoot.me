"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  completeSessionAction,
  type TeachingMutationResult,
} from "@/app/org/actions";
import { MutationResultMessage } from "./MutationResultMessage";

export function CompleteSessionForm({
  orgSlug,
  sessionId,
}: {
  orgSlug: string;
  sessionId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<TeachingMutationResult | null>(null);
  const operationKey = useRef<string | null>(null);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const data = new FormData(event.currentTarget);
    operationKey.current ??= crypto.randomUUID();
    data.set("operationKey", operationKey.current);
    setResult(null);
    startTransition(async () => {
      const next = await completeSessionAction(orgSlug, sessionId, data);
      setResult(next);
      if (next.ok) {
        operationKey.current = null;
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={submit} aria-busy={pending} className="mt-5">
      <fieldset disabled={pending} className="flex min-w-0 flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className="rounded-md bg-brand px-4 py-2 text-[14px] font-medium text-white transition hover:bg-brand-dark disabled:opacity-50">
          {pending ? "完课扣课中…" : "确认完课并扣课"}
        </button>
        <MutationResultMessage result={result} />
      </fieldset>
    </form>
  );
}
