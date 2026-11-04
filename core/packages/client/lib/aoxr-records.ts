import type { StatData } from '@/components/wca-stats/WcaStatView.types';
import { EVENT_NAME_TO_ID } from './event-constants';
import { extractWcaId, extractCompId } from './country-flags';
import { extractSolvesCell, parseTimeValue } from './wca-stat-values';

// Include the unrounded sum: two different AoXR results may both display 4.09.
export function aoxrRecordKey(wcaId: string, compId: string, eventId: string, rounds: number, sum: number): string {
  return `${wcaId}|${compId}|${eventId}|${rounds}|${sum}`;
}

/** Use the complete WR history, not the top-ten ranking or today's best value. */
export function parseAoxrWorldRecords(data: Pick<StatData, 'metricPanels'>): ReadonlySet<string> {
  const records = new Set<string>();
  for (const metric of data.metricPanels ?? []) {
    const rounds = Number(/^ao([1-4])r$/.exec(metric.id)?.[1]);
    const history = metric.panels?.find(panel => panel.id === 'history');
    if (!rounds || !history) continue;
    const personIndex = history.header.findIndex(h => h.key === 'person');
    const compIndex = history.header.findIndex(h => h.key === 'competition');
    for (const section of history.sections) {
      const eventId = EVENT_NAME_TO_ID[section.title];
      if (!eventId) continue;
      for (const row of section.rows) {
        const wcaId = extractWcaId(String(row[personIndex] ?? ''));
        // Pass only the URL to the shared URL parser, excluding Markdown's closing parenthesis.
        const compUrl = String(row[compIndex] ?? '').match(/\]\(([^)]+)\)/)?.[1];
        const compId = compUrl ? extractCompId(compUrl) : null;
        const values = extractSolvesCell(row)?.csv.split(',').map(value => Math.round(parseTimeValue(value) * 100)) ?? [];
        if (!wcaId || !compId || values.length !== rounds || values.some(value => !Number.isFinite(value) || value <= 0)) continue;
        records.add(aoxrRecordKey(wcaId, compId, eventId, rounds, values.reduce((sum, value) => sum + value, 0)));
      }
    }
  }
  return records;
}
