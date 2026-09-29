import { describe, expect, it } from 'vitest';
import type { CubeAgentRun } from '@cuberoot/shared/cube-agents';
import { replayDuration, sampleTrack, teamVisuallySolved } from '@/app/[lang]/sim/agents/_replay';

// A synthetic verifier fixture, never published as a model result.
const run: CubeAgentRun = {
  version: 1, id: 'replay-fixture', startedAt: '2026-09-28T00:00:00Z', scramble: 'R U', elapsedMs: 2000, status: 'done',
  teams: [{ model: 'fixture', name: 'fixture', status: 'solved', winner: 0, solvedMs: 2000, finishedMs: 2000,
    positions: 3, toolCalls: 2, modelCalls: 2, inputTokens: 0, outputTokens: 0, cachedTokens: 0, estimatedCny: 0, usageComplete: false,
    agents: [{ status: 'solved', trials: [
      { atMs: 1000, moves: 'F', solved: false, correct: 1 },
      { atMs: 2000, moves: "U' R'", solved: true, correct: 8 },
    ] }, ...Array.from({ length: 3 }, () => ({ status: 'stopped' as const, trials: [] }))],
  }],
};

describe('cube agent replay', () => {
  it('starts from the actual scramble and resets to it for each independent attempt', () => {
    expect(sampleTrack(run, 0, 0, 0).prefix.trim()).toBe('R U');
    expect(sampleTrack(run, 0, 0, 1.2).prefix.trim()).toBe('R U F');
    expect(sampleTrack(run, 0, 0, 2).prefix.trim()).toBe('R U');
    expect(sampleTrack(run, 0, 0, 2).move).toBe("U'");
  });
  it('preserves the moving layer at intermediate frames and supports seeking backwards', () => {
    expect(sampleTrack(run, 0, 0, 2.072).fraction).toBeCloseTo(0.5, 8);
    expect(sampleTrack(run, 0, 0, 2.3).prefix.trim()).toBe("R U U'");
    expect(sampleTrack(run, 0, 0, 1.05).move).toBe('F');
  });
  it('only expands the verified winner after the final move has completed', () => {
    expect(teamVisuallySolved(run, 0, 2.35)).toBe(false);
    expect(teamVisuallySolved(run, 0, 2.361)).toBe(true);
    expect(teamVisuallySolved(run, 0, 1.8)).toBe(false);
    expect(replayDuration(run)).toBe(3.16);
    expect(sampleTrack(run, 0, 1, 5).solved).toBe(false);
    expect(teamVisuallySolved(null, 0, 5)).toBe(false);
  });
  it('completes long attempts before a fast subsequent model response', () => {
    const rapid = structuredClone(run);
    rapid.teams[0].agents[0].trials[0].moves = 'F R U F R U';
    rapid.teams[0].agents[0].trials[1].atMs = 1100;
    expect(sampleTrack(rapid, 0, 0, 1.09).prefix.trim()).toBe('R U F R U F R U');
    expect(sampleTrack(rapid, 0, 0, 1.09).move).toBeNull();
    expect(sampleTrack(rapid, 0, 0, 1.1).prefix.trim()).toBe('R U');
  });
});
