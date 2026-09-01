import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  new URL('../app/[lang]/timer/_components/SolveModal.tsx', import.meta.url),
  'utf8',
);

describe('Web solve detail shared integration', () => {
  it('keeps only Web adapters around the canonical detail UI', () => {
    expect(source).toContain("import { TimerSolveDetailModal } from '@cuberoot/timer-ui'");
    expect(source).toContain("dynamic(() => import('./ReconstructReport')");
    expect(source).toContain('<CubePreview');
    expect(source).toContain('<ReconstructReport');
    expect(source).not.toMatch(/function (StageSplits|BldSplits|MbldBreakdown)/);
    expect(source).not.toContain('stage-splits-table');
  });
});
