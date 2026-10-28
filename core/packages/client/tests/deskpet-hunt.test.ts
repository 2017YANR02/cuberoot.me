// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDeskPetHunt } from '@/lib/deskpet-hunt';

afterEach(() => { vi.useRealTimers(); document.body.replaceChildren(); });

function fixture() {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance', 'requestAnimationFrame', 'cancelAnimationFrame'] });
  const object = document.createElement('object'); document.body.append(object);
  // Read the real fixture from disk; Vite's new URL(asset, import.meta.url)
  // transform otherwise turns this path into an HTTP URL in the jsdom run.
  const source = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../public/deskpet/rootbeast-motion/rootbeast-hunt-rig.svg'), 'utf8');
  const svgDocument = new DOMParser().parseFromString(source, 'image/svg+xml');
  Object.defineProperty(object, 'contentDocument', { value: svgDocument });
  let allowed = true;
  const start = vi.fn(), commit = vi.fn(), rest = vi.fn();
  const hunt = createDeskPetHunt({ object, box: () => ({ left: 400, top: 200, width: 176.4 }),
    travel: () => ({ min: -300, max: 300 }), canStart: () => allowed, interruption: () => null,
    idle: () => ({ time: 0, gx: 0, gy: 0 }), onStart: start, onTravel: vi.fn(), onCommit: commit, onRest: rest });
  const tease = () => { for (let t = 0; t < 5000; t += 32) { hunt.pointer(375 + 25 * Math.sin(t / 140), 312.9); vi.advanceTimersByTime(32); } };
  return { hunt, start, commit, rest, tease, block: () => { allowed = false; } };
}

describe('mouse hunt host lifecycle', () => {
  it('does not run an idle RAF or take over while another owner blocks it', () => {
    const f = fixture(); f.hunt.pointer(0, 0); expect(vi.getTimerCount()).toBe(0);
    f.block(); f.tease(); expect(f.start).not.toHaveBeenCalled(); f.hunt.dispose(); expect(vi.getTimerCount()).toBe(0);
  });
  it('commits its actual movement exactly once on immediate cancellation and clears scheduled work', () => {
    const f = fixture(); f.tease(); expect(f.start).toHaveBeenCalled();
    f.hunt.stop('hard'); expect(f.hunt.active).toBe(false); expect(f.commit).toHaveBeenCalledTimes(1);
    f.hunt.dispose(); expect(f.commit).toHaveBeenCalledTimes(1); expect(vi.getTimerCount()).toBe(0);
  });
  it('runs only the latest deferred action after settling', () => {
    const f = fixture(); f.tease(); expect(f.hunt.active).toBe(true);
    const old = vi.fn(), latest = vi.fn(); f.hunt.stop('soft', old); f.hunt.stop('soft', latest);
    vi.advanceTimersByTime(8000); expect(old).not.toHaveBeenCalled(); expect(latest).toHaveBeenCalledTimes(1);
    f.hunt.dispose(); expect(vi.getTimerCount()).toBe(0);
  });
});
