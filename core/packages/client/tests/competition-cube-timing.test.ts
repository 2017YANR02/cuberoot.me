import { describe, expect, it, vi } from 'vitest';
import { CompetitionCubeAttempt, competitionDeadline } from '@cuberoot/shared/timer';
import { smartCubeTargetFacelets, SOLVED_SMART_CUBE_FACELETS } from '@cuberoot/shared/smart-cube/cubie';
import { createSmartCubeGuidanceController } from '@cuberoot/shared/smart-cube/scramble-guidance';

const faces = (scramble: string) => smartCubeTargetFacelets(scramble)!;

function fixture() {
  const change = vi.fn();
  const finish = vi.fn();
  const machine = new CompetitionCubeAttempt(1000, faces('R U'), { change, finish, device: () => ({}) });
  return { machine, finish };
}

describe('smart cube competition clock', () => {
  it('corrects a wrong turn, enters observation, and records the first turn after automatic start', () => {
    const { machine, finish } = fixture();
    const guidance = createSmartCubeGuidanceController({ solve: async () => null });
    guidance.setConnected(true);
    guidance.setContext({ id: 1, scramble: 'R U', targetFacelets: faces('R U') });
    guidance.syncFacelets(SOLVED_SMART_CUBE_FACELETS);
    const turn = (scramble: string, move: string, at: number) => {
      const facelets = faces(scramble);
      const observation = guidance.observe(facelets, move);
      machine.aligned(facelets, observation.completedNow, at);
      return observation;
    };

    expect(turn('R', 'R', 1500).state.hint?.current).toBe('U');
    expect(turn('R F', 'F', 1800).state.hint?.corrections).toEqual(["F'"]);
    expect(turn('R', "F'", 2000).state.hint?.current).toBe('U');
    expect(turn('R U', 'U', 2500).completedNow).toBe(true);
    expect(machine.phase).toEqual({ kind: 'confirming', at: 2500 });
    machine.tick(3799);
    expect(machine.phase.kind).toBe('confirming');
    machine.tick(3800);
    expect(machine.phase).toEqual({ kind: 'inspecting', at: 3800 });
    machine.tick(18_799);
    expect(machine.phase.kind).toBe('inspecting');
    machine.tick(18_800);
    expect(machine.phase).toEqual({ kind: 'running', at: 18_800, inspectionMs: 16_300 });
    machine.move({ at: 21_299, move: "U'", facelets: faces('R') });
    machine.move({ at: 21_534, move: "R'", facelets: SOLVED_SMART_CUBE_FACELETS });
    expect(finish).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ kind: 'finished', durationMs: 2734 }), 16_300,
      expect.objectContaining({ moves: [{ m: "U'", ts: 2499 }, { m: "R'", ts: 2734 }] }),
    );
  });

  it('counts the triggering turn at zero during confirmation and stops at the solve deadline', () => {
    const { machine, finish } = fixture();
    machine.aligned(faces('R U'), false, 2000);
    expect(machine.phase.kind).toBe('scrambling');
    machine.aligned(faces('R U'), true, 2500);
    machine.move({ at: 3000, move: "U'", facelets: faces('R') });
    expect(machine.phase).toEqual({ kind: 'running', at: 3000, inspectionMs: 500 });
    expect(machine.recording.snapshotMoves()).toEqual([{ m: "U'", ts: 0 }]);
    machine.move({ at: 123_000, move: "R'", facelets: SOLVED_SMART_CUBE_FACELETS });
    expect(finish).toHaveBeenCalledOnce();
    expect(machine.phase).toMatchObject({ durationMs: 120_000, reason: 'solve_timeout' });
  });

  it('uses the automatic solve anchor for server expiry and rejects a scramble at its deadline', () => {
    const { machine } = fixture();
    expect(competitionDeadline(1000, 119_000)).toBe(255_300);
    expect(competitionDeadline(1000, 119_000, 120_000)).toBe(240_000);
    machine.aligned(faces('R U'), true, 121_000);
    expect(machine.phase).toMatchObject({ kind: 'finished', at: 121_000, reason: 'scramble_timeout' });
  });

  it('counts the first turn at zero when it ends the 15-second observation', () => {
    const { machine } = fixture();
    machine.aligned(faces('R U'), true, 2500);
    machine.tick(3800);
    machine.move({ at: 8500, move: "U'", facelets: faces('R') });
    expect(machine.phase).toEqual({ kind: 'running', at: 8500, inspectionMs: 6000 });
    expect(machine.recording.snapshotMoves()).toEqual([{ m: "U'", ts: 0 }]);
  });

  it.each(['scrambling', 'confirming', 'inspecting', 'running'] as const)('settles a disconnect from %s once', stage => {
    const { machine, finish } = fixture();
    if (stage !== 'scrambling') machine.aligned(faces('R U'), true, 2000);
    if (stage === 'running') machine.move({ at: 2500, move: "U'", facelets: faces('R') });
    if (stage === 'inspecting') machine.tick(3300);
    machine.disconnected(3500);
    machine.disconnected(4000);
    machine.move({ at: 5000, move: "R'", facelets: SOLVED_SMART_CUBE_FACELETS });
    expect(finish).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ at: 3500, reason: 'disconnected' }), expect.any(Number), expect.anything());
  });
});
