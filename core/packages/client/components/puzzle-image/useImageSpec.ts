'use client';

/**
 * useImageSpec — the nuqs binding for an ImageSpec.
 *
 * PAGE-LEVEL HOSTS ONLY. Project rule: `useQueryState(s)` never runs inside a
 * shared component, so <PuzzleImageStudio> is fully controlled and the host
 * (app/[lang]/visualcube/page.tsx today, /sim's image panel next) owns the URL.
 *
 * Contract, unchanged from the pre-extraction page:
 *   - the URL SEEDS the spec once, then the URL is a derived view of the spec;
 *   - only non-default values are written (specToParams), so a pristine page
 *     stays at `?pzl=3`;
 *   - the legacy read-only `puzzle=` alias is normalized away on first write;
 *   - history: 'replace' — dialling a slider must not stack history entries.
 *
 * `prefix` namespaces every key (imageQueryKeys) so a host that already owns
 * `puzzle` / `alg` / `view` can mount the image state under e.g. `img_`.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryStates, parseAsString } from 'nuqs';
import {
  imageQueryKeys,
  imageWriteKeys,
  readSpecFromParams,
  specToParams,
} from '@/lib/puzzle-image/codec';
import type { ImageSpec } from '@/lib/puzzle-image/types';

export type ImageSpecPatch = (patch: Partial<ImageSpec>) => void;

export function useImageSpec(prefix: string): [ImageSpec, ImageSpecPatch] {
  const parsers = useMemo(() => {
    const m: Record<string, typeof parseAsString> = {};
    for (const k of imageQueryKeys(prefix)) m[k] = parseAsString;
    return m;
  }, [prefix]);
  const writeKeys = useMemo(() => imageWriteKeys(prefix), [prefix]);
  const legacyKeys = useMemo(
    () => imageQueryKeys(prefix).filter((k) => !writeKeys.includes(k)),
    [prefix, writeKeys],
  );

  const [urlParams, setUrlParams] = useQueryStates(parsers, { history: 'replace', scroll: false });

  // Seed once — afterwards the URL is derived from the spec, not the other way.
  const initialRef = useRef<ImageSpec | null>(null);
  if (initialRef.current === null) {
    initialRef.current = readSpecFromParams(urlParams, prefix);
  }
  const [spec, setSpec] = useState<ImageSpec>(initialRef.current);

  const patchSpec = useCallback<ImageSpecPatch>((patch) => {
    setSpec((prev) => ({ ...prev, ...patch }));
  }, []);

  // spec → URL. Build the full owned-key patch (value, or null to delete) and
  // compare against the live nuqs snapshot so an unchanged render is a no-op.
  useEffect(() => {
    const sp = specToParams(spec, prefix);
    const patch: Record<string, string | null> = {};
    let changed = false;
    for (const k of writeKeys) {
      const next = sp.get(k);
      patch[k] = next;
      if ((urlParams[k] ?? null) !== (next ?? null)) changed = true;
    }
    for (const k of legacyKeys) {
      if (urlParams[k] != null) { patch[k] = null; changed = true; }
    }
    if (changed) void setUrlParams(patch);
  }, [spec, prefix, urlParams, setUrlParams, writeKeys, legacyKeys]);

  return [spec, patchSpec];
}
