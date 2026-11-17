import { mobileEmbedSurfaceFromFrameName } from '@cuberoot/shared/mobile-embed';
export function installedWebsiteSurface() {
  return typeof window !== 'undefined' && window.parent !== window ? mobileEmbedSurfaceFromFrameName(window.name) : null;
}
export function isInstalledWebsiteSurface(): boolean {
  return installedWebsiteSurface() !== null;
}
export function installedPetAvailable(id: string): boolean {
  return id !== 'clawd' || !isInstalledWebsiteSurface();
}
