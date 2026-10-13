import { useSyncExternalStore } from 'react';
import { decodeWebMembershipRequest, decodeWebMembershipResult, mobileEmbedSurfaceFromFrameName, type WebMembershipRequest, type WebMembershipResult } from '@cuberoot/shared/mobile-embed';

let sender: ((request: WebMembershipRequest) => void) | undefined;
const listeners = new Set<() => void>();
const pending = new Map<string, { resolve(result: WebMembershipResult): void; reject(error: Error): void; timer: ReturnType<typeof setTimeout> }>();

export const webMembershipAvailable = () => Boolean(sender);
export function useWebMembershipAvailable() {
  return useSyncExternalStore(listener => { listeners.add(listener); return () => { listeners.delete(listener); }; }, webMembershipAvailable, () => false);
}
export function setWebMembershipBridge(enabled: boolean, send?: typeof sender) {
  sender = enabled ? send : undefined;
  if (!sender) {
    for (const p of pending.values()) { clearTimeout(p.timer); p.reject(new Error('App connection closed')); }
    pending.clear();
  }
  for (const listener of listeners) listener();
}
export function receiveWebMembershipResult(value: unknown) {
  const result = decodeWebMembershipResult(value);
  const p = result && pending.get(result.requestId);
  if (!p || !result) return;
  clearTimeout(p.timer); pending.delete(result.requestId);
  if (result.status === 'error') p.reject(new Error('Could not open checkout'));
  else p.resolve(result);
}
export function requestWebMembership(href: string, expectedUid: number, language: 'zh' | 'en'): Promise<WebMembershipResult> {
  const surface = mobileEmbedSurfaceFromFrameName(window.name);
  if (!sender || !surface) return Promise.reject(new Error('App update required'));
  const requestId = crypto.randomUUID();
  const request = decodeWebMembershipRequest({ type: 'cuberoot:mobile:web-membership', surface, requestId, expectedUid, href, language });
  if (!request) return Promise.reject(new Error('Invalid checkout request'));
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(requestId); reject(new Error('App response timed out')); }, 150_000);
    pending.set(requestId, { resolve, reject, timer });
    sender!(request);
  });
}
