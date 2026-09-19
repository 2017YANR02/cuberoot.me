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
  rounds?: LiveRoundRef[];
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

/** SSE invalidates snapshots; polling recovers missed events and disconnected streams. */
export function useLiveStream({ cubingSlug, focusRound, rounds, applyPatch }: UseLiveStreamArgs) {
  const [status, setStatus] = useState<WsStatus>('idle');
  const applyRef = useRef(applyPatch);
  applyRef.current = applyPatch;
  const focusKey = focusRound ? JSON.stringify(focusRound) : '';
  const roundsKey = JSON.stringify(rounds ?? (focusRound ? [focusRound] : []));

  useEffect(() => {
    const allRounds = JSON.parse(roundsKey) as LiveRoundRef[];
    const focus = focusKey ? JSON.parse(focusKey) as LiveRoundRef : null;
    if (!cubingSlug || !allRounds.length) { setStatus('idle'); return; }
    let cancelled = false;
    let pending = false;
    let queued = false;
    const dirtyRounds = new Set<LiveRoundRef>();
    let lastFull = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let debounce: ReturnType<typeof setTimeout> | undefined;
    let stream: EventSource | undefined;
    const abort = new AbortController();
    setStatus('connecting');
    const refresh = async (full = false) => {
      if (cancelled || document.visibilityState === 'hidden') return;
      if (pending) { queued = true; return; }
      clearTimeout(timer);
      pending = true;
      try {
        const recoverAll = full || !focus || Date.now() - lastFull >= 60_000;
        const targets = recoverAll ? allRounds : dirtyRounds.size ? [...dirtyRounds] : [focus!];
        dirtyRounds.clear();
        // Keep upstream concurrency bounded even for competitions with many rounds.
        for (let offset = 0; offset < targets.length; offset += 3) {
          const batch = await Promise.allSettled(targets.slice(offset, offset + 3).map(async target => {
            const { eventId, roundTypeId, roundNumber } = target;
            const response = await fetch(apiUrl('/v1/cubing-live/' + encodeURIComponent(cubingSlug)
              + '/round/' + encodeURIComponent(eventId) + '/' + roundNumber
              + '?roundTypeId=' + encodeURIComponent(roundTypeId) + '&v=5'), {
              signal: AbortSignal.any([abort.signal, AbortSignal.timeout(20_000)]),
            });
            if (!response.ok) throw new Error('HTTP ' + response.status);
            const snapshot = await response.json() as Awaited<ReturnType<typeof fetchCubingLiveRound>>;
            if (snapshot.round?.e !== eventId || snapshot.round?.i !== roundTypeId || !Array.isArray(snapshot.results) || !snapshot.users) {
              throw new Error('Invalid live round response');
            }
            if (cancelled) return;
            applyRef.current({ kind: 'users', users: snapshot.users });
            applyRef.current({ kind: 'round.update', round: snapshot.round });
            applyRef.current({ kind: 'result.all', eventId, roundTypeId, results: snapshot.results });
          }));
          const failed = batch.find(result => result.status === 'rejected');
          if (failed?.status === 'rejected') throw failed.reason;
        }
        if (recoverAll) lastFull = Date.now();
        if (!cancelled) setStatus('open');
      } catch {
        if (!cancelled) setStatus('error');
      } finally {
        pending = false;
        if (!cancelled) {
          const fullQueued = queued;
          queued = false;
          timer = setTimeout(() => void refresh(fullQueued), fullQueued ? 500 : 15_000);
        }
      }
    };
    const connect = () => {
      if (stream || typeof EventSource === 'undefined' || document.visibilityState === 'hidden') return;
      stream = new EventSource(apiUrl('/v1/cubing-live/' + encodeURIComponent(cubingSlug) + '/stream?v=5'));
      const invalidate = (event?: Event) => {
        let target: LiveRoundRef | undefined;
        try {
          const message = JSON.parse((event as MessageEvent).data);
          const round = (message.payload ?? message).round;
          target = allRounds.find(ref => ref.eventId === round?.eventId && ref.roundNumber === round?.roundNumber);
        } catch { /* Opening/reconnecting a stream needs every round. */ }
        if (target) dirtyRounds.add(target);
        else allRounds.forEach(round => dirtyRounds.add(round));
        clearTimeout(debounce);
        debounce = setTimeout(() => void refresh(), 500);
      };
      stream.onopen = invalidate; // includes automatic reconnect after lost events
      stream.onerror = () => { if (!cancelled) setStatus('connecting'); };
      for (const event of ['round.updated', 'round.rules.updated', 'round.competitor.joined', 'round.competitor.quit',
        'result.updated', 'result.attempt.updated', 'result.checked', 'results.reranked', 'advancement.refreshed']) {
        stream.addEventListener(event, invalidate);
      }
      stream.onmessage = event => {
        try {
          const type = (JSON.parse(event.data) as { type?: string }).type;
          if (type && /^(round\.|result\.|results\.|advancement\.)/.test(type)) invalidate(event);
        } catch { /* Ignore malformed messages; polling will recover. */ }
      };
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') { connect(); void refresh(true); }
      else { clearTimeout(timer); clearTimeout(debounce); stream?.close(); stream = undefined; }
    };
    connect();
    void refresh(true);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelled = true;
      abort.abort();
      stream?.close();
      clearTimeout(timer);
      clearTimeout(debounce);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [cubingSlug, focusKey, roundsKey]);
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
