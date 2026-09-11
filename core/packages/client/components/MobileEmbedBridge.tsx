'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import {
  decodeMobileEmbedAuthClear,
  decodeMobileEmbedAccountManageResult,
  decodeMobileEmbedBack,
  decodeMobileEmbedInit,
  decodeMobileEmbedWebSession,
  isMobileEmbedExternalHref,
  mobileEmbedAuthClearMessage,
  mobileEmbedAccountManageMessage,
  mobileEmbedExternalMessage,
  mobileEmbedNavigationMessage,
  mobileEmbedSurfaceFromFrameName,
  mobileEmbedWebSessionResultMessage,
  type MobileEmbedInitMessage,
} from '@cuberoot/shared/mobile-embed';
import { applySession, getSessionToken, useAuthStore } from '@/lib/auth-store';
import { isMobileEmbedAppleLink, mobileEmbedAccountAuthRequest, mobileEmbedSupportsApple } from '@/lib/mobile-embed-auth';
import { exchangeWebSessionTicket } from '@/lib/web-session-handoff';
import { tr } from '@/i18n/tr';

const MOBILE_PARENT_ORIGINS = new Set([
  'capacitor://localhost',
  'http://localhost',
  'https://localhost',
  'tauri://localhost',
  'https://tauri.localhost',
  'http://127.0.0.1:1420',
]);

/**
 * Bridge for the canonical website surfaces reused inside installed-app hosts. It keeps
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
    let webSessionGeneration = 0;
    let active = true;
    const invalidateWebSession = () => {
      webSessionGeneration++;
      pendingWebTicket = null;
    };
    let hadWebsiteSession = Boolean(getSessionToken());
    let parentOrigin: string | null = null;
    let capabilities: MobileEmbedInitMessage | null = null;
    let pendingManagement: { requestId: string; timeout: number } | null = null;

    const managementFailed = () => window.alert(tr({
      zh: '未能打开系统浏览器，请确认 App 仍登录当前账号后重试。',
      en: 'Could not open the system browser. Check that the app is still signed in to this account and retry.',
    }));
    const upgradeRequired = () => window.alert(tr({
      zh: '请先更新 CubeRoot App，再使用 Apple 登录或绑定 Apple。',
      en: 'Update the CubeRoot app before signing in with or linking Apple.',
    }));

    const postToParent = (message: object) => {
      if (parentOrigin) window.parent.postMessage(message, parentOrigin);
    };

    const postNavigation = () => {
      postToParent(mobileEmbedNavigationMessage(
        surface,
        stack[index] ?? window.location.href,
        index,
      ));
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

    const delegateAccountInteraction = (event: MouseEvent | KeyboardEvent): boolean => {
      if (surface !== 'account') return false;
      const linking = isMobileEmbedAppleLink(event.target);
      const authRequest = mobileEmbedAccountAuthRequest(event.target);
      if (!linking && !authRequest) return false;
      event.preventDefault();
      event.stopImmediatePropagation();
      if ((linking || authRequest?.provider === 'apple') && !mobileEmbedSupportsApple(capabilities, linking)) {
        upgradeRequired();
        return true;
      }
      if (linking) {
        if (pendingManagement) return true;
        const uid = useAuthStore.getState().user?.uid;
        if (!uid || !getSessionToken()) { managementFailed(); return true; }
        const requestId = crypto.randomUUID();
        const timeout = window.setTimeout(() => {
          pendingManagement = null;
          managementFailed();
        }, 15_000);
        pendingManagement = { requestId, timeout };
        postToParent(mobileEmbedAccountManageMessage(uid, requestId));
      } else if (authRequest) postToParent(authRequest);
      return true;
    };

    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (delegateAccountInteraction(event)) return;
      const anchor = target instanceof Element ? target.closest<HTMLAnchorElement>('a[href]') : null;
      if (!anchor || anchor.hasAttribute('download')) return;
      const next = new URL(anchor.href, window.location.href);
      if (next.origin !== window.location.origin || anchor.target === '_blank') {
        if (!isMobileEmbedExternalHref(next.href)) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        postToParent(mobileEmbedExternalMessage(surface, next.href));
        return;
      }
      if (next.href === window.location.href) return;
      window.setTimeout(() => recordRoute(next.href), 0);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (surface !== 'account' || event.key === 'Tab' || event.key === 'Escape') return;
      if (isMobileEmbedAppleLink(event.target) && event.key !== 'Enter' && event.key !== ' ') return;
      delegateAccountInteraction(event);
    };
    const onMessage = (event: MessageEvent) => {
      if (event.source !== window.parent || !MOBILE_PARENT_ORIGINS.has(event.origin)) return;
      const init = decodeMobileEmbedInit(event.data);
      if (init?.surface === surface) {
        parentOrigin = event.origin;
        capabilities = init;
        postNavigation();
        return;
      }
      if (event.origin !== parentOrigin) return;
      const managementResult = decodeMobileEmbedAccountManageResult(event.data);
      if (surface === 'account' && managementResult) {
        if (pendingManagement?.requestId !== managementResult.requestId) return;
        window.clearTimeout(pendingManagement.timeout);
        pendingManagement = null;
        if (!managementResult.ok) managementFailed();
        return;
      }
      const back = decodeMobileEmbedBack(event.data);
      if (back?.surface === surface) {
        index = Math.max(0, index - 1);
        postNavigation();
        window.history.back();
        return;
      }

      const clear = decodeMobileEmbedAuthClear(event.data);
      if (surface === 'account' && clear) {
        invalidateWebSession();
        useAuthStore.getState().logout();
        return;
      }

      const webSession = decodeMobileEmbedWebSession(event.data);
      if (surface !== 'account' || !webSession || pendingWebTicket === webSession.ticket) return;
      pendingWebTicket = webSession.ticket;
      const generation = ++webSessionGeneration;
      const current = () => active && generation === webSessionGeneration;
      // The shared exchange helper owns single-flight ticket consumption (also
      // across StrictMode remounts). Invalidate this consumer, not that shared
      // request: an old response may never restore a logged-out/replaced user.
      void exchangeWebSessionTicket(webSession.ticket).then((session) => {
        if (!current()) return;
        const persisted = applySession(session.token, session.user);
        const ok = persisted && getSessionToken() === session.token;
        postToParent(mobileEmbedWebSessionResultMessage(ok, webSession.requestId));
        if (ok) window.location.reload();
      }).catch(() => {
        if (current()) postToParent(mobileEmbedWebSessionResultMessage(false, webSession.requestId));
      }).finally(() => {
        if (current()) pendingWebTicket = null;
      });
    };
    const unsubscribeAuth = surface === 'account'
      ? useAuthStore.subscribe((state) => {
        const hasWebsiteSession = Boolean(state.user && getSessionToken());
        if (hadWebsiteSession && !hasWebsiteSession) {
          invalidateWebSession();
          postToParent(mobileEmbedAuthClearMessage());
        }
        hadWebsiteSession = hasWebsiteSession;
      })
      : () => undefined;

    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('message', onMessage);
    return () => {
      active = false;
      invalidateWebSession();
      recordRouteRef.current = null;
      if (pendingManagement) window.clearTimeout(pendingManagement.timeout);
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
