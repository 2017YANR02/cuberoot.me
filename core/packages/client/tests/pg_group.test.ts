import { describe, it, expect } from 'vitest';
import { getPuzzleGeometryByName } from '@/lib/puzzle-geometry';
import { PgGroup, type PgWord } from '@/app/[lang]/sim/engine/pgGroup';
import { pyraPgBridge } from '@/app/[lang]/sim/engine/pyra/pyraPgBridge';

// The group-theory core: a Schreier-Sims BSGS *with words*, built on the vendored
// PGTransform algebra. Driven here by the pyraminx engine's 8 turning generators
// (tip = PG `DRF`, corner = `DRF·2DRF`). Proves it is constructive, not just a counter:
// any element factors back into a generator word, and uniform sampling is faithful.
describe('PgGroup BSGS factorizer (pyraminx engine generators)', () => {
  const od = getPuzzleGeometryByName('pyraminx', {}).getOrbitsDef(false);
  const gens = pyraPgBridge.engineGens(od);
  const G = new PgGroup(gens);
  const id = gens[0].e();
  const rnd = (len: number): PgWord =>
    Array.from({ length: len }, () => ({ gi: Math.floor(Math.random() * gens.length), inv: Math.random() < 0.5 }));

  it('|G| from the BSGS equals the classic pyraminx turning count', () => {
    expect(gens).toHaveLength(8);
    expect(G.order).toBe(75582720n); // independent of Schreier-Sims, same number
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
    expect(nonId).toBeGreaterThan(45); // ~49/50 expected for a 75M group
  });
});
