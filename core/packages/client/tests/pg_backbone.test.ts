import { describe, it, expect } from 'vitest';
import { PgBackbone } from '@/app/[lang]/sim/engine/pgBackbone';

// The binding layer's group-theory kernel, driven through PG move names (the bridge
// from our PyraMove lives in the integration layer). Proves the maintained state is a
// faithful group element and the facts match the vendored Schreier-Sims results.
describe('PgBackbone (pyraminx)', () => {
  it('starts solved; a move then its inverse returns to solved', () => {
    const b = new PgBackbone('pyraminx');
    expect(b.solved).toBe(true);
    expect(b.applyMoveName('2DRF')).toBe(true);
    expect(b.solved).toBe(false);
    b.applyMoveName('2DRF', true); // inverse
    expect(b.solved).toBe(true);
  });

  it('a 2-layer turn has order 3', () => {
    const b = new PgBackbone('pyraminx');
    b.applyMoveName('2DRF');
    b.applyMoveName('2DRF');
    expect(b.solved).toBe(false);
    b.applyMoveName('2DRF');
    expect(b.solved).toBe(true); // 120° × 3 = identity
  });

  it('reset clears an arbitrary scramble', () => {
    const b = new PgBackbone('pyraminx');
    for (const m of ['2DRF', '2DFL', 'DLR', '2FRL', 'L']) b.applyMoveName(m);
    expect(b.solved).toBe(false);
    b.reset();
    expect(b.solved).toBe(true);
  });

  it('unknown move name is rejected', () => {
    const b = new PgBackbone('pyraminx');
    expect(b.applyMoveName('NOPE')).toBe(false);
    expect(b.solved).toBe(true);
  });

  it('exposes exact group facts via Schreier-Sims', () => {
    const f = new PgBackbone('pyraminx').facts();
    expect(f.order).toBe(906992640n);
    expect(f.reassembly).toBe(174142586880n);
    expect(f.index).toBe(192n);
    expect(f.orbits).toEqual([
      { name: 'EDGES', pieces: 6, oriMod: 2 },
      { name: 'CORNERS', pieces: 4, oriMod: 3 },
      { name: 'CORNERS2', pieces: 4, oriMod: 3 },
    ]);
    expect(f.moveNames).toHaveLength(12);
  });
});
