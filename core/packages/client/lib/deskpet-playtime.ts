import manifest from '../public/deskpet/playtime/manifest.json';
import { getRootBeastScene } from './deskpet-rootbeast';
import { getOriginalScene } from './deskpet-originals';

// One manifest drives both the gallery and the pet. Bump when SVGs change:
// /deskpet assets are served immutable for one year.
export const PLAYTIME_BASE = '/deskpet/playtime/';
export const PLAYTIME_VERSION = '2';
export const PLAYTIME_SCENES = manifest.map((scene) => ({
  ...scene,
  character: 'clawd' as const,
  state: `playtime:${scene.file.replace(/^\d+-/, '').replace(/\.svg$/, '')}`,
  src: `${PLAYTIME_BASE}${scene.file}?v=${PLAYTIME_VERSION}`,
  durationMs: scene.duration * 1000,
}));

export function getPlaytimeScene(state: unknown) {
  return typeof state === 'string' ? PLAYTIME_SCENES.find((scene) => scene.state === state) : undefined;
}

// The existing story player and pet engine share character-aware dispatch.
export function getDeskPetScene(state: unknown) {
  return getPlaytimeScene(state) ?? getRootBeastScene(state) ?? getOriginalScene(state);
}
