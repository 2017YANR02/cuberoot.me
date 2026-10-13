import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import type { PluginListenerHandle } from '@capacitor/core';
import { decodeWebMembershipRequest, type WebMembershipRequest, type WebMembershipResult } from '@cuberoot/shared/mobile-embed';
import type { WebSession } from '@cuberoot/shared/auth/web-session';
import { nativeMobileAuth } from './mobile-auth';
import { usesDirectPayments } from './distribution';

let busy = false;

export async function handleWebMembership(request: WebMembershipRequest, session: WebSession): Promise<Omit<WebMembershipResult, 'type' | 'requestId'>> {
  if (!usesDirectPayments() || busy || !decodeWebMembershipRequest(request)) throw new Error('checkout unavailable');
  busy = true;
  const listeners: PluginListenerHandle[] = [];
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const matchesAccount = async () => session.user.uid === request.expectedUid
      && (await nativeMobileAuth.restore())?.user.uid === request.expectedUid;
    if (!await matchesAccount()) throw new Error('account changed');
    let finish!: (status: 'returned' | 'opened') => void;
    const returned = new Promise<'returned' | 'opened'>(resolve => { finish = resolve; });
    let opened = false;
    listeners.push(await App.addListener('appStateChange', ({ isActive }) => {
      if (opened && isActive) finish('returned');
    }));
    listeners.push(await Browser.addListener('browserFinished', () => { if (opened) finish('returned'); }));
    // Establish the merchant-origin Referer in a real browser before WeChat H5.
    // The cashier token stays in the fragment; no account token enters the URL.
    const relay = new URL(request.language === 'zh' ? '/zh/membership/checkout' : '/membership/checkout', 'https://cuberoot.me');
    relay.hash = new URLSearchParams({ checkout: request.href }).toString();
    if (!await matchesAccount()) throw new Error('account changed');
    opened = true;
    await Browser.open({ url: relay.href });
    timeout = setTimeout(() => finish('opened'), 120_000);
    const status = await returned;
    if (!await matchesAccount()) throw new Error('account changed');
    return { status };
  } finally {
    clearTimeout(timeout);
    await Promise.allSettled(listeners.map(listener => listener.remove()));
    busy = false;
  }
}
