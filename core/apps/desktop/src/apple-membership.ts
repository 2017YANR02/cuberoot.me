import { useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { mobileApiUrl, type InstalledAppHost, type InstalledAuthClient } from '@cuberoot/app-ui';
import { createAppleMembershipHandler, type NativeAppleMembership } from '@cuberoot/app-ui/apple-membership';
import type { WebSession } from '@cuberoot/shared/auth/web-session';

type StoreMode = 'store' | 'sandbox';

const native: NativeAppleMembership = {
  products: () => invoke('apple_membership', { action: 'products' }),
  purchase: ({ productId, appAccountToken }) => invoke('apple_membership', { action: 'purchase', productId, appAccountToken }),
  transactions: () => invoke('apple_membership', { action: 'transactions' }),
  restore: () => invoke('apple_membership', { action: 'restore' }),
  finish: ({ transactionId }) => invoke('apple_membership', { action: 'finish', transactionId }),
  manage: () => invoke('apple_membership', { action: 'manage' }),
};

export async function withMacAppleMembership(host: InstalledAppHost, auth: InstalledAuthClient): Promise<InstalledAppHost> {
  const mode = await invoke<StoreMode | null>('apple_membership_mode');
  if (!mode) return host;
  const appleMembership = createAppleMembershipHandler({
    apiBase: mobileApiUrl('/v1/membership/apple'),
    native,
    restoreSession: () => auth.restore(),
    sandboxOnly: mode === 'sandbox',
  });
  function useAuth(language: Parameters<InstalledAppHost['useAuth']>[0]) {
    const state = host.useAuth(language);
    const session = state.loading ? null : state.session;
    useEffect(() => {
      if (!session?.user.uid) return;
      return watchTransactions(session, session.user.uid);
    }, [session]);
    return state;
  }
  function watchTransactions(session: WebSession, uid: number) {
    let active = true;
    let processing = false;
    let pending = false;
    const sync = async () => {
      pending = true;
      if (!active || processing) return;
      processing = true;
      try {
        while (active && pending) {
          pending = false;
          await appleMembership({
            type: 'cuberoot:mobile:apple-membership', surface: 'account', action: 'sync',
            requestId: 'macos-membership-sync', expectedUid: uid,
          }, session).catch(() => undefined);
        }
      } finally {
        processing = false;
      }
    };
    const subscription = listen('apple-membership-update', sync, { target: 'main' }).catch(() => undefined);
    void subscription.then(sync);
    window.addEventListener('focus', sync);
    const retry = window.setInterval(sync, 60_000);
    return () => {
      active = false;
      window.clearInterval(retry);
      window.removeEventListener('focus', sync);
      void subscription.then(unlisten => unlisten?.());
    };
  }
  return { ...host, appleMembership, useAuth };
}
