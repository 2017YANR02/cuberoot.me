export const PB_EVENT_IDS = [
  '333', '222', '444', '555', '666', '777', '333oh', 'clock', 'minx',
  'pyram', 'skewb', 'sq1', '333bf', '444bf', '555bf', '333fm', '333mbf',
] as const;

export type PbEventId = typeof PB_EVENT_IDS[number];
export type PbRecordType = 'single' | 'mean' | 'average';

export interface PbRecordOption {
  recordType: PbRecordType;
  setSize: number;
}

export const PB_RECORD_OPTIONS: readonly PbRecordOption[] = [
  { recordType: 'single', setSize: 1 },
  { recordType: 'mean', setSize: 3 },
  { recordType: 'average', setSize: 5 },
  { recordType: 'average', setSize: 12 },
  { recordType: 'average', setSize: 50 },
  { recordType: 'average', setSize: 100 },
  { recordType: 'average', setSize: 1000 },
  { recordType: 'average', setSize: 10000 },
] as const;

export function pbRecordOptionLabel(
  recordType: PbRecordType,
  setSize: number,
  singleLabel: string,
): string {
  if (recordType === 'single') return singleLabel;
  return `${recordType === 'mean' ? 'Mo' : 'Ao'}${setSize}`;
}

const EVENT_IDS = new Set<string>(PB_EVENT_IDS);
const VALID_SIZES: Record<PbRecordType, ReadonlySet<number>> = {
  single: new Set([1]),
  mean: new Set([3]),
  average: new Set([5, 12, 50, 100, 1000, 10000]),
};

export function isPbRecordKey(
  eventId: string,
  recordType: PbRecordType,
  setSize: number,
): eventId is PbEventId {
  if (!EVENT_IDS.has(eventId) || !VALID_SIZES[recordType]?.has(setSize)) return false;
  return eventId !== '333mbf' || (recordType === 'single' && setSize === 1);
}

function decodeMbld(value: number): { difference: number; missed: number; seconds: number } {
  return {
    missed: value % 100,
    seconds: Math.floor(value / 100) % 100_000,
    difference: 99 - (Math.floor(value / 10_000_000) % 100),
  };
}

export function isValidPbResultValue(
  eventId: string,
  recordType: PbRecordType,
  value: number,
): boolean {
  if (!Number.isSafeInteger(value) || value <= 0) return false;
  if (eventId === '333mbf') {
    if (value < 10_000_000 || value >= 1_000_000_000) return false;
    const { difference, missed, seconds } = decodeMbld(value);
    const solved = difference + missed;
    const attempted = solved + missed;
    return difference >= 0 && solved >= 2 && attempted <= 99 && seconds <= 86_400;
  }
  if (eventId === '333fm') {
    return recordType === 'single' ? value <= 999 : value >= 100 && value <= 99_999;
  }
  return value <= 86_399_999;
}

function parseTime(raw: string): number | null {
  if (!/^\d+(?::[0-5]\d){0,2}(?:\.\d{1,2})?$/.test(raw)) return null;
  const parts = raw.split(':');
  if (parts.length > 3) return null;
  const seconds = parts.reduce((total, part) => total * 60 + Number(part), 0);
  const value = Math.round(seconds * 100);
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

function parseMbld(raw: string): number | null {
  const match = /^(\d{1,2})\/(\d{1,2})\s+(\d+(?::[0-5]\d){1,2})$/.exec(raw);
  if (!match) return null;
  const solved = Number(match[1]);
  const attempted = Number(match[2]);
  const timeParts = match[3].split(':');
  const seconds = timeParts.reduce((total, part) => total * 60 + Number(part), 0);
  const missed = attempted - solved;
  const difference = solved - missed;
  if (solved < 2 || attempted > 99 || missed < 0 || difference < 0 || seconds > 86_400) return null;
  const value = (99 - difference) * 10_000_000 + seconds * 100 + missed;
  return isValidPbResultValue('333mbf', 'single', value) ? value : null;
}

/** Parse a human-entered PB into WCA's raw result representation. */
export function parsePbResultInput(
  rawInput: string,
  eventId: string,
  recordType: PbRecordType,
): number | null {
  const raw = rawInput.trim();
  if (!raw) return null;
  if (eventId === '333mbf') return parseMbld(raw);
  if (eventId === '333fm') {
    const numeric = Number(raw);
    const value = recordType === 'single' ? numeric : Math.round(numeric * 100);
    return isValidPbResultValue(eventId, recordType, value) ? value : null;
  }
  const value = parseTime(raw);
  return value != null && isValidPbResultValue(eventId, recordType, value) ? value : null;
}
