'use client';

import { createContext, useContext, useEffect, useRef, type Dispatch, type SetStateAction } from 'react';

/** Only descendants of the Platform shell adapt shared main-site links. */
export const PlatformNavigationContext = createContext(false);

export const PlatformCompetitionAccessContext = createContext({ organizer: false, supervisor: false, ready: false });

/** Identity mutations invalidate the shell's instructor workspace entry. */
export const PlatformInstructorAccessRefreshContext = createContext<() => void>(() => {});

export type PlatformSearchScope = 'forum' | 'courses' | 'paths' | 'events' | 'news' | 'teachers' | 'instructor-courses';

export interface PlatformFilterOption {
  value: string;
  label: string;
  searchText?: string;
  /** A blank parent selection means all options are available. */
  dependsOn?: { group: string; values: readonly string[] };
}
export interface PlatformFilterGroup {
  id: string;
  label: string;
  value: string;
  defaultValue: string;
  options: readonly PlatformFilterOption[];
  searchPlaceholder?: string;
  presentation?: 'chips' | 'list';
}
export interface PlatformSearchFilters {
  title: string;
  groups: readonly PlatformFilterGroup[];
  apply: (values: Record<string, string>) => void;
}

/** Results pages own URL query state; the shell only hosts their input. */
export interface PlatformSearchBinding {
  scope: PlatformSearchScope;
  routeId?: string;
  query: string;
  submit?: (query: string) => void;
  filters?: PlatformSearchFilters;
}
export const PlatformSearchContext = createContext<{ scope: PlatformSearchScope; routeId?: string; bind: Dispatch<SetStateAction<PlatformSearchBinding | null>> } | null>(null);

export function usePlatformSearchBinding(scope: PlatformSearchScope, query: string, submit: ((query: string) => void) | undefined,
  enabled = true, options?: { routeId: string; filters?: PlatformSearchFilters }): boolean {
  const outlet = useContext(PlatformSearchContext);
  const routeId = options?.routeId;
  const bind = enabled && outlet?.scope === scope && (!outlet.routeId || !routeId || outlet.routeId === routeId) ? outlet.bind : null;
  const filters = options?.filters;
  // Descriptors are data; compare their contents rather than rebinding whenever a
  // parent renders a fresh array. Actions always call the latest page callbacks.
  const filterKey = filters ? JSON.stringify([filters.title, filters.groups]) : '';
  const canSubmit = Boolean(submit);
  const actions = useRef({ submit, filters });
  useEffect(() => { actions.current = { submit, filters }; }, [submit, filters]);
  useEffect(() => {
    if (!bind) return;
    const currentFilters = actions.current.filters;
    const binding: PlatformSearchBinding = { scope, routeId, query,
      submit: canSubmit ? value => actions.current.submit?.(value) : undefined,
      filters: currentFilters ? { ...currentFilters, apply: values => actions.current.filters?.apply(values) } : undefined };
    bind(binding);
    return () => bind(current => current === binding ? null : current);
  }, [bind, scope, routeId, query, canSubmit, filterKey]);
  return Boolean(bind);
}
