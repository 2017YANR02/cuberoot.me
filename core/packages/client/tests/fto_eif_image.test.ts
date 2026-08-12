import { describe, expect, it } from 'vitest';
import type { AlgSticker } from '@cuberoot/shared';
import {
  DEFAULT_FTO_EIF_PALETTE,
  ftoEifState,
  invertFtoEifAlgorithm,
  isFtoEifSolved,
  parseFtoEifAlgorithm,
  renderFtoEifSvg,
} from '@/lib/fto-eif-image';
import { FTO_DRAW_ELEMENTS } from '@/lib/fto-draw-elements';
import { validateAlgCase } from '@/lib/alg_validation';
import { createFtoSeekPlayer } from '@/components/AlgPlayer/FtoEifAlgPlayer';
import { syncPlayerToMoveCount } from '@/lib/recon-alg-utils';

const RAW_STICKER: AlgSticker = { kind: 'raw', tag: 'lowcubes-fto', attrs: {} };

describe('FTO EIF image engine', () => {
  it('accepts every documented move family and rejects case or suffix drift', () => {
    const documented = "F R L U D Bl Br B Fw Rw Lw Uw Dw Blw Brw Bw Fs Rs Ls Us Fo Ro Lo Uo Rt Lt Ft S H F' R2 Rt2'";
    expect(parseFtoEifAlgorithm(documented).invalid).toEqual([]);
    expect(parseFtoEifAlgorithm('bl S2 Uo2 nope').invalid).toEqual(['bl', 'S2', 'Uo2', 'nope']);
  });

  it('round-trips mixed simple, wide, middle, rotation, and macro moves', () => {
    const alg = "Uo' U Rw2 R' S H' Ft2 Blw Fs'";
    const setup = invertFtoEifAlgorithm(alg);
    expect(parseFtoEifAlgorithm(setup).invalid).toEqual([]);
    expect(isFtoEifSolved(`${setup} ${alg}`)).toBe(true);
    expect(isFtoEifSolved('R')).toBe(false);
  });

  it('does not sanitize unsupported tokens while inverting', () => {
    const inverse = invertFtoEifAlgorithm("S2 H2 Uo2 R''");
    expect(parseFtoEifAlgorithm(inverse).invalid).toEqual(["R''", 'Uo2', 'H2', 'S2']);
  });

  it('exposes EIF-token seeking through the shared admin player handle', async () => {
    const steps: number[] = [];
    const player = createFtoSeekPlayer(5, step => steps.push(step));
    syncPlayerToMoveCount(player, 3);
    await Promise.resolve();
    await Promise.resolve();
    expect(steps).toEqual([3]);

    syncPlayerToMoveCount(player, 9);
    await Promise.resolve();
    await Promise.resolve();
    expect(steps).toEqual([3, 5]);
  });

  it("preserves LowCubes' special 2-prime normalization", () => {
    expect(ftoEifState("R2'")).toEqual(ftoEifState('R'));
    expect(ftoEifState("Rt2'")).toEqual(ftoEifState('Rt2'));
  });

  it('renders the shared 72-sticker geometry with a transparent SVG canvas', () => {
    const palette = { ...DEFAULT_FTO_EIF_PALETTE, f: '#123456', stroke: '#654321' };
    const svg = renderFtoEifSvg('', palette, { title: 'FTO <case>' });
    expect(svg.match(/<path\b/g)).toHaveLength(FTO_DRAW_ELEMENTS.length);
    expect(svg).toContain('viewBox="0 0 279.92 301.94"');
    expect(svg).toContain('fill="#123456"');
    expect(svg).toContain('stroke="#654321"');
    expect(svg).toContain('<title>FTO &lt;case&gt;</title>');
    expect(svg).not.toContain('<rect');
  });

  it('uses the same strict state engine for database validation', async () => {
    const alg = 'U S F';
    const setup = invertFtoEifAlgorithm(alg);
    await expect(validateAlgCase(setup, alg, RAW_STICKER, 'fto', 'pf'))
      .resolves.toEqual({ ok: true, auf: '' });
    await expect(validateAlgCase(setup, 'U BAD F', RAW_STICKER, 'fto', 'pf'))
      .resolves.toMatchObject({ ok: false });
    await expect(validateAlgCase('', alg, RAW_STICKER, 'fto', 'pf'))
      .resolves.toMatchObject({ ok: false });
  });
});
