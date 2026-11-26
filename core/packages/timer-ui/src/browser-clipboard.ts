import { useLayoutEffect, useRef, useState } from 'react';

export async function browserClipboardTransport(text: string): Promise<void> {
  if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable');
  await navigator.clipboard.writeText(text);
}

/** Clipboard feedback belongs to the latest request in the current view. */
export function useClipboardFeedback(scope: string, writeText?: (text: string) => Promise<void>) {
  const [feedback, setFeedback] = useState<{ scope: string; target: string; copied: boolean } | null>(null);
  const request = useRef(0);
  const reset = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useLayoutEffect(() => {
    setFeedback(null);
    return () => {
      request.current++;
      clearTimeout(reset.current);
    };
  }, [scope]);

  async function copy(text: string, target = text) {
    if (!writeText) return;
    const id = ++request.current;
    let copied = false;
    try {
      await writeText(text);
      copied = true;
    } catch { /* The caller renders the failure state. */ }
    if (request.current !== id) return;
    clearTimeout(reset.current);
    setFeedback({ scope, target, copied });
    reset.current = setTimeout(() => setFeedback(null), 1_200);
  }

  return { copy, feedback: feedback?.scope === scope ? feedback : null };
}
