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
  type CodecOptions,
} from '@/lib/puzzle-image/codec';
import type { ImageSpec } from '@/lib/puzzle-image/types';

export type ImageSpecPatch = (patch: Partial<ImageSpec>) => void;

/**
 * `opts.puzzle` = PANEL MODE (e.g. /sim): the host's own selector owns the puzzle
 * type, so `pzl` leaves the URL entirely and the host puzzle is injected on seed (so
 * `view` parses against the right puzzle). The host is then responsible for keeping the
 * spec's puzzleType/cubeSize in sync as its selector changes (SimPage does this).
 * `opts.puzzle` presence is fixed for a mount, so memoizing on `hasPuzzle` is safe.
 */
export function useImageSpec(prefix: string, opts?: CodecOptions): [ImageSpec, ImageSpecPatch] {
  const hasPuzzle = !!opts?.puzzle;
  const keyOpts = useMemo<CodecOptions | undefined>(
    () => (hasPuzzle ? { puzzle: { puzzleType: 'cube', cubeSize: 3 } } : undefined),
    [hasPuzzle],
  );
  const parsers = useMemo(() => {
    const m: Record<string, typeof parseAsString> = {};
    for (const k of imageQueryKeys(prefix, keyOpts)) m[k] = parseAsString;
    return m;
  }, [prefix, keyOpts]);
  const writeKeys = useMemo(() => imageWriteKeys(prefix, keyOpts), [prefix, keyOpts]);
  const legacyKeys = useMemo(
    () => imageQueryKeys(prefix, keyOpts).filter((k) => !writeKeys.includes(k)),
    [prefix, keyOpts, writeKeys],
  );

  const [urlParams, setUrlParams] = useQueryStates(parsers, { history: 'replace', scroll: false });

  // Seed once — afterwards the URL is derived from the spec, not the other way. In
  // panel mode the host puzzle is injected here so `view`/rotations parse correctly.
  const initialRef = useRef<ImageSpec | null>(null);
  if (initialRef.current === null) {
    initialRef.current = readSpecFromParams(urlParams, prefix, opts);
  }
  const [spec, setSpec] = useState<ImageSpec>(initialRef.current);

  const patchSpec = useCallback<ImageSpecPatch>((patch) => {
    setSpec((prev) => ({ ...prev, ...patch }));
  }, []);

  // spec → URL. Build the full owned-key patch (value, or null to delete) and
  // compare against the live nuqs snapshot so an unchanged render is a no-op.
  useEffect(() => {
    const sp = specToParams(spec, prefix, keyOpts);
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
  }, [spec, prefix, keyOpts, urlParams, setUrlParams, writeKeys, legacyKeys]);

  return [spec, patchSpec];
}
