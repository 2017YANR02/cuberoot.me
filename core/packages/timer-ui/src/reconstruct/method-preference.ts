import { useSyncExternalStore } from 'react';
import { methodById, type MethodId } from '@cuberoot/shared/timer/reconstruct/methods';

const KEY = 'cuberoot.reconstruction.method';
const EVENT = 'cuberoot-reconstruction-method';
let fallback: MethodId = 'cfop';
function snapshot(): MethodId {
  try { return methodById(localStorage.getItem(KEY)).id; } catch { return fallback; }
}
function subscribe(notify: () => void) {
  window.addEventListener('storage', notify);
  window.addEventListener(EVENT, notify);
  return () => {
    window.removeEventListener('storage', notify);
    window.removeEventListener(EVENT, notify);
  };
}
export function useReconstructionMethod(): [MethodId, (method: MethodId) => void] {
  const method = useSyncExternalStore(subscribe, snapshot, () => 'cfop' as const);
  return [method, value => {
    fallback = value;
    try { localStorage.setItem(KEY, value); } catch { /* Private mode may deny storage. */ }
    window.dispatchEvent(new Event(EVENT));
  }];
}
