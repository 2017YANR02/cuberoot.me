import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import manifest from '../public/deskpet/originals/manifest.json';
import { PET_GALLERY } from '@/lib/deskpet-gallery';
import { getDeskPetScene } from '@/lib/deskpet-playtime';

describe('Original pet collection', () => {
  it('preserves all 12 selected characters and gives each exactly two collections of 24', () => {
    expect(manifest.characters.map(c => c.number)).toEqual([11,14,15,18,19,23,25,26,27,38,60,61]);
    expect(manifest.scenes).toHaveLength(576);
    expect(new Set(manifest.scenes.map(s => s.file)).size).toBe(576);
    for (const character of manifest.characters) {
      const scenes = manifest.scenes.filter(s => s.character === character.id);
      expect(scenes, character.id).toHaveLength(48);
      expect(new Set(scenes.map(s => s.id)).size, character.id).toBe(48);
      expect(scenes.filter(s => s.collection === 'daily')).toHaveLength(24);
      expect(scenes.filter(s => s.collection === 'play')).toHaveLength(24);
    }
  });

  it('uses the shared gallery and character-aware player for every animation', () => {
    for (const character of manifest.characters) {
      expect(PET_GALLERY.find(g => g.id === character.id)?.anims, character.id).toHaveLength(48);
    }
    for (const scene of manifest.scenes) {
      const dispatched = getDeskPetScene(`original:${scene.character}:${scene.id}`);
      expect(dispatched?.character, scene.file).toBe(scene.character);
      expect(dispatched?.durationMs).toBe(scene.duration * 1000);
      expect(dispatched?.src).toContain(`/deskpet/originals/${scene.file}?v=`);
    }
    for (const invalid of [null, undefined, {}, [], 1, 'original:fox:missing', 'original:missing:idle', 'original:__proto__:idle']) {
      expect(getDeskPetScene(invalid)).toBeUndefined();
    }
  });

  it.each(manifest.characters)('ships all 48 self-contained animated SVGs for $id', (character) => {
    for (const scene of manifest.scenes.filter(scene => scene.character === character.id)) {
      const svg = readFileSync(resolve('public/deskpet/originals', scene.file), 'utf8');
      expect(svg, scene.file).toContain('viewBox="0 0 240 240"');
      expect(svg, scene.file).toContain(`data-character="${scene.character}"`);
      for (const joint of ['body', 'head', 'left', 'right', 'blink', 'gaze']) {
        expect(svg, scene.file).toContain(`data-joint="${joint}"`);
      }
      expect(svg, scene.file).toContain(` ${scene.duration}s `);
      expect(svg, scene.file).toContain('@media(prefers-reduced-motion:reduce)');
      expect(svg, scene.file).not.toMatch(/NaN|undefined|Infinity|<(?:script|image|foreignObject)\b|(?:href|url\()\s*['"]?https?:/);
      expect(scene.description).toMatch(/[\u4e00-\u9fff]/);
      expect(scene.descriptionEn).toMatch(/[a-z]/i);
    }
  });
});
