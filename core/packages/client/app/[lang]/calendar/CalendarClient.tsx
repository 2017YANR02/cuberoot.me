'use client';

// /calendar —— 登录用户的个人日历。
//
// 结构和 Google 日历一致:左栏(迷你月历 + 我的日历 + 邀请)、顶栏(今天 / 翻页 / 标题 /
// 搜索 / 视图)、主区是 FullCalendar 的月 / 周 / 日 / 4 天 / 年 / 日程六个视图。
//
// 三条边界值得记住:
//   1. 数据源是「主事件 + 重复规则」,格子里的块是客户端展开的(lib/calendar-store);
//   2. 改重复事件一定先问作用域(此次 / 此后 / 全部),拖拽也一样 —— 不问就等于替用户
//      做了不可逆的决定;
//   3. 事件自带时区,顶栏可以切「显示时区」,两者不是一回事:出差时把显示时区切到当地,
//      北京时间的会自动落到当地钟点上,事件本身不动。

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryState, parseAsString, parseAsStringEnum } from 'nuqs';
import {
  CalendarDays, ChevronLeft, ChevronRight, Download, Globe, Menu, Plus, Search, Settings,
  Share2, Undo2, Upload, X,
} from 'lucide-react';
import BackHome from '@/components/BackHome';
import HeaderToggles from '@/components/HeaderToggles';
import AppLink from '@/components/AppLink';
import { ListSelect } from '@/components/ListSelect';
import { ClearButton } from '@/components/ClearButton';
import { useAuthUser, nextQuery } from '@/lib/auth-store';
import { useIsMobile } from '@/hooks/useIsMobile';
import { usePopoverDismiss } from '@/hooks/usePopoverDismiss';
import { tr, useLang } from '@/i18n/tr';
import { localZone, isValidZone, formatOffset, zoneOffsetMinutes } from '@cuberoot/shared/tz';
import { eventsToIcs, type CalEvent, type CalendarImport, type EditScope } from '@cuberoot/shared/calendar';
import { colorHex, readableInk } from '@/lib/calendar-colors';
import { useEffectiveTheme } from '@/lib/theme';
import { zoneLabel, zoneOptions, zoneSearchTerms } from '@/lib/tz-zones';
import { expandRange, parseOccurrenceKey, useCalendarStore } from '@/lib/calendar-store';
import { exportIcs, listImports, undoImport } from '@/lib/calendar-api';
import { importCalendarFile, type ImportProgress } from './_lib/import';
import CalendarGrid, { type GridHandle, type GridRange } from './_components/CalendarGrid';
import EventDialog, { type DialogDraft } from './_components/EventDialog';
import ShareDialog from './_components/ShareDialog';
import ScopePrompt from './_components/ScopePrompt';
import Sidebar from './_components/Sidebar';
import CalendarSettings, { SETTINGS_SECTIONS } from './_components/CalendarSettings';
import CompetitionCalendars from './_components/CompetitionCalendars';
import CompetitionDialog from './_components/CompetitionDialog';
import GoogleBackupPanel from './_components/GoogleBackupPanel';
import { readGoogleBackup, reviewGoogleBackup, type GoogleImportReview } from '@/lib/google-calendar-backup';
import { useWcaCalendar } from './_lib/useWcaCalendar';
import { competitionCalendarEvent, type CalendarCompetition } from './_lib/competitions';
import {
  dayKeyIn, dayStart, defaultEventEnd, formatClock, formatLongDate, rangeTitle, toFcEvents,
  VIEW_KEYS, VIEW_LABELS, isViewKey, type ViewKey,
} from './_lib/format';
import './calendar.css';

const DAY = 86_400_000;

/** 拖拽 / 缩放后待确认的改动(重复事件要先问作用域)。 */
interface PendingMove {
  id: number;
  occurrence: number;
  start: number;
  end: number;
  allDay: boolean;
  revert: () => void;
}

export default function CalendarClient() {
  const lang = useLang();
  const isZh = lang === 'zh';
  const user = useAuthUser();
  const theme = useEffectiveTheme();
  const eventColor = useCallback((key: string) => colorHex(key, theme), [theme]);
  const isMobile = useIsMobile(900);
  // 900 是「侧栏改抽屉」的线;真正窄到一周排不开是 640(同 calendar.css 里那档)。
  const isNarrow = useIsMobile(640);
  const gridRef = useRef<GridHandle>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const store = useCalendarStore();
  const { calendars, events, hidden, prefs, share, me } = store;

  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const [now, setNow] = useState(0);
  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  // 显示时区:偏好里空 = 跟随本机。挂载前一律 UTC,免得 SSG 首帧和客户端对不上。
  const displayTz = useMemo(() => {
    if (!mounted) return 'UTC';
    return prefs.tz && isValidZone(prefs.tz) ? prefs.tz : localZone();
  }, [mounted, prefs.tz]);

  // ── URL 状态 ────────────────────────────────────────────────────────────
  const [viewParam, setViewParam] = useQueryState(
    'view',
    parseAsStringEnum([...VIEW_KEYS]).withDefault('timeGridWeek').withOptions({ history: 'push' }),
  );
  const [dateParam, setDateParam] = useQueryState('d', parseAsString.withDefault(''));
  const view: ViewKey = isViewKey(viewParam) ? viewParam : 'timeGridWeek';

  // 手机首屏落「日」:390px 上一周七列每列才 45 px,标题只能竖着排 —— Google 手机端
  // 同样默认单日。只在 URL 自己没写 view 时改(用户切过就尊重他的选择),replace 不留
  // 历史,免得返回键要按两下才离开日历。转屏后不再回头改。
  const pickedStartView = useRef(false);
  useEffect(() => {
    if (!mounted || !store.ready || pickedStartView.current) return;
    pickedStartView.current = true;
    if (new URLSearchParams(window.location.search).has('view')) return;
    const startView = isNarrow ? 'timeGridDay' : (isViewKey(prefs.view) ? prefs.view : 'timeGridWeek');
    void setViewParam(startView, { history: 'replace' });
  }, [mounted, store.ready, isNarrow, prefs.view, setViewParam]);

  // 首帧用 URL 里的日期,之后的跳转走 FullCalendar 自己的 API(不重建视图)。
  const initialDate = useMemo(() => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) return dayStart(displayTz, dateParam);
    return mounted ? Date.now() : Date.UTC(2000, 0, 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 只取首帧值:之后靠 gotoDate 跳,重算会把视图弹回今天
  }, [mounted]);

  const [range, setRange] = useState<GridRange>({ start: Date.UTC(2000, 0, 1), end: Date.UTC(2000, 0, 2), anchor: Date.UTC(2000, 0, 1) });

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useQueryState('settings', parseAsStringEnum([...SETTINGS_SECTIONS]));
  const settingsOpen = settingsSection !== null;
  const closeSettings = useCallback(() => { void setSettingsSection(null); }, [setSettingsSection]);
  const [tzOpen, setTzOpen] = useState(false);
  // 顶栏两个浮层:点外面 / Esc 关。它们是 fixed 定位、挂在顶栏外面,所以触发钮要单独排除,
  // 否则「点钮 → 先关再开」,看着就是按不动。
  const tzBtnRef = useRef<HTMLButtonElement>(null);
  const tzPopRef = useRef<HTMLDivElement>(null);
  const setBtnRef = useRef<HTMLButtonElement>(null);
  // 导入记录只在真去看设置时才拉 —— 首屏没人关心,不该多一个请求。
  useEffect(() => {
    if (settingsSection !== 'import') return;
    void listImports().then(setImports).catch(() => { /* 没登录 / 离线时不打扰 */ });
  }, [settingsSection]);

  usePopoverDismiss(tzOpen, () => setTzOpen(false), tzPopRef, tzBtnRef);
  const [query, setQuery] = useState('');
  const [dialog, setDialog] = useState<DialogDraft | null>(null);
  const [competition, setCompetition] = useState<CalendarCompetition | null>(null);
  const todayKey = now ? dayKeyIn(displayTz, now) : '';
  const wca = useWcaCalendar(mounted ? user?.wcaId ?? '' : '', todayKey);
  const visibleCompetitions = useMemo(() => wca.competitions.filter((c) =>
    c.source === 'attended' || c.source === 'registered' ? prefs.showWca : c.source === 'followed' ? prefs.showFollowed : prefs.showUpcoming,
  ), [wca.competitions, prefs.showWca, prefs.showFollowed, prefs.showUpcoming]);
  const [shareOpen, setShareOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [scopeAsk, setScopeAsk] = useState<{ mode: 'edit' | 'delete'; run: (s: EditScope) => void } | null>(null);
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null);
  const [toast, setToast] = useState('');
  /** 导入中的进度;非 null = 正在导。几千条要跑十几批,没进度会以为卡死了。 */
  const [importing, setImporting] = useState<ImportProgress | null>(null);
  /** 最近几次导入,用来整批撤销(导错时区 / 导错文件时不必一条条删)。 */
  const [imports, setImports] = useState<CalendarImport[]>([]);
  const [undoingId, setUndoingId] = useState<number | null>(null);

  // ── 加载 ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mounted || !user) return;
    void store.init(displayTz);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- store 是 zustand 单例,依赖它会每帧重跑
  }, [mounted, user, displayTz]);

  useEffect(() => {
    if (!store.ready) return;
    void store.ensureRange(range.start, range.end);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.ready, range.start, range.end]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(''), 2600);
    return () => clearTimeout(id);
  }, [toast]);

  // ── 展开成格子里的块 ────────────────────────────────────────────────────
  const occurrences = useMemo(() => expandRange({
    events, hidden, from: range.start, to: range.end,
    meKey: me?.key, showDeclined: prefs.showDeclined,
  }), [events, hidden, range.start, range.end, me?.key, prefs.showDeclined]);

  const calColor = useCallback((id: number) => {
    const c = calendars.find((x) => x.id === id);
    return eventColor(c?.color ?? 'peacock');
  }, [calendars, eventColor]);

  const fcEvents = useMemo(() => [
    ...toFcEvents({ occurrences, calendarColor: calColor, colorHex: eventColor, readableInk, meKey: me?.key ?? '' }),
    ...visibleCompetitions.filter((c) => c.start_date < dayKeyIn(displayTz, range.end) && c.end_date >= dayKeyIn(displayTz, range.start))
      .map((c) => competitionCalendarEvent(c, isZh, theme)),
  ], [occurrences, calColor, eventColor, me?.key, visibleCompetitions, displayTz, range.start, range.end, isZh, theme]);

  // 迷你月历上的「这天有事」小点:按显示时区归日。
  const busyDays = useMemo(() => {
    const set = new Set<string>();
    for (const o of occurrences) set.add(dayKeyIn(displayTz, o.start));
    return set;
  }, [occurrences, displayTz]);

  const invites = useMemo(
    () => events.filter((e) => e.guests.some((g) => g.key === me?.key && g.status === 'pending')),
    [events, me?.key],
  );

  // ── 搜索 ────────────────────────────────────────────────────────────────
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 1) return [];
    const now = Date.now();
    return expandRange({
      events, hidden, from: now - 365 * DAY, to: now + 365 * DAY, meKey: me?.key, showDeclined: true,
    })
      .filter((o) => `${o.event.title} ${o.event.location} ${o.event.description}`.toLowerCase().includes(q))
      .slice(0, 40);
  }, [query, events, hidden, me?.key]);

  // ── 打开弹窗 ────────────────────────────────────────────────────────────
  const defaultCalendarId = calendars[0]?.id ?? 0;

  const openCreate = useCallback((start: number, end: number, allDay: boolean) => {
    setDialog({
      id: 0,
      calendarId: defaultCalendarId,
      title: '', description: '', location: '',
      allDay, start, end,
      tz: displayTz,
      rrule: '', color: '', reminders: [30], guests: [],
    });
  }, [defaultCalendarId, displayTz]);

  const openEventByKey = useCallback((key: string) => {
    if (key.startsWith('wca:')) {
      const found = wca.competitions.find((c) => c.id === key.slice(4));
      if (found) setCompetition(found);
      return;
    }
    const parsed = parseOccurrenceKey(key);
    if (!parsed) return;
    const e = events.find((x) => x.id === parsed.id);
    if (!e) return;
    const dur = e.end - e.start;
    const mine = e.guests.find((g) => g.key === me?.key);
    setDialog({
      id: e.id,
      calendarId: e.calendarId,
      title: e.title,
      description: e.description,
      location: e.location,
      allDay: e.allDay,
      // 点的是哪一次就编辑哪一次的时间,而不是序列首次的时间。
      start: parsed.start,
      end: parsed.start + dur,
      tz: e.tz,
      rrule: e.rrule,
      color: e.color,
      reminders: e.reminders,
      guests: e.guests,
      occurrenceMs: parsed.start,
      readOnly: !!e.ownerKey && !!me?.key && e.ownerKey !== me.key,
      myRsvp: mine?.status,
    });
  }, [events, me?.key, wca.competitions]);

  const openInvite = useCallback((e: CalEvent) => {
    openEventByKey(`${e.id}:${e.start}`);
  }, [openEventByKey]);

  // ── 落库 ────────────────────────────────────────────────────────────────
  const draftToPayload = (d: DialogDraft) => ({
    calendarId: d.calendarId,
    title: d.title,
    description: d.description,
    location: d.location,
    allDay: d.allDay,
    start: d.start,
    end: d.end,
    tz: d.tz,
    rrule: d.rrule,
    color: d.color,
    reminders: d.reminders,
    guestKeys: d.guests.map((g) => g.key),
    occurrenceMs: d.occurrenceMs,
  });

  const doSave = useCallback(async (d: DialogDraft, scope: EditScope) => {
    setSaving(true);
    try {
      if (d.id === 0) await store.addEvent(draftToPayload(d));
      else await store.patchEvent(d.id, draftToPayload(d), scope);
      setDialog(null);
    } catch (e) {
      setToast((e as Error).message);
    } finally {
      setSaving(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSave = useCallback((d: DialogDraft) => {
    const original = events.find((x) => x.id === d.id);
    // 已有的重复事件才需要问作用域;新建的、单次的直接存。
    if (d.id > 0 && original?.rrule && original.seriesId == null) {
      setScopeAsk({ mode: 'edit', run: (scope) => { setScopeAsk(null); void doSave(d, scope); } });
      return;
    }
    void doSave(d, 'all');
  }, [events, doSave]);

  const onDelete = useCallback((d: DialogDraft) => {
    const original = events.find((x) => x.id === d.id);
    const remove = async (scope: EditScope): Promise<void> => {
      setSaving(true);
      try {
        await store.removeEvent(d.id, scope, d.occurrenceMs);
        setDialog(null);
      } catch (e) {
        setToast((e as Error).message);
      } finally {
        setSaving(false);
      }
    };
    if (original?.rrule && original.seriesId == null) {
      setScopeAsk({ mode: 'delete', run: (scope) => { setScopeAsk(null); void remove(scope); } });
      return;
    }
    void remove('all');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events]);

  /** 拖拽 / 缩放落地。重复事件先问作用域,取消就把块弹回原位。 */
  const applyMove = useCallback(async (mv: PendingMove, scope: EditScope) => {
    const e = events.find((x) => x.id === mv.id);
    if (!e) return;
    // 全天块的落点由显示时区给出,但事件的「整日」锚在它自己的时区上,换算回去再存。
    const start = mv.allDay ? dayStart(e.tz, dayKeyIn(displayTz, mv.start)) : mv.start;
    const end = mv.allDay ? dayStart(e.tz, dayKeyIn(displayTz, mv.end)) : mv.end;
    try {
      await store.patchEvent(mv.id, {
        calendarId: e.calendarId,
        start,
        end: Math.max(end, start + (mv.allDay ? DAY : 60_000)),
        allDay: mv.allDay,
        occurrenceMs: mv.occurrence,
      }, scope);
    } catch (err) {
      mv.revert();
      setToast((err as Error).message);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, displayTz]);

  const onEventMove = useCallback((key: string, start: number, end: number, allDay: boolean, revert: () => void) => {
    const parsed = parseOccurrenceKey(key);
    if (!parsed) { revert(); return; }
    const e = events.find((x) => x.id === parsed.id);
    if (!e) { revert(); return; }
    const mv: PendingMove = { id: parsed.id, occurrence: parsed.start, start, end, allDay, revert };
    if (e.rrule && e.seriesId == null) {
      setPendingMove(mv);
      setScopeAsk({
        mode: 'edit',
        run: (scope) => { setScopeAsk(null); setPendingMove(null); void applyMove(mv, scope); },
      });
      return;
    }
    void applyMove(mv, 'all');
  }, [events, applyMove]);

  // ── 导入 / 导出 ──────────────────────────────────────────────────────────
  const [backupReview, setBackupReview] = useState<{ file: File; review: GoogleImportReview } | null>(null);
  useEffect(() => { setBackupReview(null); }, [settingsOpen, user?.uid]);
  const onImportFile = useCallback(async (file: File, confirmed = false) => {
    setImporting({ done: 0, total: 0 });
    try {
      if (!confirmed) {
        const backup = await readGoogleBackup(file);
        if (backup) {
          setBackupReview({ file, review: reviewGoogleBackup(backup) });
          return;
        }
      }
      setBackupReview(null);
      const r = await importCalendarFile({
        file,
        tz: displayTz,
        calendars,
        defaultCalendarId,
        onProgress: setImporting,
      });
      if (r.added === 0 && r.failed === 0) {
        setToast(tr({ zh: '没读出任何日程', en: 'No events found in that file' }));
        return;
      }
      await store.reload();
      setImports(await listImports().catch(() => []));
      // 落进哪几个日历要说 —— 一份 Google 导出会铺开成好几列,不讲一声会以为没导进来。
      const into = r.calendars.length
        ? tr({ zh: ` → ${r.calendars.join('、')}`, en: ` → ${r.calendars.join(', ')}` })
        : '';
      setToast(tr({
        zh: `导入 ${r.added} 条${r.failed ? `,${r.failed} 条跳过` : ''}${into}`,
        en: `Imported ${r.added}${r.failed ? `, skipped ${r.failed}` : ''}${into}`,
      }));
    } catch (e) {
      const message = (e as Error).message;
      setToast(message === 'calendar_color_upgrade_required' || message === 'calendar_color_not_supported'
        ? tr({ zh: '服务器尚未更新到支持完整颜色的版本，已停止导入以免丢色。请更新后重试。', en: 'The server needs the full-color update. Import stopped to avoid losing colors. Please retry after it is updated.' })
        : message.startsWith('google_')
          ? tr({ zh: '备份不完整、格式不兼容或包含无法恢复的数据，请重新导出；尚未开始导入。', en: 'The backup is incomplete, incompatible or cannot be restored. Export it again; import has not started.' })
          : message);
    } finally {
      setImporting(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultCalendarId, displayTz, calendars]);

  // 撤销一次导入。整批走服务端一条 DELETE —— 几千条事件靠前端逐条删既慢又会半途而废。
  const onUndoImport = useCallback(async (im: CalendarImport) => {
    setUndoingId(im.id);
    try {
      const r = await undoImport(im.id);
      await store.reload();
      setImports(await listImports().catch(() => []));
      setToast(tr({
        zh: `已撤销 ${r.removedEvents} 条${r.removedCalendars ? `,并删掉 ${r.removedCalendars} 个空日历` : ''}`,
        en: `Removed ${r.removedEvents} events${r.removedCalendars ? `, and ${r.removedCalendars} now-empty calendars` : ''}`,
      }));
    } catch (e) {
      setToast((e as Error).message);
    } finally {
      setUndoingId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onExport = useCallback(async () => {
    try {
      // 服务端出的 ICS 才带完整 VTIMEZONE 与全部日历;拿不到就用当前窗口兜底。
      const text = await exportIcs().catch(() => eventsToIcs({
        name: 'CubeRoot', tz: displayTz, events,
      }));
      const url = URL.createObjectURL(new Blob([text], { type: 'text/calendar;charset=utf-8' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'cuberoot-calendar.ics';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setToast((e as Error).message);
    }
  }, [events, displayTz]);

  // ── 导航 ────────────────────────────────────────────────────────────────
  const gotoDate = useCallback((ms: number) => {
    gridRef.current?.gotoDate(ms);
    void setDateParam(dayKeyIn(displayTz, ms));
  }, [displayTz, setDateParam]);

  const onRangeChange = useCallback((r: GridRange) => {
    setRange(r);
    void setDateParam(dayKeyIn(displayTz, r.anchor));
  }, [displayTz, setDateParam]);

  // 点一下空白格。年视图的格子只有二十几像素,点它多半是想去那天看看,不是想在那儿
  // 建个全天日程(Google 同样是跳转);其余视图按点中的位置起一条 —— 时间格 1 小时,
  // 全天 / 月格一整天,和拖一格出来的时长一致。
  /** 「创建」/ 悬浮钮 / C：从下一个整点起，应用默认时长。 */
  const openCreateNow = useCallback(() => {
    const base = new Date();
    base.setMinutes(0, 0, 0);
    const start = base.getTime() + 3600_000;
    openCreate(start, defaultEventEnd(start, false, prefs.defaultDuration, displayTz), false);
  }, [openCreate, prefs.defaultDuration, displayTz]);

  /** 表头日期数字:切到日视图并停在那天。 */
  const onDayLink = useCallback((ms: number) => {
    void setViewParam('timeGridDay');
    gotoDate(ms);
  }, [setViewParam, gotoDate]);

  const onDateClick = useCallback((ms: number, allDay: boolean) => {
    if (view === 'multiMonthYear') {
      void setViewParam('timeGridDay');
      gotoDate(ms);
      return;
    }
    openCreate(ms, defaultEventEnd(ms, allDay, prefs.defaultDuration, displayTz), allDay);
  }, [view, setViewParam, gotoDate, openCreate, prefs.defaultDuration, displayTz]);

  // 键盘快捷键,和 Google 一致:T 今天、J/K 或 ←/→ 翻页、D/X/W/M/Y/A 切视图、C 新建。
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const el = e.target as HTMLElement | null;
      if (e.defaultPrevented || e.isComposing || el?.isContentEditable || (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (dialog || competition || shareOpen || scopeAsk || settingsOpen || tzOpen) return;
      if (el?.closest('[role=dialog], .list-select')) return;
      // 窄屏的侧栏是覆盖式抽屉,开着时汉堡钮被它盖住 —— Esc 得能退出来(遮罩也能点关)。
      if (e.key === 'Escape' && sidebarOpen) { setSidebarOpen(false); return; }
      if (!prefs.keyboardShortcuts) return;
      if (e.key === '?') { e.preventDefault(); void setSettingsSection('shortcuts'); return; }
      if (e.key === '/') { e.preventDefault(); searchRef.current?.focus(); return; }
      const map: Record<string, ViewKey> = {
        d: 'timeGridDay', x: 'fourDay', w: 'timeGridWeek',
        m: 'dayGridMonth', y: 'multiMonthYear', a: 'listMonth',
      };
      const k = e.key.toLowerCase();
      if (map[k]) { e.preventDefault(); void setViewParam(map[k]); return; }
      if (k === 't') { gridRef.current?.today(); return; }
      if (k === 'j' || e.key === 'ArrowLeft') { e.preventDefault(); gridRef.current?.prev(); return; }
      if (k === 'k' || e.key === 'ArrowRight') { e.preventDefault(); gridRef.current?.next(); return; }
      if (k === 'c') {
        e.preventDefault();
        openCreateNow();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dialog, competition, shareOpen, scopeAsk, sidebarOpen, settingsOpen, tzOpen, prefs.keyboardShortcuts, setSettingsSection, setViewParam, openCreateNow]);

  const zoneItems = useMemo(() => zoneOptions().map((z) => ({
    value: z.tz,
    label: `${zoneLabel(z.tz, isZh)} ${formatOffset(zoneOffsetMinutes(z.tz, new Date()))}`,
    searchTerms: zoneSearchTerms(z),
  })), [isZh]);

  // ── 未登录 ──────────────────────────────────────────────────────────────
  const loginHref = `/account${nextQuery(`${lang === 'zh' ? '/zh' : ''}/calendar`)}`;
  if (mounted && !user) {
    return (
      <div className="cal-page">
        <div className="cal-topbar">
          <BackHome />
          <h1 className="cal-brand"><CalendarDays size={20} aria-hidden />{tr({ zh: '日历', en: 'Calendar' })}</h1>
          <span className="cal-foot-gap" />
          <HeaderToggles />
        </div>
        <div className="cal-empty">
          <p>{tr({ zh: '登录后就能用自己的日历,并按需公开分享。', en: 'Log in to keep your own calendar and share it when you want to.' })}</p>
          <AppLink className="cal-btn is-primary" href={loginHref} prefetch={false}>
            {tr({ zh: '去登录', en: 'Log in' })}
          </AppLink>
        </div>
      </div>
    );
  }

  return (
    <div className={`cal-page${sidebarOpen ? ' sidebar-open' : ''}${prefs.sidebarCollapsed ? ' sidebar-collapsed' : ''}`}>
      <div className="cal-topbar">
        <button
          type="button"
          className="cal-icon-btn cal-menu-btn"
          aria-label={tr({ zh: '侧栏', en: 'Sidebar' })}
          aria-expanded={isMobile ? sidebarOpen : !prefs.sidebarCollapsed}
          onClick={() => { if (isMobile) setSidebarOpen((v) => !v); else store.setPrefs({ sidebarCollapsed: !prefs.sidebarCollapsed }); }}
        >
          <Menu size={18} aria-hidden />
        </button>
        <BackHome />
        <h1 className="cal-brand">
          <CalendarDays size={20} aria-hidden />
          {tr({ zh: '日历', en: 'Calendar' })}
        </h1>

        <button type="button" className="cal-btn" onClick={() => gridRef.current?.today()}>
          {tr({ zh: '今天', en: 'Today' })}
        </button>
        <button type="button" className="cal-icon-btn" onClick={() => gridRef.current?.prev()} aria-label={tr({ zh: '上一页', en: 'Previous' })}>
          <ChevronLeft size={18} aria-hidden />
        </button>
        <button type="button" className="cal-icon-btn" onClick={() => gridRef.current?.next()} aria-label={tr({ zh: '下一页', en: 'Next' })}>
          <ChevronRight size={18} aria-hidden />
        </button>
        <span className="cal-range-title">
          {mounted ? rangeTitle(view, range.anchor, displayTz, isZh, range.start, range.end) : ''}
        </span>

        <div className="cal-search">
          <Search size={15} aria-hidden />
          <input
            ref={searchRef}
            type="search"
            aria-label={tr({ zh: '搜索日程', en: 'Search events' })}
            className="cal-search-field"
            value={query}
            placeholder={tr({ zh: '搜索日程', en: 'Search events' })}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && <ClearButton onClick={() => setQuery('')} />}
        </div>

        <ListSelect
          className="cal-view-select"
          items={VIEW_KEYS.map((v) => ({ value: v, label: tr(VIEW_LABELS[v]) }))}
          value={view}
          allLabel=""
          clearable={false}
          onChange={(v) => { if (isViewKey(v)) void setViewParam(v); }}
        />

        <button
          ref={tzBtnRef}
          type="button"
          className="cal-icon-btn"
          aria-label={tr({ zh: '显示时区', en: 'Display time zone' })}
          aria-expanded={tzOpen}
          title={zoneLabel(displayTz, isZh)}
          onClick={() => { closeSettings(); setTzOpen((v) => !v); }}
        >
          <Globe size={17} aria-hidden />
        </button>
        <button
          ref={setBtnRef}
          type="button"
          className="cal-icon-btn"
          aria-label={tr({ zh: '设置', en: 'Settings' })}
          aria-expanded={settingsOpen}
          onClick={() => { setTzOpen(false); void setSettingsSection(settingsOpen ? null : 'general'); }}
        >
          <Settings size={17} aria-hidden />
        </button>
        <button
          type="button"
          className="cal-icon-btn"
          aria-label={tr({ zh: '对外展示', en: 'Share' })}
          onClick={() => setShareOpen(true)}
        >
          <Share2 size={17} aria-hidden />
        </button>
        <HeaderToggles />
      </div>

      {tzOpen && (
        <div className="cal-pop cal-pop-tz" ref={tzPopRef}>
          <div className="cal-pop-head">
            <span className="cal-field-label">{tr({ zh: '显示时区', en: 'Display time zone' })}</span>
            <button
              type="button"
              className="cal-icon-btn"
              onClick={() => setTzOpen(false)}
              aria-label={tr({ zh: '关闭', en: 'Close' })}
            >
              <X size={16} aria-hidden />
            </button>
          </div>
          <ListSelect
            items={zoneItems}
            value={displayTz}
            allLabel={tr({ zh: '本机时区', en: 'Device zone' })}
            clearable={false}
            searchable
            maxVisible={80}
            searchPlaceholder={tr({ zh: '搜城市 / 时区', en: 'Search city or zone' })}
            onChange={(tzNext) => { store.setPrefs({ tz: tzNext }); setTzOpen(false); }}
          />
          <p className="cal-hint">
            {tr({
              zh: '只改「怎么摆」,不改日程本身;出差时切到当地看最方便。',
              en: 'Changes how events are laid out, not the events themselves — handy when travelling.',
            })}
          </p>
          <AppLink className="cal-link-btn" href="/timezone" prefetch={false}>
            {tr({ zh: '打开时区换算', en: 'Open the time zone converter' })}
          </AppLink>
        </div>
      )}

      {settingsSection && (
        <CalendarSettings
          section={settingsSection}
          onSection={(section) => { void setSettingsSection(section); }}
          prefs={prefs}
          onPrefs={store.setPrefs}
          displayTz={displayTz}
          zoneItems={zoneItems}
          onClose={closeSettings}
        >
          <GoogleBackupPanel key={me?.key} disabled={importing != null} onFile={(file) => void onImportFile(file)} />
          {backupReview && <section className="cal-google-backup" aria-label={tr({ zh: '导入预览', en: 'Import preview' })}>
            <h4>{tr({ zh: '导入预览', en: 'Import preview' })}</h4>
            <p>{tr({ zh: `备份含 ${backupReview.review.archived} 条原始记录，其中 ${backupReview.review.cancelled} 条为取消记录。可导入 ${backupReview.review.sources.reduce((n, s) => n + s.events.length, 0)} 条日程。`, en: `The backup has ${backupReview.review.archived} raw records, including ${backupReview.review.cancelled} cancelled records. ${backupReview.review.sources.reduce((n, s) => n + s.events.length, 0)} events can be imported.` })}</p>
            <ul>{backupReview.review.sources.map((s, i) => <li key={i}>{s.name} — {s.tz}</li>)}</ul>
            <p className="cal-pop-hint">{tr({ zh: '导入时间、地点、标题、说明、支持的重复规则、弹窗提醒和活动颜色。参与人、会议、附件、扩展字段等原始信息保存在备份文件中，本站暂不恢复为对应功能；不会向参与人发送邀请。请保留备份包。', en: 'Imports times, locations, titles, descriptions, supported recurrence, popup reminders and event colors. Attendees, conferences, attachments and extra fields remain in the backup file and are not restored as active features. No invitations are sent. Keep the backup.' })}</p>
            {backupReview.review.skipped > 0 && <p role="alert">{tr({ zh: `${backupReview.review.skipped} 条记录的重复规则或时间暂不支持，将仅保留在备份中，不导入。`, en: `${backupReview.review.skipped} records use unsupported recurrence or times and will remain in the backup without being imported.` })}</p>}
            {backupReview.review.warnings.includes('legacy_calendar_palette') && <p role="alert">{tr({ zh: '部分日历使用 Google 旧版默认配色：原始色值已保留，但与 Google 现代主题的显示可能不同，需要核对。', en: 'Some calendars use legacy Google default colors. Original values are preserved, but their appearance may differ from Google’s modern theme and needs review.' })}</p>}
            {backupReview.review.warnings.some(w => ['text_limits', 'reminder_methods', 'reminder_limits'].includes(w)) && <p role="alert">{tr({ zh: '部分内容超过本站长度或提醒限制：标题/地点最多 300 字、说明 5000 字、最多 5 个提前 28 天以内的弹窗提醒。完整内容仍在备份文件中。', en: 'Some fields exceed site limits: titles/locations 300 characters, descriptions 5,000, and up to 5 popup reminders within 28 days. Full content remains in the backup file.' })}</p>}
            <p className="cal-pop-hint">{tr({ zh: '这是追加导入，重复导入会产生重复活动。可在下方“最近导入”撤销整批。', en: 'This adds events; importing again creates duplicates. Undo the batch under Recent imports below.' })}</p>
            <div className="cal-pop-actions">
              <button type="button" className="cal-btn" disabled={importing != null || !backupReview.review.sources.some(s => s.events.length)} onClick={() => void onImportFile(backupReview.file, true)}>{tr({ zh: '确认导入', en: 'Confirm import' })}</button>
              <button type="button" className="cal-btn" disabled={importing != null} onClick={() => setBackupReview(null)}>{tr({ zh: '取消', en: 'Cancel' })}</button>
            </div>
          </section>}
          <div className="cal-pop-actions">
            <button
              type="button"
              className="cal-btn"
              disabled={importing != null}
              onClick={() => fileRef.current?.click()}
            >
              <Upload size={15} aria-hidden />
              {/* total 还是 0 = 文件刚点开、zip 还没拆完,这时候报「0/0」像是坏了。 */}
              {importing && importing.total > 0
                ? tr({ zh: `导入中 ${importing.done}/${importing.total}`, en: `Importing ${importing.done}/${importing.total}` })
                : importing
                  ? tr({ zh: '读取中…', en: 'Reading…' })
                  : tr({ zh: '导入 .ics / .zip', en: 'Import .ics / .zip' })}
            </button>
            <button type="button" className="cal-btn" onClick={() => void onExport()}>
              <Download size={15} aria-hidden />
              {tr({ zh: '导出 .ics', en: 'Export .ics' })}
            </button>
          </div>
          <p className="cal-pop-hint">
            {tr({
              zh: '在电脑浏览器打开 Google 日历：⚙️ → 导入和导出 → 导出。手机 App 不支持导出。下载的 .zip 不用解压，直接导入即可，里面每个日历会各自成一列。',
              en: 'Open Google Calendar in a browser on your computer: ⚙️ → Import & export → Export. The mobile app does not support export. Import the downloaded .zip without unzipping it; each calendar inside becomes its own list.',
            })}
          </p>

          <p className="cal-pop-hint">
            {tr({
              zh: 'Google 网页普通导出的 .ics / .zip 没有颜色信息；需要保留颜色时，请使用上方“带颜色导出”。普通文件中新建日历使用灰色，已有日历保留当前配色。重复上传会追加活动，不会覆盖或去重。',
              en: 'Standard Google .ics / .zip exports omit colors. Use Export with colors above to preserve them. Ordinary file imports create gray calendars and keep existing calendar colors. Uploading again adds events without replacing or deduplicating them.',
            })}
          </p>

          {imports.length > 0 && (
            <div className="cal-imports">
              <span className="cal-field-label">{tr({ zh: '最近导入', en: 'Recent imports' })}</span>
              {imports.map((im) => (
                <div key={im.id} className="cal-import-row">
                  <span className="cal-import-what">
                    {im.source || tr({ zh: '未命名文件', en: 'Unnamed file' })}
                    <span className="cal-import-meta">
                      {tr({ zh: `${im.eventCount} 条`, en: `${im.eventCount} events` })}
                      {'  '}
                      {dayKeyIn(displayTz, im.createdAt)} {formatClock(im.createdAt, displayTz, prefs.hour24, isZh)}
                    </span>
                  </span>
                  {im.undone ? (
                    <span className="cal-import-meta">{tr({ zh: '已撤销', en: 'Undone' })}</span>
                  ) : (
                    <button
                      type="button"
                      className="cal-btn"
                      disabled={undoingId === im.id}
                      onClick={() => void onUndoImport(im)}
                    >
                      <Undo2 size={15} aria-hidden />
                      {undoingId === im.id
                        ? tr({ zh: '撤销中…', en: 'Undoing…' })
                        : tr({ zh: '撤销', en: 'Undo' })}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CalendarSettings>
      )}

      <input
        ref={fileRef}
        type="file"
        accept=".ics,.zip,text/calendar,application/zip"
        className="cal-file-input"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) void onImportFile(f);
        }}
      />

      <div className="cal-body">
        <Sidebar
          calendars={calendars}
          hidden={hidden}
          anchor={range.anchor}
          tz={displayTz}
          weekStart={prefs.weekStart}
          todayKey={todayKey}
          busyDays={busyDays}
          invites={invites}
          onCreate={() => { openCreateNow(); if (isMobile) setSidebarOpen(false); }}
          onPickDate={(ms) => { gotoDate(ms); if (isMobile) setSidebarOpen(false); }}
          onToggle={store.toggleHidden}
          onAdd={() => void store.addCalendar({
            name: tr({ zh: '新日历', en: 'New calendar' }), color: 'flamingo', tz: displayTz,
          }).catch((e: Error) => setToast(e.message))}
          onRename={(id, name) => void store.patchCalendar(id, { name }).catch((e: Error) => setToast(e.message))}
          onRecolor={(id, color) => void store.patchCalendar(id, { color }).catch((e: Error) => setToast(e.message))}
          onRemove={(id) => void store.removeCalendar(id).catch((e: Error) => setToast(e.message))}
          onOpenInvite={openInvite}
        >
          <CompetitionCalendars wcaId={user?.wcaId ?? ''} competitions={wca.competitions} loading={wca.loading} incomplete={wca.incomplete} prefs={prefs} onPrefs={store.setPrefs} onRefresh={wca.refresh}
            onPick={(c) => { gotoDate(dayStart(displayTz, c.start_date)); setCompetition(c); if (isMobile) setSidebarOpen(false); }} />
        </Sidebar>

        {/* 窄屏抽屉的遮罩:抽屉盖住了汉堡钮,没有它就只能靠选日期才关得掉。
            用真 <button> 而不是 <div onClick>(iOS Safari 上 div 的 tap 不可靠)。 */}
        {sidebarOpen && (
          <button
            type="button"
            className="cal-scrim"
            aria-label={tr({ zh: '关闭侧栏', en: 'Close sidebar' })}
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <main className="cal-main">
          {mounted && (
            <CalendarGrid
              ref={gridRef}
              view={view}
              tzLabel={
                // Google 那里写 GMT+08;站内一律 UTC+8(时区选择器就在上面一行,别两种写法)
                formatOffset(zoneOffsetMinutes(displayTz, new Date(range.anchor)))
              }
              initialDate={initialDate}
              events={fcEvents}
              tz={displayTz}
              isZh={isZh}
              hour24={prefs.hour24}
              weekStart={prefs.weekStart}
              weekends={prefs.weekends}
              weekNumbers={prefs.weekNumbers}
              editable
              onSelect={openCreate}
              onDayLink={onDayLink}
              onDateClick={onDateClick}
              onEventClick={openEventByKey}
              onEventMove={onEventMove}
              onRangeChange={onRangeChange}
            />
          )}

          {query.trim() && (
            <div className="cal-results">
              <div className="cal-results-head">
                <span>{tr({ zh: `搜索结果 ${results.length}`, en: `${results.length} results` })}</span>
                <button type="button" className="cal-icon-btn" onClick={() => setQuery('')} aria-label={tr({ zh: '关闭', en: 'Close' })}>
                  <X size={16} aria-hidden />
                </button>
              </div>
              <ul>
                {results.map((o) => (
                  <li key={o.key}>
                    <button
                      type="button"
                      className="cal-result-row"
                      onClick={() => { gotoDate(o.start); openEventByKey(o.key); setQuery(''); }}
                    >
                      <span
                        className="cal-dot"
                        style={{ background: o.event.color ? eventColor(o.event.color) : calColor(o.event.calendarId) }}
                        aria-hidden
                      />
                      <span className="cal-result-when">
                        {formatLongDate(o.start, displayTz, isZh)}
                        {!o.event.allDay && ` ${formatClock(o.start, displayTz, prefs.hour24, isZh)}`}
                      </span>
                      <span className="cal-result-title">{o.event.title || tr({ zh: '(无标题)', en: '(No title)' })}</span>
                    </button>
                  </li>
                ))}
                {results.length === 0 && (
                  <li className="cal-hint">{tr({ zh: '前后一年内没有匹配的日程', en: 'No matching events within a year' })}</li>
                )}
              </ul>
            </div>
          )}
        </main>
      </div>

      <button
        type="button"
        className="cal-fab"
        aria-label={tr({ zh: '新建日程', en: 'New event' })}
        onClick={openCreateNow}
      >
        <Plus size={22} aria-hidden />
      </button>

      {competition && <CompetitionDialog key={competition.id} competition={competition} onClose={() => setCompetition(null)} />}

      {dialog && (
        <EventDialog
          draft={dialog}
          hour24={prefs.hour24}
          calendars={calendars}
          meKey={me?.key ?? ''}
          saving={saving}
          onSave={onSave}
          onDelete={onDelete}
          onRespond={dialog.readOnly ? (status) => {
            void store.respond(dialog.id, status).then(() => setDialog(null)).catch((e: Error) => setToast(e.message));
          } : undefined}
          onClose={() => setDialog(null)}
        />
      )}

      {shareOpen && share && (
        <ShareDialog
          share={share}
          calendars={calendars}
          lang={lang}
          onSave={(patch) => store.updateShare(patch)}
          onRotate={() => store.rotateShare()}
          onClose={() => setShareOpen(false)}
        />
      )}

      {scopeAsk && (
        <ScopePrompt
          mode={scopeAsk.mode}
          onPick={scopeAsk.run}
          onClose={() => {
            pendingMove?.revert();
            setPendingMove(null);
            setScopeAsk(null);
          }}
        />
      )}

      {toast && <div className="cal-toast" role="status">{toast}</div>}
      {store.error && !toast && <div className="cal-toast is-error" role="status">{store.error}</div>}
    </div>
  );
}
