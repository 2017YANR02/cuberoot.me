import { describe, expect, it } from 'vitest';
import { buildSimpleOptions, renderCubeSVG } from '@cuberoot/visualcube';
import { renderStageThumbnail } from '@/lib/sim-stage-thumbnail';
import { CUBE_FILL } from '@/lib/cube-colors';
import { STAGE_SECTIONS } from '@/lib/puzzle-image/masks';
import { FM_REGULAR, FM_IGNORED, stickeringMaskFn } from '@/app/[lang]/sim/engine/nxn/stickering';
import { resolveStageMaskFn, stickeringSelectGroupsFor, stickeringValueForVcMask } from '@/app/[lang]/sim/engine/nxn/vcStageMask';

describe('stage menu thumbnails', () => {
  it('makes every former catalog card reachable through the stage menu', () => {
    for (const section of STAGE_SECTIONS) {
      const choices = stickeringSelectGroupsFor(section.cubeSize).flatMap(group => group.items);
      for (const item of section.items) {
        expect(choices, `${section.cubeSize}: ${item.mask}`).toContain(stickeringValueForVcMask(section.cubeSize, item.mask));
      }
    }
  });

  it('places the URF corner on the correct three facelets', () => {
    const colors = new Array<string>(54).fill('#666666');
    colors[8] = CUBE_FILL.U;
    colors[9] = CUBE_FILL.R;
    colors[20] = CUBE_FILL.F;
    const expected = renderCubeSVG({ ...buildSimpleOptions({ case: '', view: 'trans', pzl: 3, size: 64 }), stickerColors: colors });
    expect(renderStageThumbnail(3, initial => initial === 26 ? FM_REGULAR : FM_IGNORED)).toBe(expected);
  });

  it('renders every catalog fixture and every built-in stage for the supported orders', () => {
    const entries = STAGE_SECTIONS.flatMap(section => section.items.map(item => [section.cubeSize, item.mask] as const));
    for (const order of [2, 3, 4, 5, 6, 7, 9]) {
      entries.push(...stickeringSelectGroupsFor(order).flatMap(group => group.items.map(name => [order, name] as const)));
    }
    for (const [order, name] of entries) {
      const svg = renderStageThumbnail(order, stickeringMaskFn(order, name) ?? resolveStageMaskFn(order, name));
      expect(svg, `${order}: ${name}`).toContain('<svg');
      expect(svg, `${order}: ${name}`).not.toMatch(/NaN|undefined/);
    }
  });
});
