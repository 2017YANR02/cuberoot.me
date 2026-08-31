'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import {
  decodeMobileEmbedAuthClear,
  decodeMobileEmbedBack,
  decodeMobileEmbedWebSession,
  mobileEmbedAuthClearMessage,
  mobileEmbedNavigationMessage,
  mobileEmbedSurfaceFromFrameName,
  mobileEmbedWebSessionResultMessage,
} from '@cuberoot/shared/mobile-embed';
import { applySession, getSessionToken, useAuthStore } from '@/lib/auth-store';
import { mobileEmbedAccountAuthRequest } from '@/lib/mobile-embed-auth';
import { exchangeWebSessionTicket } from '@/lib/web-session-handoff';

const MOBILE_PARENT_ORIGINS = new Set([
  'capacitor://localhost',
  'http://localhost',
  'https://localhost',
]);

/**
 * Bridge for the canonical website surfaces reused inside Capacitor. It keeps
 * navigation in the website, delegates third-party OAuth to the system Browser,
 * and accepts only a short-lived one-time ticket when the native session needs
 * to hydrate the Account iframe. Long-lived JWTs never cross postMessage.
 */
export default function MobileEmbedBridge() {
  const pathname = usePathname();
  const recordRouteRef = useRef<((href: string) => void) | null>(null);

  useEffect(() => {
    if (window.parent === window) return;
    const surface = mobileEmbedSurfaceFromFrameName(window.name);
    if (!surface) return;

    const stack = [window.location.href];
    let index = 0;
    let pendingWebTicket: string | null = null;
    let hadWebsiteSession = Boolean(getSessionToken());

    const postNavigation = () => {
      window.parent.postMessage(
        mobileEmbedNavigationMessage(surface, stack[index] ?? window.location.href, index),
        '*',
      );
    };

    const recordRoute = (href: string) => {
      if (href === stack[index]) {
        postNavigation();
        return;
      }
      const existing = stack.lastIndexOf(href);
      if (existing >= 0) {
        index = existing;
      } else {
        stack.splice(index + 1);
        stack.push(href);
        index = stack.length - 1;
      }
      postNavigation();
    };
    recordRouteRef.current = recordRoute;

    const onClick = (event: MouseEvent) => {
      const target = event.target;
      const authRequest = surface === 'account'
        ? mobileEmbedAccountAuthRequest(target)
        : null;
      if (authRequest) {
        event.preventDefault();
        event.stopImmediatePropagation();
        window.parent.postMessage(authRequest, '*');
        return;
      }
      const anchor = target instanceof Element ? target.closest<HTMLAnchorElement>('a[href]') : null;
      if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return;
      const next = new URL(anchor.href, window.location.href);
      if (next.origin !== window.location.origin || next.href === window.location.href) return;
      window.setTimeout(() => recordRoute(next.href), 0);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (surface !== 'account' || event.key === 'Tab' || event.key === 'Escape') return;
      const authRequest = mobileEmbedAccountAuthRequest(event.target);
      if (!authRequest) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      window.parent.postMessage(authRequest, '*');
    };
    const onMessage = (event: MessageEvent) => {
      if (event.source !== window.parent || !MOBILE_PARENT_ORIGINS.has(event.origin)) return;
      const back = decodeMobileEmbedBack(event.data);
      if (back?.surface === surface) {
        index = Math.max(0, index - 1);
        postNavigation();
        window.history.back();
        return;
      }

      const clear = decodeMobileEmbedAuthClear(event.data);
      if (surface === 'account' && clear) {
        useAuthStore.getState().logout();
        return;
      }

      const webSession = decodeMobileEmbedWebSession(event.data);
      if (surface !== 'account' || !webSession || pendingWebTicket === webSession.ticket) return;
      pendingWebTicket = webSession.ticket;
      void exchangeWebSessionTicket(webSession.ticket).then((session) => {
        const persisted = applySession(session.token, session.user);
        const ok = persisted && getSessionToken() === session.token;
        window.parent.postMessage(mobileEmbedWebSessionResultMessage(ok), '*');
        if (ok) window.location.reload();
      }).catch(() => {
        window.parent.postMessage(mobileEmbedWebSessionResultMessage(false), '*');
      }).finally(() => {
        pendingWebTicket = null;
      });
    };
    const unsubscribeAuth = surface === 'account'
      ? useAuthStore.subscribe((state) => {
        const hasWebsiteSession = Boolean(state.user && getSessionToken());
        if (hadWebsiteSession && !hasWebsiteSession) {
          window.parent.postMessage(mobileEmbedAuthClearMessage(), '*');
        }
        hadWebsiteSession = hasWebsiteSession;
      })
      : () => undefined;

    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('message', onMessage);
    postNavigation();
    return () => {
      recordRouteRef.current = null;
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('message', onMessage);
      unsubscribeAuth();
    };
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => recordRouteRef.current?.(window.location.href), 0);
    return () => window.clearTimeout(timeout);
  }, [pathname]);

  return null;
}
