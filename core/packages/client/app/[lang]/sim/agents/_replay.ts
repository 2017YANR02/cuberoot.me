import type { CubeAgentRun } from '@cuberoot/shared/cube-agents';

export const REFERENCE_URL = 'https://x.com/ClaudeDevs/status/2104641318555353400';
const MOVE_MS = 180;
export function replayDuration(run: CubeAgentRun | null): number {
  if (!run) return 1;
  return Math.max(run.elapsedMs, ...run.teams.flatMap(team => team.agents.map(agent => {
    const last = agent.trials.at(-1);
    return last ? last.atMs + last.moves.split(' ').filter(Boolean).length * MOVE_MS + 800 : 0;
  }))) / 1000;
}
export function sampleTrack(run: CubeAgentRun | null, teamIndex: number, agent: number, seconds: number) {
  const team = run?.teams[teamIndex];
  const trials = team?.agents[agent].trials ?? [];
  const index = trials.findLastIndex(item => item.atMs <= seconds * 1000);
  const trial = trials[index];
  const moves = trial?.moves.split(' ').filter(Boolean) ?? [];
  // Fast model responses still replay every move before the next independent test.
  const next = trials[index + 1];
  const moveMs = trial && next && moves.length
    ? Math.max(1, Math.min(MOVE_MS, (next.atMs - trial.atMs) * 0.8 / moves.length)) : MOVE_MS;
  const cursor = trial ? Math.max(0, (seconds * 1000 - trial.atMs) / moveMs) : 0;
  const step = Math.min(moves.length, Math.floor(cursor));
  const fraction = Math.min(1, (cursor - step) / 0.8);
  return {
    key: `${run?.id ?? 'empty'}:${trial?.atMs ?? -1}:${trial?.moves ?? ''}:${step}`,
    prefix: `${run?.scramble ?? ''} ${moves.slice(0, step).join(' ')}`,
    move: moves[step] ?? null,
    fraction: fraction * fraction * (3 - 2 * fraction),
    solved: Boolean(trial?.solved && step === moves.length),
  };
}
export function teamVisuallySolved(run: CubeAgentRun | null, team: number, seconds: number) {
  const winner = run?.teams[team].winner;
  return winner != null && sampleTrack(run, team, winner, seconds).solved;
}
