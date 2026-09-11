import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { PaperSkiTrail, skiSurface } from '@/app/[lang]/dev/architecture/history/history-ski-trail';
import type { PaperPalette } from '@/app/[lang]/dev/architecture/history/history-scenery';
import { HISTORY_ENVIRONMENTS } from '@/app/[lang]/dev/architecture/history/history-environment';

const css = readFileSync(new URL('../app/[lang]/dev/architecture/history/history.css', import.meta.url), 'utf8');
const palette = Object.fromEntries([...css.matchAll(/--scroll-(\w+):\s*(#[\da-f]+);/g)].map(([, key, color]) => [key, color])) as PaperPalette;

describe('world-space skiing effects', () => {
  it('leaves each track where it was laid and bounds both pools across long travel', () => {
    const trail = new PaperSkiTrail(palette);
    const tracks = trail.root.getObjectByName('ski-tracks') as T.InstancedMesh;
    const spray = trail.root.getObjectByName('ski-powder') as T.InstancedMesh;
    trail.update(0, 0, false, 'glide', 0, 0, 0, 'snow');
    trail.update(.02, .04, false, 'glide', 0, 0, 0, 'snow');
    const before = new T.Matrix4(); tracks.getMatrixAt(0, before);
    trail.update(.04, .08, false, 'glide', 0, 0, 0, 'snow');
    const after = new T.Matrix4(); tracks.getMatrixAt(0, after);
    expect(new T.Vector3().setFromMatrixPosition(after)).toEqual(new T.Vector3().setFromMatrixPosition(before));
    for (let i = 3; i <= 1000; i++) trail.update(i * .02, i * .04, false, 'glide', 0, 0, 1, 'snow');
    expect(tracks.count).toBe(256); expect(spray.count).toBe(160);
    trail.dispose();
  });

  it('freezes paused effects and clears a seek or switch to walking', () => {
    const trail = new PaperSkiTrail(palette);
    const spray = trail.root.getObjectByName('ski-powder') as T.InstancedMesh;
    trail.update(0, 0, false, 'glide', 0, 0, 0, 'snow');
    trail.update(.02, .04, false, 'glide', 0, 0, 0, 'snow');
    const before = new T.Matrix4(); spray.getMatrixAt(0, before);
    trail.update(20, .04, false, 'glide', 0, 0, 0, 'snow');
    const after = new T.Matrix4(); spray.getMatrixAt(0, after); expect(after).toEqual(before);
    trail.update(20.02, 5, false, 'glide', 0, 0, 0, 'snow'); expect(spray.count).toBe(0);
    trail.update(20.04, 5.04, false, 'glide', 0, 0, 0, 'snow'); expect(spray.count).toBeGreaterThan(0);
    trail.update(20.06, 5.08, false, 'walk', 0, 0, 0, 'snow'); expect(spray.count).toBe(0);
    trail.dispose();
  });

  it('does not leave airborne tracks and emits a single landing burst', () => {
    const trail = new PaperSkiTrail(palette);
    const spray = trail.root.getObjectByName('ski-powder') as T.InstancedMesh;
    const tracks = trail.root.getObjectByName('ski-tracks') as T.InstancedMesh;
    trail.update(0, 0, false, 'glide', 2, 0, 0, 'snow');
    trail.update(.02, .04, false, 'glide', 2, 0, 0, 'snow');
    expect(tracks.count).toBe(0); expect(spray.count).toBe(0);
    trail.update(.04, .08, false, 'glide', 0, 1, 0, 'snow');
    expect(spray.count).toBe(30);
    trail.dispose();
  });

  it('chooses snow, sand and water from canonical terrain and weather', () => {
    const dry = HISTORY_ENVIRONMENTS.findIndex(e => e.ground !== 'ice' && e.ground !== 'snow' && e.ground !== 'sand');
    expect(skiSurface(dry, 'clear')).toBe('paper');
    expect(skiSurface(dry, 'blizzard')).toBe('snow');
    expect(skiSurface(dry, 'sandstorm')).toBe('sand');
    expect(skiSurface(dry, 'monsoon')).toBe('water');
    for (const [day, environment] of HISTORY_ENVIRONMENTS.entries()) {
      if (environment.ground === 'snow' || environment.ground === 'ice') expect(skiSurface(day, 'clear')).toBe('snow');
      if (environment.ground === 'sand') expect(skiSurface(day, 'clear')).toBe('sand');
    }
  });
});
