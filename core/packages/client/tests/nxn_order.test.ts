import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  NXN_ORDER_DEFAULT,
  NXN_ORDER_MAX,
  NXN_ORDER_MIN,
  clampNxNOrder,
} from '@/lib/nxn-order';

describe('shared NxN order contract', () => {
  it('normalizes empty, fractional and out-of-range order values', () => {
    expect(NXN_ORDER_MIN).toBe(1);
    expect(NXN_ORDER_MAX).toBe(400);
    expect(clampNxNOrder(Number.NaN)).toBe(NXN_ORDER_DEFAULT);
    expect(clampNxNOrder(0)).toBe(1);
    expect(clampNxNOrder(7.9)).toBe(7);
    expect(clampNxNOrder(401)).toBe(400);
  });

  it('keeps the simulator and notation explorer on the same input component', () => {
    const simControls = readFileSync(
      join(process.cwd(), 'app', '[lang]', 'sim', 'PlayerControls.tsx'),
      'utf8',
    );
    const notationPage = readFileSync(
      join(process.cwd(), 'app', '[lang]', 'notation', 'page.tsx'),
      'utf8',
    );

    expect(simControls).toContain("from '@/components/NxNOrderInput'");
    expect(notationPage).toContain("from '@/components/NxNOrderInput'");
    expect(simControls).not.toContain('commitOrderInput');
    expect(simControls).not.toContain('sim-puzzle-order-input');
  });

  it('uses the selected order when mounting the shared NxN animation engine', () => {
    const simPlayer = readFileSync(
      join(process.cwd(), 'components', 'AlgPlayer', 'AlgSimPlayer.tsx'),
      'utf8',
    );

    expect(simPlayer).toContain('clampNxNOrder(puzzleOrder)');
    expect(simPlayer).toContain('[puzzle, puzzleKind, setupAlg, moves]');
    expect(simPlayer).toContain("typeof puzzleKind === 'number' ? puzzleKind : undefined");
  });
});
