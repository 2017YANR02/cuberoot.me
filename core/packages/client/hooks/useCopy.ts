'use client';

import { writeClipboardText } from '@/lib/clipboard';
import { useClipboardFeedback, type ClipboardFeedbackOptions } from '@cuberoot/timer-ui/clipboard-feedback';
import { useCallback } from 'react';

/** Pass a key for per-item feedback. Copy checkmarks use the shared one-second duration. */
export function useCopy({ scope = '', ...options }: ClipboardFeedbackOptions & { scope?: string } = {}) {
  const { copy: write, copyWith, feedback, reset } = useClipboardFeedback(scope, writeClipboardText, options);
  const copy = useCallback((text: string, key = '') => write(text, key), [write]);
  const copiedKey = feedback?.copied ? feedback.target : null;
  return { copied: copiedKey !== null, copiedKey, feedback, copy, copyWith, reset };
}
