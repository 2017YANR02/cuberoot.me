'use client';

import { useEffect, useState } from 'react';
import { apiUrl } from '@/lib/api-base';

export interface TranslationMatch {
  component: string;
  unitId: number;
  en: string;
  zh: string;
  key: string;
  sourceUrl: string;
  approved: boolean;
  hasFailingChecks: boolean;
  sourceForms: string[];
  targetForms: string[];
}
interface TranslationResponse {
  ready: boolean;
  stale: boolean;
  syncedAt: string | null;
  results: { query: string; matches: TranslationMatch[] }[];
}

export function useWcaTranslationSearch(query: string, limit = 10, debounceMs = 0) {
  const [result, setResult] = useState<{ query: string; data: TranslationResponse } | null>(null);
  const [failedQuery, setFailedQuery] = useState<string | null>(null);
  const term = query.trim();
  const data = result?.query === term ? result.data : null;
  const failed = failedQuery === term;
  const loading = !!term && !data && !failed;
  const matches = data?.results[0]?.matches ?? [];
  const fallback = `https://translate.worldcubeassociation.org/browse/wca/-/zh_Hans/?q=${encodeURIComponent(term)}`;

  useEffect(() => {
    setResult(null);
    setFailedQuery(null);
    if (!term) return;
    const controller = new AbortController();
    let active = true;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const timer = setTimeout(() => {
      timeout = setTimeout(() => controller.abort(), 15_000);
      void (async () => {
        try {
          const params = new URLSearchParams({ q: term, limit: String(limit), v: '1' });
          const response = await fetch(apiUrl(`/v1/wca/translations?${params}`), { signal: controller.signal, credentials: 'omit' });
          if (!response.ok) throw new Error('Translation search unavailable');
          const body: TranslationResponse = await response.json();
          if (!body.ready || !Array.isArray(body.results)) throw new Error('Translation snapshot unavailable');
          if (active) setResult({ query: term, data: body });
        } catch {
          if (active) setFailedQuery(term);
        } finally {
          clearTimeout(timeout);
        }
      })();
    }, debounceMs);
    return () => { active = false; clearTimeout(timer); clearTimeout(timeout); controller.abort(); };
  }, [term, limit, debounceMs]);

  return { term, data, failed, loading, matches, fallback };
}
