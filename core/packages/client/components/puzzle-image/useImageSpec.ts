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
  const hasInherit = !!opts?.inherit;
  // The KEY set (imageQueryKeys / imageWriteKeys) depends only on WHICH options are
  // present, not their values — so memoize on the two booleans with placeholder values.
  // The real `opts` (live sim alg/colours) still seeds the spec below.
  const keyOpts = useMemo<CodecOptions | undefined>(() => {
    if (!hasPuzzle && !hasInherit) return undefined;
    const o: CodecOptions = {};
    if (hasPuzzle) o.puzzle = { puzzleType: 'cube', cubeSize: 3 };
    if (hasInherit) {
      o.inherit = {
        algType: 'alg', algorithm: '',
        faceU: '', faceR: '', faceF: '', faceD: '', faceL: '', faceB: '',
      };
    }
    return o;
  }, [hasPuzzle, hasInherit]);
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
    if (changed) { if (typeof window !== 'undefined') { (window as any).__EFFB = ((window as any).__EFFB||0)+1; if ((window as any).__EFFB % 20 === 0) console.warn('[EFFB spec→URL]', (window as any).__EFFB, JSON.stringify(patch)); } void setUrlParams(patch); }
  }, [spec, prefix, keyOpts, urlParams, setUrlParams, writeKeys, legacyKeys]);

  return [spec, patchSpec];
}
