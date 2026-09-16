import { parsePbResultInput } from '@cuberoot/shared/pb';
import { query } from '../db/connection.js';
import { EVENT_NAME_BY_ID } from './record_format.js';
import type { CompData } from '../routes/cubing_live.js';

export type NewcomerSource = '1st-solve' | '1st-comp';
export interface NewcomerRecord {
  eventId: string;
  roundId: string;
  personNumber: number;
  type: 'single' | 'average';
  source: NewcomerSource;
  value: number;
}
interface HistoryRow {
  eventId: string; type: 'single' | 'average'; source: NewcomerSource;
  value: number; date: string; compId: string;
}
interface StatData {
  metricPanels: { id: string; sourcePanels: {
    id: string; panels: { id: string; sections: { title: string; rows: unknown[][] }[] }[];
  }[] }[];
}

/** The same published history used by /wca/wr_newcomer, including its two independent sources. */
export function newcomerHistory(data: StatData): HistoryRow[] {
  const rows: HistoryRow[] = [];
  const eventIds = new Map(Object.entries(EVENT_NAME_BY_ID).map(([id, name]) => [name, id]));
  for (const metric of data.metricPanels) {
    if (metric.id !== 'single' && metric.id !== 'average') continue;
    for (const source of metric.sourcePanels) {
      const sourceId = source.id.slice(metric.id.length + 1);
      if (sourceId !== '1st-solve' && sourceId !== '1st-comp') continue;
      for (const section of source.panels.find(p => p.id === 'history')?.sections ?? []) {
        const eventId = eventIds.get(section.title);
        if (!eventId) continue;
        for (const row of section.rows) {
          const value = parsePbResultInput(String(row[0]), eventId, metric.id);
          const date = String(row[4]);
          const compId = String(row[5]).match(/\/competitions\/([A-Za-z0-9]+)\)/)?.[1];
          if (value == null || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !compId) continue;
          rows.push({ eventId, type: metric.id, source: sourceId, value, date, compId });
        }
      }
    }
  }
  return rows;
}

let history: HistoryRow[] = [];
let historyUntil = 0;
let historyPending: Promise<HistoryRow[]> | undefined;
async function loadHistory(): Promise<HistoryRow[]> {
  if (Date.now() < historyUntil) return history;
  if (!historyPending) historyPending = (async () => {
    try {
      const res = await fetch('https://static.cuberoot.me/stats/wr_newcomer.json', { signal: AbortSignal.timeout(5000) });
      if (!res.ok) throw new Error(`newcomer history HTTP ${res.status}`);
      const rows = newcomerHistory(await res.json() as StatData);
      if (!rows.length) throw new Error('empty newcomer history');
      history = rows;
      historyUntil = Date.now() + 3600_000;
      return history;
    } catch (error) {
      // A failed refresh must not adjudicate against a stale or empty baseline.
      history = [];
      historyUntil = Date.now() + 60_000;
      console.warn('[newcomer-records]', (error as Error).message);
      return history;
    }
  })().finally(() => { historyPending = undefined; });
  return historyPending;
}

/** First attempt/first-round average versus the best across every round of the first competition. */
export function newcomerCandidates(data: CompData, date: string, rows: HistoryRow[]): NewcomerRecord[] {
  if (data.type !== 'WCA' || data.partial) return [];
  const candidates = new Map<string, NewcomerRecord>();
  for (const event of data.events) {
    for (const [roundIndex, round] of event.rs.entries()) {
      for (const result of data.resultsByRound[`${event.i}:${round.i}`] ?? []) {
        for (const source of ['1st-solve', '1st-comp'] as const) {
          if (source === '1st-solve' && roundIndex !== 0) continue;
          for (const type of ['single', 'average'] as const) {
            const value = type === 'average' ? result.a : source === '1st-solve' ? result.v[0] : result.b;
            if (!Number.isSafeInteger(value) || value <= 0) continue;
            const baseline = rows.filter(r => r.eventId === event.i && r.type === type && r.source === source
              && r.date <= date && r.compId !== data.slug);
            // History uses strictly improving results, not ties. Unknown baselines are not records.
            if (!baseline.length || value >= Math.min(...baseline.map(r => r.value))) continue;
            const key = `${event.i}|${result.n}|${type}|${source}`;
            if (value >= (candidates.get(key)?.value ?? Infinity)) continue;
            candidates.set(key, { eventId: event.i, roundId: round.i, personNumber: result.n, type, source, value });
          }
        }
      }
    }
  }
  return [...candidates.values()];
}

// Candidate-only official lookups close the weekly dump gap. Failed lookups never grant eligibility.
const officialResults = new Map<string, { until: number; rows: { event_id: string; competition_id: string }[] | null }>();
async function hasEarlierOfficialResult(id: string, eventId: string, compId: string, date: string,
  compDate: (id: string) => Promise<string | null>): Promise<boolean> {
  let entry = officialResults.get(id);
  if (!entry || entry.until <= Date.now()) {
    try {
      const res = await fetch(`https://www.worldcubeassociation.org/api/v0/persons/${encodeURIComponent(id)}/results`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) throw new Error(`person results HTTP ${res.status}`);
      const rows = await res.json();
      if (!Array.isArray(rows) || rows.some(r => typeof r.event_id !== 'string' || typeof r.competition_id !== 'string')) {
        throw new Error('invalid person results');
      }
      entry = { until: Date.now() + 300_000, rows };
    } catch {
      entry = { until: Date.now() + 60_000, rows: null };
    }
    for (const [key, cached] of officialResults) if (cached.until <= Date.now()) officialResults.delete(key);
    officialResults.set(id, entry);
  }
  if (!entry.rows) return true;
  for (const other of new Set(entry.rows.filter(r => r.event_id === eventId && r.competition_id !== compId).map(r => r.competition_id))) {
    const otherDate = await compDate(other);
    if (!otherDate || otherDate < date) return true;
  }
  return false;
}

export async function findNewcomerRecords(data: CompData, date: string,
  compDate: (id: string) => Promise<string | null>): Promise<NewcomerRecord[]> {
  const candidates = newcomerCandidates(data, date, await loadHistory());
  if (!candidates.length) return [];
  const ids = [...new Set(candidates.flatMap(r => data.users[String(r.personNumber)]?.wcaid || []))];
  const prior = new Set<string>();
  if (ids.length) {
    const placeholders = ids.map(() => '?').join(',');
    // Unlike wca_results_flat, these tables retain whole-round DNF/DNS results.
    const rows = await query<{ wca_id: string; event_id: string }>(
      `SELECT DISTINCT wca_id, event_id FROM wca_person_results WHERE wca_id IN (${placeholders}) AND comp_date < ?
       UNION SELECT DISTINCT wca_id, event_id FROM wca_live_person_results WHERE wca_id IN (${placeholders}) AND comp_date < ?`,
      [...ids, date, ...ids, date],
    );
    for (const row of rows) prior.add(`${row.wca_id}|${row.event_id}`);
  }
  const eligible = new Map<string, boolean>();
  const out: NewcomerRecord[] = [];
  for (const candidate of candidates) {
    const user = data.users[String(candidate.personNumber)];
    if (!user) continue;
    const key = `${candidate.personNumber}|${candidate.eventId}`;
    if (!eligible.has(key)) {
      eligible.set(key, user.wcaid
        ? !prior.has(`${user.wcaid}|${candidate.eventId}`)
          && !await hasEarlierOfficialResult(user.wcaid, candidate.eventId, data.slug, date, compDate)
        // WCA Live explicitly identifies first-time competitors with a missing WCA ID.
        : data.source === 'wca_live' || data.membersByFilter.newcomers.includes(candidate.personNumber));
    }
    if (eligible.get(key)) out.push(candidate);
  }
  return out.filter(r => !out.some(other => other.source === r.source && other.eventId === r.eventId
    && other.type === r.type && other.value < r.value));
}
