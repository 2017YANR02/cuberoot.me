import { describe, expect, it } from 'vitest';

import {
  eventHasScramblePreview,
  renderScramblePreviewSvg,
} from '@/components/scramble-preview-svg';
import { ivyApplyStandard, ivyStandardToCstimer } from '@/lib/ivy-solver';

describe('shared scramble preview SVG renderer', () => {
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
});
