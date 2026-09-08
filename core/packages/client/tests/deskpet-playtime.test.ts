import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PET_GALLERY } from '@/lib/deskpet-gallery';
import { getPlaytimeScene, PLAYTIME_SCENES, PLAYTIME_VERSION } from '@/lib/deskpet-playtime';

describe('Clawd playtime integration', () => {
  it('makes all 30 gallery entries addressable by the pet without duplicating the manifest', () => {
    expect(PLAYTIME_SCENES).toHaveLength(30);
    expect(new Set(PLAYTIME_SCENES.map((scene) => scene.state)).size).toBe(30);
    expect(PET_GALLERY.some((group) => group.id === 'playtime')).toBe(false);
    const clawd = PET_GALLERY.find((group) => group.id === 'clawd')!;
    expect(clawd.anims.filter((animation) => animation.state)).toEqual(PLAYTIME_SCENES);
    expect(clawd.anims.slice(-30)).toEqual(PLAYTIME_SCENES);
    for (const scene of PLAYTIME_SCENES) {
      expect(getPlaytimeScene(scene.state)).toBe(scene);
      expect(scene.durationMs).toBe(8000);
      expect(scene.src).toBe(`/deskpet/playtime/${scene.file}?v=${PLAYTIME_VERSION}`);
    }
  });

  it('rejects malformed events, paths, and inherited object keys', () => {
    for (const invalid of [undefined, null, '', {}, [], 0, 'constructor', '__proto__', 'playtime:missing', '../01-bubblegum.svg']) {
      expect(getPlaytimeScene(invalid)).toBeUndefined();
    }
  });

  it('ships every scene with normal pixel eyes and no external SVG dependencies', () => {
    for (const scene of PLAYTIME_SCENES) {
      const svg = readFileSync(resolve('public/deskpet/playtime', scene.file), 'utf8');
      expect(svg, scene.file).toContain('width="1" height="2"');
      // The rejected surprise face had cream eye frames at these coordinates.
      expect(svg, scene.file).not.toContain('x="3.5" y="7.5" width="2" height="3" fill="#FFF0CE"');
      expect(svg, scene.file).not.toMatch(/<(?:script|image|foreignObject|use)\b|(?:href|url\()\s*['"]?https?:/);
    }
  });
});
