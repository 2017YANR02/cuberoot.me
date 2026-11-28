'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import {
  decodeMobileEmbedAuthClear,
  decodeMobileEmbedAccountManageResult,
  decodeMobileEmbedBack,
  decodeMobileEmbedInit,
  decodeMobileEmbedAppearance,
  decodeMobileEmbedWebSession,
  isMobileEmbedExternalHref,
  mobileEmbedAuthClearMessage,
  mobileEmbedAppearanceMessage,
  mobileEmbedAccountManageMessage,
  mobileEmbedExternalMessage,
  mobileEmbedNavigationMessage,
  mobileEmbedSelectTabMessage,
  mobileEmbedOpenSettingsMessage,
  mobileEmbedSurfaceFromFrameName,
  mobileEmbedDisablesGenerativeAi,
  mobileEmbedWebSessionResultMessage,
  type MobileEmbedInitMessage,
} from '@cuberoot/shared/mobile-embed';
import { applySession, getSessionToken, authActions, getAuthUser, subscribeExplicitAuthLogout } from '@/lib/auth-store';
import { blurMobileEmbedAuthEntry, isMobileEmbedAppleLink, mobileEmbedAccountAuthRequest, mobileEmbedSupportsApple } from '@/lib/mobile-embed-auth';
import { exchangeWebSessionTicket } from '@/lib/web-session-handoff';
import { tr } from '@/i18n/tr';
import { installedContentUnavailable } from '@cuberoot/shared/installed-content';
import { installedCommunityDisabled, isInstalledCommunityHref } from '@/lib/installed-content';
import { setAppleMembershipBridge, receiveAppleMembershipResult } from '@/lib/apple-membership-bridge';
import { setStoreMembershipBridge } from '@/lib/store-membership-bridge';
import { setWebMembershipBridge, receiveWebMembershipResult } from '@/lib/web-membership-bridge';
import { setInstalledBleBridge } from '@/lib/installed-ble-bridge';
import { applyAppearancePreferences, persistAppearancePreferences, readAppearancePreferences, APPEARANCE_CHANGE_EVENT } from '@cuberoot/app-ui/appearance';
import type { AppearancePreferences } from '@cuberoot/shared/appearance';
import { setInstalledShellNavigation } from '@/lib/installed-shell-navigation';
import { decodeTimerPracticeSearch } from '@/lib/timer-practice-url';
import { resolveTrainingTarget } from '@/lib/timer-training-catalog';

const MOBILE_PARENT_ORIGINS = new Set([
  'capacitor://localhost',
  'http://localhost',
  'https://localhost',
  'tauri://localhost',
  'https://tauri.localhost',
  'http://127.0.0.1:1420',
]);

function isTimerTraining(search: URLSearchParams): boolean {
  const training = decodeTimerPracticeSearch(search).get('training') ?? '';
  return training === 'home' || Boolean(resolveTrainingTarget(training));
}

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
    const generativeAiDisabled = mobileEmbedDisablesGenerativeAi(window.name);

    const rootStyle = document.documentElement.style;
    const previousSafeTop = rootStyle.getPropertyValue('--sat');
    const previousSafeTopPriority = rootStyle.getPropertyPriority('--sat');
    let hostOwnsSafeTop = false;
    const stack = [window.location.href];
    let index = 0;
    let pendingWebTicket: string | null = null;
    let webSessionGeneration = 0;
    let active = true;
    const invalidateWebSession = () => {
      webSessionGeneration++;
      pendingWebTicket = null;
    };
    let clearingFromHost = false;
    let parentOrigin: string | null = null;
    let capabilities: MobileEmbedInitMessage | null = null;
    let hostAppearance: AppearancePreferences | null = null;
    let applyingAppearance = false;
    const applyHostAppearance = (preferences: AppearancePreferences) => {
      if (applyingAppearance) return;
      const changed = JSON.stringify(readAppearancePreferences()) !== JSON.stringify(preferences);
      if (!changed && JSON.stringify(hostAppearance) === JSON.stringify(preferences)) {
        // Web previews may alter the DOM without committing storage.
        applyAppearancePreferences(preferences);
        return;
      }
      hostAppearance = preferences;
      applyingAppearance = true;
      try {
        if (changed) {
          try { persistAppearancePreferences(preferences); }
          catch { /* Restricted iframe storage must not block host appearance or bridge initialization. */ }
        }
        applyAppearancePreferences(preferences);
        window.dispatchEvent(new Event('theme-change'));
        window.dispatchEvent(new Event('home-background-change'));
      } finally { applyingAppearance = false; }
    };
    const restoreHostAppearance = () => { if (hostAppearance) applyHostAppearance(hostAppearance); };
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

    const originalOpen = window.open;
    const openWindow: typeof window.open = (href, target, features) => {
      if (!parentOrigin || !href || (target && target.toLowerCase() !== '_blank')) {
        return originalOpen.call(window, href, target, features);
      }
      let next: URL;
      try { next = new URL(href, window.location.href); }
      catch { return null; }
      if (next.protocol !== 'https:' && next.protocol !== 'http:') {
        return originalOpen.call(window, href, target, features);
      }
      if (navigator.userActivation?.isActive !== false && isMobileEmbedExternalHref(next.href)) {
        postToParent(mobileEmbedExternalMessage(surface, next.href));
      }
      return null;
    };
    window.open = openWindow;

    const inlineAccount = () => surface === 'account' && capabilities?.inlineAccountSettings === true;
    const commitAppearance = () => {
      if (applyingAppearance) return;
      if (!inlineAccount()) {
        restoreHostAppearance();
        return;
      }
      const url = new URL(window.location.href);
      if (!/^\/(?:en\/|zh\/)?account\/?$/.test(url.pathname)
        || !['general', 'appearance'].includes(url.searchParams.get('settings') ?? '')) return;
      try { localStorage.getItem('trainer-lang'); }
      catch {
        restoreHostAppearance();
        return;
      }
      const preferences = readAppearancePreferences();
      if (JSON.stringify(hostAppearance) === JSON.stringify(preferences)) return;
      // Keep the latest committed value until its echo arrives from the shell.
      hostAppearance = preferences;
      postToParent(mobileEmbedAppearanceMessage('account', preferences));
    };

    const applyToolsSearch = (chrome: MobileEmbedInitMessage['chrome'], home: boolean) => {
      const root = document.documentElement;
      const search = home ? chrome?.toolsSearch : undefined;
      const wasExpanded = root.hasAttribute('data-embedded-search-open');
      const expanded = search?.expanded === true;
      root.toggleAttribute('data-embedded-search-button', Boolean(search));
      root.toggleAttribute('data-embedded-search-open', expanded);
      if (search && chrome) rootStyle.setProperty('--embedded-search-clearance', `${chrome.bottom}px`);
      else rootStyle.removeProperty('--embedded-search-clearance');
      if (expanded && !wasExpanded) document.querySelector<HTMLInputElement>('.landing-page > .landing-search .landing-search-field')?.focus();
      if (!expanded && wasExpanded && document.activeElement instanceof HTMLInputElement
        && document.activeElement.matches('.landing-search-field')) document.activeElement.blur();
    };

    const applyChrome = () => {
      const chrome = capabilities?.chrome;
      const pathname = window.location.pathname.replace(/^\/(?:en|zh)(?=\/|$)/, '') || '/';
      const supportedPage = pathname === (surface === 'tools' ? '/' : '/account');
      if (surface === 'tools') applyToolsSearch(chrome, supportedPage);
      document.documentElement.toggleAttribute('data-installed-top-bar', Boolean(chrome?.top && supportedPage));
      document.documentElement.toggleAttribute('data-installed-tools-insets', surface === 'tools' && supportedPage && chrome?.insetByHost === true);
      for (const [side, value] of Object.entries({
        left: chrome?.top?.left, right: chrome?.top?.right, bottom: chrome?.bottom,
      })) {
        if (supportedPage && value != null) rootStyle.setProperty(`--installed-chrome-${side}`, `${value}px`);
        else rootStyle.removeProperty(`--installed-chrome-${side}`);
      }
      return Boolean(chrome && supportedPage);
    };

    const postNavigation = () => {
      postToParent(mobileEmbedNavigationMessage(
        surface,
        stack[index] ?? window.location.href,
        index,
        applyChrome(),
        inlineAccount(),
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
        const uid = getAuthUser()?.uid;
        if (!uid || !getSessionToken()) { managementFailed(); return true; }
        const requestId = crypto.randomUUID();
        const timeout = window.setTimeout(() => {
          pendingManagement = null;
          managementFailed();
        }, 15_000);
        pendingManagement = { requestId, timeout };
        postToParent(mobileEmbedAccountManageMessage(uid, requestId));
      } else if (authRequest) {
        // Pointer focus happens before click. Do not leave the iframe keyboard
        // active behind Browser, where it would return after canceling sign-in.
        blurMobileEmbedAuthEntry(event.target);
        postToParent(authRequest);
      }
      return true;
    };

    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (delegateAccountInteraction(event)) return;
      const anchor = target instanceof Element ? target.closest<HTMLAnchorElement>('a[href]') : null;
      if (parentOrigin && (capabilities?.shellNavigation || inlineAccount()) && event.button === 0
        && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
        let destination: 'timer' | 'account' | 'appearance' | 'timer-external' | null = target instanceof Element
          && target.closest('[data-mobile-open-settings="appearance"]') ? 'appearance' : null;
        if (!destination && anchor && !anchor.hasAttribute('download') && (!anchor.target || anchor.target === '_self')) {
          const next = new URL(anchor.href, window.location.href);
          const path = next.pathname.replace(/^\/(en|zh)(?=\/|$)/, '').replace(/\/$/, '') || '/';
          if (next.origin === window.location.origin) {
            if (path === '/timer') {
              const onlyTracking = [...next.searchParams.keys()].every(key => /^utm_/.test(key) || ['gclid', 'fbclid', 'msclkid'].includes(key));
              if (onlyTracking && !next.hash) destination = 'timer';
              // The installed practice picker also uses the Tools surface for online training.
              else if (surface !== 'tools' || !isTimerTraining(next.searchParams)) destination = 'timer-external';
            }
            else if (path === '/appearance' || !inlineAccount() && path === '/account'
              && ['appearance', 'general'].includes(next.searchParams.get('settings') ?? next.searchParams.get('view') ?? '')) destination = 'appearance';
            else if (surface === 'tools' && path === '/account' && !next.hash
              && [...next.searchParams.keys()].every(key => key === 'next')) {
              try {
                const returnTo = new URL(next.searchParams.get('next') || '/', window.location.origin);
                if (returnTo.origin === window.location.origin && !/^\/(?:en\/|zh\/)?(?:auth|api)(?:\/|$)/.test(returnTo.pathname)) destination = 'account';
              } catch { /* Invalid return targets remain owned by the canonical Account route. */ }
            }
          }
        }
        if (destination) {
          event.preventDefault(); event.stopImmediatePropagation();
          postToParent(destination === 'appearance' ? mobileEmbedOpenSettingsMessage(surface)
            : destination === 'timer-external' ? mobileEmbedExternalMessage(surface, anchor!.href)
              : mobileEmbedSelectTabMessage(surface, destination));
          return;
        }
      }
      if (!anchor || anchor.hasAttribute('download')) return;
      const next = new URL(anchor.href, window.location.href);
      if ((installedCommunityDisabled() && isInstalledCommunityHref(next.href)) || installedContentUnavailable(next.href, generativeAiDisabled)) {
        event.preventDefault(); event.stopImmediatePropagation();
        window.alert(tr({ zh: '此内容暂不在 App 中提供。', en: 'This content is not available in the app.' }));
        return;
      }
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
        // The installed shell already positions this iframe below the status bar.
        // WKWebView still exposes its top inset inside the frame; don't apply it twice.
        rootStyle.setProperty('--sat', '0px');
        if (surface === 'account') document.documentElement.setAttribute('data-installed-account-frame', '');
        hostOwnsSafeTop = true;
        parentOrigin = event.origin;
        capabilities = init;
        setInstalledShellNavigation(init.shellNavigation === true || inlineAccount() || init.accountDetailNavigation === true
          ? () => postToParent(mobileEmbedOpenSettingsMessage(surface)) : null, surface, inlineAccount(), init.accountDetailNavigation === true);
        if (init.appearance) applyHostAppearance(init.appearance);
        setInstalledBleBridge(surface === 'tools' && init.bluetooth === true ? event.origin : null);
        setAppleMembershipBridge(init.appleMembership === true, postToParent);
        setStoreMembershipBridge('google', init.googleMembership === true, postToParent);
        setWebMembershipBridge(init.webMembership === true && !init.googleMembership && !init.appleMembership, postToParent);
        postNavigation();
        return;
      }
      if (event.origin !== parentOrigin) return;
      const appearance = decodeMobileEmbedAppearance(event.data);
      if (appearance?.surface === surface) { applyHostAppearance(appearance.preferences); return; }
      receiveAppleMembershipResult(event.data);
      receiveWebMembershipResult(event.data);
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
        if (index === 0) { postNavigation(); return; }
        index = Math.max(0, index - 1);
        postNavigation();
        window.history.back();
        return;
      }

      const clear = decodeMobileEmbedAuthClear(event.data);
      if (surface === 'account' && clear) {
        invalidateWebSession();
        clearingFromHost = true;
        try { authActions.logout(); }
        finally { clearingFromHost = false; }
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
      void exchangeWebSessionTicket(webSession.ticket).then(async (session) => {
        if (!current()) return;
        const persisted = await applySession(session.token, session.user, current);
        if (!current()) return;
        const ok = persisted && current() && Boolean(getSessionToken());
        postToParent(mobileEmbedWebSessionResultMessage(ok, webSession.requestId));
      }).catch(() => {
        if (current()) postToParent(mobileEmbedWebSessionResultMessage(false, webSession.requestId));
      }).finally(() => {
        if (current()) pendingWebTicket = null;
      });
    };
    const unsubscribeAuth = surface === 'account'
      ? subscribeExplicitAuthLogout(() => {
        if (clearingFromHost) return;
        invalidateWebSession();
        postToParent(mobileEmbedAuthClearMessage());
      })
      : () => undefined;

    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('message', onMessage);
    window.addEventListener(APPEARANCE_CHANGE_EVENT, commitAppearance);
    window.addEventListener('theme-change', commitAppearance);
    window.addEventListener('home-background-change', commitAppearance);
    window.addEventListener('storage', restoreHostAppearance);
    return () => {
      active = false;
      document.documentElement.removeAttribute('data-installed-top-bar');
      if (surface === 'tools') {
        document.documentElement.removeAttribute('data-installed-tools-insets');
        applyToolsSearch(undefined, false);
      }
      if (surface === 'account') document.documentElement.removeAttribute('data-installed-account-frame');
      for (const side of ['left', 'right', 'bottom']) rootStyle.removeProperty(`--installed-chrome-${side}`);
      if (hostOwnsSafeTop) rootStyle.setProperty('--sat', previousSafeTop, previousSafeTopPriority);
      setInstalledShellNavigation(null);
      setInstalledBleBridge(null);
      setAppleMembershipBridge(false);
      setStoreMembershipBridge('google', false);
      setWebMembershipBridge(false);
      invalidateWebSession();
      recordRouteRef.current = null;
      if (pendingManagement) window.clearTimeout(pendingManagement.timeout);
      if (window.open === openWindow) window.open = originalOpen;
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('message', onMessage);
      window.removeEventListener(APPEARANCE_CHANGE_EVENT, commitAppearance);
      window.removeEventListener('theme-change', commitAppearance);
      window.removeEventListener('home-background-change', commitAppearance);
      window.removeEventListener('storage', restoreHostAppearance);
      unsubscribeAuth();
    };
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => recordRouteRef.current?.(window.location.href), 0);
    return () => window.clearTimeout(timeout);
  }, [pathname]);

  return null;
}
