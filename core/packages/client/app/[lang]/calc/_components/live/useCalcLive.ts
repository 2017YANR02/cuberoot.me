'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CALC_LIVE_ROOM_CODE_LENGTH,
  isCalcLiveHostToken,
  isCalcLiveRoomCode,
  parseCalcLiveServerMessage,
  type CalcLiveSnapshot,
} from '@cuberoot/shared';
import { websocketApiUrl } from '@/lib/api-base';

const ROOM_CODE_SPACE = 10 ** CALC_LIVE_ROOM_CODE_LENGTH;
const MAX_COLLISION_RETRIES = 20;
const RECONNECT_DELAY_MS = 1_500;
const SEND_DEBOUNCE_MS = 120;

type LiveRole = 'none' | 'resolving' | 'host' | 'viewer' | 'invalid';
type ConnectionState = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error';

interface SessionResolution {
  checked: boolean;
  code: string | null;
  token: string | null;
}

interface UseCalcLiveOptions {
  liveCode: string | null;
  setLiveCode: (code: string | null) => unknown;
  getSnapshot: () => CalcLiveSnapshot;
  onSnapshot: (snapshot: CalcLiveSnapshot) => void;
  subscribe: (listener: () => void) => () => void;
}

function sessionKey(code: string): string {
  return `cuberoot.calc.live.${code}`;
}

function randomRoomCode(exclude?: string): string {
  let code: string;
  do {
    const value = crypto.getRandomValues(new Uint32Array(1))[0] % ROOM_CODE_SPACE;
    code = value.toString().padStart(CALC_LIVE_ROOM_CODE_LENGTH, '0');
  } while (code === exclude);
  return code;
}

function randomToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function inviteUrl(code: string): string {
  const url = new URL(window.location.href);
  url.searchParams.set('live', code);
  url.searchParams.delete('tab');
  return url.toString();
}

export function useCalcLive({
  liveCode,
  setLiveCode,
  getSnapshot,
  onSnapshot,
  subscribe,
}: UseCalcLiveOptions) {
  const normalizedCode = liveCode?.trim() ?? null;
  const [session, setSession] = useState<SessionResolution>({ checked: false, code: null, token: null });
  const [connection, setConnection] = useState<ConnectionState>('idle');
  const [hostOnline, setHostOnline] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const readyRef = useRef(false);
  const getSnapshotRef = useRef(getSnapshot);
  const onSnapshotRef = useRef(onSnapshot);
  const collisionRetriesRef = useRef(0);

  useEffect(() => { getSnapshotRef.current = getSnapshot; }, [getSnapshot]);
  useEffect(() => { onSnapshotRef.current = onSnapshot; }, [onSnapshot]);

  useEffect(() => {
    if (!normalizedCode || !isCalcLiveRoomCode(normalizedCode)) {
      setSession({ checked: true, code: normalizedCode, token: null });
      return;
    }
    const stored = sessionStorage.getItem(sessionKey(normalizedCode));
    setSession({
      checked: true,
      code: normalizedCode,
      token: isCalcLiveHostToken(stored) ? stored : null,
    });
  }, [normalizedCode]);

  const role: LiveRole = !normalizedCode
    ? 'none'
    : !isCalcLiveRoomCode(normalizedCode)
      ? 'invalid'
      : !session.checked || session.code !== normalizedCode
        ? 'resolving'
        : session.token
          ? 'host'
          : 'viewer';

  const sendSnapshot = useCallback(() => {
    const socket = socketRef.current;
    if (!readyRef.current || !socket || socket.readyState !== WebSocket.OPEN) return;
    try {
      socket.send(JSON.stringify({ type: 'state', state: getSnapshotRef.current() }));
      setConnection('connected');
    } catch {
      setConnection('error');
    }
  }, []);

  useEffect(() => {
    if ((role !== 'host' && role !== 'viewer') || !session.code) {
      setConnection(role === 'none' ? 'idle' : 'connecting');
      setHostOnline(false);
      setViewerCount(0);
      return;
    }

    let disposed = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let activeSocket: WebSocket | null = null;

    const connect = () => {
      if (disposed) return;
      setConnection('connecting');
      readyRef.current = false;
      const socket = new WebSocket(websocketApiUrl('/v1/calc/live'));
      activeSocket = socket;
      socketRef.current = socket;

      socket.addEventListener('open', () => {
        const hello = role === 'host'
          ? { type: 'hello', role, code: session.code, token: session.token }
          : { type: 'hello', role, code: session.code };
        socket.send(JSON.stringify(hello));
      });
      socket.addEventListener('message', (event) => {
        if (typeof event.data !== 'string') return;
        let decoded: unknown;
        try {
          decoded = JSON.parse(event.data) as unknown;
        } catch {
          return;
        }
        const message = parseCalcLiveServerMessage(decoded);
        if (!message) return;
        if (message.type === 'ready') {
          collisionRetriesRef.current = 0;
          readyRef.current = true;
          setConnection('connected');
          if (role === 'host') sendSnapshot();
          return;
        }
        if (message.type === 'status') {
          setHostOnline(message.live);
          setViewerCount(message.viewers);
          return;
        }
        if (role === 'viewer') {
          setLastUpdatedAt(message.updatedAt);
          onSnapshotRef.current(message.state);
        }
      });
      socket.addEventListener('close', (event) => {
        if (activeSocket !== socket) return;
        if (socketRef.current === socket) socketRef.current = null;
        readyRef.current = false;
        setHostOnline(false);
        if (disposed) return;
        if (role === 'host' && session.code && event.code === 1008 && event.reason === 'room code taken'
          && collisionRetriesRef.current < MAX_COLLISION_RETRIES) {
          collisionRetriesRef.current++;
          const previousCode = session.code;
          const code = randomRoomCode(previousCode);
          const token = randomToken();
          sessionStorage.removeItem(sessionKey(previousCode));
          sessionStorage.setItem(sessionKey(code), token);
          setSession({ checked: true, code, token });
          void setLiveCode(code);
          setConnection('connecting');
          return;
        }
        const terminal = role === 'host'
          && event.code === 1008
          && event.reason !== 'room not found';
        setConnection(terminal ? 'error' : 'disconnected');
        if (!terminal) retryTimer = setTimeout(connect, RECONNECT_DELAY_MS);
      });
      socket.addEventListener('error', () => {
        if (!disposed) setConnection('disconnected');
      });
    };

    connect();
    return () => {
      disposed = true;
      if (retryTimer) clearTimeout(retryTimer);
      readyRef.current = false;
      if (socketRef.current === activeSocket) socketRef.current = null;
      activeSocket?.close(1000, 'page changed');
    };
  }, [role, sendSnapshot, session.code, session.token, setLiveCode]);

  useEffect(() => {
    if (role !== 'host') return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = subscribe(() => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(sendSnapshot, SEND_DEBOUNCE_MS);
    });
    return () => {
      if (timer) clearTimeout(timer);
      unsubscribe();
    };
  }, [role, sendSnapshot, subscribe]);

  const start = useCallback((): { code: string; url: string } => {
    collisionRetriesRef.current = 0;
    const code = randomRoomCode();
    const token = randomToken();
    sessionStorage.setItem(sessionKey(code), token);
    setSession({ checked: true, code, token });
    void setLiveCode(code);
    return { code, url: inviteUrl(code) };
  }, [setLiveCode]);

  const leave = useCallback(() => {
    if (session.code && session.token) sessionStorage.removeItem(sessionKey(session.code));
    setSession({ checked: true, code: null, token: null });
    void setLiveCode(null);
  }, [session.code, session.token, setLiveCode]);

  const currentInviteUrl = useCallback(() => (
    session.code && isCalcLiveRoomCode(session.code) ? inviteUrl(session.code) : null
  ), [session.code]);

  return {
    role,
    connection,
    code: session.code,
    hostOnline,
    viewerCount,
    lastUpdatedAt,
    start,
    leave,
    currentInviteUrl,
  };
}
