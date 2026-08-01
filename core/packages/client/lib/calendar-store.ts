'use client';

// /calendar 的客户端状态 —— 服务端只发「主事件 + 重复规则」,这里负责:
//   1. 按可视范围向后端要一段带余量的窗口(翻月不必每次都打服务器);
//   2. 把重复规则展开成一个个格子里的块(@cuberoot/shared/recur,和服务端同一份实现);
//   3. 记住本地偏好(隐藏了哪些日历、上次的视图、显示时区)。
//
// 写操作一律「服务端为准」:改完重拉当前窗口,而不是在本地猜结果 —— 重复事件的
// 「只改这一次 / 此后所有」会在服务端拆出新行,本地猜不准。

import { create } from 'zustand';
import {
  createCalendar, createEvent, deleteCalendar, deleteEvent, fetchBootstrap, fetchEvents,
  rotateShareToken, rsvp, saveShare, updateCalendar, updateEvent,
  type EventDraft,
} from './calendar-api';
import { expandOccurrences } from '@cuberoot/shared/recur';
import type {
  CalEvent, CalendarMeta, EditScope, EventOccurrence, ShareDetail, ShareSettings,
} from '@cuberoot/shared/calendar';
import { persistItem } from './safe-storage';

const HIDDEN_KEY = 'cuberoot-calendar.hidden.v1';
const PREF_KEY = 'cuberoot-calendar.prefs.v1';

/** 每次向后端要数据时,在可视范围两侧各留这么多天的余量。 */
const PAD_DAYS = 62;
const DAY = 86_400_000;

export interface CalendarPrefs {
  /** 上次用的视图 */
  view: string;
  /** 显示时区(空 = 跟随本机) */
  tz: string;
  /** 周起始:0=周日,1=周一 */
  weekStart: 0 | 1;
  /** 24 小时制 */
  hour24: boolean;
  /** 显示周末 */
  weekends: boolean;
  /** 显示已拒绝的邀请 */
  showDeclined: boolean;
}

export const DEFAULT_PREFS: CalendarPrefs = {
  view: 'timeGridWeek', tz: '', weekStart: 1, hour24: true, weekends: true, showDeclined: false,
};

function readPrefs(): CalendarPrefs {
  if (typeof window === 'undefined') return DEFAULT_PREFS;
  try {
    const raw = localStorage.getItem(PREF_KEY);
    return raw ? { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<CalendarPrefs>) } : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}

function readHidden(): number[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(HIDDEN_KEY);
    const v = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(v) ? v.map(Number).filter(Number.isFinite) : [];
  } catch {
    return [];
  }
}

interface State {
  ready: boolean;
  loading: boolean;
  error: string;
  me: { key: string; name: string; avatar: string } | null;
  calendars: CalendarMeta[];
  events: CalEvent[];
  invitedIds: number[];
  share: ShareSettings | null;
  hidden: number[];
  prefs: CalendarPrefs;
  /** 已经从后端取回的时间窗口 */
  loadedFrom: number;
  loadedTo: number;
}

interface Actions {
  init: (tz: string) => Promise<void>;
  ensureRange: (from: number, to: number) => Promise<void>;
  reload: () => Promise<void>;
  setPrefs: (patch: Partial<CalendarPrefs>) => void;
  toggleHidden: (id: number) => void;
  addCalendar: (input: { name: string; color: string; tz: string }) => Promise<void>;
  patchCalendar: (id: number, input: Partial<{ name: string; color: string; tz: string }>) => Promise<void>;
  removeCalendar: (id: number) => Promise<void>;
  addEvent: (draft: EventDraft) => Promise<void>;
  patchEvent: (id: number, draft: EventDraft, scope: EditScope) => Promise<void>;
  removeEvent: (id: number, scope: EditScope, occurrenceMs?: number) => Promise<void>;
  respond: (id: number, status: 'accepted' | 'declined') => Promise<void>;
  updateShare: (input: {
    enabled?: boolean; detail?: ShareDetail; title?: string; calendarIds?: number[]; tz?: string;
  }) => Promise<void>;
  rotateShare: () => Promise<void>;
}

export const useCalendarStore = create<State & Actions>()((set, get) => ({
  ready: false,
  loading: false,
  error: '',
  me: null,
  calendars: [],
  events: [],
  invitedIds: [],
  share: null,
  hidden: [],
  prefs: DEFAULT_PREFS,
  loadedFrom: 0,
  loadedTo: 0,

  init: async (tz) => {
    set({ loading: true, error: '', hidden: readHidden(), prefs: readPrefs() });
    try {
      const boot = await fetchBootstrap(tz);
      set({ calendars: boot.calendars, share: boot.share, me: boot.me, ready: true });
    } catch (e) {
      set({ error: (e as Error).message });
    } finally {
      set({ loading: false });
    }
  },

  ensureRange: async (from, to) => {
    const s = get();
    if (!s.ready) return;
    if (from >= s.loadedFrom && to <= s.loadedTo) return;
    const padFrom = from - PAD_DAYS * DAY;
    const padTo = to + PAD_DAYS * DAY;
    set({ loading: true });
    try {
      const data = await fetchEvents(padFrom, padTo);
      set({ events: data.events, invitedIds: data.invitedIds, loadedFrom: padFrom, loadedTo: padTo, error: '' });
    } catch (e) {
      set({ error: (e as Error).message });
    } finally {
      set({ loading: false });
    }
  },

  reload: async () => {
    const { loadedFrom, loadedTo } = get();
    if (loadedTo === 0) return;
    try {
      const data = await fetchEvents(loadedFrom, loadedTo);
      set({ events: data.events, invitedIds: data.invitedIds, error: '' });
    } catch (e) {
      set({ error: (e as Error).message });
    }
  },

  setPrefs: (patch) => {
    const prefs = { ...get().prefs, ...patch };
    set({ prefs });
    persistItem(PREF_KEY, JSON.stringify(prefs));
  },

  toggleHidden: (id) => {
    const hidden = get().hidden.includes(id) ? get().hidden.filter((x) => x !== id) : [...get().hidden, id];
    set({ hidden });
    persistItem(HIDDEN_KEY, JSON.stringify(hidden));
  },

  addCalendar: async (input) => {
    const cal = await createCalendar(input);
    set({ calendars: [...get().calendars, cal] });
  },

  patchCalendar: async (id, input) => {
    const cal = await updateCalendar(id, input);
    set({ calendars: get().calendars.map((c) => (c.id === id ? cal : c)) });
  },

  removeCalendar: async (id) => {
    await deleteCalendar(id);
    set({
      calendars: get().calendars.filter((c) => c.id !== id),
      events: get().events.filter((e) => e.calendarId !== id),
    });
  },

  addEvent: async (draft) => {
    await createEvent(draft);
    await get().reload();
  },

  patchEvent: async (id, draft, scope) => {
    await updateEvent(id, draft, scope);
    await get().reload();
  },

  removeEvent: async (id, scope, occurrenceMs) => {
    await deleteEvent(id, scope, occurrenceMs);
    await get().reload();
  },

  respond: async (id, status) => {
    await rsvp(id, status);
    await get().reload();
  },

  updateShare: async (input) => {
    const share = await saveShare(input);
    set({ share });
  },

  rotateShare: async () => {
    const share = await rotateShareToken();
    set({ share });
  },
}));

// ── 展开 ────────────────────────────────────────────────────────────────────

export interface ExpandContext {
  events: CalEvent[];
  hidden: number[];
  from: number;
  to: number;
  /** 我的归属键,用来判断「别人邀请我的」 */
  meKey?: string;
  /** 已拒绝的邀请是否照样显示 */
  showDeclined?: boolean;
}

/**
 * 把事件列表展开成窗口内的一个个块。重复事件按规则展开,单次覆盖行原样出现
 * (它们对应的 occurrence 已在主事件的 exdates 里被剔掉,不会重影)。
 */
export function expandRange(ctx: ExpandContext): EventOccurrence[] {
  const hidden = new Set(ctx.hidden);
  const out: EventOccurrence[] = [];
  for (const e of ctx.events) {
    if (hidden.has(e.calendarId)) continue;
    if (!ctx.showDeclined && ctx.meKey) {
      const mine = e.guests.find((g) => g.key === ctx.meKey);
      if (mine && mine.status === 'declined') continue;
    }
    const dur = Math.max(0, e.end - e.start);
    const starts = expandOccurrences({
      rrule: e.rrule, start: e.start, tz: e.tz, exdates: e.exdates,
      from: ctx.from, to: ctx.to, durationMs: dur, limit: 400,
    });
    for (const s of starts) {
      out.push({ key: `${e.id}:${s}`, event: e, start: s, end: s + dur, recurring: e.rrule !== '' });
    }
  }
  out.sort((a, b) => a.start - b.start || a.end - b.end);
  return out;
}

/** 事件 key(`<id>:<occurrenceStart>`)→ 拆回两段。 */
export function parseOccurrenceKey(key: string): { id: number; start: number } | null {
  const m = /^(\d+):(\d+)$/.exec(key);
  return m ? { id: Number(m[1]), start: Number(m[2]) } : null;
}
