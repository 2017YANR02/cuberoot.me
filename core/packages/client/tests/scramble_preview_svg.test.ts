import { describe, expect, it, vi } from 'vitest';

import {
  eventHasScramblePreview,
  renderScramblePreviewSvg,
} from '@/components/scramble-preview-svg';
import { ivyApplyStandard, ivyStandardToCstimer } from '@/lib/ivy-solver';
import { DUO_FACE_COLORS } from '@cuberoot/puzzle-render-core/duo-face';
import { DUO_SVG_ASPECT, renderPyraminxDuoSvg } from '@cuberoot/puzzle-render-core/pyraminx-duo-svg';
import { renderMagicSvg } from '@cuberoot/puzzle-render-core/magic-svg';
import { renderSphereScrambleSvg } from '@cuberoot/puzzle-render-core/sphere-svg';

function duoStickerColors(svg: string): Record<string, string> {
  return Object.fromEntries(Array.from(
    svg.matchAll(/<path\b[^>]*data-face="([0-3])" data-corner="(center|[0-3])"[^>]* fill="([^"]+)"/g),
    ([, face, corner, fill]) => [`${face}/${corner}`, fill],
  ));
}

describe('shared scramble preview SVG renderer', () => {
  it('retains sphere identity through the web and PDF dispatcher', () => {
    expect(eventHasScramblePreview('sphere')).toBe(true);
    const scramble = "R U R' F2";
    const svg = renderScramblePreviewSvg({ event: 'sphere', scramble });
    expect(svg).toMatch(/^<svg\b/);
    expect(svg).toBe(renderSphereScrambleSvg(scramble));
    expect(svg).not.toBe(renderScramblePreviewSvg({ event: '333', scramble }));
    expect(svg).not.toBe(renderScramblePreviewSvg({ event: 'sphere', scramble: '' }));
    expect(renderScramblePreviewSvg({ event: 'sphere', scramble: 'R invalid' })).toBeNull();
  });

  it('uses the simulator Ivy direction convention', () => {
    expect(ivyStandardToCstimer("R L'")).toBe("R' L");
    expect(ivyApplyStandard("R L'")).toEqual({
      centers: [2, 3, 4, 0, 1, 5],
      corners: [1, 2, 0, 0],
    });
  });

  it('solves the tutorial four-center case in two three-center cycles', () => {
    const setup = "D' B' D B L' R' L R";
    expect(ivyApplyStandard(setup).centers.filter((center, index) => center !== index)).toHaveLength(4);
    expect(ivyApplyStandard(`${setup} R' L' R L`).centers.filter((center, index) => center !== index)).toHaveLength(3);
    expect(ivyApplyStandard(`${setup} R' L' R L B' D' B D`)).toEqual({
      centers: [0, 1, 2, 3, 4, 5],
      corners: [0, 0, 0, 0],
    });
  });

  it('renders Ivy through the same registry used by web thumbnails and PDFs', () => {
    expect(eventHasScramblePreview('ivy')).toBe(true);
    const svg = renderScramblePreviewSvg({ event: 'ivy', scramble: "R L'" });
    expect(svg).toMatch(/^<svg\b/);
    expect(svg).toContain('<path');
    expect(svg).toContain('#1463E6');
  });

  it('renders all 16 Duo stickers through the exact shared gen/PDF renderer', () => {
    expect(eventHasScramblePreview('pyraminx_duo')).toBe(true);
    const svg = renderScramblePreviewSvg({ event: 'pyraminx_duo', scramble: "R U' L" });
    expect(svg).toBe(renderPyraminxDuoSvg("R U' L"));
    expect(Object.keys(duoStickerColors(svg!))).toHaveLength(16);
    expect(svg).not.toBe(renderPyraminxDuoSvg(''));
    const [, width, height] = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg!)!;
    expect(Number(width) / Number(height)).toBeCloseTo(DUO_SVG_ASPECT, 5);
  });

  it('keeps the physically clockwise U corner and adjacent centers on the same faces', () => {
    // Looking into U: old blue/right (face 1) → green/front (3), front →
    // red/left (2), left → right. The other corners and yellow base stay put.
    const expectedIds: Record<string, number> = {
      '0/1': 0, '0/3': 0, '0/2': 0, '0/center': 0,
      '1/0': 2, '1/2': 1, '1/3': 1, '1/center': 2,
      '2/0': 3, '2/3': 2, '2/1': 2, '2/center': 3,
      '3/0': 1, '3/1': 3, '3/2': 3, '3/center': 1,
    };
    expect(duoStickerColors(renderPyraminxDuoSvg('U'))).toEqual(
      Object.fromEntries(Object.entries(expectedIds).map(([key, color]) => [key, DUO_FACE_COLORS[color]])),
    );
  });

  it('rejects invalid Duo notation instead of replacing it with a solved image', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      for (const scramble of ['u', 'R U garbage', 'F']) {
        expect(() => renderPyraminxDuoSvg(scramble)).toThrow();
        expect(renderScramblePreviewSvg({ event: 'pyraminx_duo', scramble })).toBeNull();
      }
      expect(renderScramblePreviewSvg({ event: 'pyraminx_duo', scramble: '' })).toBe(renderPyraminxDuoSvg(''));
    } finally {
      warn.mockRestore();
    }
  });

  it.each([
    ['magic', 'Forward', 'Backward'],
    ['mmagic', 'M Forward', 'M Backward'],
  ] as const)('uses the shared %s starting pattern for every practice direction', (event, forward, backward) => {
    expect(eventHasScramblePreview(event)).toBe(true);
    for (const scramble of ['', forward, backward]) {
      const svg = renderScramblePreviewSvg({ event, scramble });
      expect(svg).toMatch(/^<svg\b/);
      expect(svg).toBe(renderMagicSvg(event, scramble));
    }
    expect(renderScramblePreviewSvg({ event, scramble: forward }))
      .not.toBe(renderScramblePreviewSvg({ event, scramble: backward }));
  });

  it('rejects cube moves and the Master prefix on eight-tile Magic instead of drawing a false start', () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      for (const [event, scramble] of [['magic', 'M Forward'], ['magic', 'R U'], ['mmagic', 'R U']] as const) {
        expect(renderScramblePreviewSvg({ event, scramble })).toBeNull();
      }
    } finally {
      warning.mockRestore();
    }
  });
});
