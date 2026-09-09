import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PET_GALLERY } from '@/lib/deskpet-gallery';
import { getDeskPetScene, PLAYTIME_SCENES } from '@/lib/deskpet-playtime';
import { getRootBeastScene, ROOTBEAST_AUTO, ROOTBEAST_COLLECTIONS, ROOTBEAST_FILES, ROOTBEAST_MINI_FILES, ROOTBEAST_RANDOM_SCENES, ROOTBEAST_SCENES, ROOTBEAST_VERSION } from '@/lib/deskpet-rootbeast';

describe('Root Beast animation integration', () => {
  it('exposes independent loops through the same gallery and pet manifest', () => {
    expect(ROOTBEAST_SCENES).toHaveLength(51);
    expect(new Set(ROOTBEAST_SCENES.map(scene => scene.state)).size).toBe(ROOTBEAST_SCENES.length);
    expect(PET_GALLERY.find(group => group.id === 'rootbeast')?.anims).toEqual(ROOTBEAST_SCENES);
    expect(readdirSync(resolve('public/deskpet/rootbeast')).filter(file => file.endsWith('.svg'))).toHaveLength(ROOTBEAST_SCENES.length);
    const choreography = new Set<string>();
    for (const scene of ROOTBEAST_SCENES) {
      expect(getDeskPetScene(scene.state)).toBe(scene);
      expect(scene.character).toBe('rootbeast');
      expect(scene.src).toBe(`/deskpet/rootbeast/${scene.file}?v=${ROOTBEAST_VERSION}`);
      expect(scene.durationMs).toBe(scene.duration * 1000);
      expect(scene.duration).toBeGreaterThanOrEqual(1.6);
      expect(scene.duration).toBeLessThanOrEqual(5.4);
      expect(scene.poster).toBeGreaterThan(0);
      expect(scene.poster).toBeLessThan(1);
      const svg = readFileSync(resolve('public/deskpet/rootbeast', scene.file), 'utf8');
      expect(svg, scene.file).toContain(`data-rootbeast="${scene.id}"`);
      expect(svg, scene.file).toContain('prefers-reduced-motion:reduce');
      expect(svg, scene.file).toContain('viewBox="0 0 640 640"');
      // <img> rendering must composite the white underpaint and colored skin
      // before strip clipping; <object>-only previews hide this regression.
      expect([...svg.matchAll(/data-shell-strip="\d+" clip-path="[^"]+"><g filter="url\(#rb-skin-/g)], scene.file).toHaveLength(8);
      expect(svg, scene.file).not.toMatch(/<(?:script|image|foreignObject|video|canvas)\b|(?:href=["']|url\(["']?)(?:https?:|data:)/);
      // Duplicate clip IDs made pupils disappear when an emotion reused an eye.
      const ids = [...svg.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
      const targets = new Set(ids);
      expect(targets.size, scene.file).toBe(ids.length);
      for (const reference of svg.matchAll(/href="#([^"]+)"|url\(#([^)]*)\)/g)) {
        expect(targets.has(reference[1] ?? reference[2]), scene.file).toBe(true);
      }
      // Ignore per-file identifiers and common traced outlines: a rename of one
      // loop cannot masquerade as a different animation.
      const timeline = svg.match(/<style>([\s\S]*?)<\/style>/)![1].replace(/rb\d+-\d+/g, 'animation');
      choreography.add(createHash('sha256').update(timeline).digest('hex'));
    }
    expect(choreography.size).toBe(ROOTBEAST_SCENES.length);
  });

  it('keeps the traced head rounded through every generated turn', () => {
    for (const scene of ROOTBEAST_SCENES) {
      const svg = readFileSync(resolve('public/deskpet/rootbeast', scene.file), 'utf8');
      const scales = [0, 7].map(strip => {
        const animation = svg.match(new RegExp(`<g class="([^"]+)"><g data-shell-strip="${strip}"`))![1];
        const keyframes = svg.slice(svg.indexOf(`@keyframes ${animation}{`)).split('\n')[0];
        return [...keyframes.matchAll(/transform:matrix\(([\d.]+),/g)].map(match => Number(match[1]));
      });
      expect(scales[0].length, scene.id).toBe(scales[1].length);
      expect(scales[0].length, scene.id).toBeGreaterThan(1);
      for (let i = 0; i < scales[0].length; i++) {
        // The old 55-degree teaching pose stretched the flank 3.19 times
        // more than the face; profile poses exceeded 20 times.
        expect(scales[1][i] / scales[0][i], `${scene.id} pose ${i}`).toBeLessThanOrEqual(1.651);
        expect(Math.min(scales[0][i], scales[1][i]), scene.id).toBeGreaterThan(0);
      }
      if (scene.id === 'teaching') expect(scales[0][1]).toBe(.8429);
    }
  });

  it('groups two complete WeChat releases without duplicates and keeps the rest as candidates', () => {
    expect(ROOTBEAST_COLLECTIONS.map(item => item.id)).toEqual(['daily', 'adventures', 'candidates']);
    const releases = ROOTBEAST_COLLECTIONS.filter(item => item.id !== 'candidates');
    for (const release of releases) expect(release.sceneIds, release.id).toHaveLength(24);
    expect(ROOTBEAST_COLLECTIONS.find(item => item.id === 'candidates')?.sceneIds).toEqual(['idle', 'walk', 'stretch']);
    const ids = ROOTBEAST_COLLECTIONS.flatMap(item => item.sceneIds);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual(ROOTBEAST_SCENES.map(scene => scene.id).sort());
    expect(ROOTBEAST_COLLECTIONS.find(item => item.id === 'adventures')?.sceneIds).toContain('cube-pop');
  });

  it('ships real turning layers and detached edge pieces wherever a puzzle appears', () => {
    for (const id of ['inspection', 'cubing', 'pop', 'teaching', 'cube-pop']) {
      const scene = getRootBeastScene(`rootbeast:${id}`)!;
      const svg = readFileSync(resolve('public/deskpet/rootbeast', scene.file), 'utf8');
      expect(svg, id).toContain('data-turning-cube="U"');
      expect(svg, id).toContain('data-cube-base="fixed"');
      expect(svg, id).toMatch(/data-turn-angle="-?7\.5"/);
      expect(svg, id).not.toContain('data-solve-steps=');
      if (id === 'pop' || id === 'cube-pop') expect(svg, id).toContain('data-cube-piece="UF"');
    }
  });

  it('resolves all interaction, rest and edge-cling poses to shipped animations', () => {
    const files = new Set(ROOTBEAST_SCENES.map(scene => scene.file));
    for (const file of [...Object.values(ROOTBEAST_FILES), ...Object.values(ROOTBEAST_MINI_FILES)]) expect(files.has(file), file).toBe(true);
    for (const [state, duration] of Object.entries(ROOTBEAST_AUTO)) {
      expect(duration).toBe(ROOTBEAST_SCENES.find(scene => scene.file === ROOTBEAST_FILES[state])?.durationMs);
    }
    expect(ROOTBEAST_RANDOM_SCENES.every(scene => scene.character === 'rootbeast')).toBe(true);
    expect(ROOTBEAST_RANDOM_SCENES.some(scene => ['sleeping', 'drag', 'annoyed'].includes(scene.id))).toBe(false);
    for (const scene of PLAYTIME_SCENES) expect(getDeskPetScene(scene.state)).toBe(scene);
  });

  it('keeps quick gestures distinct from breathing and synchronizes the timer loop', () => {
    const seconds = (id: string) => getRootBeastScene(`rootbeast:${id}`)?.duration;
    expect(seconds('walk')).toBe(1.6);
    expect(seconds('hello')).toBe(2.8);
    expect(seconds('happy')).toBe(2.4);
    expect(seconds('double-jump')).toBe(2.6);
    expect(seconds('idle')).toBe(5.4);
    expect(seconds('sleeping')).toBe(4.8);
    expect(seconds('timer')).toBe(4);
    // At 81% of the loop, 1.36 real seconds have elapsed since paws-off at 47%.
    // Digit strips must stop at 1.36, rather than replaying the old 2.72 count.
    const timer = readFileSync(resolve('public/deskpet/rootbeast', getRootBeastScene('rootbeast:timer')!.file), 'utf8');
    for (const [place, value] of [[100, 1], [10, 3], [1, 6]]) {
      const animation = timer.match(new RegExp(`data-timer-digit="${place}"><g class="([^"]+)"`))![1];
      const keyframes = timer.slice(timer.indexOf(`@keyframes ${animation}{`)).split('\n')[0];
      expect(keyframes).toContain(`96%{transform:translate(0px,${-30 * value}px)`);
    }
  });

  it('rejects unknown, malformed and cross-character scene identifiers', () => {
    for (const invalid of [undefined, null, {}, [], 0, '__proto__', 'constructor', '../idle.svg', 'rootbeast:missing', 'playtime:idle']) {
      expect(getRootBeastScene(invalid)).toBeUndefined();
    }
    expect(getDeskPetScene('rootbeast:missing')).toBeUndefined();
    expect(getRootBeastScene(PLAYTIME_SCENES[0].state)).toBeUndefined();
  });
});
