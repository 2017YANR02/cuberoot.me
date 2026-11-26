'use client';

import { useEffect, useState } from 'react';
import type { PageNotice } from '@/lib/page-notices-api';
import { persistItem } from '@/lib/safe-storage';

const DISMISS_KEY = 'pn-dismissed';

function readDismissedNotices(): Record<string, string> {
  try {
    const saved = JSON.parse(localStorage.getItem(DISMISS_KEY) ?? '{}');
    if (saved && typeof saved === 'object' && !Array.isArray(saved)) return saved;
  } catch { /* Storage may be unavailable. */ }
  return {};
}

/** A dismissal applies to one version of a notice. */
export function usePageNoticeDismissals() {
  const [dismissed, setDismissed] = useState<Record<string, string>>({});
  useEffect(() => { setDismissed(readDismissedNotices()); }, []);

  const dismiss = ({ id, updatedAt }: Pick<PageNotice, 'id' | 'updatedAt'>) => {
    // Read the latest map so the two placements can write without erasing each other.
    persistItem(DISMISS_KEY, JSON.stringify({ ...readDismissedNotices(), [id]: updatedAt }));
    setDismissed((previous) => ({ ...previous, [id]: updatedAt }));
  };

  return { dismissed, dismiss };
}
