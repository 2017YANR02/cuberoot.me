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
