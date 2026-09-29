import { useSyncExternalStore } from 'react';
import { decodeAppleMembershipResult, type AppleMembershipRequest, type AppleMembershipResult } from '@cuberoot/shared/apple-membership';
import { mobileEmbedSurfaceFromFrameName } from '@cuberoot/shared/mobile-embed';

let enabled = false;
let send: ((request: AppleMembershipRequest) => void) | undefined;
const listeners = new Set<() => void>();
const pending = new Map<string, { resolve: (result: AppleMembershipResult) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>();
export function setAppleMembershipBridge(available: boolean, post?: typeof send) {
  enabled = available; send = post;
  for (const listener of listeners) listener();
  if (!available) for (const [id, p] of pending) {
    clearTimeout(p.timer); p.reject(new Error('App connection closed')); pending.delete(id);
  }
}
export function receiveAppleMembershipResult(value: unknown) {
  const result = decodeAppleMembershipResult(value);
  const p = result && pending.get(result.requestId);
  if (!result || !p) return;
  clearTimeout(p.timer); pending.delete(result.requestId); p.resolve(result);
}
export function useAppleMembershipAvailable() {
  return useSyncExternalStore(listener => { listeners.add(listener); return () => { listeners.delete(listener); }; }, () => enabled, () => false);
}
export function isIosMembershipSurface() {
  return typeof window !== 'undefined' && window.parent !== window
    && Boolean(mobileEmbedSurfaceFromFrameName(window.name))
    && (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
}
export function requestAppleMembership(action: AppleMembershipRequest['action'], expectedUid: number, productId?: AppleMembershipRequest['productId']): Promise<AppleMembershipResult> {
  const surface = mobileEmbedSurfaceFromFrameName(window.name);
  if (!enabled || !send || !surface) return Promise.reject(new Error('App update required'));
  const requestId = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(requestId); reject(new Error('App Store response timed out')); }, 180_000);
    pending.set(requestId, { resolve, reject, timer });
    send!({ type: 'cuberoot:mobile:apple-membership', surface, requestId, expectedUid, action, productId });
  });
}
