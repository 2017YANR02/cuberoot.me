import { DEFAULT_ROUND_CONFIG, roundProjection, roundResult, type Solve } from '@cuberoot/shared/timer';
import { isAo5Bracketed } from '@/lib/wca-ao5-brackets';
import { formatWcaResult } from '@/lib/wca-format-result';
import type { CompetitionArenaAttempt, CompetitionArenaPlayer, CompetitionAttemptResult, CompetitionResult } from '@/lib/online-competition-api';

export function attemptValue(item: { centiseconds: number | null; penalty: string | null }) {
  if (item.penalty === 'DNF') return -1;
  if (item.penalty === 'DNS') return -2;
  return (item.centiseconds ?? 0) + (item.penalty === '+2' ? 200 : 0);
}

const config = { ...DEFAULT_ROUND_CONFIG, on: true, format: 'ao5', cutoffMs: null, limitMs: null, cumulative: false } as const;

export function competitionAo5(attempts: CompetitionResult['attempts'], project: string) {
  const solves: Solve[] = attempts.map((item, index) => ({
    id: String(index), timeMs: (item.centiseconds ?? 0) * 10, penalty: item.penalty === 'none' ? 'ok' : item.penalty,
    scramble: '', event: '333', ts: 0,
  }));
  const result = roundResult(solves, config);
  const value = (ms: number | null) => ms === null ? 0 : Number.isFinite(ms) ? ms / 10 : -1;
  const values = attempts.map(attemptValue);
  const equal = values.length === 5 && values[0] > 0 && values.every(time => time === values[0]);
  const projection = roundProjection(solves, config);
  return {
    bpa: value(projection.bpa), wpa: value(projection.wpa),
    average: value(result.official), best: value(result.best),
    times: values.map((time, index) => {
      const label = formatWcaResult(time, project, 'single');
      const trimmed = equal ? index === 0 || index === values.length - 1 : isAo5Bracketed(values, index);
      return trimmed ? `(${label})` : label;
    }),
  };
}

export function validResult(attempt?: CompetitionArenaAttempt): CompetitionAttemptResult | null {
  return attempt?.penalty ? { centiseconds: attempt.centiseconds, penalty: attempt.penalty } : null;
}

// During intermission each seat is ranked from the same completed-round history.
export function rankArena(players: CompetitionArenaPlayer[], number: number, project: string) {
  const sortable = (value: number) => value > 0 ? value : Infinity;
  return players.map(player => {
    const current = player.attempts.find(attempt => attempt.attemptNumber === number);
    const attempts = player.attempts.flatMap(attempt => validResult(attempt) ?? []);
    const history = player.attempts.filter(attempt => attempt.attemptNumber < number).flatMap(attempt => validResult(attempt) ?? []);
    const historicalMetrics = competitionAo5(history, project);
    const validTimes = history.map(attemptValue).filter(value => value > 0);
    const mean = validTimes.length ? validTimes.reduce((total, value) => total + value, 0) / validTimes.length : Infinity;
    const metrics = competitionAo5(attempts, project);
    return {
      player, metrics, count: attempts.length, current,
      currentRank: number === 5 ? sortable(metrics.average) : current ? sortable(attemptValue(current)) : Infinity,
      historyRank: number === 5 && attempts.length === 5 ? sortable(metrics.best)
        : history.length >= 3 ? sortable(historicalMetrics.bpa) : mean,
      historyBest: sortable(historicalMetrics.best),
    };
  }).sort((a, b) => a.currentRank - b.currentRank || a.historyRank - b.historyRank
    || a.historyBest - b.historyBest || a.player.name.localeCompare(b.player.name) || a.player.id.localeCompare(b.player.id));
}
