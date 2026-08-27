import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const solverSource = readFileSync(
  join(ROOT, 'app', '[lang]', 'scramble', 'solver', '_Cube3Solver.tsx'),
  'utf8',
);
const photoSource = readFileSync(
  join(ROOT, 'app', '[lang]', 'scramble', 'solver', '_PhotoScanner.tsx'),
  'utf8',
);

describe('3x3 solver input actions', () => {
  it('offers scramble and solve actions in every input mode', () => {
    expect(solverSource).toContain("{ value: 'cube', label: t('立体', '3D') }");
    expect(solverSource).toContain("{ value: 'net', label: t('平面', '2D') }");
    expect(solverSource).toContain("{ value: 'photo', label: t('拍照', 'Photo') }");
    expect(solverSource).toContain("{ value: 'scramble', label: t('打乱', 'Scramble') }");
    expect(solverSource).toContain("{ value: 'recon', label: t('复盘', 'Reconstruction') }");

    // 立体和平面复用画板自身的主、次操作。
    expect(solverSource.match(/solveLabel=\{\{ zh: '求打乱'/g)).toHaveLength(2);
    expect(solverSource.match(/secondaryActionLabel=\{\{ zh: '求解法'/g)).toHaveLength(2);
    // 拍照识别结果、文本打乱和复盘也接到同一组动作。
    expect(solverSource).toContain('resultActions={(fc) => renderStateActions(fc, setPaintFacelet)}');
    expect(photoSource).toContain('{result && resultActions?.(result.facelet)}');
    expect(solverSource).toContain("handleScrambleAction('scramble')");
    expect(solverSource).toContain("handleScrambleAction('solution')");
    expect(solverSource).toContain('{renderStateActions(reconState.facelet)}');
  });

  it('keeps cloud success status to progress and elapsed time', () => {
    expect(solverSource).toContain('setCloudStatus(`${done}/${lines.length}`)');
    expect(solverSource).toContain('setCloudStatus(`${completed}/${lines.length} ${solveSecs}s`)');
    expect(solverSource).not.toContain('云端求解完成');
  });
});
