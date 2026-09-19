import { useEffect, useRef, useState } from 'react';
import type { fetchCubingLiveRound } from '@cuberoot/shared/cubing-live';
import { apiUrl } from '@/lib/api-base';

export interface LiveResultRow {
  i: number; c: number; n: number; e: string; r: string; f: string;
  b: number; a: number; v: number[]; sr: string; ar: string | number;
  pS?: number; pA?: number;
  sk?: unknown; ak?: unknown;
}

/**
 * 实时源只带成绩和地区纪录，不带首屏 API 算好的个人纪录名次/日掩信息。
 * 对应成绩没变时保留 enrich；成绩一变就立即丢弃旧 enrich，避免展示过期名次。
 */
export function mergeLiveRoundRows<T extends LiveResultRow>(
  previous: readonly T[],
  incoming: readonly T[],
): T[] {
  const keyOf = (row: LiveResultRow): string | null => {
    if (row.i > 0) return `i:${row.i}`;
    if (row.n > 0) return `n:${row.n}`;
    return null;
  };
  const previousByKey = new Map<string, T>();
  for (const row of previous) {
    const key = keyOf(row);
    if (key) previousByKey.set(key, row);
  }

  return incoming.map(row => {
    const key = keyOf(row);
    const old = key ? previousByKey.get(key) : undefined;
    if (!old) return row;

    const merged = { ...row };
    if (row.b === old.b) {
      if (merged.pS === undefined && old.pS !== undefined) merged.pS = old.pS;
      if (merged.sk === undefined && old.sk !== undefined) merged.sk = old.sk;
    }
    if (row.a === old.a) {
      if (merged.pA === undefined && old.pA !== undefined) merged.pA = old.pA;
      if (merged.ak === undefined && old.ak !== undefined) merged.ak = old.ak;
    }
    return merged;
  });
}

export interface RoundMetaForSort {
  i: string; e: string; f: string;
}

export type WsStatus = 'idle' | 'connecting' | 'open' | 'closed' | 'error';

/** 上游 live.min.js 的比较器,移植 1:1。f=`a`/`m`/`''` 用平均优先,其余用单次。 */
function compareResult(a: LiveResultRow, b: LiveResultRow, format: string): number {
  let r = 0;
  if (format === 'a' || format === 'm') {
    if (a.a > 0 && b.a <= 0) return -1;
    if (b.a > 0 && a.a <= 0) return 1;
    r = a.a - b.a;
  }
  if (r === 0) {
    if (a.b > 0 && b.b <= 0) return -1;
    if (b.b > 0 && a.b <= 0) return 1;
    r = a.b - b.b;
  }
  // 同分按号码升序兜底,跟 upstream 一致
  if (r === 0) r = a.n - b.n;
  return r;
}

interface UseLiveStreamArgs {
  cubingSlug: string | null;
  focusRound: LiveRoundRef | null;
  applyPatch: (patch: LivePatch) => void;
}

export interface LiveRoundRef {
  eventId: string;
  roundTypeId: string;
  roundNumber: number;
}
export type LivePatch =
  | { kind: 'result.new'; result: LiveResultRow; roundFormat: string }
  | { kind: 'result.update'; result: LiveResultRow; roundFormat: string }
  | { kind: 'result.all'; eventId: string; roundTypeId: string; results: LiveResultRow[] }
  | { kind: 'round.update'; round: { i: string; e: string; s?: number; rn?: number; tt?: number; n?: number; name?: string } }
  | { kind: 'users'; users: Record<string, { number: number; name: string; wcaid: string; region: string }> };

/** Poll the visible round through the same REST adapter as the initial API snapshot. */
export function useLiveStream({ cubingSlug, focusRound, applyPatch }: UseLiveStreamArgs) {
  const [status, setStatus] = useState<WsStatus>('idle');
  const applyRef = useRef(applyPatch);
  applyRef.current = applyPatch;
  const eventId = focusRound?.eventId;
  const roundTypeId = focusRound?.roundTypeId;
  const roundNumber = focusRound?.roundNumber;

  useEffect(() => {
    if (!cubingSlug || !eventId || !roundTypeId || !roundNumber) {
      setStatus('idle');
      return;
    }
    let cancelled = false;
    let pending = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const abort = new AbortController();
    setStatus('connecting');
    const refresh = async () => {
      if (cancelled || pending || document.visibilityState === 'hidden') return;
      clearTimeout(timer);
      pending = true;
      try {
        const response = await fetch(apiUrl(`/v1/cubing-live/${encodeURIComponent(cubingSlug)}/round/${encodeURIComponent(eventId)}/${roundNumber}?roundTypeId=${encodeURIComponent(roundTypeId)}&v=4`), {
          signal: AbortSignal.any([abort.signal, AbortSignal.timeout(20_000)]),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const snapshot = await response.json() as Awaited<ReturnType<typeof fetchCubingLiveRound>>;
        if (snapshot.round?.e !== eventId || snapshot.round?.i !== roundTypeId || !Array.isArray(snapshot.results) || !snapshot.users) {
          throw new Error('Invalid live round response');
        }
        if (cancelled) return;
        applyRef.current({ kind: 'users', users: snapshot.users });
        applyRef.current({ kind: 'round.update', round: snapshot.round });
        applyRef.current({ kind: 'result.all', eventId, roundTypeId, results: snapshot.results });
        setStatus('open');
      } catch {
        if (!cancelled) setStatus('error');
      } finally {
        pending = false;
        if (!cancelled) timer = setTimeout(refresh, 15_000);
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void refresh();
      else clearTimeout(timer);
    };
    void refresh();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelled = true;
      abort.abort();
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [cubingSlug, eventId, roundTypeId, roundNumber]);
  return status;
}
/** 把 LivePatch 应用到 results 数组 (新建 + 重排) — 给 reducer 用。 */
export function applyResultPatch(
  arr: LiveResultRow[],
  patch: Extract<LivePatch, { kind: 'result.new' | 'result.update' }>,
): LiveResultRow[] {
  const [incoming] = mergeLiveRoundRows(arr, [patch.result]);
  const idx = arr.findIndex(r => r.i === incoming.i);
  let next: LiveResultRow[];
  if (idx >= 0) {
    next = arr.slice();
    next[idx] = incoming;
  } else {
    next = arr.concat(incoming);
  }
  next.sort((x, y) => compareResult(x, y, patch.roundFormat));
  return next;
}
