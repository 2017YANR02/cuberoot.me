import { moveCost, renderMove, tokenizeMoves } from '../alg_notation';
import {
  checkMbldEntry,
  formatMbldResult,
  isMbldDnf,
  mbldPoints,
  type MbldEntryCheck,
} from './stats';
import type { EventId, Penalty, Solve } from './types';

export interface ParsedTimerEntry {
  /** Raw time before a +2 penalty, in milliseconds. */
  ms: number;
  penalty: Penalty;
}

/**
 * Parse the canonical timer manual-entry syntax.
 *
 * Accepts DNF / DNS, seconds, mm:ss, hh:mm:ss, and either a `+2 ` prefix or
 * `+2` suffix. The legacy prefix is a displayed total (so two seconds are
 * removed before storing); the competition-style suffix marks a raw time that
 * still needs the penalty. Colon-delimited minute/second fields stay below 60.
 */
export function parseTimerEntry(input: string): ParsedTimerEntry | null {
  let value = input.trim();
  if (!value) return null;
  if (/^dnf$/i.test(value)) return { ms: 0, penalty: 'DNF' };
  if (/^dns$/i.test(value)) return { ms: 0, penalty: 'DNS' };

  let penalty: Penalty = 'ok';
  let plusTwoIsDisplayedTotal = false;
  if (/^\+2\s+/i.test(value)) {
    penalty = '+2';
    plusTwoIsDisplayedTotal = true;
    value = value.replace(/^\+2\s+/i, '').trim();
  } else if (/\s*\+2$/i.test(value)) {
    penalty = '+2';
    value = value.replace(/\s*\+2$/i, '').trim();
  }

  if (!/^(?:\d+(?::\d{1,2}){0,2})?(?:\.\d+)?$/.test(value)) return null;
  if (!value || value === '.') return null;
  const parts = value.split(':');
  if (parts.length > 3) return null;
  const numbers = parts.map(Number);
  if (numbers.some((part) => !Number.isFinite(part) || part < 0)) return null;

  let hours = 0;
  let minutes = 0;
  let seconds = 0;
  if (parts.length === 3) {
    [hours, minutes, seconds] = numbers;
    if (!Number.isInteger(hours) || !Number.isInteger(minutes) || minutes >= 60 || seconds >= 60) return null;
  } else if (parts.length === 2) {
    [minutes, seconds] = numbers;
    if (!Number.isInteger(minutes) || seconds >= 60) return null;
  } else {
    [seconds] = numbers;
  }

  const displayedMs = hours * 3_600_000 + minutes * 60_000 + Math.round(seconds * 1000);
  if (!Number.isSafeInteger(displayedMs) || displayedMs <= 0) return null;
  if (plusTwoIsDisplayedTotal) {
    if (displayedMs < 2000) return null;
    return { ms: displayedMs - 2000, penalty };
  }
  return { ms: displayedMs, penalty };
}

export type TimerManualEntryKind = 'time' | 'fmc' | 'mbld';

export interface TimerManualEntryDraft {
  comment: string;
  currentScramble: string;
  event: EventId;
  fmcMoveCount: string;
  fmcSolution: string;
  mbldAttempted: string;
  mbldSolved: string;
  penalty: Penalty;
  scramble: string;
  time: string;
}

/** Canonical value accepted by both website storage and the Mobile repository. */
export type TimerManualEntryValue = Pick<
  Solve,
  'comment' | 'event' | 'mbld' | 'penalty' | 'scramble' | 'timeMs'
>;

export type TimerManualEntryError =
  | 'time-required'
  | 'time-invalid'
  | 'plus-two-under-two'
  | 'fmc-required'
  | 'fmc-move-count-invalid'
  | 'fmc-solution-invalid'
  | 'mbld-attempted-invalid'
  | 'mbld-solved-invalid'
  | 'mbld-solved-exceeds-attempted'
  | 'mbld-time-invalid';

/** Host-independent bilingual copy consumed by the shared React form. */
export interface TimerManualEntryCopy {
  attempted: string;
  attemptedPlaceholder: string;
  cancel: string;
  comment: string;
  commentPlaceholder: string;
  error(error: TimerManualEntryError): string;
  fmcChecking(count: number): string;
  fmcComment: string;
  fmcInvalidToken(token: string): string;
  fmcMoveCount: string;
  fmcMoveCountPlaceholder: string;
  fmcSolved(count: number): string;
  fmcSolution: string;
  fmcSolutionPlaceholder: string;
  fmcUnchecked(count: number): string;
  fmcUnsolved(count: number): string;
  mbldDnf: string;
  mbldPoints(points: number): string;
  mbldTime: string;
  mbldTimePlaceholder: string;
  penalty: string;
  save: string;
  scramble: string;
  solved: string;
  solvedPlaceholder: string;
  time: string;
  timePlaceholder: string;
  title: string;
}

function englishError(error: TimerManualEntryError): string {
  switch (error) {
    case 'time-required': return 'Enter time';
    case 'time-invalid': return 'Invalid time';
    case 'plus-two-under-two': return '+2 time must be ≥ 2 seconds';
    case 'fmc-required': return 'Enter a solution or a move count';
    case 'fmc-move-count-invalid': return 'Move count must be a non-negative integer';
    case 'fmc-solution-invalid': return 'The solution contains invalid notation';
    case 'mbld-attempted-invalid': return 'Attempted must be a whole number of at least 2';
    case 'mbld-solved-invalid': return 'Solved must be a whole number of at least 0';
    case 'mbld-solved-exceeds-attempted': return 'Solved cannot be greater than attempted';
    case 'mbld-time-invalid': return 'Enter a time greater than zero, e.g. 58:02';
  }
}

function chineseError(error: TimerManualEntryError): string {
  switch (error) {
    case 'time-required': return '请输入时间';
    case 'time-invalid': return '时间格式无效';
    case 'plus-two-under-two': return '+2 时间须 ≥ 2 秒';
    case 'fmc-required': return '请输入解法或步数';
    case 'fmc-move-count-invalid': return '步数必须是非负整数';
    case 'fmc-solution-invalid': return '解法包含无法识别的记号';
    case 'mbld-attempted-invalid': return '尝试个数必须是不小于 2 的整数';
    case 'mbld-solved-invalid': return '还原个数必须是不小于 0 的整数';
    case 'mbld-solved-exceeds-attempted': return '还原个数不能多于尝试个数';
    case 'mbld-time-invalid': return '请输入大于 0 的时间，例如 58:02';
  }
}

const TIMER_MANUAL_ENTRY_COPY: Record<'en' | 'zh', TimerManualEntryCopy> = {
  en: {
    attempted: 'Attempted',
    attemptedPlaceholder: 'e.g. 13',
    cancel: 'Cancel',
    comment: 'Comment',
    commentPlaceholder: 'Optional notes…',
    error: englishError,
    fmcChecking: (count) => `Checking — ${count} moves`,
    fmcComment: 'Comment (saved below the solution)',
    fmcInvalidToken: (token) => `Invalid token: ${token}`,
    fmcMoveCount: 'Move count (optional — derived from the solution)',
    fmcMoveCountPlaceholder: 'e.g. 26',
    fmcSolved: (count) => `Solved — ${count} moves`,
    fmcSolution: 'Solution',
    fmcSolutionPlaceholder: "e.g. R U R' U' F2 …",
    fmcUnchecked: (count) => `Could not verify — ${count} moves`,
    fmcUnsolved: (count) => `Not solved — ${count} moves`,
    mbldDnf: 'Scored DNF by Regulation 9f12c (net score below 0, or only 1 solved)',
    mbldPoints: (points) => `${points} point${points === 1 || points === -1 ? '' : 's'}`,
    mbldTime: 'Time (mm:ss)',
    mbldTimePlaceholder: 'e.g. 58:02',
    penalty: 'Penalty',
    save: 'Save',
    scramble: 'Scramble (optional, defaults to current)',
    solved: 'Solved',
    solvedPlaceholder: 'e.g. 11',
    time: 'Time',
    timePlaceholder: 'e.g. 12.34 or 1:23.45 or DNF',
    title: 'Manual entry',
  },
  zh: {
    attempted: '已尝试',
    attemptedPlaceholder: '例如：13',
    cancel: '取消',
    comment: '注释',
    commentPlaceholder: '可选备注…',
    error: chineseError,
    fmcChecking: (count) => `正在验证 · ${count} 步`,
    fmcComment: '注释（保存在解法之后）',
    fmcInvalidToken: (token) => `无法识别的记号：${token}`,
    fmcMoveCount: '步数（留空则按解法自动计算）',
    fmcMoveCountPlaceholder: '例如：26',
    fmcSolved: (count) => `已还原 · ${count} 步`,
    fmcSolution: '解法',
    fmcSolutionPlaceholder: "例如：R U R' U' F2 …",
    fmcUnchecked: (count) => `暂时无法验证 · ${count} 步`,
    fmcUnsolved: (count) => `未还原 · ${count} 步`,
    mbldDnf: '按规则 9f12c 记 DNF（净得分小于 0，或只还原了 1 个）',
    mbldPoints: (points) => `净得分 ${points}`,
    mbldTime: '用时（分:秒）',
    mbldTimePlaceholder: '例如：58:02',
    penalty: '罚时',
    save: '保存',
    scramble: '打乱（留空则用当前打乱）',
    solved: '已还原',
    solvedPlaceholder: '例如：11',
    time: '时间',
    timePlaceholder: '例如：12.34 或 1:23.45 或 DNF',
    title: '手动录入成绩',
  },
};

export function timerManualEntryCopy(language: string): TimerManualEntryCopy {
  return TIMER_MANUAL_ENTRY_COPY[language.toLowerCase().startsWith('zh') ? 'zh' : 'en'];
}

export type TimerFmcSolutionParse =
  | { kind: 'empty' }
  | { kind: 'invalid'; token: string }
  | { kind: 'parsed'; count: number; normalized: string };

export type TimerFmcSolvedness = 'solved' | 'unsolved' | 'unchecked';

export interface TimerMbldEntryPreview {
  attempted: number;
  dnf: boolean;
  ms: number;
  points: number;
  result: string;
  solved: number;
}

export interface TimerManualEntryValidation {
  error: TimerManualEntryError | null;
  fmc: TimerFmcSolutionParse | null;
  kind: TimerManualEntryKind;
  mbld: TimerMbldEntryPreview | null;
  value: TimerManualEntryValue | null;
}

export function timerManualEntryKind(event: EventId): TimerManualEntryKind {
  if (event === '333fm') return 'fmc';
  if (event === '333mbld') return 'mbld';
  return 'time';
}

export function createTimerManualEntryDraft(
  event: EventId,
  currentScramble: string,
): TimerManualEntryDraft {
  return {
    comment: '',
    currentScramble,
    event,
    fmcMoveCount: '',
    fmcSolution: '',
    mbldAttempted: '',
    mbldSolved: '',
    penalty: 'ok',
    scramble: '',
    time: '',
  };
}

/** Strict non-negative integer input used by the two MBLD count boxes. */
function parseCount(input: string): number | null {
  const value = input.trim();
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function parseMbldDraft(draft: TimerManualEntryDraft): MbldEntryCheck {
  const time = parseTimerEntry(draft.time);
  return checkMbldEntry(
    parseCount(draft.mbldSolved),
    parseCount(draft.mbldAttempted),
    time?.penalty === 'ok' ? time.ms : null,
  );
}

function mbldError(check: Extract<MbldEntryCheck, { ok: false }>): TimerManualEntryError {
  switch (check.reason) {
    case 'attempted': return 'mbld-attempted-invalid';
    case 'solved': return 'mbld-solved-invalid';
    case 'solved-exceeds-attempted': return 'mbld-solved-exceeds-attempted';
    case 'time': return 'mbld-time-invalid';
  }
}

/**
 * Parse one FMC solution without silently dropping a typo.
 *
 * This uses the repository-wide move grammar. End-of-line `//` and `#`
 * comments are ignored exactly like the former website-only validator. OBTM
 * is HTM in this grammar: rotations cost 0, slice moves cost 2, and every
 * face/wide block turn costs 1.
 */
export function parseTimerFmcSolution(solution: string): TimerFmcSolutionParse {
  const text = solution.trim();
  if (!text) return { kind: 'empty' };

  const normalized: string[] = [];
  let count = 0;
  for (const line of solution.split(/[\r\n]+/)) {
    const code = line.replace(/(\/\/|#).*$/, '').replace(/,/g, ' ').trim();
    if (!code) continue;
    const parsed = tokenizeMoves(code);
    if (parsed.junk.length > 0) return { kind: 'invalid', token: parsed.junk[0] };
    for (const move of parsed.moves) {
      normalized.push(renderMove(move));
      count += moveCost(move, 'htm');
    }
  }
  if (normalized.length === 0) return { kind: 'empty' };
  return { kind: 'parsed', count, normalized: normalized.join(' ') };
}

/**
 * Check an already-strict FMC solution against its scramble.
 *
 * The state oracle is the same runtime-neutral completion checker used by
 * reconstruction submission. It lazy-loads cubing.js, so opening the timer
 * without the manual-entry modal does not pull that engine into the initial
 * bundle. A missing scramble is represented by an identity sequence so an
 * entered solution can still be checked rather than reported as unavailable.
 */
export async function checkTimerFmcSolvedness(
  scramble: string,
  parsed: Extract<TimerFmcSolutionParse, { kind: 'parsed' }>,
): Promise<TimerFmcSolvedness> {
  const { checkReconCompletion } = await import('../recon_completion');
  const result = await checkReconCompletion({
    event: 'fmc',
    scramble: scramble.trim() || "U U'",
    solution: parsed.normalized,
  });
  if (result.status === 'solved') return 'solved';
  if (result.status === 'unsolved' || result.status === 'invalid') return 'unsolved';
  return 'unchecked';
}

function effectiveScramble(draft: TimerManualEntryDraft): string {
  return draft.scramble.trim() || draft.currentScramble;
}

function normalizedComment(draft: TimerManualEntryDraft, kind: TimerManualEntryKind): string | undefined {
  const note = draft.comment.trim();
  if (kind !== 'fmc') return note || undefined;
  return [draft.fmcSolution.trim(), note].filter(Boolean).join('\n') || undefined;
}

function baseValue(
  draft: TimerManualEntryDraft,
  kind: TimerManualEntryKind,
  timeMs: number,
  penalty: Penalty,
): TimerManualEntryValue {
  return {
    comment: normalizedComment(draft, kind),
    event: draft.event,
    mbld: undefined,
    penalty,
    scramble: effectiveScramble(draft),
    timeMs,
  };
}

/** Validate every field and construct the exact storage-neutral solve value. */
export function validateTimerManualEntry(draft: TimerManualEntryDraft): TimerManualEntryValidation {
  const kind = timerManualEntryKind(draft.event);

  if (kind === 'mbld') {
    const parsed = parseMbldDraft(draft);
    if (!parsed.ok) {
      return { error: mbldError(parsed), fmc: null, kind, mbld: null, value: null };
    }
    const provisional: Solve = {
      id: '',
      ...baseValue(draft, kind, parsed.ms, 'ok'),
      ts: 0,
      mbld: { solved: parsed.solved, attempted: parsed.attempted },
    };
    const dnf = isMbldDnf(provisional);
    const resultSolve: Solve = { ...provisional, penalty: dnf ? 'DNF' : 'ok' };
    const value: TimerManualEntryValue = {
      ...baseValue(draft, kind, parsed.ms, dnf ? 'DNF' : 'ok'),
      mbld: provisional.mbld,
    };
    return {
      error: null,
      fmc: null,
      kind,
      mbld: {
        attempted: parsed.attempted,
        dnf,
        ms: parsed.ms,
        points: mbldPoints(provisional) ?? 0,
        result: formatMbldResult(resultSolve),
        solved: parsed.solved,
      },
      value,
    };
  }

  if (kind === 'fmc') {
    const fmc = parseTimerFmcSolution(draft.fmcSolution);
    const override = draft.fmcMoveCount.trim();
    if (override !== '') {
      const moveCount = Number(override);
      if (!Number.isFinite(moveCount) || moveCount < 0 || !Number.isInteger(moveCount)) {
        return { error: 'fmc-move-count-invalid', fmc, kind, mbld: null, value: null };
      }
      return {
        error: null,
        fmc,
        kind,
        mbld: null,
        value: baseValue(draft, kind, moveCount * 1000, 'ok'),
      };
    }
    if (fmc.kind === 'invalid') {
      return { error: 'fmc-solution-invalid', fmc, kind, mbld: null, value: null };
    }
    if (fmc.kind === 'empty') {
      return { error: 'fmc-required', fmc, kind, mbld: null, value: null };
    }
    return {
      error: null,
      fmc,
      kind,
      mbld: null,
      value: baseValue(draft, kind, fmc.count * 1000, 'ok'),
    };
  }

  const time = parseTimerEntry(draft.time);
  if (!draft.time.trim()) {
    return { error: 'time-required', fmc: null, kind, mbld: null, value: null };
  }
  if (!time) {
    const error = /^\+2\s+/i.test(draft.time.trim())
      ? 'plus-two-under-two'
      : 'time-invalid';
    return { error, fmc: null, kind, mbld: null, value: null };
  }
  const penalty = time.penalty === 'ok' ? draft.penalty : time.penalty;
  return {
    error: null,
    fmc: null,
    kind,
    mbld: null,
    value: baseValue(draft, kind, time.ms, penalty),
  };
}
