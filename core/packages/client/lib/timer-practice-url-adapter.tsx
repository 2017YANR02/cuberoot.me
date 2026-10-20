'use client';

import { startTransition, useCallback, useMemo, type ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  unstable_createAdapterProvider as createAdapterProvider,
  type unstable_UseAdapterHook as UseAdapterHook,
} from 'nuqs/adapters/custom';
import { decodeTimerPracticeSearch, encodeTimerPracticeSearch } from './timer-practice-url';

const usePracticeAdapter: UseAdapterHook = () => {
  const router = useRouter();
  const searchParams = useTimerSearchParams();
  const updateUrl = useCallback<ReturnType<UseAdapterHook>['updateUrl']>((search, options) => {
    const query = encodeTimerPracticeSearch(search).toString();
    const url = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
    startTransition(() => {
      // Next integrates native history with useSearchParams. The root nuqs
      // NavigationSpy still owns its queue reset and popstate lifecycle.
      // allow-raw-history: this nuqs transport encodes the batched engine state
      // into the public URL; calling query hooks here would recursively re-enter it.
      // eslint-disable-next-line no-restricted-syntax, no-restricted-globals
      if (options.history === 'push') window.history.pushState(null, '', url);
      // eslint-disable-next-line no-restricted-syntax, no-restricted-globals
      else window.history.replaceState(null, '', url);
      if (options.scroll) window.scrollTo(0, 0);
      if (!options.shallow) router.replace(url, { scroll: false });
    });
  }, [router]);
  const getSearchParamsSnapshot = useCallback(() =>
    decodeTimerPracticeSearch(window.location.search), []);
  return { searchParams, updateUrl, getSearchParamsSnapshot, rateLimitFactor: 3, autoResetQueueOnUpdate: true };
};

const PracticeAdapter = createAdapterProvider(usePracticeAdapter);

/** Keep nuqs batching/history and the existing engine contract behind one URL boundary. */
export function TimerPracticeUrlProvider({ children }: { children: ReactNode }) {
  return <PracticeAdapter>{children}</PracticeAdapter>;
}

/** Next's read-only search hook sees the public URL; engine consumers need the same projection as nuqs. */
export function useTimerSearchParams(): URLSearchParams {
  const search = useSearchParams();
  return useMemo(() => decodeTimerPracticeSearch(search), [search]);
}
