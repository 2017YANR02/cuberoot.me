import { mobileEmbedSurfaceFromFrameName } from '@cuberoot/shared/mobile-embed';
export function isInstalledWebsiteSurface(): boolean {
  return typeof window !== 'undefined' && window.parent !== window && mobileEmbedSurfaceFromFrameName(window.name) !== null;
}
export function installedPetAvailable(id: string): boolean {
  return id !== 'clawd' || !isInstalledWebsiteSurface();
}
