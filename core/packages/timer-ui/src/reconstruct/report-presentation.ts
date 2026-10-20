import type { ReferenceResult, StageReference } from '@cuberoot/shared/timer/reconstruct/reference';
import type { ReconstructLocalize } from './ReconstructHost';
import { buildNormalizedSolution, findCrossLineIndex, hasNormalizableCrossMove } from '@cuberoot/shared/recon-ground-truth';
import { formattedReconMoves, originalReconNotation, simplifyF2lRotations, type ReconTextResult } from '@cuberoot/shared/timer/reconstruct/recon-text';
import { METHODS } from '@cuberoot/shared/timer/reconstruct/methods';
import { reconCommentLinks, type ReconCommentCases } from '@cuberoot/shared/recon/comment-links';
import { cubeColorGroups, cubeColorGroupPunctuation, leadingCubeColors, crossColorFromLabels, f2lDisplayColors } from '../cube-color-model';
import { CUBE_FILL, CUBE_FACE_FOR_COLOR_LETTER, type CubeColorLetter } from '@cuberoot/puzzle-render-core/support/cube-colors';
import { sliceReconstruction } from '@cuberoot/shared/timer/reconstruct/slice';
import type { ReconstructionType } from '@cuberoot/shared/timer/reconstruct/recon-text';
import type { SolveMove } from '@cuberoot/shared/timer/reconstruct/stage-segments';
import type { Solve } from '@cuberoot/shared/timer';
import { timerSupportsTrainingTiming } from '@cuberoot/shared/timer/training-settings';
import { metricForRange } from '@cuberoot/shared/timer/reconstruct/step-metrics';
import { htmMoves } from '@cuberoot/shared/timer/reconstruct/htm';

/** One training repetition is one range. Use precisely the same AUF/rotation
 * boundary as the step table, with the training clock's origin as its start.
 * The caller supplies the report's oriented moves, never a display-only alg. */
export function trainingRepetitionMetrics(solve: Solve, moves: SolveMove[]) {
  if (!timerSupportsTrainingTiming(solve.event) || !moves.length) return null;
  const range = metricForRange(moves, htmMoves(moves), -1, 0, moves.length - 1);
  const observationMs = Math.min(solve.timeMs, range.recognitionMs);
  return { observationMs, executionMs: Math.max(0, solve.timeMs - observationMs), totalMs: solve.timeMs };
}

export function trainingCaseHistory(history: Solve[], current: Solve): Solve[] {
  if (!current.caseId) return [];
  return history.filter(item => item.id !== current.id && item.event === current.event
    && item.caseId === current.caseId && item.ts <= current.ts && item.penalty === 'ok'
    && item.moves?.length && (item.trainingStartMode ?? 'first-turn') === (current.trainingStartMode ?? 'first-turn'))
    .sort((a, b) => b.ts - a.ts).slice(0, 12);
}

export function trainingCaseStatistics(samples: NonNullable<ReturnType<typeof trainingRepetitionMetrics>>[]) {
  if (!samples.length) return null;
  const mean = (key: 'observationMs' | 'executionMs' | 'totalMs') => samples.reduce((sum, sample) => sum + sample[key], 0) / samples.length;
  return { count: samples.length, observationMs: mean('observationMs'), executionMs: mean('executionMs'), totalMs: mean('totalMs'),
    bestExecutionMs: Math.min(...samples.map(sample => sample.executionMs)) };
}

/** The stage spacing and inline comments of StepMoveList, shared with native rendering. */
export function reconNotationGroup(line: ReconTextResult['lines'][number], method: ReconstructionType) {
  return line.stageKey ?? (method === 'cfop' ? line.kind : line.key === 'tail' && method !== 'training' ? METHODS[method].stages.at(-1)!.key : line.key);
}

export function reconNotationState(line: { fromIdx: number; toIdx: number }, currentIdx?: number | null) {
  if (!currentIdx) return null;
  return currentIdx > line.toIdx + 1 ? 'done' : currentIdx > line.fromIdx ? 'now' : 'future';
}

export interface ReconCommentPart { text: string; colors?: string; href?: string }
/** Native colors use the very same label ordering and sticker palette as CubeColorChip. */
export function reconCommentFills(colors: string, labels: readonly (string | null | undefined)[]) {
  return [...f2lDisplayColors(colors, crossColorFromLabels(labels))].map(letter => CUBE_FILL[CUBE_FACE_FOR_COLOR_LETTER[letter as CubeColorLetter]]);
}
export function projectReconComment(label: string, method: ReconstructionType, cases: ReconCommentCases, caseHref?: (colors: string) => string | undefined): ReconCommentPart[] {
  if (!label) return [];
  if (method === 'training') return [{ text: '// ' + label }];
  const parts: ReconCommentPart[] = [{ text: '// ' }];
  const leading = leadingCubeColors(label);
  if (leading) {
    parts.push({ text: '', colors: leading, href: caseHref?.(leading) });
    label = label.slice(leading.length).replace(/^\/?/, '').trimStart();
  }
  const appendText = (value: string) => {
    const groups = cubeColorGroups(value);
    const hidden = cubeColorGroupPunctuation(value, groups);
    const plain = (from: number, to: number) => [...value.slice(from, to)].map((char, i) =>
      hidden.has(from + i) ? (char === '+' ? ' ' : '') : char).join('');
    let cursor = 0;
    for (const group of groups) {
      parts.push({ text: plain(cursor, group.start) }, { text: '', colors: group.colors, href: caseHref?.(group.colors) });
      cursor = group.end;
    }
    parts.push({ text: plain(cursor, value.length) });
  };
  const text = `// ${label}`;
  const links = method === 'cfop' ? reconCommentLinks(text, cases, set => caseHref?.(set)).flatMap(link => {
    if (link.href !== '/alg/3x3/f2l') return /^\/alg\/3x3\/[^/]+\//.test(link.href) ? [link] : [];
    const href = caseHref?.('F2L');
    return href ? [{ ...link, href }] : [];
  }) : [];
  let end = 3;
  for (const link of links) {
    appendText(text.slice(end, link.start));
    parts.push({ text: text.slice(link.start, link.end), href: link.href });
    end = link.end;
  }
  appendText(text.slice(end));
  return parts.filter(part => part.text || part.colors);
}

/** The final notation projection used by both React and native reports.
 * It never changes the physical track or its original timing ranges. */
export function projectReconNotation(recon: ReconTextResult | null, method: ReconstructionType, simplified = true) {
  const simplifiedRecon = recon?.presentation ?? (method === 'cfop' && recon ? simplifyF2lRotations(recon) : recon);
  const originalRecon = recon ? originalReconNotation(recon) : recon;
  const shownRecon = simplified ? simplifiedRecon : originalRecon;
  // Measured wide turns are real gestures. The legacy cross normalizer expands
  // them into outer turns and moves their rotation into inspection, erasing
  // what the user did. Keep the entire cross frame when it contains one.
  const hasWideCross = shownRecon?.lines.some(line => line.kind === 'cross'
    && line.moves.some(move => /^(?:[rludfb]|[RLUDFB]w)(?:2'?|')?$/.test(move)));
  const normalizedText = method === 'cfop' && shownRecon && !hasWideCross && hasNormalizableCrossMove(shownRecon.text)
    ? buildNormalizedSolution(shownRecon.inspection ? shownRecon.text : `// insp\n${shownRecon.text}`) : null;
  const normalized = simplified && normalizedText !== null;
  const displayText = normalized ? normalizedText : shownRecon?.text ?? '';
  const normalizedLines = displayText.split(/\r?\n/);
  const crossLine = normalized ? findCrossLineIndex(displayText) : -1;
  const inspectionOffset = normalized || shownRecon?.inspection ? 1 : 0;
  const inspection = normalized && inspectionOffset ? normalizedLines[0].split('//')[0].trim() : shownRecon?.inspection ?? '';
  const lines = (shownRecon?.lines ?? []).map((line, i) => {
    const normalizedLine = normalized && i + inspectionOffset <= crossLine;
    return { line, normalizedLine, groupKey: reconNotationGroup(line, method), moves: normalizedLine
      ? normalizedLines[i + inspectionOffset].split('//')[0].trim().split(/\s+/).filter(Boolean)
      : formattedReconMoves(line) };
  });
  return { simplifiedRecon, originalRecon, shownRecon, normalizedText, normalized, displayText,
    normalizedLines, crossLine, inspectionOffset, inspection, lines,
    canToggle: method === 'cfop' && Boolean(simplifiedRecon !== recon || originalRecon !== recon || normalizedText) };
}

export function reconstructionSummary(moves: SolveMove[], timeMs: number, recon: ReconTextResult | null, executionMs: number | null, memoMs?: number) {
  const slices = sliceReconstruction(moves, timeMs, memoMs);
  const stm = recon?.stm ?? slices.htmCount;
  return { stm, tps: slices.executionMs >= 1 ? stm / (slices.executionMs / 1000) : 0,
    fluency: executionMs !== null && timeMs > 0 ? Math.round(executionMs / timeMs * 100) : null };
}

export function refKindLabel(tr: ReconstructLocalize, kind: NonNullable<StageReference['kind']>): string {
  switch (kind) {
    case 'optimal':      return tr({ zh: '最优', en: 'optimal' });
    case 'step-optimal': return tr({ zh: '步进最优', en: 'step-optimal' });
    case 'library-alg':  return tr({ zh: '库内最短', en: 'shortest in library' });
  }
}

type StageKey = 'cross' | 'f2l' | 'oll' | 'pll';

export function stageLabel(tr: ReconstructLocalize, step: StageKey): string {
  switch (step) {
    case 'cross': return tr({ zh: '十字', en: 'Cross' });
    case 'f2l':   return 'F2L';
    case 'oll':   return 'OLL';
    case 'pll':   return 'PLL';
  }
}


export function reportSeconds(ms: number | null | undefined, digits = 2): string {
  return ms == null ? '–' : (ms / 1000).toFixed(digits);
}
export function projectReferenceRows(reference: ReferenceResult | null, tr: ReconstructLocalize) {
  return (reference?.stages ?? []).filter(s => s.refSolution || s.refTurns !== null).map(s => ({ ...s,
    label: stageLabel(tr, s.step), kindLabel:s.kind ? refKindLabel(tr, s.kind) : '',
    solution:s.refSolution || (s.note === 'skipped' ? tr({zh:'跳过',en:'skipped'}) : '—') }));
}
