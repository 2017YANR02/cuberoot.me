import type { Penalty } from './types';
import {
  decodeTimerWcaCompetitionScrambleSlot,
  decodeTimerWcaCompetitionScrambleSlotIdentity,
  timerWcaCompetitionScrambleSlotIdentity,
  type TimerWcaCompetitionScrambleSlot,
} from './wca-source-config';

export interface TimerWcaFinitePoolProgress {
  seen: number;
  total: number;
  done: boolean;
}

type TimerWcaSlotInput = TimerWcaCompetitionScrambleSlot | string;

function slotIdentity(value: TimerWcaSlotInput): string | null {
  if (typeof value === 'string') {
    const slot = decodeTimerWcaCompetitionScrambleSlotIdentity(value);
    return slot ? timerWcaCompetitionScrambleSlotIdentity(slot) : null;
  }
  const slot = decodeTimerWcaCompetitionScrambleSlot(value);
  return slot ? timerWcaCompetitionScrambleSlotIdentity(slot) : null;
}

/** Occurrence-aware progress for WCA pools whose complete slot set is known. */
export class TimerWcaFinitePoolProgressTracker {
  readonly #closed = new Map<string, Set<string>>();
  readonly #served = new Map<string, Set<string>>();

  registerClosedSet(sourceKey: string, slots: readonly TimerWcaSlotInput[]): boolean {
    if (!sourceKey) return false;
    const identities: string[] = [];
    for (const slot of slots) {
      const identity = slotIdentity(slot);
      if (!identity) return false;
      identities.push(identity);
    }
    if (identities.length === 0) {
      this.#closed.delete(sourceKey);
      return false;
    }
    this.#closed.set(sourceKey, new Set(identities));
    return true;
  }

  noteServed(sourceKey: string, slot: TimerWcaSlotInput): boolean {
    const identity = slotIdentity(slot);
    if (!sourceKey || !identity) return false;
    const served = this.#served.get(sourceKey) ?? new Set<string>();
    served.add(identity);
    this.#served.set(sourceKey, served);
    return true;
  }

  get(sourceKey: string): TimerWcaFinitePoolProgress | null {
    const closed = this.#closed.get(sourceKey);
    if (!closed?.size) return null;
    const served = this.#served.get(sourceKey);
    let seen = 0;
    for (const identity of closed) if (served?.has(identity)) seen += 1;
    return { seen, total: closed.size, done: seen === closed.size };
  }
}

export interface TimerWcaScrambleProgressLabels {
  allMarks: string;
  allPracticed(total: number): string;
  allPracticedTitle(total: number): string;
  marks(count: number): string;
  marksTitle: string;
  practiced(seen: number, total: number): string;
  practicedTitle(seen: number, total: number): string;
}

/** Canonical bilingual copy for rare-pool progress and public scramble marks. */
export const TIMER_WCA_SCRAMBLE_PROGRESS_COPY = {
  allMarks: {
    en: 'All marks',
    zh: '全站足迹',
  },
  allPracticed: {
    en: (total: number) => `All ${total} practiced`,
    zh: (total: number) => `${total} 条已全部练过`,
  },
  allPracticedTitle: {
    en: (total: number) => `Only ${total} WCA scrambles match the current filters — all practiced, so they now repeat`,
    zh: (total: number) => `符合当前筛选的 WCA 真题只有 ${total} 条,已全部练过,之后是重复出题`,
  },
  marks: {
    en: (count: number) => `${count} did it`,
    zh: (count: number) => `${count} 人做过`,
  },
  marksTitle: {
    en: 'Who did this scramble',
    zh: '谁做过这条打乱',
  },
  practiced: {
    en: (seen: number, total: number) => `${seen}/${total} practiced`,
    zh: (seen: number, total: number) => `已练 ${seen}/${total}`,
  },
  practicedTitle: {
    en: (_seen: number, total: number) => `Only ${total} WCA scrambles match the current filters — they repeat once all are practiced`,
    zh: (_seen: number, total: number) => `符合当前筛选的 WCA 真题只有 ${total} 条,练完后会重复出题`,
  },
} as const;

/** Resolve the canonical copy without introducing a host-specific i18n layer. */
export function timerWcaScrambleProgressLabels(language: string): TimerWcaScrambleProgressLabels {
  const key = language.toLowerCase().startsWith('zh') ? 'zh' : 'en';
  return {
    allMarks: TIMER_WCA_SCRAMBLE_PROGRESS_COPY.allMarks[key],
    allPracticed: TIMER_WCA_SCRAMBLE_PROGRESS_COPY.allPracticed[key],
    allPracticedTitle: TIMER_WCA_SCRAMBLE_PROGRESS_COPY.allPracticedTitle[key],
    marks: TIMER_WCA_SCRAMBLE_PROGRESS_COPY.marks[key],
    marksTitle: TIMER_WCA_SCRAMBLE_PROGRESS_COPY.marksTitle[key],
    practiced: TIMER_WCA_SCRAMBLE_PROGRESS_COPY.practiced[key],
    practicedTitle: TIMER_WCA_SCRAMBLE_PROGRESS_COPY.practicedTitle[key],
  };
}

export interface TimerWcaScrambleMarkKey {
  ci: string;
  e: string;
  r: string;
  g: string;
  x: 0 | 1;
  n: number;
}

export function decodeTimerWcaScrambleMarkKey(value: unknown): TimerWcaScrambleMarkKey | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const key = value as Record<string, unknown>;
  if (key.x !== 0 && key.x !== 1) return null;
  const slot = decodeTimerWcaCompetitionScrambleSlot({
    competitionId: key.ci,
    eventId: key.e,
    roundTypeId: key.r,
    groupId: key.g,
    isExtra: key.x === 1,
    scrambleNumber: key.n,
  });
  return slot ? {
    ci: slot.competitionId,
    e: slot.eventId,
    r: slot.roundTypeId,
    g: slot.groupId,
    x: slot.isExtra ? 1 : 0,
    n: slot.scrambleNumber,
  } : null;
}

export function timerWcaScrambleMarkKeyFromSlot(
  slot: TimerWcaCompetitionScrambleSlot,
): TimerWcaScrambleMarkKey {
  const value = decodeTimerWcaCompetitionScrambleSlot(slot);
  if (!value) throw new TypeError('Invalid WCA competition scramble slot');
  return {
    ci: value.competitionId,
    e: value.eventId,
    r: value.roundTypeId,
    g: value.groupId,
    x: value.isExtra ? 1 : 0,
    n: value.scrambleNumber,
  };
}

export function timerWcaScrambleMarkKeyIdentity(key: TimerWcaScrambleMarkKey): string {
  const value = decodeTimerWcaScrambleMarkKey(key);
  if (!value) throw new TypeError('Invalid WCA scramble mark key');
  return timerWcaCompetitionScrambleSlotIdentity({
    competitionId: value.ci,
    eventId: value.e,
    roundTypeId: value.r,
    groupId: value.g,
    isExtra: value.x === 1,
    scrambleNumber: value.n,
  });
}

export interface TimerWcaScrambleMark {
  wcaId: string;
  name: string;
  country: string;
  timeCs: number | null;
  createdAt: number;
}

export interface TimerWcaScrambleMarksResponse {
  count: number;
  marks: TimerWcaScrambleMark[];
}

const TIMER_WCA_MARK_MAX_TIME_CS = 36_000_000;

function decodeMark(value: unknown): TimerWcaScrambleMark | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const mark = value as Record<string, unknown>;
  if (typeof mark.wcaId !== 'string' || !/^[A-Za-z0-9:_-]{1,20}$/.test(mark.wcaId)
    || typeof mark.name !== 'string' || mark.name.length > 200
    || typeof mark.country !== 'string' || !/^(?:[A-Z]{2})?$/.test(mark.country)
    || (mark.timeCs !== null && (typeof mark.timeCs !== 'number'
      || !Number.isSafeInteger(mark.timeCs)
      || mark.timeCs < 1
      || mark.timeCs > TIMER_WCA_MARK_MAX_TIME_CS))
    || typeof mark.createdAt !== 'number'
    || !Number.isSafeInteger(mark.createdAt)
    || mark.createdAt < 0) return null;
  return {
    wcaId: mark.wcaId,
    name: mark.name,
    country: mark.country,
    timeCs: mark.timeCs,
    createdAt: mark.createdAt,
  };
}

export function decodeTimerWcaScrambleMarksResponse(
  value: unknown,
): TimerWcaScrambleMarksResponse | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const response = value as Record<string, unknown>;
  if (typeof response.count !== 'number'
    || !Number.isSafeInteger(response.count)
    || response.count < 0
    || !Array.isArray(response.marks)) return null;
  const marks = response.marks.map(decodeMark);
  if (marks.some((mark) => mark === null) || response.count < marks.length) return null;
  return { count: response.count, marks: marks as TimerWcaScrambleMark[] };
}

export interface TimerWcaScrambleMarksHttp {
  apiBase: string;
  fetcher: (
    input: string,
    init?: { method?: string; headers?: Record<string, string>; body?: string },
  ) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;
  token?: string | null;
}

function marksEndpoint(apiBase: string): string {
  return `${apiBase.replace(/\/+$/, '')}/v1/scramble-marks`;
}

function markQuery(key: TimerWcaScrambleMarkKey): string {
  const value = decodeTimerWcaScrambleMarkKey(key);
  if (!value) throw new TypeError('Invalid WCA scramble mark key');
  return new URLSearchParams({
    ci: value.ci,
    e: value.e,
    r: value.r,
    g: value.g,
    x: String(value.x),
    n: String(value.n),
  }).toString();
}

export async function fetchTimerWcaScrambleMarks(
  key: TimerWcaScrambleMarkKey,
  http: TimerWcaScrambleMarksHttp,
): Promise<TimerWcaScrambleMarksResponse> {
  const response = await http.fetcher(`${marksEndpoint(http.apiBase)}?${markQuery(key)}`);
  if (!response.ok) throw new Error(`Failed to fetch WCA scramble marks (${response.status})`);
  const decoded = decodeTimerWcaScrambleMarksResponse(await response.json());
  if (!decoded) throw new Error('Invalid WCA scramble marks response');
  return decoded;
}

export interface TimerWcaScrambleMarkWrite {
  timeCs: number | null;
  country: string;
}

interface TimerWcaScrambleMarkWriteResult {
  createdAt: number | null;
  updated: boolean;
}

async function writeTimerWcaScrambleMark(
  key: TimerWcaScrambleMarkKey,
  mark: TimerWcaScrambleMarkWrite,
  http: TimerWcaScrambleMarksHttp,
  method: 'PATCH' | 'POST',
): Promise<TimerWcaScrambleMarkWriteResult> {
  const value = decodeTimerWcaScrambleMarkKey(key);
  if (!value) throw new TypeError('Invalid WCA scramble mark key');
  if (!http.token || /[\r\n]/.test(http.token)) throw new Error('WCA scramble mark login required');
  if ((mark.timeCs !== null && (!Number.isSafeInteger(mark.timeCs)
    || mark.timeCs < 1 || mark.timeCs > TIMER_WCA_MARK_MAX_TIME_CS))
    || !/^(?:[A-Z]{2})?$/.test(mark.country)) throw new TypeError('Invalid WCA scramble mark');
  const response = await http.fetcher(marksEndpoint(http.apiBase), {
    method,
    headers: {
      Authorization: `Bearer ${http.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ...value, ...mark }),
  });
  if (!response.ok) throw new Error(`Failed to post WCA scramble mark (${response.status})`);
  const payload = await response.json();
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Invalid WCA scramble mark response');
  }
  const result = payload as Record<string, unknown>;
  const createdAt = result.createdAt;
  if (result.ok !== true || (createdAt !== null && (typeof createdAt !== 'number'
    || !Number.isSafeInteger(createdAt) || createdAt < 0))) {
    throw new Error('Invalid WCA scramble mark response');
  }
  if (method === 'POST') {
    if (createdAt === null) throw new Error('Invalid WCA scramble mark response');
    return { createdAt, updated: true };
  }
  if (typeof result.updated !== 'boolean'
    || result.updated !== (createdAt !== null)) {
    throw new Error('Invalid WCA scramble mark response');
  }
  return { createdAt, updated: result.updated };
}

/** Create or update the authenticated user's mark. Existing clients retain POST semantics. */
export async function postTimerWcaScrambleMark(
  key: TimerWcaScrambleMarkKey,
  mark: TimerWcaScrambleMarkWrite,
  http: TimerWcaScrambleMarksHttp,
): Promise<number> {
  const result = await writeTimerWcaScrambleMark(key, mark, http, 'POST');
  return result.createdAt!;
}

/** Update the authenticated user's mark only when it already exists; never creates one. */
export async function updateTimerWcaScrambleMarkIfExists(
  key: TimerWcaScrambleMarkKey,
  mark: TimerWcaScrambleMarkWrite,
  http: TimerWcaScrambleMarksHttp,
): Promise<boolean> {
  return (await writeTimerWcaScrambleMark(key, mark, http, 'PATCH')).updated;
}

export const DEFAULT_TIMER_AUTO_MARK_WCA_SCRAMBLE = true;

export type TimerWcaScrambleMarkWriteMode = 'upsert' | 'update-only';

/** Authenticated write intent; update-only lets the server decide private ownership. */
export function timerWcaScrambleMarkWriteMode(input: {
  penalty: Penalty;
  signedIn: boolean;
  enabled: boolean;
}): TimerWcaScrambleMarkWriteMode | null {
  if (!input.signedIn || (input.penalty !== 'ok' && input.penalty !== '+2')) return null;
  return input.enabled ? 'upsert' : 'update-only';
}

export function shouldAutoMarkTimerWcaScramble(input: {
  penalty: Penalty;
  signedIn: boolean;
  enabled: boolean;
  alreadyMine: boolean;
}): boolean {
  const mode = timerWcaScrambleMarkWriteMode(input);
  return mode === 'upsert' || (mode === 'update-only' && input.alreadyMine);
}
