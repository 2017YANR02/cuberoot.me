import { DEFAULT_ROUND_CONFIG, roundResult, type Solve } from '@cuberoot/shared/timer';
import { isAo5Bracketed } from '@/lib/wca-ao5-brackets';
import { formatWcaResult } from '@/lib/wca-format-result';
import type { CompetitionResult } from '@/lib/online-competition-api';

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
  return {
    average: value(result.official), best: value(result.best),
    times: values.map((time, index) => {
      const label = formatWcaResult(time, project, 'single');
      const trimmed = equal ? index === 0 || index === values.length - 1 : isAo5Bracketed(values, index);
      return trimmed ? `(${label})` : label;
    }),
  };
}
