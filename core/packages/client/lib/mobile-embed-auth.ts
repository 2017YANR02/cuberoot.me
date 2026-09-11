'use client';

import { isMobileAuthProvider } from '@cuberoot/shared/auth/web-session';
import {
  mobileEmbedAuthRequestMessage,
  type MobileEmbedInitMessage,
  type MobileEmbedAuthRequestMessage,
} from '@cuberoot/shared/mobile-embed';

export function mobileEmbedSupportsApple(init: MobileEmbedInitMessage | null, managingAccount = false): boolean {
  return init?.authProviders?.includes('apple') === true
    && (!managingAccount || init.accountManagement === true);
}

export function isMobileEmbedAppleLink(target: EventTarget | null): boolean {
  return target instanceof Element
    && Boolean(target.closest('[data-mobile-account-link="apple"]'));
}

/**
 * Map every interaction inside the canonical LoginForm to a native Browser
 * handoff. Provider buttons retain their provider; email/phone/password use the
 * provider-null first-party flow. Outside the marked form there is no handoff.
 */
export function mobileEmbedAccountAuthRequest(
  target: EventTarget | null,
): MobileEmbedAuthRequestMessage | null {
  if (!(target instanceof Element)) return null;
  const authEntry = target.closest<HTMLElement>('[data-mobile-auth-entry]');
  if (!authEntry) return null;
  const provider = target.closest<HTMLElement>('[data-mobile-auth-provider]')
    ?.dataset.mobileAuthProvider;
  return mobileEmbedAuthRequestMessage(isMobileAuthProvider(provider) ? provider : null);
}
