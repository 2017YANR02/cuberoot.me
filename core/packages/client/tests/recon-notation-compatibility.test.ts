import { describe, expect, it, vi } from 'vitest';
import { puzzles } from 'cubing/puzzles';
import { checkReconCompletion, cleanFtoReconAlgForPlayer, parseClockAlgorithm } from '@cuberoot/shared/recon-completion';
import { parsePyraAlgorithm, parsePyraMoves } from '@cuberoot/shared/pyra-notation';
import { parseSkewbAlgorithm } from '@cuberoot/shared/skewb-notation';
import { canonicalSq1Alg, parseSq1Algorithm, parseSq1Tokens, SQ1_PBL_MNEMONIC_GROUPS } from '@cuberoot/shared/sq1-notation';
import { syncReconPlayerCursorFromText } from '@/lib/recon-alg-utils';
import fixtures from './fixtures/recon-notation-compatibility.json';

describe('reconstruction notation compatibility', () => {
  it.each(fixtures)('replays real reconstruction #$id without losing notation', async row => {
    expect(await checkReconCompletion(row)).toEqual({ status: 'solved' });
    const extra = row.event.toLowerCase() === 'clock' ? 'UR1+' : row.event.toLowerCase() === 'sq1' ? '(1,0)' : 'R';
    expect(await checkReconCompletion({ ...row, solution: `${row.solution}\n${extra}` }))
      .toEqual({ status: 'unsolved' });
  });

  it('preserves long corner names, compact moves, detached primes and inverse doubles', () => {
    expect(parseSkewbAlgorithm("UL UR2' F2 B ' z2'").moves)
      .toEqual(parseSkewbAlgorithm("UL UR F' B' z2").moves);
    expect(parsePyraMoves("Lw2'Rv'Ru2" )).toEqual(parsePyraMoves("Lw Rv' R u'"));
    expect(parsePyraMoves("S2 H'" )).toEqual(parsePyraMoves("R' L R L' R' L R L' R' L R L'"));
    expect(parsePyraAlgorithm('foobar').invalid).toEqual(['foobar']);
    expect(parseSkewbAlgorithm("S H' S2").moves).toEqual(
      parseSkewbAlgorithm("F' UL F UL' F' UL F UL' F' UL F UL' F' UL F UL'").moves,
    );
  });

  it.each(['pyra', 'skewb', 'mega'])('retains the direction of %s inverse doubles', async event => {
    expect(await checkReconCompletion({ event, scramble: 'R2', solution: "R2'" })).toEqual({ status: 'solved' });
    expect(await checkReconCompletion({ event, scramble: 'R2', solution: 'R2' })).toEqual({ status: 'unsolved' });
  });

  it.each(['pyra', 'skewb', 'sq1', 'clock'])('does not mark unknown %s tokens solved', async event => {
    const scramble = event === 'sq1' ? '(3,0)' : event === 'clock' ? 'UR1+' : 'R';
    const inverse = event === 'sq1' ? '(-3,0)' : event === 'clock' ? 'UR1-' : "R'";
    expect(await checkReconCompletion({ event, scramble, solution: inverse + ' nonsense' })).toEqual({ status: 'invalid' });
  });

  it('expands only numerically defined SQ1 symbols and retains explicit slice boundaries', () => {
    expect(canonicalSq1Alg("U/u2'/t' W" )).toBe('(3, 0) / (-5, 1) / (-4, 2) (3, 0) / (-3, 0) /');
    for (const entry of SQ1_PBL_MNEMONIC_GROUPS.flatMap(g => g.entries)) {
      if (!/^[0-9, /()\-]+$/.test(entry.expansion)) continue;
      expect(parseSq1Algorithm(entry.symbol).invalid, entry.symbol).toEqual([]);
      expect(parseSq1Tokens(entry.symbol), entry.symbol).toEqual(parseSq1Tokens(entry.expansion));
    }
    for (const text of ['M', "M'", 'm', "m'", 'U4', 'Unknown2', '(1,0) garbage']) {
      expect(parseSq1Algorithm(text).invalid.length).toBeGreaterThan(0);
      expect(parseSq1Tokens(text)).toEqual([]);
    }
    expect(parseSq1Algorithm('(3,0) // M U4\n/').invalid).toEqual([]);
  });

  it('uses the same expanded corner moves for playback and caret scrubbing', () => {
    for (const [kind, text, count] of [['pyra', "x' Lw S", 6], ['skewb', "UL UR2' B '", 3]] as const) {
      const player = { __kind: kind, jumpToMoveCount: vi.fn() };
      syncReconPlayerCursorFromText(player, text);
      expect(player.jumpToMoveCount).toHaveBeenCalledWith(count, false);
      const clean = cleanFtoReconAlgForPlayer(text);
      expect(kind === 'pyra' ? parsePyraMoves(clean).length : parseSkewbAlgorithm(clean).moves.length).toBe(count);
    }
  });

  it('matches an independent published ClockDB simultaneous-wheel reconstruction', async () => {
    // https://clockdb.net/r/171 (Tommy Cherry). Amounts may be signed on either side.
    expect(await checkReconCompletion({ event: 'clock',
      scramble: 'UR6+ DR5- DL4+ UL5+ U2- R4+ D1- L2- ALL1- y2 U2- R4+ D2+ L2- ALL2-',
      solution: 'x2 dl(2-,0+) R2+ DR(2+,3+) \\(6-,5-) UL(2+,1+) L(5+,2+) ur(2-,2+)',
    })).toEqual({ status: 'solved' });
  });

  it('cancels simultaneous clock wheels for every pin mask', async () => {
    const kpuzzle = await puzzles.clock.kpuzzle();
    for (const root of ['UL', 'UR', 'DL', 'DR', 'U', 'R', 'D', 'L', 'ul', 'ur', 'dl', 'dr', '/', '\\']) {
      const parsed = parseClockAlgorithm(`${root}(2,-3) ${root}(-2,3)`);
      expect(parsed.invalid).toBe(false);
      expect(kpuzzle.defaultPattern().applyAlg(parsed.alg).isIdentical(kpuzzle.defaultPattern())).toBe(true);
    }
  });
});
