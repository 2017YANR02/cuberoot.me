import { describe, expect, it } from 'vitest';
import { DEFAULT_SQ1_COLORS, renderSq1ScrambleSvg } from '@/lib/sq1-svg';
import { sq1Stage, sq1StageHiddenStickerIds } from '@/lib/sq1-stage-mask';
import { pieceGroups } from '@/lib/puzzle-image/puzzle-mask';
import Sq1Cube from '@/app/[lang]/sim/engine/sq1/Sq1Cube';
import { FM_FIXED_COLOR, FM_IGNORED } from '@/app/[lang]/sim/engine/nxn/stickering';
import { resolveCaps } from '@/app/[lang]/sim/simCaps';
import type * as THREE from 'three';

const SIDE_COLORS = [
  DEFAULT_SQ1_COLORS.L,
  DEFAULT_SQ1_COLORS.B,
  DEFAULT_SQ1_COLORS.R,
  DEFAULT_SQ1_COLORS.F,
];

function planSvg(stage: string): string {
  const ids = sq1StageHiddenStickerIds(stage)!;
  return renderSq1ScrambleSvg('', DEFAULT_SQ1_COLORS, {
    mask: { ids, color: 'transparent' },
  }, false);
}

describe('SQ1 stage masks', () => {
  it('exposes the stage selector in the SQ1 simulator', () => {
    expect(resolveCaps('sq1', 'group').supports.stickering).toBe(true);
  });

  it('accepts set slugs case-insensitively and rejects unrelated sets', () => {
    expect(sq1Stage('co')).toBe('CO');
    expect(sq1Stage('EP')).toBe('EP');
    expect(sq1Stage('obl')).toBe('EO');
    expect(sq1StageHiddenStickerIds('obl')).toEqual(sq1StageHiddenStickerIds('EO'));
    expect(sq1Stage('cs')).toBeNull();
    expect(sq1Stage('parity')).toBeNull();
  });

  it('keeps only the expected physical-piece stickers', () => {
    const total = pieceGroups('sq1').flat().length;
    expect(total).toBe(46);
    expect(total - sq1StageHiddenStickerIds('CO')!.size).toBe(8);
    expect(total - sq1StageHiddenStickerIds('EO')!.size).toBe(16);
    expect(total - sq1StageHiddenStickerIds('CP')!.size).toBe(32);
    expect(total - sq1StageHiddenStickerIds('EP')!.size).toBe(40);
    for (const stage of ['CO', 'EO', 'CP', 'EP']) {
      expect([...sq1StageHiddenStickerIds(stage)!].filter((sid) => sid.startsWith('M'))).toHaveLength(6);
    }
  });

  it('reveals stickers cumulatively from CO through EP', () => {
    const hidden = ['CO', 'EO', 'CP', 'EP'].map((stage) => sq1StageHiddenStickerIds(stage)!);
    for (let i = 1; i < hidden.length; i++) {
      expect([...hidden[i]].every((sid) => hidden[i - 1].has(sid))).toBe(true);
    }
  });

  it('CO and EO plan images contain only white/yellow stickers and no equator', () => {
    for (const stage of ['CO', 'EO']) {
      const svg = planSvg(stage);
      expect(svg.match(/<path /g)).toHaveLength(stage === 'CO' ? 8 : 16);
      expect(svg).not.toContain('fill="none"');
      expect(svg).toContain(DEFAULT_SQ1_COLORS.U);
      expect(svg).toContain(DEFAULT_SQ1_COLORS.D);
      for (const color of SIDE_COLORS) expect(svg).not.toContain(color);
      expect(svg).not.toContain('<rect');
      expect(svg).not.toContain('transparent');
      expect(svg).not.toMatch(/<path d="[^"]* Z" fill="none"/);
    }
  });

  it('CP deletes masked side blocks while EP remains fully visible', () => {
    expect(planSvg('CP').match(/<path /g)).toHaveLength(32);
    expect(planSvg('EP').match(/<path /g)).toHaveLength(40);
    expect(planSvg('CP')).not.toContain('fill="none"');
    expect(planSvg('EP')).not.toContain('fill="none"');
    expect(planSvg('CP')).not.toContain('transparent');
    expect(planSvg('EP')).not.toContain('transparent');
    expect(planSvg('CP')).not.toMatch(/<path d="[^"]* Z" fill="none"/);
  });

  it('the 3D puzzle grays masked stickers and full restores their original colors', () => {
    const cube = new Sq1Cube();
    cube.setStickering('CO');
    let gray = 0;
    let colored = 0;
    cube.traverse((obj) => {
      if (!obj.userData.stickerKey) return;
      const material = (obj as THREE.Mesh).material as THREE.MeshPhongMaterial;
      if (`#${material.color.getHexString()}` === FM_FIXED_COLOR[FM_IGNORED]) gray++;
      else colored++;
    });
    expect({ gray, colored }).toEqual({ gray: 38, colored: 8 });

    cube.setStickering('full');
    cube.traverse((obj) => {
      if (!obj.userData.stickerKey) return;
      const material = (obj as THREE.Mesh).material as THREE.MeshPhongMaterial;
      expect(`#${material.color.getHexString()}`).not.toBe(FM_FIXED_COLOR[FM_IGNORED]);
    });
    cube.dispose();
  });
});
