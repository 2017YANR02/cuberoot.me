import { WCA_EVENT_ORDER } from '../wca_events';
import { selectCurrentRecords, type WcaRecordRow } from '../wca_records';
import { formatWcaResult } from '../wca_format_result';
import { fromWcaSpelling, toWcaSpelling, type EventId, type Solve } from './types';
import { bestAverageOfN, bestMeanOfN, bestMbldSolve, bestSingle, formatEventMs, formatSolveResult } from './stats';

export function hasTimerWcaRecords(event: EventId): boolean {
  return WCA_EVENT_ORDER.some(id => id === toWcaSpelling(event));
}

/** Keep every tied record; training variants must never inherit another event's WR. */
export function selectTimerWcaRecords(event: EventId, rows: readonly WcaRecordRow[]): WcaRecordRow[] {
  const id = toWcaSpelling(event);
  return selectCurrentRecords(rows.filter(row => row.e === id && row.l === 'WR'
    // The history feed also includes unofficial MBLD means. They are not WCA WRs.
    && !(id === '333mbf' && row.t === 'a')));
}

/** Compare in timer units, retaining WCA raw values for the record formatter. */
export function compareTimerWcaRecord(record: WcaRecordRow, solves: Solve[]) {
  const event = fromWcaSpelling(record.e);
  const attempts = solves.filter(solve => solve.event === event);
  const recordText = formatWcaResult(record.v, record.e, record.t === 's' ? 'single' : 'average');
  if (event === '333mbld') {
    const best = bestMbldSolve(attempts);
    return { recordText, pbText: best ? formatSolveResult(best) : null, gap: null, gapText: null };
  }

  // Use the record's actual format (Ao5 or Mo3), not the timer's primary display
  // format, which may be Bo3 for big BLD or Ao5 for big cubes.
  const n = record.a?.length;
  const pb = record.t === 's' ? bestSingle(attempts, event)
    : n === 3 ? bestMeanOfN(attempts, 3)
    : n === 5 ? bestAverageOfN(attempts, 5) : null;
  if (pb === null || !Number.isFinite(pb)) {
    return { recordText, pbText: null, gap: null, gapText: null };
  }

  // FMC timer values are moves * 1000; WCA singles are moves, means moves * 100.
  // All timed WCA results are centiseconds; timer durations are milliseconds.
  const recordValue = record.v * (event === '333fm' && record.t === 's' ? 1000 : 10);
  const gap = pb - recordValue;
  return { recordText, pbText: formatEventMs(event, pb), gap, gapText: formatEventMs(event, Math.abs(gap)) };
}
