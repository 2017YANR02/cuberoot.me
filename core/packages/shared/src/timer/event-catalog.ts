import { EVENTS, eventInfo, fromWcaSpelling, isBldEvent, toWcaSpelling, type EventId } from './types';

/** The two sections shown by the canonical solo-timer event picker. */
export type TimerEventPickerGroupId = 'wca' | 'other';

export interface TimerEventPickerItem {
  /** Always CubeRoot's internal timer EventId, never the WCA selector spelling. */
  readonly id: EventId;
  readonly nameEn: string;
  readonly nameZh: string;
  /** `@cuberoot/event-icon` key. Absent when the picker uses `textLabel`. */
  readonly iconClass?: string;
  /** Compact fallback badge for modes that do not have an event icon. */
  readonly textLabel?: string;
}

export interface TimerEventPickerGroup {
  readonly id: TimerEventPickerGroupId;
  readonly nameEn: string;
  readonly nameZh: string;
  readonly items: readonly TimerEventPickerItem[];
}

interface TimerEventPickerLayoutItem {
  readonly id: EventId;
  readonly group: TimerEventPickerGroupId;
  /** Reuse another timer event's WCA icon, for example 3BLD for 3x3 NI. */
  readonly iconEvent?: EventId;
  readonly textLabel?: string;
}

/**
 * Canonical solo-timer picker order and grouping.
 *
 * Names come from `EVENTS`; WCA icon keys come through `toWcaSpelling`; the
 * layout contains internal EventIds only. Keeping the 43 entries here means a
 * Web or App picker cannot silently drift into a different product catalog.
 */
const TIMER_EVENT_PICKER_LAYOUT = [
  // WCA grid, including the two retired Magic events still supported by Timer.
  { id: '333', group: 'wca' },
  { id: '222', group: 'wca' },
  { id: '444', group: 'wca' },
  { id: '555', group: 'wca' },
  { id: '666', group: 'wca' },
  { id: '777', group: 'wca' },
  { id: '333bld', group: 'wca' },
  { id: '333fm', group: 'wca' },
  { id: '333oh', group: 'wca' },
  { id: 'mega', group: 'wca' },
  { id: 'pyra', group: 'wca' },
  { id: 'clock', group: 'wca' },
  { id: 'skewb', group: 'wca' },
  { id: 'sq1', group: 'wca' },
  { id: '444bld', group: 'wca' },
  { id: '555bld', group: 'wca' },
  { id: '333mbld', group: 'wca' },
  { id: 'magic', group: 'wca' },
  { id: 'mmagic', group: 'wca' },

  // Extra BLD / puzzle / relay / training modes.
  { id: '333ni', group: 'other', iconEvent: '333bld' },
  { id: '333mr', group: 'other', textLabel: 'MR' },
  { id: '666bld', group: 'other', textLabel: '6BLD' },
  { id: '777bld', group: 'other', textLabel: '7BLD' },
  { id: 'r3', group: 'other', textLabel: 'R3' },
  { id: 'r4', group: 'other', textLabel: 'R4' },
  { id: 'r5', group: 'other', textLabel: 'R5' },
  { id: 'cross', group: 'other', textLabel: 'Cross' },
  { id: 'f2l', group: 'other', textLabel: 'F2L' },
  { id: 'll', group: 'other', textLabel: 'LL' },
  { id: 'oll', group: 'other', textLabel: 'OLL' },
  { id: 'pll', group: 'other', textLabel: 'PLL' },
  { id: 'coll', group: 'other', textLabel: 'COLL' },
  { id: 'cmll', group: 'other', textLabel: 'CMLL' },
  { id: 'zbll', group: 'other', textLabel: 'ZBLL' },
  { id: 'eg1', group: 'other', textLabel: 'EG-1' },
  { id: 'eg2', group: 'other', textLabel: 'EG-2' },
  { id: 'custom', group: 'other', textLabel: 'Custom' },

  // Non-WCA puzzle icons come from EventInfo.icon.
  { id: 'fto', group: 'other' },
  { id: 'kilominx', group: 'other' },
  { id: 'gear', group: 'other' },
  { id: 'ivy', group: 'other' },
  { id: 'redi', group: 'other' },
  { id: 'mpyram', group: 'other' },
] as const satisfies readonly TimerEventPickerLayoutItem[];

function pickerItem(entry: TimerEventPickerLayoutItem): TimerEventPickerItem {
  const info = eventInfo(entry.id);
  const iconClass = entry.iconEvent
    ? `event-${toWcaSpelling(entry.iconEvent)}`
    : info.icon ?? (entry.group === 'wca' ? `event-${toWcaSpelling(entry.id)}` : undefined);
  return Object.freeze({
    id: entry.id,
    nameEn: info.nameEn,
    nameZh: info.nameZh,
    ...(iconClass ? { iconClass } : {}),
    ...(entry.textLabel ? { textLabel: entry.textLabel } : {}),
  });
}

/** Flat catalog for consumers that do not render section headers. */
export const TIMER_EVENT_PICKER_ITEMS: readonly TimerEventPickerItem[] = Object.freeze(
  TIMER_EVENT_PICKER_LAYOUT.map(pickerItem),
);

/** Canonical two-group catalog shared by Web, Android, and iOS timer surfaces. */
export const TIMER_EVENT_PICKER_GROUPS: readonly TimerEventPickerGroup[] = Object.freeze([
  Object.freeze({
    id: 'wca',
    nameEn: 'WCA events',
    nameZh: 'WCA 项目',
    items: Object.freeze(TIMER_EVENT_PICKER_ITEMS.filter((_, index) => (
      TIMER_EVENT_PICKER_LAYOUT[index].group === 'wca'
    ))),
  }),
  Object.freeze({
    id: 'other',
    nameEn: 'Other puzzles',
    nameZh: '其他项目',
    items: Object.freeze(TIMER_EVENT_PICKER_ITEMS.filter((_, index) => (
      TIMER_EVENT_PICKER_LAYOUT[index].group === 'other'
    ))),
  }),
]);

/**
 * Timer event -> event_id used by CubeRoot's real WCA-scramble API.
 *
 * This is deliberately narrower than `toWcaSpelling`: a selector/icon spelling
 * does not prove that the WCA dump contains official scrambles for that timer
 * mode. Mirror Blocks and 3x3 NI intentionally practise official 3x3
 * scrambles, matching the canonical Web timer. Events absent from this table
 * must report real scrambles as unavailable; they must never fall back to 333.
 */
export const TIMER_WCA_SCRAMBLE_EVENT_MAP = Object.freeze({
  '222': '222',
  '333': '333',
  '444': '444',
  '555': '555',
  '666': '666',
  '777': '777',
  '333oh': '333oh',
  '333fm': '333fm',
  '333mr': '333',
  '333ni': '333',
  '333bld': '333bf',
  '333mbld': '333mbf',
  '444bld': '444bf',
  '555bld': '555bf',
  pyra: 'pyram',
  skewb: 'skewb',
  sq1: 'sq1',
  mega: 'minx',
  clock: 'clock',
} as const satisfies Partial<Record<EventId, string>>);

export type TimerWcaScrambleEventId =
  (typeof TIMER_WCA_SCRAMBLE_EVENT_MAP)[keyof typeof TIMER_WCA_SCRAMBLE_EVENT_MAP];

const TIMER_WCA_SCRAMBLE_EVENT_IDS = new Set<string>(
  Object.values(TIMER_WCA_SCRAMBLE_EVENT_MAP),
);

export function isTimerWcaScrambleEventId(value: unknown): value is TimerWcaScrambleEventId {
  return typeof value === 'string' && TIMER_WCA_SCRAMBLE_EVENT_IDS.has(value);
}

/** Return the exact API event_id, or null when no official pool exists. */
export function timerWcaScrambleEventId(id: EventId): TimerWcaScrambleEventId | null {
  const map: Partial<Record<EventId, TimerWcaScrambleEventId>> = TIMER_WCA_SCRAMBLE_EVENT_MAP;
  return map[id] ?? null;
}

/** Capability check shared by Web, Android, and iOS source selectors. */
export function timerSupportsRealWcaScrambles(id: EventId): boolean {
  return timerWcaScrambleEventId(id) !== null;
}

const PICKER_ITEM_BY_EVENT = new Map(
  TIMER_EVENT_PICKER_ITEMS.map((item) => [item.id, item] as const),
);

const THREE_BY_THREE_PREVIEW_EVENTS = new Set<EventId>([
  '333', '333oh', '333bld', '333ni', '333fm', '333mr',
  'cross', 'f2l', 'll', 'oll', 'pll', 'coll', 'cmll', 'zbll', 'eg1', 'eg2',
]);

/** Look up a picker item without making each app rebuild its own event map. */
export function timerEventPickerItem(id: EventId): TimerEventPickerItem {
  const item = PICKER_ITEM_BY_EVENT.get(id);
  if (!item) throw new Error(`Unknown timer event: ${id}`);
  return item;
}

/** Runtime-neutral label helper for the two supported product languages. */
export function timerEventPickerName(id: EventId, language: 'en' | 'zh'): string {
  const item = timerEventPickerItem(id);
  return language === 'zh' ? item.nameZh : item.nameEn;
}

/**
 * Export the canonical selector spelling without leaking it into stored data.
 * This wrapper makes the intended boundary explicit at UI adapters.
 */
export function timerEventSelectorId(id: EventId): string {
  return toWcaSpelling(id);
}

/** Convert a picker/URL selector spelling back to a validated internal id. */
export function timerEventIdFromSelector(id: string): EventId | null {
  const internal = fromWcaSpelling(id);
  return EVENTS.some((event) => event.id === internal) ? internal : null;
}

/** NxN renderer size for timer modes whose scramble can be shown as one cube. */
export function timerEventNxnSize(id: EventId): number | null {
  if (id === '222') return 2;
  if (id === '444' || id === '444bld') return 4;
  if (id === '555' || id === '555bld') return 5;
  if (id === '666' || id === '666bld') return 6;
  if (id === '777' || id === '777bld') return 7;
  if (THREE_BY_THREE_PREVIEW_EVENTS.has(id)) return 3;
  return null;
}

/** Smart cubes can verify any plain 3x3-shaped scramble used by the Web timer. */
export function timerSupportsSmartCubeAutoTiming(id: EventId): boolean {
  return timerEventNxnSize(id) === 3 && id !== '333fm';
}

/** BLD timing includes memorization, so its first solve turn must never start the clock. */
export function timerSmartCubeStartsAttemptOnTurn(id: EventId): boolean {
  return timerSupportsSmartCubeAutoTiming(id) && !isBldEvent(id);
}

export function timerSupportsLocalBattleSmartCube(id: EventId): boolean {
  return id === '333';
}

export function timerSupportsNetBattleSmartCube(id: EventId): boolean {
  return id === '333' || id === '333oh';
}
