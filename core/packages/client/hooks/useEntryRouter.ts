'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { currentEntryHref } from '@/lib/entry-navigation';

/** Imperative counterpart of AppLink; replacements retain, rather than append, the entry trail. */
export function useEntryRouter(): ReturnType<typeof useRouter> {
  const router = useRouter();
  return useMemo(() => ({
    ...router,
    push: (href, options) => router.push(currentEntryHref(href), options),
    replace: (href, options) => router.replace(currentEntryHref(href, 'replace'), options),
  } satisfies ReturnType<typeof useRouter>), [router]);
}
