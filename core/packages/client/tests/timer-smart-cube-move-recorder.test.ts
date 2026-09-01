import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { TimerSmartCubeMoveRecorder } from '@cuberoot/shared/timer';

describe('TimerSmartCubeMoveRecorder', () => {
  it('records the first move at zero and returns a safe monotonic snapshot', () => {
    const recorder = new TimerSmartCubeMoveRecorder();
    expect(recorder.record('R', 900)).toBe(false);

    recorder.begin(1_000);
    recorder.record('R', 999);
    recorder.record('U', 1_050);
    recorder.record("R'", Number.NaN);

    recorder.record('F', 1_025);
    const snapshot = recorder.snapshot();
    expect(snapshot).toEqual([
      { m: 'R', ts: 0 },
      { m: 'U', ts: 50 },
      { m: "R'", ts: 50 },
      { m: 'F', ts: 50 },
    ]);
    snapshot[0]!.ts = 999;
    expect(recorder.snapshot()[0]!.ts).toBe(0);
    expect(recorder.take()).toHaveLength(4);
    expect(recorder.snapshot()).toEqual([]);
    expect(recorder.record('L', 1_100)).toBe(false);
  });

  it('is the recorder used by every website smart-cube timing mode', () => {
    const solo = readFileSync(new URL('../app/[lang]/timer/_shell/SoloView.tsx', import.meta.url), 'utf8');
    const net = readFileSync(new URL('../app/[lang]/timer/_shell/NetBattleView.tsx', import.meta.url), 'utf8');
    for (const source of [solo, net]) {
      expect(source).toContain('new TimerSmartCubeMoveRecorder()');
      expect(source).toContain('moveRecorderRef.current.begin(');
      expect(source).toContain('moveRecorderRef.current.record(');
      expect(source).not.toMatch(/movesRef|solveStartTsRef/);
    }

    const local = readFileSync(new URL('../app/[lang]/timer/_battle/useBattleCubes.ts', import.meta.url), 'utf8');
    expect(local).toContain('new TimerSmartCubeMoveRecorder()');
    expect(local).toContain('recorder.begin(p.startTime)');
    expect(local).toContain('recorder.record(move, ts)');
    expect(local).not.toMatch(/moves:\s*\[|t0:/);
  });
});
