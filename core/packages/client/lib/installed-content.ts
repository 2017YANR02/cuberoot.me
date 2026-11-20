import { useSyncExternalStore } from 'react';
import { mobileEmbedDisablesGenerativeAi, mobileEmbedSurfaceFromFrameName } from '@cuberoot/shared/mobile-embed';
export function installedWebsiteSurface() {
  return typeof window !== 'undefined' && window.parent !== window ? mobileEmbedSurfaceFromFrameName(window.name) : null;
}
export function isInstalledWebsiteSurface(): boolean {
  return installedWebsiteSurface() !== null;
}
export function installedPetAvailable(id: string): boolean {
  return id !== 'clawd' || !isInstalledWebsiteSurface();
}

const subscribe = () => () => {};
const falseSnapshot = () => false;

export function installedGenerativeAiDisabled(): boolean {
  return typeof window !== 'undefined' && window.parent !== window
    && mobileEmbedDisablesGenerativeAi(window.name);
}

export function useInstalledGenerativeAiDisabled(): boolean {
  return useSyncExternalStore(subscribe, installedGenerativeAiDisabled, falseSnapshot);
}

export function isInstalledForumHref(href: string): boolean {
  const origin = typeof window === 'undefined' ? 'https://cuberoot.me' : window.location.origin;
  try {
    const url = new URL(href, origin);
    if (url.origin !== origin && !['cuberoot.me', 'www.cuberoot.me', 'next.cuberoot.me', 'dev.cuberoot.me'].includes(url.hostname)) return false;
    return /^\/(?:forum|platform\/(?:community|admin\/community))(?=\/|$)/
      .test(decodeURIComponent(url.pathname).replace(/^\/(?:en|zh)(?=\/|$)/, ''));
  } catch { return false; }
}

let forumAvailable = false;
let regionCheckStarted = false;
let regionCheckPending = false;
const forumListeners = new Set<() => void>();

function updateForumAvailability(available: boolean) {
  if (available === forumAvailable) return;
  forumAvailable = available;
  forumListeners.forEach(listener => listener());
}

async function refreshForumAvailability() {
  if (regionCheckPending) return;
  regionCheckPending = true;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch('/api/installed-forum', {
      cache: 'no-store', credentials: 'omit', redirect: 'error', signal: controller.signal,
    });
    updateForumAvailability(response.ok && (await response.json())?.available === true);
  } catch { updateForumAvailability(false); }
  finally {
    window.clearTimeout(timeout);
    regionCheckPending = false;
  }
}

function subscribeInstalledForum(listener: () => void) {
  if (!installedGenerativeAiDisabled()) return () => {};
  forumListeners.add(listener);
  if (!regionCheckStarted) {
    regionCheckStarted = true;
    const checkWhenVisible = () => {
      if (!document.hidden) void refreshForumAvailability();
    };
    void refreshForumAvailability();
    window.addEventListener('online', refreshForumAvailability);
    document.addEventListener('visibilitychange', checkWhenVisible);
    // An active WebView can move between networks without becoming hidden or offline.
    window.setInterval(checkWhenVisible, 60_000);
  }
  return () => { forumListeners.delete(listener); };
}

export function installedForumDisabled(): boolean {
  // Current Apple Store builds identify their web surfaces by the no-AI frame names.
  return installedGenerativeAiDisabled() && !forumAvailable;
}

export function useInstalledForumDisabled(relevant = true): boolean {
  return useSyncExternalStore(relevant ? subscribeInstalledForum : subscribe,
    relevant ? installedForumDisabled : falseSnapshot, falseSnapshot);
}
