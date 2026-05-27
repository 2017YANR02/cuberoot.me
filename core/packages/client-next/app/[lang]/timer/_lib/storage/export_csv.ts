/**
 * Per-solve CSV exporter — flat row-per-solve format suitable for spreadsheets
 * / Python (pandas.read_csv). Distinct from the legacy `exportCsv` in
 * `import_export.ts` (which is the simpler reimport-target shape).
 *
 * Columns (RFC 4180 quoting; UTF-8 BOM prepended so Excel reads Chinese
 * comments correctly):
 *   id, event, ts, scramble, time_ms, penalty, effective_time_ms, comment,
 *   move_count, htm, qtm,
 *   cross_ms, f2l_ms, oll_ms, pll_ms,
 *   oll_case, pll_case, cross_side
 *
 * Stage durations / HTM / case labels prefer `stageSegments` (rich, computed
 * by the recognizer) over the legacy `stages` field (three numbers the user
 * marked during a multi-stage solve). QTM is approximated from the move stream
 * (double turns count as 2 quarter turns).
 */

import type { EventId, Solve } from '../types';
import { EVENTS, effectiveMs } from '../types';
import { loadAll } from './db';

const COLUMNS = [
  'id',
  'event',
  'ts',
  'scramble',
  'time_ms',
  'penalty',
  'effective_time_ms',
  'comment',
  'move_count',
  'htm',
  'qtm',
  'cross_ms',
  'f2l_ms',
  'oll_ms',
  'pll_ms',
  'oll_case',
  'pll_case',
  'cross_side',
] as const;

/** Quote-escape one field per RFC 4180. */
function csvEscape(v: string): string {
  if (v === '') return '';
  if (/[",\r\n]/.test(v)) {
    return '"' + v.replace(/"/g, '""') + '"';
  }
  return v;
}

function isoOf(ts: number): string {
  if (!Number.isFinite(ts)) return '';
  try {
    return new Date(ts).toISOString();
  } catch {
    return '';
  }
}

function numOrEmpty(n: number | null | undefined): string {
  return typeof n === 'number' && Number.isFinite(n) ? String(n) : '';
}

/** Approximate QTM: double turns ("R2", "U2") count as 2 quarter turns;
 *  single / prime turns count as 1; rotations / slices / unknown tokens are
 *  ignored. Returns null when the move stream is absent. */
function qtmOf(moves: Solve['moves']): number | null {
  if (!moves) return null;
  let qtm = 0;
  for (const mv of moves) {
    const t = (mv.m ?? '').trim();
    if (!t) continue;
    const head = t[0];
    if (head === undefined) continue;
    // Skip rotations and slices for HTM/QTM accounting (matches stage_segments).
    if ('xyzXYZMES'.includes(head)) continue;
    if (t.includes('2')) qtm += 2;
    else qtm += 1;
  }
  return qtm;
}

/** Sum of stage HTM counts when stageSegments is present and complete enough. */
function htmFromSegments(s: Solve): number | null {
  const seg = s.stageSegments;
  if (!seg) return null;
  const parts = [seg.crossHtm, seg.f2lHtm, seg.ollHtm, seg.pllHtm];
  let total = 0;
  let any = false;
  for (const p of parts) {
    if (typeof p === 'number' && Number.isFinite(p)) {
      total += p;
      any = true;
    }
  }
  return any ? total : null;
}

/** Per-stage durations: prefer stageSegments (rich), fall back to legacy
 *  `stages` splits (cumulative ms → diffed). */
function stageDurations(s: Solve): {
  crossMs: number | null;
  f2lMs: number | null;
  ollMs: number | null;
  pllMs: number | null;
} {
  const seg = s.stageSegments;
  if (seg) {
    return {
      crossMs: seg.crossMs,
      f2lMs: seg.f2lMs,
      ollMs: seg.ollMs,
      pllMs: seg.pllMs,
    };
  }
  const st = s.stages;
  if (!st) return { crossMs: null, f2lMs: null, ollMs: null, pllMs: null };
  const cross = typeof st.cross === 'number' ? st.cross : null;
  const f2l = typeof st.f2l === 'number' ? st.f2l : null;
  const oll = typeof st.oll === 'number' ? st.oll : null;
  const pll = typeof st.pll === 'number' ? st.pll : null;
  return {
    crossMs: cross,
    f2lMs: cross !== null && f2l !== null ? f2l - cross : f2l,
    ollMs: f2l !== null && oll !== null ? oll - f2l : null,
    pllMs: oll !== null && pll !== null ? pll - oll : null,
  };
}

function rowFor(s: Solve): string {
  const eff = effectiveMs(s);
  const effStr = Number.isFinite(eff) ? String(eff) : '';
  const moveCount = s.moves ? s.moves.length : null;
  const htm = htmFromSegments(s);
  const qtm = qtmOf(s.moves);
  const dur = stageDurations(s);
  const seg = s.stageSegments;
  const ollCase = seg?.ollCase ?? null;
  const pllCase = seg?.pllCase ?? null;
  const crossSide = seg?.crossSide ?? null;

  const fields = [
    s.id,
    s.event,
    isoOf(s.ts),
    s.scramble ?? '',
    String(s.timeMs),
    s.penalty,
    effStr,
    s.comment ?? '',
    numOrEmpty(moveCount),
    numOrEmpty(htm),
    numOrEmpty(qtm),
    numOrEmpty(dur.crossMs),
    numOrEmpty(dur.f2lMs),
    numOrEmpty(dur.ollMs),
    numOrEmpty(dur.pllMs),
    ollCase ?? '',
    pllCase ?? '',
    crossSide ?? '',
  ];
  return fields.map(csvEscape).join(',');
}

export interface CsvExportResult {
  csv: string;
  solveCount: number;
}

/**
 * Build a per-solve CSV string from all stored solves. Empty store still
 * produces a valid CSV (BOM + header row only). Solves are emitted grouped
 * by event in the canonical EVENTS order, then chronological within each
 * event (matching how db.ts stores them).
 */
export function exportSolvesCsv(): CsvExportResult {
  const byEvent = loadAll();
  const lines: string[] = [];
  lines.push(COLUMNS.join(','));

  let total = 0;
  for (const e of EVENTS) {
    const arr = byEvent[e.id as EventId];
    if (!arr || arr.length === 0) continue;
    for (const s of arr) {
      lines.push(rowFor(s));
      total++;
    }
  }

  // UTF-8 BOM so Excel detects encoding correctly on double-click.
  const csv = '﻿' + lines.join('\n') + '\n';
  return { csv, solveCount: total };
}
