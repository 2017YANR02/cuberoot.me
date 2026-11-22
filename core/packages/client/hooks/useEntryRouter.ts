'use client';

import { useContext, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { currentEntryHref, navigateVideoToolDocument } from '@/lib/entry-navigation';
import { PlatformNavigationContext } from '@/lib/platform-navigation-context';
import { platformNavigationHref } from '@/lib/platform-navigation';

/** Imperative counterpart of AppLink; replacements retain, rather than append, the entry trail. */
export function useEntryRouter(): ReturnType<typeof useRouter> {
  const router = useRouter();
  const platform = useContext(PlatformNavigationContext);
  return useMemo(() => ({
    ...router,
    push: (href, options) => {
      const target = currentEntryHref(platform ? platformNavigationHref(href) : href);
      if (!navigateVideoToolDocument(target)) router.push(target, options);
    },
    replace: (href, options) => {
      const target = currentEntryHref(platform ? platformNavigationHref(href) : href, 'replace');
      if (!navigateVideoToolDocument(target, true)) router.replace(target, options);
    },
  } satisfies ReturnType<typeof useRouter>), [router, platform]);
}
