'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import {
  ReadonlyURLSearchParams, useParams, usePathname, useRouter, useSearchParams,
} from 'next/navigation';
import {
  useQueryState, useQueryStates, type Options, type UseQueryStateOptions,
  type UseQueryStatesKeysMap, type UseQueryStatesOptions, type UseQueryStatesReturn,
} from 'nuqs';
import { trainingQueryKey, trainingSearchParams } from './timer-training-location';

export { trainingQueryKey } from './timer-training-location';

export interface TrainingHost {
  path: string;
  params: Readonly<Record<string, string | string[]>>;
  mapHref(href: string): string;
  /** Optional toolbar destination for an explicitly hosted settings popover. */
  settingsPortal?: HTMLElement | null;
  practiceSettings?: ReactNode;
}

const TrainingHostContext = createContext<TrainingHost | null>(null);
const unchangedHref = (href: string) => href;

export function TrainingHostProvider({ value, children }: { value: TrainingHost; children: ReactNode }) {
  return <TrainingHostContext.Provider value={value}>{children}</TrainingHostContext.Provider>;
}

export function useTrainingHost(): TrainingHost | null {
  return useContext(TrainingHostContext);
}

/** Context-only: safe for global AppLink without introducing a search-params Suspense boundary. */
export function useTrainingHref(): (href: string) => string {
  return useTrainingHost()?.mapHref ?? unchangedHref;
}

export function useTrainingParams<T extends Record<string, string | string[]> = Record<string, string | string[]>>(): T {
  const params = useParams();
  const host = useTrainingHost();
  return (host ? { ...params, ...host.params } : params) as T;
}

export function useTrainingPathname(): ReturnType<typeof usePathname> {
  const pathname = usePathname();
  return useTrainingHost()?.path ?? pathname;
}

export function useTrainingRouter(): ReturnType<typeof useRouter> {
  const router = useRouter();
  const host = useTrainingHost();
  return useMemo<ReturnType<typeof useRouter>>(() => host ? {
    ...router,
    push: (href, options) => router.push(host.mapHref(href), options),
    replace: (href, options) => router.replace(host.mapHref(href), options),
    prefetch: (href, options) => router.prefetch(host.mapHref(href), options),
  } : router, [host, router]);
}

export function useTrainingSearchParams(): ReturnType<typeof useSearchParams> {
  const params = useSearchParams();
  const host = useTrainingHost();
  return useMemo(() => host && params
    ? new ReadonlyURLSearchParams(trainingSearchParams(params))
    : params, [host, params]);
}

/** Forward nuqs unchanged, retaining its parser/default-value overloads for all consumers. */
export const useTrainingQueryState: typeof useQueryState = function useTrainingQueryState(
  key: string, options?: UseQueryStateOptions<unknown> | Options,
) {
  const host = useTrainingHost();
  return useQueryState(trainingQueryKey(key, !!host), options as UseQueryStateOptions<unknown>);
} as typeof useQueryState;

export function useTrainingQueryStates<KeyMap extends UseQueryStatesKeysMap>(
  keyMap: KeyMap, options?: Partial<UseQueryStatesOptions<KeyMap>>,
): UseQueryStatesReturn<KeyMap> {
  const host = useTrainingHost();
  const scopedOptions = useMemo(() => {
    if (!host) return options;
    const urlKeys = { ...options?.urlKeys } as UseQueryStatesOptions<KeyMap>['urlKeys'];
    for (const key of Object.keys(keyMap) as (keyof KeyMap & string)[]) {
      urlKeys[key] = trainingQueryKey(options?.urlKeys?.[key] ?? key);
    }
    return { ...options, urlKeys };
  }, [host, keyMap, options]);
  return useQueryStates(keyMap, scopedOptions);
}
