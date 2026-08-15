// 直连 wss://cubing.com/ws 拿 result.new / result.update / round.update / users 实时增量。
// 初始快照仍走 /v1/cubing-live/:slug,只是 mount 后另开 WS 把后续 patch 喂进 setData。
//
// 协议来自 D:/cube/cubingchina/protected/websocket/handler/ResultHandler.php +
// /f/js/websocket.min.js 的 frame 包装 ({code, type, data})。
//
// 注意: 上游 LiveResult 排序逻辑完全在 client 做 (live.min.js 的 `p()` 比较器):
//   - 'a'/'m' 格式: 先比 average (>0 优先),再比 best
//   - 其他: 直接比 best
//   - DNF/DNS/0 都 ≤ 0,被推到末尾
import { useEffect, useRef, useState } from 'react';

export interface LiveResultRow {
  i: number; c: number; n: number; e: string; r: string; f: string;
  b: number; a: number; v: number[]; sr: string; ar: string | number;
}

export interface RoundMetaForSort {
  i: string; e: string; f: string;
}

export type WsStatus = 'idle' | 'connecting' | 'open' | 'closed' | 'error';

interface WsFrame {
  code?: number;
  type?: string;
  data?: unknown;
}

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
  /** 已 fetch 的 comp 元数据,需要 compId 才能 subscribe;为空 = 不连。 */
  compId: number | null;
  /** 比赛全部轮次;仅断线重连后逐轮补拉 result.all,避免漏掉断线窗口的增量。 */
  rounds: readonly LiveRoundRef[];
  /** 当前展示轮次;首次连接和切换轮次时各校准一次,缓存先显示、不阻塞首屏。 */
  focusRound: LiveRoundRef | null;
  /** 在收到 result.new / result.update / round.update / users 时调用,patch 整个 CompData。 */
  applyPatch: (patch: LivePatch) => void;
}

export interface LiveRoundRef {
  eventId: string;
  roundTypeId: string;
}

export type LivePatch =
  | { kind: 'result.new'; result: LiveResultRow; roundFormat: string }
  | { kind: 'result.update'; result: LiveResultRow; roundFormat: string }
  | { kind: 'result.all'; eventId: string; roundTypeId: string; results: LiveResultRow[] }
  | { kind: 'round.update'; round: { i: string; e: string; s?: number; rn?: number; tt?: number; n?: number; name?: string } }
  | { kind: 'users'; users: Record<string, { number: number; name: string; wcaid: string; region: string }> };

export function useLiveStream({ compId, rounds, focusRound, applyPatch }: UseLiveStreamArgs) {
  const [status, setStatus] = useState<WsStatus>('idle');
  const wsRef = useRef<WebSocket | null>(null);
  const pingTimerRef = useRef<number | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  // 用 ref 锁定最新 applyPatch,避免 effect 依赖它而频繁重连
  const applyRef = useRef(applyPatch);
  applyRef.current = applyPatch;
  const roundsRef = useRef(rounds);
  roundsRef.current = rounds;
  const focusRoundRef = useRef(focusRound);
  focusRoundRef.current = focusRound;
  const syncRoundRef = useRef<(round: LiveRoundRef) => void>(() => {});

  useEffect(() => {
    if (compId == null) return;
    let cancelled = false;
    let backoff = 1000;
    let needsRecovery = false;
    let syncQueue: LiveRoundRef[] = [];
    let syncPending: LiveRoundRef | null = null;
    const syncedKeys = new Set<string>();
    const keyOf = (round: LiveRoundRef) => `${round.eventId}:${round.roundTypeId}`;

    // result.all 不带请求参数,空数组也无法反推轮次,所以必须逐轮串行补拉。
    const fetchNextSnapshot = (ws: WebSocket) => {
      if (cancelled || syncPending || ws.readyState !== WebSocket.OPEN) return;
      const round = syncQueue.shift();
      if (!round) return;
      syncPending = round;
      ws.send(JSON.stringify({
        type: 'result',
        action: 'fetch',
        params: { event: round.eventId, round: round.roundTypeId, filter: 'all' },
      }));
    };

    const queueRoundSync = (round: LiveRoundRef) => {
      const key = keyOf(round);
      if (syncedKeys.has(key) || (syncPending && keyOf(syncPending) === key)
        || syncQueue.some(item => keyOf(item) === key)) return;
      syncQueue.push(round);
      const ws = wsRef.current;
      if (ws) fetchNextSnapshot(ws);
    };
    syncRoundRef.current = queueRoundSync;

    const connect = () => {
      if (cancelled) return;
      setStatus('connecting');
      let ws: WebSocket;
      try {
        ws = new WebSocket('wss://cubing.com/ws');
      } catch {
        needsRecovery = true;
        setStatus('error');
        scheduleReconnect();
        return;
      }
      wsRef.current = ws;

      ws.onopen = () => {
        if (cancelled) return ws.close();
        setStatus('open');
        backoff = 1000;
        ws.send(JSON.stringify({ type: 'competition', competitionId: compId }));
        // 首屏先显示 HTTP 缓存,再只校准当前轮;断线重连才补齐全部有效轮次。
        if (needsRecovery) {
          const seen = new Set<string>();
          syncQueue = [focusRoundRef.current, ...roundsRef.current].filter((round): round is LiveRoundRef => {
            if (!round) return false;
            const key = keyOf(round);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
          syncPending = null;
          syncedKeys.clear();
          needsRecovery = false;
        }
        fetchNextSnapshot(ws);
        // periodic ping to keep upstream alive (upstream timeout ~55s on live.min.js)
        pingTimerRef.current = window.setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify('ping'));
        }, 25000);
      };

      ws.onmessage = (e) => {
        let msg: WsFrame;
        try {
          if (e.data === '"pong"' || e.data === 'pong') return;
          msg = JSON.parse(e.data);
        } catch { return; }
        if (msg.code !== 200) return;

        if (msg.type === 'result.all' && Array.isArray(msg.data) && syncPending) {
          const round = syncPending;
          syncPending = null;
          syncedKeys.add(keyOf(round));
          applyRef.current({
            kind: 'result.all',
            eventId: round.eventId,
            roundTypeId: round.roundTypeId,
            results: msg.data as LiveResultRow[],
          });
          fetchNextSnapshot(ws);
        } else if (msg.type === 'result.new' && msg.data && typeof msg.data === 'object') {
          const r = msg.data as LiveResultRow;
          applyRef.current({ kind: 'result.new', result: r, roundFormat: r.f });
        } else if (msg.type === 'result.update' && msg.data && typeof msg.data === 'object') {
          const r = msg.data as LiveResultRow;
          applyRef.current({ kind: 'result.update', result: r, roundFormat: r.f });
        } else if (msg.type === 'round.update' && msg.data && typeof msg.data === 'object') {
          applyRef.current({ kind: 'round.update', round: msg.data as { i: string; e: string; s?: number; rn?: number; tt?: number; n?: number; name?: string } });
        } else if (msg.type === 'users' && msg.data && typeof msg.data === 'object') {
          applyRef.current({ kind: 'users', users: msg.data as Record<string, { number: number; name: string; wcaid: string; region: string }> });
        }
        // round.all 不处理:轮次元数据由 HTTP 快照和 round.update 维护。
      };

      ws.onerror = () => {
        if (cancelled) return;
        setStatus('error');
      };
      ws.onclose = () => {
        if (pingTimerRef.current) { clearInterval(pingTimerRef.current); pingTimerRef.current = null; }
        if (cancelled) return;
        needsRecovery = true;
        syncQueue = [];
        syncPending = null;
        syncedKeys.clear();
        setStatus('closed');
        scheduleReconnect();
      };
    };

    const scheduleReconnect = () => {
      if (cancelled) return;
      if (reconnectTimerRef.current) return;
      const delay = Math.min(backoff, 30000);
      backoff = Math.min(backoff * 2, 30000);
      reconnectTimerRef.current = window.setTimeout(() => {
        reconnectTimerRef.current = null;
        connect();
      }, delay);
    };

    connect();
    return () => {
      cancelled = true;
      syncRoundRef.current = () => {};
      if (pingTimerRef.current) clearInterval(pingTimerRef.current);
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      pingTimerRef.current = null;
      reconnectTimerRef.current = null;
      const ws = wsRef.current;
      wsRef.current = null;
      if (ws) {
        ws.onopen = ws.onmessage = ws.onerror = ws.onclose = null;
        try { ws.close(); } catch { /* */ }
      }
    };
  }, [compId]);

  useEffect(() => {
    if (focusRound) syncRoundRef.current(focusRound);
  }, [focusRound?.eventId, focusRound?.roundTypeId]);

  return status;
}

/** 把 LivePatch 应用到 results 数组 (新建 + 重排) — 给 reducer 用。 */
export function applyResultPatch(
  arr: LiveResultRow[],
  patch: Extract<LivePatch, { kind: 'result.new' | 'result.update' }>,
): LiveResultRow[] {
  const incoming = patch.result;
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
