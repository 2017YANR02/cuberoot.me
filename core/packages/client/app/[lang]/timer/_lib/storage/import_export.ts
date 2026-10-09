/**
 * Round 1E I/O — cstimer JSON import + CSV/TSV/Speedstacks exports.
 *
 * Public API (re-exported from `db.ts` so callers can do
 * `import { importCstimerJson } from './storage/db'`):
 *   - importCstimerJson(text) → Record<EventId, Solve[]> | null
 *   - exportCsv(byEvent)
 *   - exportTsv(byEvent)
 *   - exportSpeedstacks(solves)
 *
 * No external deps; pure TS.
 */

import type { Solve } from '../types';
import { parseCstimerExport } from './import_cstimer';

/**
 * Flatten the canonical session parser into the legacy per-event API.
 * Keep null for an unrecognized envelope and {} for recognized empty/malformed
 * sessions; event aliases, metadata, penalties and solve parsing remain shared.
 */
export function importCstimerJson(text: string): Record<string, Solve[]> | null {
  let outer: unknown;
  try {
    outer = JSON.parse(text);
  } catch {
    return null;
  }
  if (!outer || typeof outer !== 'object'
    || !Object.keys(outer).some((key) => /^session\d+$/.test(key))) return null;

  const byEvent: Record<string, Solve[]> = {};
  for (const { event, solves } of parseCstimerExport(text)) {
    if (solves.length === 0) continue;
    const bucket = byEvent[event] ??= [];
    // Import large histories without spreading them into function arguments.
    for (const solve of solves) bucket.push(solve);
  }
  for (const solves of Object.values(byEvent)) solves.sort((a, b) => a.ts - b.ts);
  return byEvent;
}

/* ------------------------------------------------------------------ */
/* Export — CSV / TSV                                                  */
/* ------------------------------------------------------------------ */

const CSV_HEADER = ['event', 'index', 'time_ms', 'penalty', 'scramble', 'comment', 'date_iso'];

export function csvEscape(field: string): string {
  if (/[",\r\n]/.test(field)) {
    return '"' + field.replace(/"/g, '""') + '"';
  }
  return field;
}

function tsvEscape(field: string): string {
  // No quoting in TSV; just strip tabs/newlines.
  return field.replace(/[\t\r\n]+/g, ' ');
}

function rowsForExport(byEvent: Record<string, Solve[]>): Array<{ s: Solve; index: number; eventId: string }> {
  const rows: Array<{ s: Solve; index: number; eventId: string }> = [];
  // Stable order: event keys alphabetical for reproducibility.
  const eventKeys = Object.keys(byEvent).sort();
  for (const ev of eventKeys) {
    const solves = (byEvent[ev] ?? []).slice().sort((a, b) => a.ts - b.ts);
    for (let i = 0; i < solves.length; i++) {
      rows.push({ s: solves[i], index: i + 1, eventId: ev });
    }
  }
  return rows;
}

function isoOf(ts: number): string {
  if (!Number.isFinite(ts)) return '';
  try {
    return new Date(ts).toISOString();
  } catch {
    return '';
  }
}

/** CSV export. Header included. Returns "" rows after header if no solves. */
export function exportCsv(byEvent: Record<string, Solve[]>): string {
  const out: string[] = [];
  out.push(CSV_HEADER.join(','));
  const rows = rowsForExport(byEvent);
  for (const { s, index, eventId } of rows) {
    out.push([
      csvEscape(eventId),
      String(index),
      String(s.timeMs),
      csvEscape(s.penalty),
      csvEscape(s.scramble ?? ''),
      csvEscape(s.comment ?? ''),
      csvEscape(isoOf(s.ts)),
    ].join(','));
  }
  return out.join('\n') + '\n';
}

/** TSV export. Header included. */
export function exportTsv(byEvent: Record<string, Solve[]>): string {
  const out: string[] = [];
  out.push(CSV_HEADER.join('\t'));
  const rows = rowsForExport(byEvent);
  for (const { s, index, eventId } of rows) {
    out.push([
      tsvEscape(eventId),
      String(index),
      String(s.timeMs),
      tsvEscape(s.penalty),
      tsvEscape(s.scramble ?? ''),
      tsvEscape(s.comment ?? ''),
      tsvEscape(isoOf(s.ts)),
    ].join('\t'));
  }
  return out.join('\n') + '\n';
}

/* ------------------------------------------------------------------ */
/* Export — Speedstacks .txt                                           */
/* ------------------------------------------------------------------ */

export { exportSpeedstacks } from '@cuberoot/shared/timer';
