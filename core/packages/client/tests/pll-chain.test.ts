import { describe, expect, it } from 'vitest';
import pll from '@cuberoot/shared/data/pll.json';
import { CUBE_ORIENTATIONS } from '@cuberoot/shared/timer';
import { applyScramble, toFaceletString } from '@cuberoot/shared/timer/reconstruct/state';
import { invertAlg } from '@cuberoot/shared/alg-transform';
import { faceletToCubie, SOLVED_FACELET } from '@cuberoot/shared/cube-facelet';
import { PllChainAttempt, pllChainBeforeMove, recognizePllOperation } from '@/lib/pll-chain';

function effect(alg: string) {
  const stickers = toFaceletString(applyScramble(3, alg)).split('');
  for (let i = 4; i < 54; i += 9) stickers[i] = SOLVED_FACELET[i];
  return faceletToCubie(stickers.join(''));
}
describe('PLL chain operation recognition', () => {
  it('recognizes all 21 cases with every pre/post AUF and grip', () => {
    for (const [id, { noAuf }] of Object.entries(pll)) {
      for (const { value: grip } of CUBE_ORIENTATIONS) {
        for (const pre of ['', 'U', 'U2', "U'"]) for (const post of ['', 'U', 'U2', "U'"]) {
          const alg = `${grip} ${pre} ${noAuf} ${post} ${invertAlg(grip)}`;
          expect(recognizePllOperation(effect(alg)), alg).toBe(id);
        }
      }
    }
  }, 30_000);
  it('accepts alternative slice algorithms, trailing rotations and cancelling moves', () => {
    const alternatives = {
      H: 'M2 U M2 U2 M2 U M2',
      Ub: "M2 U M U2 M' U M2",
      T: "R U R' U' R' F R2 U' R' U' R U R' F'",
    };
    for (const [id, alg] of Object.entries(alternatives)) for (const { value } of CUBE_ORIENTATIONS) {
      expect(recognizePllOperation(effect(`R R' ${alg} ${value}`))).toBe(id);
    }
    expect(recognizePllOperation(effect(pll.Ua.noAuf))).toBe('Ua');
    expect(recognizePllOperation(effect(pll.Ub.noAuf), 'Ua')).toBeNull();
  });
  it('rejects pure AUF, rotations and damage outside the PLL layer', () => {
    for (const { value } of CUBE_ORIENTATIONS) {
      for (const u of ['', 'U', 'U2', "U'"]) expect(recognizePllOperation(effect(`${value} ${u}`))).toBeNull();
    }
    expect(recognizePllOperation(effect(`D ${pll.T.noAuf}`), 'T')).toBeNull();
    expect(recognizePllOperation(effect(`R ${pll.T.noAuf}`), 'T')).toBeNull();
  });
  it('advances all 21 without pauses and keeps the first move of the next case', () => {
    const order = Object.keys(pll);
    const attempt = new PllChainAttempt(order);
    const moves: { m: string; ts: number }[] = [];
    for (const id of order) {
      for (const move of `U ${pll[id as keyof typeof pll].noAuf} U'`.split(' ')) {
        if (attempt.done) break;
        moves.push({ m: move, ts: moves.length * 50 });
        attempt.move(move);
      }
      expect(attempt.completed, id).toBe(order.indexOf(id) + 1);
    }
    expect(attempt.done).toBe(true);
    const result = attempt.result(moves);
    expect(result.verified).toBe(true);
    expect(result.splits).toHaveLength(21);
    expect(result.splits.at(-1)!.elapsedMs).toBe(moves.at(-1)!.ts);
    expect(result.splits.every(split => split.elapsedMs === moves[split.endMove - 1].ts)).toBe(true);
    expect(attempt.move('R')).toBe(false);
  });
  it('does not skip an unexpected case; undoing the mistake allows recovery', () => {
    const attempt = new PllChainAttempt(['T']);
    for (const move of `${pll.Ua.noAuf} ${invertAlg(pll.Ua.noAuf)}`.split(' ')) attempt.move(move);
    expect(attempt.completed).toBe(0);
    for (const move of pll.T.noAuf.split(' ')) attempt.move(move);
    expect(attempt.completed).toBe(1);
  });
  it('starts from an arbitrary physical state and rejects missing moves', () => {
    const start = toFaceletString(applyScramble(3, "R U F2 L D'"));
    const attempt = new PllChainAttempt(['T'], start);
    let sequence = "R U F2 L D'";
    for (const move of pll.T.noAuf.split(' ')) {
      sequence += ` ${move}`;
      attempt.move(move, toFaceletString(applyScramble(3, sequence)));
    }
    expect(attempt.completed).toBe(1);
    const lost = new PllChainAttempt(['T'], SOLVED_FACELET);
    lost.move('R', toFaceletString(applyScramble(3, 'U R')));
    expect(lost.verified).toBe(false);
    expect(lost.completed).toBe(0);
  });
  it('freezes order and rejects verification after disconnection', () => {
    const order = ['T'];
    const attempt = new PllChainAttempt(order);
    order[0] = 'H';
    attempt.move('R');
    attempt.interrupt();
    for (const move of pll.T.noAuf.split(' ')) attempt.move(move);
    expect(attempt.result([])).toMatchObject({ order: ['T'], verified: false, splits: [] });
  });
  it('recovers the state before the first physical turn', () => {
    for (const move of ['R', "F'", 'U2', "L2'"]) {
      expect(pllChainBeforeMove(toFaceletString(applyScramble(3, `R U ${move}`)), move))
        .toBe(toFaceletString(applyScramble(3, 'R U')));
    }
  });
});
