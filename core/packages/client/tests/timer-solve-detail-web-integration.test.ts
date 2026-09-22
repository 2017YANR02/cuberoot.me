import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { workspaceFixturePath } from './workspace-fixture-path';

const source = readFileSync(
  new URL('../app/[lang]/timer/_components/SolveModal.tsx', import.meta.url),
  'utf8',
);
const reportSource = readFileSync(
  workspaceFixturePath('@cuberoot/timer-ui', 'src', 'reconstruct', 'ReconstructReport.tsx'),
  'utf8',
);
const reportCss = readFileSync(
  workspaceFixturePath('@cuberoot/timer-ui', 'src', 'reconstruct', 'reconstruct.css'),
  'utf8',
);
const detailSource = readFileSync(
  workspaceFixturePath('@cuberoot/timer-ui', 'src', 'TimerSolveDetailModal.tsx'),
  'utf8',
);
const detailCss = readFileSync(
  workspaceFixturePath('@cuberoot/timer-ui', 'src', 'solve-detail.css'),
  'utf8',
);
const timerUiPackage = JSON.parse(readFileSync(
  workspaceFixturePath('@cuberoot/timer-ui', 'package.json'),
  'utf8',
)) as { exports: Record<string, string> };

describe('Web solve detail shared integration', () => {
  it('keeps only Web adapters around the canonical detail UI', () => {
    expect(source).toContain("import { TimerSolveDetailModal } from '@cuberoot/timer-ui'");
    expect(source).toContain("import ReconstructActions from '@cuberoot/timer-ui/reconstruct-actions'");
    expect(source).toContain("dynamic(() => import('./ReconstructReport')");
    expect(source).toContain('<CubePreview');
    expect(source).toContain('fullHeaderActions={hasMoves ? (');
    expect(source).toContain('placement="detail"');
    expect(source).toMatch(/<ReconstructReport[\s\S]{0,120}hideActions/);
    expect(timerUiPackage.exports['./reconstruct-actions'])
      .toBe('./src/reconstruct/ReconstructActions.tsx');
    expect(source).not.toMatch(/function (StageSplits|BldSplits|MbldBreakdown)/);
    expect(source).not.toContain('stage-splits-table');
    expect(reportSource).not.toContain('TimerReconstructMetrics');
    expect(reportSource).not.toContain('reconstruct-waste-line');
    expect(reportCss).not.toMatch(/reconstruct-(?:stats|waste-line)/);
  });

  it('keeps full-screen motion in the shared detail lifecycle', () => {
    expect(source).toContain('const [localCloseRequested, setLocalCloseRequested] = useState(false)');
    expect(source).toContain('setLocalCloseRequested(true)');
    expect(source).toContain('closeRequested={closeRequested || localCloseRequested}');
    expect(source).toContain('onEntered={onDisplayed}');
    expect(source).not.toContain('requestAnimationFrame');
    expect(detailSource.match(/window\.requestAnimationFrame\(/g)).toHaveLength(2);
    expect(detailCss).toContain('@keyframes timer-solve-detail-page-in');
    expect(detailCss).toContain('@keyframes timer-solve-detail-page-out');
    expect(detailCss).toMatch(/\.timer-solve-detail-overlay--closing[\s\S]*animation:/);
    expect(detailCss).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*animation:\s*none/);
  });
});
