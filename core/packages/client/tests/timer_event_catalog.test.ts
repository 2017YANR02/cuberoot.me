import { describe, expect, it } from 'vitest';
import {
  EVENTS,
  TIMER_EVENT_PICKER_GROUPS,
  TIMER_EVENT_PICKER_ITEMS,
  TIMER_WCA_SCRAMBLE_EVENT_MAP,
  eventInfo,
  fromWcaSpelling,
  timerEventIdFromSelector,
  timerEventNxnSize,
  timerEventPickerItem,
  timerEventPickerName,
  timerEventSelectorId,
  timerSupportsLocalBattleSmartCube,
  timerSupportsNetBattleSmartCube,
  timerSupportsSmartCubeAutoTiming,
  timerSupportsRealWcaScrambles,
  timerWcaScrambleEventId,
  toWcaSpelling,
  type EventId,
} from '@cuberoot/shared/timer';
import { nxnSizeForEvent } from '@/app/[lang]/timer/_lib/cube/colors';

const EXPECTED_WCA: EventId[] = [
  '333', '222', '444', '555', '666', '777', '333bld', '333fm', '333oh',
  'mega', 'pyra', 'clock', 'skewb', 'sq1', '444bld', '555bld', '333mbld',
  'magic', 'mmagic',
];

const EXPECTED_OTHER: EventId[] = [
  '333ni', '333mr', '666bld', '777bld', 'r3', 'r4', 'r5',
  'cross', 'f2l', 'll', 'oll', 'pll', 'coll', 'cmll', 'zbll', 'eg1', 'eg2',
  'custom', 'fto', 'kilominx', 'gear', 'ivy', 'redi', 'mpyram',
];

const EXPECTED_REAL_WCA_EVENTS = {
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
} as const satisfies Partial<Record<EventId, string>>;

describe('shared timer event picker catalog', () => {
  it('is a complete, duplicate-free 43-event partition in the website order', () => {
    expect(TIMER_EVENT_PICKER_GROUPS.map((group) => group.id)).toEqual(['wca', 'other']);
    expect(TIMER_EVENT_PICKER_GROUPS[0].items.map((item) => item.id)).toEqual(EXPECTED_WCA);
    expect(TIMER_EVENT_PICKER_GROUPS[1].items.map((item) => item.id)).toEqual(EXPECTED_OTHER);

    const pickerIds = TIMER_EVENT_PICKER_ITEMS.map((item) => item.id);
    const eventIds = EVENTS.map((event) => event.id);
    expect(pickerIds).toHaveLength(43);
    expect(new Set(pickerIds).size).toBe(pickerIds.length);
    expect(new Set(pickerIds)).toEqual(new Set(eventIds));
  });

  it('keeps internal EventIds while round-tripping every selector spelling', () => {
    for (const item of TIMER_EVENT_PICKER_ITEMS) {
      const selectorId = timerEventSelectorId(item.id);
      expect(selectorId).toBe(toWcaSpelling(item.id));
      expect(timerEventIdFromSelector(selectorId), item.id).toBe(item.id);
      expect(fromWcaSpelling(selectorId), item.id).toBe(item.id);
    }

    expect(TIMER_EVENT_PICKER_ITEMS.map((item) => item.id)).not.toContain('333bf');
    expect(TIMER_EVENT_PICKER_ITEMS.map((item) => item.id)).not.toContain('333mbf');
    expect(TIMER_EVENT_PICKER_ITEMS.map((item) => item.id)).not.toContain('minx');
    expect(TIMER_EVENT_PICKER_ITEMS.map((item) => item.id)).not.toContain('pyram');
    expect(timerEventIdFromSelector('not-an-event')).toBeNull();
  });

  it('rejects unknown runtime ids instead of presenting them as 3x3', () => {
    const unknown = 'not-an-event' as EventId;
    expect(() => eventInfo(unknown)).toThrow('Unknown timer event: not-an-event');
    expect(() => timerEventPickerItem(unknown)).toThrow('Unknown timer event: not-an-event');
    expect(() => timerEventPickerName(unknown, 'en')).toThrow('Unknown timer event: not-an-event');
  });

  it('takes every bilingual item label from the canonical EVENTS table', () => {
    expect(TIMER_EVENT_PICKER_GROUPS.map((group) => [group.nameEn, group.nameZh])).toEqual([
      ['WCA events', 'WCA 项目'],
      ['Other puzzles', '其他项目'],
    ]);

    for (const item of TIMER_EVENT_PICKER_ITEMS) {
      const info = eventInfo(item.id);
      expect(item.nameEn, item.id).toBe(info.nameEn);
      expect(item.nameZh, item.id).toBe(info.nameZh);
      expect(timerEventPickerName(item.id, 'en'), item.id).toBe(info.nameEn);
      expect(timerEventPickerName(item.id, 'zh'), item.id).toBe(info.nameZh);
      expect(timerEventPickerItem(item.id), item.id).toBe(item);
    }
  });

  it('derives WCA icon keys through the shared spelling bridge', () => {
    for (const id of EXPECTED_WCA) {
      expect(timerEventPickerItem(id).iconClass, id).toBe(`event-${toWcaSpelling(id)}`);
    }

    expect(timerEventPickerItem('333ni').iconClass).toBe(`event-${toWcaSpelling('333bld')}`);
    for (const id of ['fto', 'kilominx', 'gear', 'ivy', 'redi', 'mpyram'] as const) {
      expect(timerEventPickerItem(id).iconClass, id).toBe(eventInfo(id).icon);
    }
  });

  it('publishes preview and smart-cube capabilities without a Mobile-only map', () => {
    const expectedNxnSizes: Partial<Record<EventId, number>> = {
      '222': 2,
      '333': 3,
      '333oh': 3,
      '333bld': 3,
      '333ni': 3,
      '333fm': 3,
      '333mr': 3,
      '444': 4,
      '444bld': 4,
      '555': 5,
      '555bld': 5,
      '666': 6,
      '666bld': 6,
      '777': 7,
      '777bld': 7,
      cross: 3,
      f2l: 3,
      ll: 3,
      oll: 3,
      pll: 3,
      coll: 3,
      cmll: 3,
      zbll: 3,
      eg1: 3,
      eg2: 3,
    };

    for (const { id } of EVENTS) {
      expect(timerEventNxnSize(id), id).toBe(expectedNxnSizes[id] ?? null);
      expect(nxnSizeForEvent(id), `Web adapter: ${id}`).toBe(timerEventNxnSize(id));
      expect(timerSupportsSmartCubeAutoTiming(id), id).toBe(
        (expectedNxnSizes[id] ?? null) === 3 && id !== '333fm',
      );
      expect(timerSupportsLocalBattleSmartCube(id), `local: ${id}`).toBe(id === '333');
      expect(timerSupportsNetBattleSmartCube(id), `net: ${id}`).toBe(id === '333' || id === '333oh');
    }
  });

  it('publishes the exact 19-event real-WCA matrix with no implicit 333 fallback', () => {
    expect(TIMER_WCA_SCRAMBLE_EVENT_MAP).toEqual(EXPECTED_REAL_WCA_EVENTS);
    expect(Object.keys(TIMER_WCA_SCRAMBLE_EVENT_MAP)).toHaveLength(19);

    for (const { id } of EVENTS) {
      const expected = EXPECTED_REAL_WCA_EVENTS[id as keyof typeof EXPECTED_REAL_WCA_EVENTS] ?? null;
      expect(timerWcaScrambleEventId(id), id).toBe(expected);
      expect(timerSupportsRealWcaScrambles(id), id).toBe(expected !== null);
    }

    expect(timerWcaScrambleEventId('222')).toBe('222');
    expect(timerWcaScrambleEventId('333mr')).toBe('333');
    expect(timerWcaScrambleEventId('333ni')).toBe('333');
    expect(timerWcaScrambleEventId('custom')).toBeNull();
    expect(timerWcaScrambleEventId('magic')).toBeNull();
  });
});
