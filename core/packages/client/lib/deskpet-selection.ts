import { persistItem } from './safe-storage';
import { THEME_IDS, type ThemeId } from './deskpet-themes';
import { getSessionToken, useAuthStore } from './auth-store';
import { fetchAccountDeskPetSelection, updateAccountDeskPetSelection } from './account-api';

const STORAGE_KEY = 'clawd-deskpet-char';
const CHANGE_EVENT = 'deskpet-character-change';
const key = (owner: string) => owner ? `${STORAGE_KEY}:account:${owner}` : STORAGE_KEY;
const account = () => String(useAuthStore.getState().user?.uid ?? '');
const valid = (value: unknown): ThemeId | null => THEME_IDS.find(id => id === value) ?? null;
type Snapshot = { choice: ThemeId | null; pending: boolean };
const memory = new Map<string, Snapshot>();
function read(owner: string): Snapshot {
  const fallback = memory.get(owner);
  if (fallback) return fallback;
  try {
    const raw = localStorage.getItem(key(owner));
    if (!owner) return { choice: valid(raw), pending: false };
    const saved = JSON.parse(raw || 'null');
    return { choice: valid(saved?.choice), pending: saved?.pending === true };
  } catch { return { choice: null, pending: false }; }
}
function write(owner: string, snapshot: Snapshot) {
  const saved = persistItem(key(owner), owner ? JSON.stringify(snapshot) : snapshot.choice ?? '');
  if (saved) memory.delete(owner); else memory.set(owner, snapshot);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}
export function getDeskPetSelection(): ThemeId | null { return read(account()).choice; }
export function getServerDeskPetSelection(): null { return null; }

let running: { owner: string; token: string; controller: AbortController; promise: Promise<void> } | undefined;
/** Reuse account profile transport and the pending-edit pattern of account MAC settings. */
export function syncDeskPetSelection(): Promise<void> {
  const owner = account();
  const token = getSessionToken();
  if (running && (running.owner !== owner || running.token !== token)) {
    running.controller.abort();
    running = undefined;
  }
  if (!owner || !token) return Promise.resolve();
  if (running) return running.promise;
  const controller = new AbortController();
  const current = () => !controller.signal.aborted && owner === account() && token === getSessionToken();
  const promise = (async () => {
    try {
      const cloud = await fetchAccountDeskPetSelection(controller.signal);
      if (!current()) return;
      let local = read(owner);
      if (!local.pending) {
        // Cloud wins. Claim the legacy preference once, only for an empty account.
        const legacy = read('').choice;
        local = { choice: valid(cloud) ?? (cloud === null ? legacy : null), pending: cloud === null && legacy !== null };
        write(owner, local);
        if (legacy) {
          memory.delete('');
          try { localStorage.removeItem(STORAGE_KEY); } catch { /* best effort */ }
        }
      }
      while (current() && local.pending && local.choice) {
        const sent = local.choice;
        await updateAccountDeskPetSelection(sent, Number(owner), controller.signal);
        if (!current()) return;
        local = read(owner);
        if (local.choice === sent) {
          local = { choice: sent, pending: false };
          write(owner, local);
        }
      }
    } catch { /* Offline: retain this account's pending edit for foreground/online retry. */ }
  })().finally(() => { if (running?.controller === controller) running = undefined; });
  running = { owner, token, controller, promise };
  return promise;
}

const listeners = new Set<() => void>();
let stop: (() => void) | undefined;
export function subscribeDeskPetSelection(notify: () => void) {
  listeners.add(notify);
  if (!stop) {
    const emit = () => { for (const listener of listeners) listener(); };
    const sync = () => { void syncDeskPetSelection(); };
    const visibility = () => { if (document.visibilityState === 'visible') sync(); };
    const storage = (event: StorageEvent) => {
      if (event.key !== null && event.key !== key(account())) return;
      memory.delete(account());
      emit();
      sync();
    };
    const unsubscribe = useAuthStore.subscribe(() => { emit(); sync(); });
    window.addEventListener(CHANGE_EVENT, emit);
    window.addEventListener('storage', storage);
    window.addEventListener('focus', sync);
    window.addEventListener('online', sync);
    document.addEventListener('visibilitychange', visibility);
    stop = () => {
      unsubscribe();
      window.removeEventListener(CHANGE_EVENT, emit);
      window.removeEventListener('storage', storage);
      window.removeEventListener('focus', sync);
      window.removeEventListener('online', sync);
      document.removeEventListener('visibilitychange', visibility);
      running?.controller.abort();
      running = undefined;
    };
    sync();
  }
  return () => {
    listeners.delete(notify);
    if (!listeners.size) { stop?.(); stop = undefined; }
  };
}
export function setDeskPetSelection(character: ThemeId) {
  if (!valid(character)) return;
  const owner = account();
  write(owner, { choice: character, pending: !!owner });
  void syncDeskPetSelection();
}
