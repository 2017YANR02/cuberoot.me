'use client';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { applyTimerLivePatch, createTimerLivePublisher, parseTimerLiveSession, parseTimerLiveDetail,
  parseTimerLiveSnapshot, TIMER_LIVE_MAX_BYTES, TIMER_LIVE_PATH, TIMER_LIVE_STALE_MS,
  type TimerLiveCredential, type TimerLiveSession, type TimerLiveSnapshot, type TimerLiveSource, type TimerLiveConnection } from '@cuberoot/shared/timer/live-share';
import type { Solve } from '@cuberoot/shared/timer';

export interface TimerLiveTransport {
  apiUrl(path: string): string;
  websocketUrl: string;
  fetcher?: typeof fetch;
}
export type { TimerLiveConnection } from '@cuberoot/shared/timer/live-share';
const STORAGE_KEY = 'cuberoot.timer.live-share.v1';
function saveSession(session: TimerLiveSession | null, paused = false) {
  try { if (session) sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...session, paused })); else sessionStorage.removeItem(STORAGE_KEY); } catch { /* in-memory sharing still works */ }
}
async function shareRequest(transport: TimerLiveTransport, path: string, init: RequestInit) {
  const abort = new AbortController();
  const timeout = setTimeout(() => abort.abort(), 10_000);
  try { return await (transport.fetcher ?? fetch)(transport.apiUrl(path), { ...init, signal: abort.signal, cache: 'no-store' }); }
  finally { clearTimeout(timeout); }
}

/** Shared Web/App transport. Only the publisher gets a data source; viewers cannot publish. */
export function useTimerLiveConnection(transport: TimerLiveTransport, credential: TimerLiveCredential | null,
  role: 'host' | 'viewer', source?: TimerLiveSource) {
  const [connection, setConnection] = useState<TimerLiveConnection>('idle');
  const [online, setOnline] = useState(false), [viewers, setViewers] = useState(0);
  const [snapshot, setSnapshot] = useState<TimerLiveSnapshot | null>(null);
  const [detail, setDetail] = useState<{ requestId: string; context: string; solve: Solve } | null>(null);
  const [clockOffset, setClockOffset] = useState(0);
  const sourceRef = useRef(source); sourceRef.current = source;
  const sendRef = useRef<(message: unknown) => boolean>(() => false);
  const flushRef = useRef<() => void>(() => {});
  const requestedDetail = useRef<{ solveId: string; context: string; requestId: string } | null>(null);
  useLayoutEffect(() => flushRef.current());
  const requestDetail = useCallback((solveId: string, context: string, requestId: string) => {
    requestedDetail.current = { solveId, context, requestId };
    setDetail(null); return sendRef.current({ type: 'detail', solveId, context, requestId });
  }, []);
  useEffect(() => {
    setSnapshot(null); setDetail(null); setOnline(false); setViewers(0);
    requestedDetail.current = null;
    if (!credential) { setConnection('idle'); return; }
    let disposed = false, socket: WebSocket | null = null, retry: ReturnType<typeof setTimeout> | undefined;
    let ready = false, revision = 0, last: TimerLiveSnapshot | null = null;
    let lastReceived = performance.now(), offset = 0, bestRtt = Infinity, reconnects = 0;
    let snapshotReceived = false, publisher: ReturnType<typeof createTimerLivePublisher> | undefined;
    const send = (message: unknown): boolean => {
      if (!socket || socket.readyState !== WebSocket.OPEN) return false;
      const data = JSON.stringify(message);
      if (new TextEncoder().encode(data).byteLength > TIMER_LIVE_MAX_BYTES) {
        setConnection('error'); socket.close(4003, 'payload too large'); return false;
      }
      if (socket.bufferedAmount > TIMER_LIVE_MAX_BYTES) { socket.close(4002, 'slow connection'); return false; }
      try { socket.send(data); return true; } catch { return false; }
    };
    sendRef.current = send;
    const flush = () => publisher?.flush();
    flushRef.current = flush;
    const connect = () => {
      if (disposed) return;
      setConnection('connecting'); ready = false; last = null; snapshotReceived = false;
      lastReceived = performance.now(); bestRtt = Infinity;
      publisher = role === 'host' && sourceRef.current ? createTimerLivePublisher({ send, now: Date.now, source: {
        snapshot: () => sourceRef.current!.snapshot(),
        detail: (id, context) => sourceRef.current?.detail(id, context) ?? null,
      } }) : undefined;
      const current = new WebSocket(transport.websocketUrl); socket = current;
      current.onopen = () => {
        if (disposed || socket !== current) return;
        send({ type: 'hello', version: 1, role, ...credential });
      };
      current.onmessage = event => {
        if (disposed || socket !== current || typeof event.data !== 'string' || event.data.length > TIMER_LIVE_MAX_BYTES) return;
        let m: Record<string, unknown>;
        try { m = JSON.parse(event.data); if (!m || typeof m !== 'object') return; } catch { return; }
        lastReceived = performance.now();
        if (m.type === 'ready') {
          ready = true; reconnects = 0; setConnection('connected');
          if (typeof m.serverNow === 'number') { offset = m.serverNow - Date.now(); setClockOffset(offset); }
          if (publisher) publisher.receive(m); else send({ type: 'ping', sentAt: Date.now() });
          return;
        }
        if (m.type === 'pong' && typeof m.sentAt === 'number' && typeof m.serverNow === 'number') {
          publisher?.receive(m);
          const rtt = Date.now() - m.sentAt;
          if (rtt >= 0 && rtt < bestRtt) { bestRtt = rtt; offset = m.serverNow - (m.sentAt + rtt / 2); setClockOffset(offset); }
          return;
        }
        if (m.type === 'status' && typeof m.online === 'boolean' && typeof m.viewers === 'number') {
          setOnline(m.online); setViewers(m.viewers); return;
        }
        if (role === 'host') { publisher?.receive(m); return; }
        if (m.type === 'detail' && typeof m.requestId === 'string' && typeof m.context === 'string') {
          const solve = parseTimerLiveDetail(m.solve);
          if (solve && requestedDetail.current?.requestId === m.requestId && requestedDetail.current.context === m.context
            && requestedDetail.current.solveId === solve.id) setDetail({ requestId: m.requestId, context: m.context, solve });
          return;
        }
        if (!Number.isSafeInteger(m.revision)) return;
        if (m.type === 'snapshot') {
          const next = parseTimerLiveSnapshot(m.snapshot);
          if (next) { last = next; revision = m.revision as number; snapshotReceived = true; setSnapshot(next); }
        } else if (m.type === 'patch') {
          if (!last || !snapshotReceived || m.revision !== revision + 1) { send({ type: 'resync' }); return; }
          const next = applyTimerLivePatch(last, m.patch);
          if (!next) { snapshotReceived = false; send({ type: 'resync' }); return; }
          last = next; revision = m.revision as number; setSnapshot(next);
        }
      };
      current.onclose = e => {
        if (disposed || socket !== current) return;
        ready = false; publisher = undefined; setOnline(false);
        if (e.code === 4001) { setConnection('ended'); setSnapshot(null); setDetail(null); return; }
        if (e.code === 1008 || e.code === 4000 || e.code === 4003) { setConnection('error'); return; }
        setConnection('disconnected');
        retry = setTimeout(connect, Math.min(5000, 500 * 2 ** reconnects++));
      };
      current.onerror = () => { if (socket === current && current.readyState === WebSocket.OPEN) current.close(4002, 'transport error'); };
    };
    connect();
    const publicationTimer = role === 'host' ? setInterval(flush, 50) : undefined;
    const heartbeat = setInterval(() => {
      if (performance.now() - lastReceived > TIMER_LIVE_STALE_MS) { setOnline(false); socket?.close(4002, 'heartbeat timeout'); }
      else if (ready) send({ type: 'ping', sentAt: Date.now() });
    }, 2000);
    const wake = () => {
      if (!ready) return;
      if (publisher) publisher.refresh();
      else if (role === 'viewer') { send({ type: 'ping', sentAt: Date.now() }); send({ type: 'resync' }); }
    };
    window.addEventListener('online', wake); document.addEventListener('visibilitychange', wake);
    return () => {
      disposed = true; ready = false; clearInterval(publicationTimer); clearInterval(heartbeat); clearTimeout(retry);
      sendRef.current = () => false; flushRef.current = () => {};
      window.removeEventListener('online', wake); document.removeEventListener('visibilitychange', wake);
      socket?.close(1000, 'page closed');
    };
  }, [transport.websocketUrl, credential?.id, credential?.token, role]);
  return { connection, online, viewers, snapshot, detail, clockOffset, requestDetail };
}

export function useTimerLiveShare(transport: TimerLiveTransport, source: TimerLiveSource, enabled = true) {
  const [session, setSession] = useState<TimerLiveSession | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(false);
  const [paused, setPaused] = useState(false);
  const mounted = useRef(false), pending = useRef(false);
  const transportRef = useRef(transport); transportRef.current = transport;
  useEffect(() => {
    mounted.current = true;
    try { const raw = sessionStorage.getItem(STORAGE_KEY); if (raw) {
      const value = JSON.parse(raw), restored = parseTimerLiveSession(value);
      setPaused(!!restored && value?.paused === true); setSession(restored);
      if (!restored) saveSession(null);
    } } catch { /* optional restore */ }
    return () => { mounted.current = false; };
  }, []);
  const connection = useTimerLiveConnection(transport, enabled && !paused ? session : null, 'host', source);
  const stop = useCallback(async () => {
    if (!session || pending.current) return;
    pending.current = true; setBusy(true); setError(false); setPaused(true);
    saveSession(session, true);
    try {
      const t = transportRef.current;
      const res = await shareRequest(t, `${TIMER_LIVE_PATH}/${session.id}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${session.token}` },
      });
      if (!res.ok && res.status !== 404) throw new Error();
      saveSession(null);
      if (mounted.current) { setSession(null); setPaused(false); }
    } catch { if (mounted.current) setError(true); }
    finally { pending.current = false; if (mounted.current) setBusy(false); }
  }, [session]);
  const start = useCallback(async () => {
    if (pending.current || session || !enabled) return;
    pending.current = true; setBusy(true); setError(false);
    try {
      const t = transportRef.current;
      const res = await shareRequest(t, TIMER_LIVE_PATH, { method: 'POST' });
      if (!res.ok) throw new Error();
      const next = parseTimerLiveSession(await res.json()); if (!next) throw new Error();
      if (!mounted.current) {
        void (t.fetcher ?? fetch)(t.apiUrl(`${TIMER_LIVE_PATH}/${next.id}`), { method: 'DELETE', headers: { Authorization: `Bearer ${next.token}` } }).catch(() => {});
        return;
      }
      saveSession(next); setPaused(false); setSession(next);
    } catch { if (mounted.current) setError(true); }
    finally { pending.current = false; if (mounted.current) setBusy(false); }
  }, [session, enabled]);
  useEffect(() => { if (connection.connection === 'ended') { saveSession(null); setSession(null); setPaused(false); } }, [connection.connection]);
  return { ...connection, session, busy, error, paused: paused || !enabled, start, stop };
}
export type TimerLiveShareController = ReturnType<typeof useTimerLiveShare>;
