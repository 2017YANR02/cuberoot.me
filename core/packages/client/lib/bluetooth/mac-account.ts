import { getSessionToken, useAuthStore } from '@/lib/auth-store';
import { authHeaders, handleApi } from '@/lib/admin-api';
import { apiUrl } from '@/lib/api-base';
import { sessionFetch } from '@/lib/session-fetch';
import { persistItem } from '@/lib/safe-storage';
import { normalizeMac } from '@cuberoot/shared/timer/external/mac';

const LEGACY_KEY = 'cuberoot.timer.ganMacMap';
const GUEST_DEVICE_KEY = 'cuberoot.timer.lastCubeDeviceId';
const endpoint = () => apiUrl('/v1/smart-cube/macs');
type Map = Record<string, string | null>;
type Snapshot = {
  items: Map;
  pending: Map;
  lastDeviceId?: string;
  accountLastDeviceId?: string;
  pendingDeviceId?: string;
};
const key = (owner: string) => `${LEGACY_KEY}:account:${owner || 'guest'}`;
const account = () => String(useAuthStore.getState().user?.uid ?? '');
const deviceId = (value: unknown) => typeof value === 'string' && value.length > 0 && value.length <= 256
  && !/[\x00-\x1f\x7f]/.test(value) ? value : undefined;

function validMap(raw: unknown): Map {
  const result = Object.create(null) as Map;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return result;
  for (const [name, value] of Object.entries(raw)) {
    if (name && name.length <= 256 && (value === null || typeof value === 'string' && normalizeMac(value))) {
      result[name] = value === null ? null : normalizeMac(value as string);
    }
  }
  return result;
}

function read(owner: string): Snapshot {
  try {
    const raw = JSON.parse(localStorage.getItem(key(owner)) || 'null');
    if (raw) return {
      items: validMap(raw.items),
      pending: validMap(raw.pending),
      lastDeviceId: deviceId(raw.lastDeviceId),
      accountLastDeviceId: deviceId(raw.accountLastDeviceId),
      pendingDeviceId: deviceId(raw.pendingDeviceId),
    };
    // Claim the pre-account cache once, never copy another account's cache.
    const guest = owner ? localStorage.getItem(key('')) : null;
    const legacy = localStorage.getItem(LEGACY_KEY);
    const items = validMap(guest ? JSON.parse(guest).items : JSON.parse(legacy || '{}'));
    const snapshot = { items, pending: { ...items } };
    if ((legacy || guest) && persistItem(key(owner), JSON.stringify(snapshot))) {
      localStorage.removeItem(LEGACY_KEY);
      if (guest) localStorage.removeItem(key(''));
    }
    return snapshot;
  } catch { return { items: {}, pending: {} }; }
}

export function readAccountMac(name: string): string | null {
  return read(account()).items[name] ?? null;
}

export function readLastCubeDeviceId(): string | undefined {
  const owner = account();
  if (!owner) {
    try { return deviceId(localStorage.getItem(GUEST_DEVICE_KEY)); }
    catch { return undefined; }
  }
  const { lastDeviceId, accountLastDeviceId } = read(owner);
  return lastDeviceId ?? accountLastDeviceId;
}

/** Capture the account before the chooser opens, since pairing can take a while. */
export function rememberCubeSelection(): (id: string) => void {
  const owner = account();
  return (id) => {
    if (owner !== account() || !deviceId(id)) return;
    if (!owner) {
      persistItem(GUEST_DEVICE_KEY, id);
      return;
    }
    const snapshot = read(owner);
    snapshot.lastDeviceId = id;
    snapshot.pendingDeviceId = id;
    persistItem(key(owner), JSON.stringify(snapshot));
    void syncAccountMacs();
  };
}

export function writeAccountMac(name: string, mac: string | null): void {
  const owner = account();
  const snapshot = read(owner);
  if (snapshot.items[name] === mac) return;
  snapshot.items[name] = mac;
  snapshot.pending[name] = mac;
  persistItem(key(owner), JSON.stringify(snapshot));
  void syncAccountMacs();
}

const running = new Map<string, Promise<void>>();

/** Fetch before resolving a device; failed writes remain queued for the next connection. */
export function syncAccountMacs(): Promise<void> {
  const owner = account();
  const token = getSessionToken();
  if (!owner || !token) return Promise.resolve();
  const existing = running.get(owner);
  if (existing) return existing;
  const current = () => owner === account() && token === getSessionToken();
  const task = (async () => {
    try {
      const cloud = await handleApi<{ items: unknown; lastDeviceId?: unknown }>(await sessionFetch(endpoint(), {
        headers: authHeaders(false), cache: 'no-store', signal: AbortSignal.timeout(5000),
      }));
      if (!current()) return;
      let local = read(owner);
      local.items = { ...validMap(cloud.items), ...local.pending };
      // A Web Bluetooth ID belongs to its browser. Prefer a selection made
      // here even if another browser paired a cube more recently.
      if (Object.hasOwn(cloud, 'lastDeviceId')) local.accountLastDeviceId = deviceId(cloud.lastDeviceId);
      if (!persistItem(key(owner), JSON.stringify(local))) return;
      let canSyncDevice = Object.hasOwn(cloud, 'lastDeviceId');
      while (current() && (Object.keys(local.pending).length || canSyncDevice && local.pendingDeviceId)) {
        const sent = Object.fromEntries(Object.entries(local.pending).slice(0, 100));
        const lastDeviceId = canSyncDevice ? local.pendingDeviceId : undefined;
        const saved = await handleApi<{ lastDeviceId?: string }>(await sessionFetch(endpoint(), {
          method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ items: sent, lastDeviceId }),
          signal: AbortSignal.timeout(5000),
        }));
        if (!current()) return;
        local = read(owner);
        for (const [name, mac] of Object.entries(sent)) {
          if (local.pending[name] === mac) delete local.pending[name];
        }
        if (lastDeviceId !== undefined) {
          canSyncDevice = saved.lastDeviceId === lastDeviceId;
          if (canSyncDevice && local.pendingDeviceId === lastDeviceId) delete local.pendingDeviceId;
        }
        if (!persistItem(key(owner), JSON.stringify(local))) return;
      }
    } catch { /* Offline: keep local addresses and pending edits for retry. */ }
  })().finally(() => { running.delete(owner); });
  running.set(owner, task);
  return task;
}
