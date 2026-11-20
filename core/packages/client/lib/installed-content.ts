import { useSyncExternalStore } from 'react';
import { mobileEmbedDisablesGenerativeAi, mobileEmbedSurfaceFromFrameName } from '@cuberoot/shared/mobile-embed';
import { fetchInstalledCommunityAvailability, INSTALLED_COMMUNITY_POLICY_PATH, isInstalledCommunityHref as restrictedCommunityHref } from '@cuberoot/shared/installed-content';
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

export function isInstalledCommunityHref(href: string): boolean {
  return restrictedCommunityHref(href, typeof window === 'undefined' ? undefined : window.location?.origin);
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
    updateForumAvailability(await fetchInstalledCommunityAvailability(INSTALLED_COMMUNITY_POLICY_PATH, controller.signal) === true);
  }
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
    const invalidateAvailability = () => updateForumAvailability(false);
    const onVisibility = () => {
      if (!document.hidden) {
        invalidateAvailability();
        void refreshForumAvailability();
      }
    };
    void refreshForumAvailability();
    window.addEventListener('online', refreshForumAvailability);
    window.addEventListener('offline', invalidateAvailability);
    document.addEventListener('visibilitychange', onVisibility);
    // An active WebView can move between networks without becoming hidden or offline.
    window.setInterval(checkWhenVisible, 60_000);
  }
  return () => { forumListeners.delete(listener); };
}

export function installedCommunityDisabled(): boolean {
  // Current Apple Store builds identify their web surfaces by the no-AI frame names.
  return installedGenerativeAiDisabled() && !forumAvailable;
}

export function useInstalledCommunityDisabled(relevant = true): boolean {
  return useSyncExternalStore(relevant ? subscribeInstalledForum : subscribe,
    relevant ? installedCommunityDisabled : falseSnapshot, falseSnapshot);
}
