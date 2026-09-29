import { describe, expect, it } from 'vitest';
import { puzzles } from 'cubing/puzzles';
import record from '@/app/[lang]/sim/agents/_recorded-run.json';

describe('published cube agent recording', () => {
  it('contains a completed real two-provider run with all four agents and usage', () => {
    expect(record.status).toBe('done');
    expect(record.teams.map(team => team.model)).toEqual(['qwen3.8-flash', 'deepseek-flash']);
    for (const team of record.teams) {
      expect(team.agents.length).toBe(4);
      expect(team.usageComplete).toBe(true);
      expect(team.modelCalls).toBe(25);
      expect(team.toolCalls).toBe(team.agents.reduce((sum, agent) => sum + agent.trials.length, 0));
      expect(team.estimatedCny).toBeCloseTo((team.inputTokens * team.pricing.inputPerMillion + team.outputTokens * team.pricing.outputPerMillion) / 1_000_000, 10);
    }
  });
  it('rechecks every recorded candidate and every explored state with the cube rules', async () => {
    const kpuzzle = await puzzles['2x2x2'].kpuzzle();
    const initial = kpuzzle.defaultPattern().applyAlg(record.scramble);
    for (const team of record.teams) {
      const states = new Set([JSON.stringify(initial.patternData.CORNERS)]);
      for (const agent of team.agents) for (const trial of agent.trials) {
        let state = initial;
        for (const move of trial.moves.split(' ').filter(Boolean)) {
          expect(move).toMatch(/^[URF](2|')?$/);
          state = state.applyMove(move);
          states.add(JSON.stringify(state.patternData.CORNERS));
        }
        expect(state.isIdentical(kpuzzle.defaultPattern())).toBe(trial.solved);
        const corners = state.patternData.CORNERS;
        expect(corners.pieces.reduce((sum, piece, slot) => sum + Number(piece === slot && corners.orientation[slot] === 0), 0)).toBe(trial.correct);
      }
      expect(states.size).toBe(team.positions);
      expect(team.status).toBe('exhausted');
      expect(team.winner).toBeNull();
    }
  });
});
