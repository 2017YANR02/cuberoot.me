import { describe, expect, it } from 'vitest';
import { renderCubeSVG } from '@cuberoot/visualcube';

const SOLVED = 'u'.repeat(9) + 'r'.repeat(9) + 'f'.repeat(9)
  + 'd'.repeat(9) + 'l'.repeat(9) + 'b'.repeat(9);

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
});
