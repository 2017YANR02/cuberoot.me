import { describe, it, expect } from 'vitest';
import { getPuzzleGeometryByName } from '@/lib/puzzle-geometry';
import { PgGroup, type PgWord } from '@/app/[lang]/sim/engine/pgGroup';
import { pyraPgBridge } from '@/app/[lang]/sim/engine/pyra/pyraPgBridge';

// The group-theory core: a Schreier-Sims BSGS *with words*, built on the vendored
// PGTransform algebra. Driven here by the pyraminx engine's 12 generators — 4 tips
// (PG `DRF` family), 4 corners (`DRF·2DRF`) and 4 faces (PG's far slab on the same
// axis). Proves it is constructive, not just a counter: any element factors back into
// a generator word, and uniform sampling is faithful.
describe('PgGroup BSGS factorizer (pyraminx engine generators)', () => {
  const od = getPuzzleGeometryByName('pyraminx', {}).getOrbitsDef(false);
  const gens = pyraPgBridge.engineGens(od);
  const G = new PgGroup(gens);
  const id = gens[0].e();
  const rnd = (len: number): PgWord =>
    Array.from({ length: len }, () => ({ gi: Math.floor(Math.random() * gens.length), inv: Math.random() < 0.5 }));

  it('|G| from the BSGS equals the full pyraminx group (turns + reorientations)', () => {
    expect(gens).toHaveLength(12);
    // Full pyraminx group: the face-turn generators reach the 12 whole-puzzle
    // reorientations, so |G| = 12 × the pure turning group (75,582,720) —
    // exactly PG's precomputed facts order.
    expect(G.order).toBe(906992640n);
  });

  it('factor round-trips: word → elem → factor → elem', () => {
    for (let i = 0; i < 200; i++) {
      const e = G.wordElem(rnd(25));
      expect(G.wordElem(G.factor(e)).equal(e)).toBe(true);
    }
  });

  it('uniform random element is reproduced by its word and by factoring', () => {
    for (let i = 0; i < 200; i++) {
      const { elem, word } = G.randomElement();
      expect(G.wordElem(word).equal(elem)).toBe(true);
      expect(G.wordElem(G.factor(elem)).equal(elem)).toBe(true);
    }
  });

  it('solve identity: state · factor(state⁻¹) = e', () => {
    for (let i = 0; i < 200; i++) {
      const s = G.wordElem(rnd(20));
      expect(s.mul(G.wordElem(G.factor(s.inv()))).equal(id)).toBe(true);
    }
  });

  it('random states are well-spread (sanity: not collapsing to identity)', () => {
    let nonId = 0;
    for (let i = 0; i < 50; i++) if (!G.randomElement().elem.equal(id)) nonId++;
    expect(nonId).toBeGreaterThan(45); // ~50/50 expected for a 907M group
  });
});
