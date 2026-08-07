import { describe, expect, it } from 'vitest';
import { renderCubeSVG } from '@cuberoot/visualcube';

const SOLVED = 'u'.repeat(9) + 'r'.repeat(9) + 'f'.repeat(9)
  + 'd'.repeat(9) + 'l'.repeat(9) + 'b'.repeat(9);

const COLOR = {
  u: '#FEFE00', r: '#00D800', f: '#EE0000',
  d: '#FFFFFF', l: '#0000F2', b: '#FFA100',
} as const;

function stickerFillAt(svg: string, x: number, y: number): string | undefined {
  const stickers = [...svg.matchAll(/<polygon points="([^"]+)" fill="([^"]+)"/g)];
  const inset = 0.07;
  return stickers.find((match) => {
    const [first] = match[1].split(' ');
    const [px, py] = first.split(',').map(Number);
    return Math.abs(px - (x + inset)) < 1e-9 && Math.abs(py - (y + inset)) < 1e-9;
  })?.[2];
}

describe('visualcube q2Look view', () => {
  it('renders U, two F rows, and the R top row only', () => {
    const svg = renderCubeSVG({ cubeSize: 3, facelets: SOLVED.split(''), view: 'q2look' });
    const stickerFills = [...svg.matchAll(/<polygon[^>]* fill="([^"]+)"/g)].map(m => m[1]);

    expect(stickerFills).toHaveLength(18);
    expect(stickerFills.filter(c => c === '#FEFE00')).toHaveLength(9);
    expect(stickerFills.filter(c => c === '#EE0000')).toHaveLength(6);
    expect(stickerFills.filter(c => c === '#00D800')).toHaveLength(3);
    expect(svg).toContain('viewBox="-0.1 -0.1 4.32 5.32"');
  });

  it('reads live facelets instead of assuming solved colors', () => {
    const facelets = SOLVED.split('');
    facelets[0] = 'r';
    const svg = renderCubeSVG({ cubeSize: 3, facelets, view: 'q2look' });

    expect((svg.match(/fill="#FEFE00"/g) ?? [])).toHaveLength(8);
    expect((svg.match(/fill="#00D800"/g) ?? [])).toHaveLength(4);
  });

  it('renders qLast with all four last-layer side strips', () => {
    const svg = renderCubeSVG({ cubeSize: 3, facelets: SOLVED.split(''), view: 'qlast' });
    const stickerFills = [...svg.matchAll(/<polygon[^>]* fill="([^"]+)"/g)].map(m => m[1]);

    expect(stickerFills).toHaveLength(24);
    expect(stickerFills.filter(c => c === '#FEFE00')).toHaveLength(9);
    expect(stickerFills.filter(c => c === '#EE0000')).toHaveLength(6);
    expect(stickerFills.filter(c => c === '#0000F2')).toHaveLength(3);
    expect(stickerFills.filter(c => c === '#FFA100')).toHaveLength(3);
    expect(stickerFills.filter(c => c === '#00D800')).toHaveLength(3);
  });

  it('places qLast side rows in physical URFDLB orientation', () => {
    const facelets = SOLVED.split('');
    facelets.splice(36, 3, 'u', 'r', 'f'); // L top: back → front
    facelets.splice(45, 3, 'd', 'l', 'b'); // B top: right → left when viewed above
    const svg = renderCubeSVG({ cubeSize: 3, facelets, view: 'qlast' });
    const gap = 0.12;
    const offset = 1 + gap;

    expect(stickerFillAt(svg, offset, 0)).toBe(COLOR.b); // B top-right becomes upper-left
    expect(stickerFillAt(svg, 0, offset)).toBe(COLOR.u); // L back corner becomes upper-left
    expect(stickerFillAt(svg, offset + 2, 0)).toBe(COLOR.d);
    expect(stickerFillAt(svg, 0, offset + 2)).toBe(COLOR.f);
  });

  it('renders qCube with complete U/F faces and folded L/R strips', () => {
    const svg = renderCubeSVG({ cubeSize: 3, facelets: SOLVED.split(''), view: 'qcube' });
    const stickerFills = [...svg.matchAll(/<polygon[^>]* fill="([^"]+)"/g)].map(m => m[1]);

    expect(stickerFills).toHaveLength(28);
    expect(stickerFills.filter(c => c === '#FEFE00')).toHaveLength(9);
    expect(stickerFills.filter(c => c === '#EE0000')).toHaveLength(9);
    expect(stickerFills.filter(c => c === '#0000F2')).toHaveLength(5);
    expect(stickerFills.filter(c => c === '#00D800')).toHaveLength(5);
  });

  it('folds qCube L stickers around the real U/L/F edge', () => {
    const facelets = SOLVED.split('');
    facelets.splice(36, 3, 'u', 'r', 'f');
    facelets[36 + 5] = 'd';
    facelets[36 + 8] = 'b';
    const svg = renderCubeSVG({ cubeSize: 3, facelets, view: 'qcube' });
    const gap = 0.12;
    const frontY = 3 + gap;

    expect(stickerFillAt(svg, 0, 0)).toBe(COLOR.u);
    expect(stickerFillAt(svg, 0, 1)).toBe(COLOR.r);
    expect(stickerFillAt(svg, 0, 2)).toBe(COLOR.f); // UFL corner bridges both faces
    expect(stickerFillAt(svg, 0, frontY + 1)).toBe(COLOR.d);
    expect(stickerFillAt(svg, 0, frontY + 2)).toBe(COLOR.b);
  });
});
