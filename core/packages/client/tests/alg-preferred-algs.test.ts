import { describe, expect, it } from 'vitest';
import type { AlgCase, AlgEntry } from '@cuberoot/shared';
import { mirrorMoveString } from '@cuberoot/shared/alg-mirror';
import {
  findPreferredAlg,
  newerPreferredAlgs,
  nonPreferredSolutions,
  preferredAlgRef,
  preferredAlgSlot,
  sortPreferredAlgs,
} from '@/lib/alg-preferred-algs';
import { generateScramble } from '@/lib/trainer-scramble';

const sticker: AlgCase['sticker'] = {
  kind: 'face', us: '', ub: '', uf: '', ul: '', ur: '',
};

const entry = (alg: string, altId?: string): AlgEntry => ({ alg, altId });

describe('primary algorithm preferences', () => {
  it('uses altId when available and normalized text otherwise', () => {
    expect(preferredAlgRef(entry('R  U', ' main '))).toBe('id:main');
    expect(preferredAlgRef(entry(' R   U '))).toBe('alg:R U');
    expect(preferredAlgSlot({ subgroup: 'U', name: 'Ua' }, 2)).toBe('U|Ua::2');
  });

  it('pins the preferred entry without losing its canonical database index', () => {
    const entries = [entry('R'), entry('U', 'main'), entry('F')];
    const ref = preferredAlgRef(entries[1]);
    expect(findPreferredAlg(entries, ref)).toBe(entries[1]);
    expect(sortPreferredAlgs(entries, ref)).toEqual([
      { entry: entries[1], originalIndex: 1 },
      { entry: entries[0], originalIndex: 0 },
      { entry: entries[2], originalIndex: 2 },
    ]);
  });

  it('uses cloud on a tie and otherwise keeps the newer whole snapshot', () => {
    const local = { items: { a: 'alg:R' }, updatedAt: 10 };
    const cloud = { items: { a: 'alg:U' }, updatedAt: 10 };
    expect(newerPreferredAlgs(local, cloud)).toBe(cloud);
    expect(newerPreferredAlgs({ ...local, updatedAt: 11 }, cloud)).toEqual({ ...local, updatedAt: 11 });
  });

  it('builds anti-recognition candidates from other formulas and the mirror case', () => {
    const current: AlgCase = {
      name: 'Ua', subgroup: 'U', setup: '', sticker,
      algs: [[entry("R U R'", 'main'), entry("F U F'")]],
      meta: { no: 1, ollcp: '', subset: '', oll: '', cp: '', mirror: 2 },
    };
    const partner: AlgCase = {
      name: 'Ub', subgroup: 'U', setup: '', sticker,
      algs: [[entry("L U L'")]],
      meta: { no: 2, ollcp: '', subset: '', oll: '', cp: '', mirror: 1 },
    };
    const candidates = nonPreferredSolutions(current, [current, partner], 'id:main');
    expect(candidates).toEqual(["F U F'", mirrorMoveString("L U L'", 'M')]);
    expect(candidates).not.toContain("R U R'");
  });

  it('takes the inverse of an alternate solution instead of the stored setup', () => {
    const c: AlgCase = {
      name: 'test', subgroup: 'T', setup: 'F2', sticker,
      algs: [[entry('R2')]],
    };
    expect(generateScramble(c, '3x3', 'htm', {
      preAuf: false,
      postAuf: false,
      alternativeSolutions: ["R U R'"],
    })).toBe("R U' R'");
  });
});
