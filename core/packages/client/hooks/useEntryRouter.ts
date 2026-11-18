'use client';

import { useContext, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { currentEntryHref } from '@/lib/entry-navigation';
import { PlatformNavigationContext } from '@/lib/platform-navigation-context';
import { platformNavigationHref } from '@/lib/platform-navigation';

/** Imperative counterpart of AppLink; replacements retain, rather than append, the entry trail. */
export function useEntryRouter(): ReturnType<typeof useRouter> {
  const router = useRouter();
  const platform = useContext(PlatformNavigationContext);
  return useMemo(() => ({
    ...router,
    push: (href, options) => router.push(currentEntryHref(platform ? platformNavigationHref(href) : href), options),
    replace: (href, options) => router.replace(currentEntryHref(platform ? platformNavigationHref(href) : href, 'replace'), options),
  } satisfies ReturnType<typeof useRouter>), [router, platform]);
}
