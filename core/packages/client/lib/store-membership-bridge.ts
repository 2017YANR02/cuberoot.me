import { useSyncExternalStore } from 'react';
import { mobileEmbedSurfaceFromFrameName } from '@cuberoot/shared/mobile-embed';
import { decodeAppleMembershipResult, type AppleMembershipRequest, type AppleMembershipResult } from '@cuberoot/shared/apple-membership';
import { decodeGoogleMembershipResult, type GoogleMembershipRequest, type GoogleMembershipResult } from '@cuberoot/shared/google-membership';

export type MembershipStore = 'apple' | 'google';
type Request = AppleMembershipRequest | GoogleMembershipRequest;
type Result = AppleMembershipResult | GoogleMembershipResult;
const bridges: Record<MembershipStore, { enabled: boolean; send?: (request: Request) => void }> = { apple: { enabled: false }, google: { enabled: false } };
const listeners = new Set<() => void>();
const pending = new Map<string, { store: MembershipStore; resolve: (result: Result) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>();
export function setStoreMembershipBridge(store: MembershipStore, enabled: boolean, send?: (request: Request) => void) {
  bridges[store] = { enabled, send };
  for (const listener of listeners) listener();
  if (!enabled) for (const [id, p] of pending) if (p.store === store) {
    clearTimeout(p.timer); p.reject(new Error('App connection closed')); pending.delete(id);
  }
}
export function receiveStoreMembershipResult(value: unknown) {
  const result = decodeAppleMembershipResult(value) ?? decodeGoogleMembershipResult(value);
  const p = result && pending.get(result.requestId);
  if (!result || !p || result.type !== `cuberoot:mobile:${p.store}-membership-result`) return;
  clearTimeout(p.timer); pending.delete(result.requestId); p.resolve(result);
}
export function useStoreMembershipAvailable(store: MembershipStore) {
  return useSyncExternalStore(listener => { listeners.add(listener); return () => { listeners.delete(listener); }; }, () => bridges[store].enabled, () => false);
}
export function installedMembershipStore(): MembershipStore | null {
  if (typeof window === 'undefined' || window.parent === window || !mobileEmbedSurfaceFromFrameName(window.name)) return null;
  if (bridges.google.enabled || /Android/.test(navigator.userAgent)) return 'google';
  if (bridges.apple.enabled || /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'apple';
  return null;
}
export function requestStoreMembership(store: MembershipStore, action: Request['action'], expectedUid: number, productId?: Request['productId']): Promise<Result> {
  const surface = mobileEmbedSurfaceFromFrameName(window.name);
  const { enabled, send } = bridges[store];
  if (!enabled || !send || !surface) return Promise.reject(new Error('App update required'));
  const requestId = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(requestId); reject(new Error('Store response timed out')); }, 180_000);
    pending.set(requestId, { store, resolve, reject, timer });
    send({ type: `cuberoot:mobile:${store}-membership`, surface, requestId, expectedUid, action, productId });
  });
}
