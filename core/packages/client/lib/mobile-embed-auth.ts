'use client';

import { isMobileAuthProvider } from '@cuberoot/shared/auth/web-session';
import {
  mobileEmbedAuthRequestMessage,
  type MobileEmbedAuthRequestMessage,
} from '@cuberoot/shared/mobile-embed';

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
