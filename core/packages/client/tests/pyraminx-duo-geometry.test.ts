import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const CORE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const PROOF_SCRIPT = join(CORE_ROOT, 'packages/client/scripts/pyraminx-duo/verify-geometry.mts');

interface GeometryProof {
  status: string;
  stepDegrees: number;
  rendered: { meshes: number; triangles: number; connectedCornerPairs: number };
  negativeControl: number;
  minimumContinuousSeparation: number;
  turns: { axis: number; sign: number; continuousLowerBound: number }[];
}

describe('Pyraminx Duo finite geometry', () => {
  it('certifies actual closed meshes and positive clearance throughout all eight turns', () => {
    const result = spawnSync(process.execPath, ['--import', 'tsx', PROOF_SCRIPT], {
      cwd: CORE_ROOT,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 25_000,
    });
    const diagnostic = [result.error?.message, result.stderr, result.stdout].filter(Boolean).join('\n');
    expect(result.error, diagnostic).toBeUndefined();
    expect(result.status, diagnostic).toBe(0);

    const proof = JSON.parse(result.stdout) as GeometryProof;
    expect(proof.status).toBe('passed');
    expect(proof.stepDegrees).toBe(0.5);
    expect(proof.rendered).toMatchObject({ meshes: 32, triangles: 5920, connectedCornerPairs: 12 });
    expect(proof.turns.map(({ axis, sign }) => [axis, sign])).toEqual([
      [0, 1], [0, -1], [1, 1], [1, -1], [2, 1], [2, -1], [3, 1], [3, -1],
    ]);
    expect(proof.turns.every(turn => Number.isFinite(turn.continuousLowerBound) && turn.continuousLowerBound > 0)).toBe(true);
    expect(proof.minimumContinuousSeparation).toBe(Math.min(...proof.turns.map(turn => turn.continuousLowerBound)));
    // Lock the certificate and the known-invalid no-gap control to explicit
    // baselines. Nine decimals allow only insignificant platform rounding.
    expect(Number(proof.minimumContinuousSeparation.toFixed(9))).toBe(0.000479214);
    expect(Number(proof.negativeControl.toFixed(9))).toBe(-0.011357279);
  }, 30_000);
});
