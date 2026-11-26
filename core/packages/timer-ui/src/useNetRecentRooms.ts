'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  decodeNetRecentRooms,
  forgetNetRecentRoom,
  NET_RECENT_ROOMS_KEY,
  NET_RECENT_ROOM_TTL_MS,
  rememberNetRecentRoom,
  type NetRecentRoom,
} from '@cuberoot/shared/timer/net-battle';

function readRecentRooms(now: number, fallback: NetRecentRoom[]): NetRecentRoom[] {
  try {
    const raw = window.localStorage.getItem(NET_RECENT_ROOMS_KEY);
    return decodeNetRecentRooms(raw ? JSON.parse(raw) : [], now);
  } catch {
    return decodeNetRecentRooms(fallback, now);
  }
}

/** Device-local room shortcuts. Credentials continue to use the host session store. */
export function useNetRecentRooms() {
  const [rooms, setRooms] = useState<NetRecentRoom[]>([]);
  const latest = useRef(rooms);
  const publish = useCallback((next: NetRecentRoom[]) => {
    latest.current = next;
    setRooms(next);
  }, []);

  useEffect(() => {
    const refresh = () => publish(readRecentRooms(Date.now(), latest.current));
    const storageChanged = (event: StorageEvent) => {
      if (event.key === null || event.key === NET_RECENT_ROOMS_KEY) refresh();
    };
    refresh();
    window.addEventListener('storage', storageChanged);
    return () => window.removeEventListener('storage', storageChanged);
  }, [publish]);

  useEffect(() => {
    if (!rooms.length) return;
    const expiresAt = rooms[rooms.length - 1].updatedAt + NET_RECENT_ROOM_TTL_MS;
    const timeout = setTimeout(() => publish(decodeNetRecentRooms(latest.current, Date.now())),
      Math.max(0, expiresAt - Date.now()));
    return () => clearTimeout(timeout);
  }, [rooms, publish]);

  const update = useCallback((change: (current: NetRecentRoom[], now: number) => NetRecentRoom[]) => {
    const now = Date.now();
    const next = change(latest.current, now);
    publish(next);
    try { window.localStorage.setItem(NET_RECENT_ROOMS_KEY, JSON.stringify(next)); } catch { /* Keep shortcuts in memory. */ }
  }, [publish]);

  const remember = useCallback((room: Pick<NetRecentRoom, 'code' | 'event'>) =>
    update((current, now) => rememberNetRecentRoom(current, room, now)), [update]);
  const forget = useCallback((code: string, reason: string | null) => {
    if (reason === 'room not found' || reason === 'removed from room') {
      update((current, now) => forgetNetRecentRoom(current, code, now));
    }
  }, [update]);

  return { rooms, remember, forget };
}
