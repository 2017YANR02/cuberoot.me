import { useCallback, useLayoutEffect, useRef, useState } from 'react';

export async function copyClipboardText(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* Try the legacy clipboard API. */ }
  const previousFocus = document.activeElement;
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.readOnly = true;
  textarea.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
  document.body.appendChild(textarea);
  textarea.select();
  try { return document.execCommand('copy'); } catch { return false; }
  finally {
    textarea.remove();
    if (previousFocus instanceof HTMLElement) previousFocus.focus({ preventScroll: true });
  }
}

export async function browserClipboardTransport(text: string): Promise<void> {
  if (!await copyClipboardText(text)) {
    const available = typeof navigator.clipboard?.writeText === 'function';
    throw new Error(available ? 'Clipboard write failed' : 'clipboard unavailable');
  }
}

const COPY_SUCCESS_DURATION_MS = 1000;

export type ClipboardFeedbackOptions = {
  /** Persist a manual-copy instruction or a text-only confirmation until reset. */
  persist?: 'failure' | 'all';
  failureDurationMs?: number;
};

/** Clipboard feedback belongs to the latest request in the current view. */
export function useClipboardFeedback(
  scope: string,
  writeText?: (text: string) => Promise<void>,
  { persist, failureDurationMs = 1200 }: ClipboardFeedbackOptions = {},
) {
  const [feedback, setFeedback] = useState<{ scope: string; target: string; copied: boolean } | null>(null);
  const activeScope = useRef<string | null>(null);
  const request = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const cancelPending = useCallback(() => {
    request.current++;
    clearTimeout(timer.current);
  }, []);
  const reset = useCallback(() => {
    cancelPending();
    setFeedback(null);
  }, [cancelPending]);

  useLayoutEffect(() => {
    activeScope.current = scope;
    reset();
    return () => {
      activeScope.current = null;
      cancelPending();
    };
  }, [scope, reset, cancelPending]);

  const copyWith = useCallback(async (write: () => Promise<void>, target = '') => {
    if (activeScope.current !== scope) return false;
    const id = ++request.current;
    let copied = false;
    try {
      await write();
      copied = true;
    } catch { /* The caller renders the failure state. */ }
    if (request.current === id) {
      clearTimeout(timer.current);
      setFeedback({ scope, target, copied });
      if (persist !== 'all' && (copied || persist !== 'failure')) {
        timer.current = setTimeout(() => setFeedback(null), copied ? COPY_SUCCESS_DURATION_MS : failureDurationMs);
      }
    }
    return copied;
  }, [scope, persist, failureDurationMs]);
  const copy = useCallback((text: string, target = text) =>
    writeText ? copyWith(() => writeText(text), target) : Promise.resolve(false), [copyWith, writeText]);

  return { copy, copyWith, feedback: feedback?.scope === scope ? feedback : null, reset };
}
