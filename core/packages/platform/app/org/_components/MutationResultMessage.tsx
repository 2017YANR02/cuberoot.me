import type { TeachingMutationResult } from "@/app/org/actions";

export function MutationResultMessage({ result }: { result: TeachingMutationResult | null }) {
  if (!result) return null;
  return result.ok ? (
    <p role="status" className="break-words text-[13px] text-brand-dark">{result.message}</p>
  ) : (
    <p role="alert" className="break-words text-[13px] text-ink-2">{result.error}</p>
  );
}
