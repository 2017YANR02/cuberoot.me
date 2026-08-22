import { Hono } from 'hono';
import crypto from 'node:crypto';
import { getIp } from '../utils/analytics_helpers.js';
import { query } from '../db/connection.js';
import { requireAuth, checkRateLimit } from '../utils/recon_helpers.js';
import { notify } from '../utils/notify.js';
import { isValidZone } from '@cuberoot/shared/tz';
import { expandOccurrences, parseRRule, formatRRule } from '@cuberoot/shared/recur';
import {
  eventsToIcs, isCalendarColor, parseNumList, redactBusy, ICS_IMPORT_BATCH,
  type CalEvent, type CalendarImport, type CalendarMeta, type EventGuest, type ShareDetail,
} from '@cuberoot/shared/calendar';

/**
 * /v1/calendar/* —— 个人日历(/calendar 页的后端)。
 *
 *   GET    /calendar/bootstrap             首屏:我的日历列表 + 分享设置(首次访问自动建主日历)
 *   POST   /calendar/calendars             新建日历        PATCH/DELETE /calendar/calendars/:id
 *   GET    /calendar/events?from&to        窗口内事件(含受邀事件;重复事件整取,由前端展开)
 *   POST   /calendar/events                新建事件
 *   PATCH  /calendar/events/:id            改事件(?scope=this|following|all)
 *   DELETE /calendar/events/:id            删事件(同上 scope)
 *   POST   /calendar/events/bulk           ICS 导入(一次多条,带 importId 归入某个批次)
 *   POST   /calendar/imports               开一个导入批次   GET 列最近的   DELETE /:id 整批撤销
 *   POST   /calendar/events/:id/rsvp       受邀者接受 / 拒绝
 *   GET    /calendar/export                我的全部事件 → .ics 文本
 *   PUT    /calendar/share                 对外展示设置    POST /calendar/share/rotate 换链接
 *   GET    /calendar/public/:token         公开读(detail=busy 时**在服务端**抹掉内容)
 *   GET    /calendar/public/:token/ics     公开订阅源(Google / Apple 日历可直接订阅)
 *   GET    /calendar/people?q=             加嘉宾时的站内用户搜索
 *
 * 身份一律取 requireAuth(c).wcaId(归属键),客户端不传 owner。
 *
 * 重复事件:库里只存主事件(rrule + exdates)与「只改这一次」产生的覆盖行(series_id +
 * occurrence_ms),不落地展开结果 —— 无限重复本来就存不下,而且改一次规则要回改成千上万行。
 * 展开在 @cuberoot/shared/recur,前端画格子、这里扫提醒、导出 ICS 用的是同一份实现。
 */
export const calendarRoutes = new Hono();

const NO_STORE = 'no-cache, no-store, must-revalidate';

const MAX_CALENDARS_PER_USER = 30;
const MAX_EVENTS_PER_USER = 20_000;
/** 一次导入最多多少条(ICS 文件可能上千条,分批传)。批大小与前端同源,见 shared/calendar。 */
const MAX_BULK = ICS_IMPORT_BATCH;
const MAX_GUESTS_PER_EVENT = 50;
/** 单次查询窗口上限:两年。再宽就该分页了,而日历界面一次最多看一年。 */
const MAX_WINDOW_MS = 750 * 86_400_000;

// ── 行 ↔ JSON ───────────────────────────────────────────────────────────────

interface CalendarRow {
  id: string | number;
  name: string;
  color: string;
  tz: string;
  is_default: boolean;
  sort_order: number;
}

interface ImportRow {
  id: string | number;
  source: string;
  event_count: number;
  created_at: string | number;
  undone_at: string | number | null;
}

function toImport(r: ImportRow): CalendarImport {
  return {
    id: Number(r.id),
    source: r.source,
    eventCount: r.event_count,
    createdAt: Number(r.created_at),
    undone: r.undone_at != null,
  };
}

interface EventRow {
  id: string | number;
  calendar_id: string | number;
  owner_key: string;
  title: string;
  description: string;
  location: string;
  all_day: boolean;
  start_ms: string | number;
  end_ms: string | number;
  tz: string;
  rrule: string;
  exdates: string;
  series_id: string | number | null;
  occurrence_ms: string | number | null;
  color: string;
  reminders: string;
  updated_at: string | number;
}

function toCalendar(r: CalendarRow): CalendarMeta {
  return {
    id: Number(r.id),
    name: r.name,
    color: r.color,
    tz: r.tz,
    isDefault: !!r.is_default,
    sortOrder: Number(r.sort_order),
  };
}

/** 逗号分隔的数字串 → 数字数组(空串 → []);编码与解析同在 shared,前后端一份。 */
const numList = parseNumList;

function toEvent(r: EventRow, guests: EventGuest[] = []): CalEvent {
  return {
    id: Number(r.id),
    calendarId: Number(r.calendar_id),
    title: r.title,
    description: r.description,
    location: r.location,
    allDay: !!r.all_day,
    start: Number(r.start_ms),
    end: Number(r.end_ms),
    tz: r.tz,
    rrule: r.rrule,
    exdates: numList(r.exdates),
    seriesId: r.series_id == null ? null : Number(r.series_id),
    occurrenceMs: r.occurrence_ms == null ? null : Number(r.occurrence_ms),
    color: r.color,
    reminders: numList(r.reminders),
    guests,
    ownerKey: r.owner_key,
    updatedAt: Number(r.updated_at),
  };
}

const EVENT_COLS = `id, calendar_id, owner_key, title, description, location, all_day,
  start_ms, end_ms, tz, rrule, exdates, series_id, occurrence_ms, color, reminders, updated_at`;

// ── 输入校验 ────────────────────────────────────────────────────────────────

function str(v: unknown, max: number): string {
  return typeof v === 'string' ? v.slice(0, max) : '';
}

function zone(v: unknown, fallback: string): string {
  return typeof v === 'string' && v.length <= 64 && isValidZone(v) ? v : fallback;
}

/** 合法时刻:1970..2200 之间的整毫秒。越界返回 null(URL / 客户端都可能乱给)。 */
function ms(v: unknown): number | null {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  const i = Math.round(n);
  return i >= 0 && i <= 7_258_118_400_000 ? i : null;
}

/** 规范化 RRULE:解析不出来就当不重复,存进去的一律是我们自己序列化的形式。 */
function normalizeRrule(v: unknown): string {
  const parsed = parseRRule(typeof v === 'string' ? v : '');
  return parsed ? formatRRule(parsed) : '';
}

function normalizeReminders(v: unknown): string {
  if (!Array.isArray(v)) return '';
  const list = [...new Set(v.map((x) => Math.round(Number(x))).filter((n) => Number.isInteger(n) && n >= 0 && n <= 40320))]
    .sort((a, b) => a - b)
    .slice(0, 5);
  return list.join(',');
}

function normalizeExdates(v: unknown): string {
  if (!Array.isArray(v)) return '';
  const list = [...new Set(v.map((x) => ms(x)).filter((n): n is number => n != null))]
    .sort((a, b) => a - b)
    .slice(0, 400);
  return list.join(',');
}

function color(v: unknown): string {
  return typeof v === 'string' && isCalendarColor(v) ? v : '';
}

// ── 日历 ────────────────────────────────────────────────────────────────────

/** 拿(必要时创建)某人的主日历。首次进 /calendar 的人在这里落地。 */
async function ensureDefaultCalendar(ownerKey: string, tz: string): Promise<CalendarMeta> {
  const existing = await query<CalendarRow>(
    'SELECT id, name, color, tz, is_default, sort_order FROM calendars WHERE owner_key = ? ORDER BY sort_order, id LIMIT 1',
    [ownerKey],
  );
  if (existing.length) return toCalendar(existing[0]);
  const now = Date.now();
  const rows = await query<CalendarRow>(
    `INSERT INTO calendars (owner_key, name, color, tz, is_default, sort_order, created_at, updated_at)
     VALUES (?, '', 'peacock', ?, TRUE, 0, ?, ?)
     ON CONFLICT DO NOTHING
     RETURNING id, name, color, tz, is_default, sort_order`,
    [ownerKey, tz, now, now],
  );
  if (rows.length) return toCalendar(rows[0]);
  // 并发下两个标签页同时首访:唯一索引挡住第二条,回读即可。
  const again = await query<CalendarRow>(
    'SELECT id, name, color, tz, is_default, sort_order FROM calendars WHERE owner_key = ? ORDER BY sort_order, id LIMIT 1',
    [ownerKey],
  );
  return toCalendar(again[0]);
}

async function listCalendars(ownerKey: string): Promise<CalendarMeta[]> {
  const rows = await query<CalendarRow>(
    'SELECT id, name, color, tz, is_default, sort_order FROM calendars WHERE owner_key = ? ORDER BY sort_order, id',
    [ownerKey],
  );
  return rows.map(toCalendar);
}

/** 校验某日历确实属于调用者;不属于返回 null。 */
async function ownedCalendar(ownerKey: string, id: number): Promise<CalendarMeta | null> {
  const rows = await query<CalendarRow>(
    'SELECT id, name, color, tz, is_default, sort_order FROM calendars WHERE id = ? AND owner_key = ?',
    [id, ownerKey],
  );
  return rows.length ? toCalendar(rows[0]) : null;
}

// ── 分享设置 ────────────────────────────────────────────────────────────────

interface ShareRow {
  token: string;
  enabled: boolean;
  detail: ShareDetail;
  title: string;
  calendar_ids: string;
  tz: string;
}

function newToken(): string {
  // 22 位 base62 ≈ 130 bit,不可枚举;URL 里不带特殊字符。
  return crypto.randomBytes(16).toString('base64url').slice(0, 22);
}

async function ensureShare(ownerKey: string, tz: string): Promise<ShareRow> {
  const rows = await query<ShareRow>(
    'SELECT token, enabled, detail, title, calendar_ids, tz FROM calendar_shares WHERE owner_key = ?',
    [ownerKey],
  );
  if (rows.length) return rows[0];
  const now = Date.now();
  const created = await query<ShareRow>(
    `INSERT INTO calendar_shares (owner_key, token, enabled, detail, title, calendar_ids, tz, created_at, updated_at)
     VALUES (?, ?, FALSE, 'busy', '', '', ?, ?, ?)
     ON CONFLICT (owner_key) DO NOTHING
     RETURNING token, enabled, detail, title, calendar_ids, tz`,
    [ownerKey, newToken(), tz, now, now],
  );
  if (created.length) return created[0];
  const again = await query<ShareRow>(
    'SELECT token, enabled, detail, title, calendar_ids, tz FROM calendar_shares WHERE owner_key = ?',
    [ownerKey],
  );
  return again[0];
}

function shareJson(r: ShareRow): {
  enabled: boolean; token: string; detail: ShareDetail; title: string; calendarIds: number[]; tz: string;
} {
  return {
    enabled: !!r.enabled,
    token: r.token,
    detail: r.detail,
    title: r.title,
    calendarIds: numList(r.calendar_ids),
    tz: r.tz,
  };
}

// ── 嘉宾 ────────────────────────────────────────────────────────────────────

interface GuestRow { event_id: string | number; guest_key: string; status: EventGuest['status'] }

/** 批量取事件的嘉宾 + 昵称头像(app_users 里查不到的人只回归属键)。 */
async function guestsFor(eventIds: number[]): Promise<Map<number, EventGuest[]>> {
  const out = new Map<number, EventGuest[]>();
  if (eventIds.length === 0) return out;
  const rows = await query<GuestRow>(
    `SELECT event_id, guest_key, status FROM calendar_guests
     WHERE event_id IN (${eventIds.map(() => '?').join(',')})`,
    eventIds,
  );
  if (rows.length === 0) return out;
  const profiles = await profilesFor([...new Set(rows.map((r) => r.guest_key))]);
  for (const r of rows) {
    const id = Number(r.event_id);
    const p = profiles.get(r.guest_key);
    const list = out.get(id) ?? [];
    list.push({ key: r.guest_key, name: p?.name || r.guest_key, userId: p?.userId, avatar: p?.avatar, status: r.status });
    out.set(id, list);
  }
  return out;
}

interface ProfileRow { wca_id: string | null; uid: string | number; display_name: string; avatar_url: string | null }

/** 归属键 → 昵称 / 头像。wca_id 与 `u<id>` 两种键一次查完。 */
async function profilesFor(keys: string[]): Promise<Map<string, { name: string; userId: number; avatar: string }>> {
  const out = new Map<string, { name: string; userId: number; avatar: string }>();
  if (keys.length === 0) return out;
  const rows = await query<ProfileRow>(
    `SELECT wca_id, id AS uid, display_name, avatar_url FROM app_users
     WHERE wca_id IN (${keys.map(() => '?').join(',')})
        OR ('u' || id::text) IN (${keys.map(() => '?').join(',')})`,
    [...keys, ...keys],
  );
  for (const r of rows) {
    const entry = { name: r.display_name || '', userId: Number(r.uid), avatar: r.avatar_url || '' };
    if (r.wca_id) out.set(r.wca_id, entry);
    out.set(`u${r.uid}`, entry);
  }
  return out;
}

// ── 首屏 ────────────────────────────────────────────────────────────────────

calendarRoutes.get('/calendar/bootstrap', async (c) => {
  c.header('Cache-Control', NO_STORE);
  checkRateLimit(getIp(c));
  const me = await requireAuth(c);
  const tz = zone(c.req.query('tz'), 'UTC');
  await ensureDefaultCalendar(me.wcaId, tz);
  const [calendars, share] = await Promise.all([listCalendars(me.wcaId), ensureShare(me.wcaId, tz)]);
  const profile = (await profilesFor([me.wcaId])).get(me.wcaId);
  return c.json({
    calendars,
    share: shareJson(share),
    me: { key: me.wcaId, name: me.name, avatar: profile?.avatar || '' },
  });
});

calendarRoutes.post('/calendar/calendars', async (c) => {
  c.header('Cache-Control', NO_STORE);
  checkRateLimit(getIp(c));
  const me = await requireAuth(c);
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({} as Record<string, unknown>));
  const count = await query<{ n: number }>('SELECT COUNT(*)::int AS n FROM calendars WHERE owner_key = ?', [me.wcaId]);
  if ((count[0]?.n ?? 0) >= MAX_CALENDARS_PER_USER) return c.json({ error: 'too many calendars' }, 400);
  const now = Date.now();
  // 导入新建的日历记一笔 —— 撤销那次导入时,空了就跟着删掉,不留一列空壳。
  const importId = await ownedImportId(me.wcaId, body.importId);
  const rows = await query<CalendarRow>(
    `INSERT INTO calendars (owner_key, name, color, tz, is_default, sort_order, import_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, FALSE, ?, ?, ?, ?)
     RETURNING id, name, color, tz, is_default, sort_order`,
    [me.wcaId, str(body.name, 80), color(body.color) || 'flamingo', zone(body.tz, 'UTC'),
      count[0]?.n ?? 0, importId, now, now],
  );
  return c.json({ calendar: toCalendar(rows[0]) });
});

calendarRoutes.patch('/calendar/calendars/:id', async (c) => {
  c.header('Cache-Control', NO_STORE);
  checkRateLimit(getIp(c));
  const me = await requireAuth(c);
  const id = Number(c.req.param('id'));
  const cal = await ownedCalendar(me.wcaId, id);
  if (!cal) return c.json({ error: 'not found' }, 404);
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({} as Record<string, unknown>));
  const name = typeof body.name === 'string' ? str(body.name, 80) : cal.name;
  const col = typeof body.color === 'string' ? (color(body.color) || cal.color) : cal.color;
  const tz = typeof body.tz === 'string' ? zone(body.tz, cal.tz) : cal.tz;
  const rows = await query<CalendarRow>(
    `UPDATE calendars SET name = ?, color = ?, tz = ?, updated_at = ?
     WHERE id = ? AND owner_key = ?
     RETURNING id, name, color, tz, is_default, sort_order`,
    [name, col, tz, Date.now(), id, me.wcaId],
  );
  return c.json({ calendar: toCalendar(rows[0]) });
});

calendarRoutes.delete('/calendar/calendars/:id', async (c) => {
  c.header('Cache-Control', NO_STORE);
  checkRateLimit(getIp(c));
  const me = await requireAuth(c);
  const id = Number(c.req.param('id'));
  const cal = await ownedCalendar(me.wcaId, id);
  if (!cal) return c.json({ error: 'not found' }, 404);
  // 主日历不给删:删了之后「快速新建」没有落脚点,Google 同样不允许。
  if (cal.isDefault) return c.json({ error: 'cannot delete the default calendar' }, 400);
  await query('DELETE FROM calendars WHERE id = ? AND owner_key = ?', [id, me.wcaId]);
  return c.json({ ok: true });
});

// ── 事件读 ──────────────────────────────────────────────────────────────────

/**
 * 窗口内的事件。重复事件的 start_ms 只是首次,窗口过滤对它无效 —— 一律整取(每人量级
 * 就几十条),由前端按可视范围展开。受邀事件(calendar_guests 命中我)一并返回。
 */
calendarRoutes.get('/calendar/events', async (c) => {
  c.header('Cache-Control', NO_STORE);
  checkRateLimit(getIp(c));
  const me = await requireAuth(c);
  const from = ms(c.req.query('from')) ?? Date.now() - 45 * 86_400_000;
  const to = ms(c.req.query('to')) ?? from + 120 * 86_400_000;
  if (to <= from || to - from > MAX_WINDOW_MS) return c.json({ error: 'invalid window' }, 400);

  const own = await query<EventRow>(
    `SELECT ${EVENT_COLS} FROM calendar_events
     WHERE owner_key = ? AND (rrule <> '' OR (start_ms < ? AND end_ms > ?))
     ORDER BY start_ms`,
    [me.wcaId, to, from],
  );
  const invited = await query<EventRow>(
    `SELECT ${EVENT_COLS} FROM calendar_events e
     WHERE e.owner_key <> ?
       AND EXISTS (SELECT 1 FROM calendar_guests g WHERE g.event_id = e.id AND g.guest_key = ? AND g.status <> 'declined')
       AND (e.rrule <> '' OR (e.start_ms < ? AND e.end_ms > ?))
     ORDER BY e.start_ms`,
    [me.wcaId, me.wcaId, to, from],
  );
  const all = [...own, ...invited];
  const guests = await guestsFor(all.map((r) => Number(r.id)));
  return c.json({
    events: all.map((r) => toEvent(r, guests.get(Number(r.id)) ?? [])),
    invitedIds: invited.map((r) => Number(r.id)),
  });
});

// ── 事件写 ──────────────────────────────────────────────────────────────────

interface EventInput {
  calendarId: number;
  title: string;
  description: string;
  location: string;
  allDay: boolean;
  start: number;
  end: number;
  tz: string;
  rrule: string;
  exdates: string;
  color: string;
  reminders: string;
}

/** 请求体 → 可入库的字段。时间非法 / 日历不属于我 → 抛,由 onError 转 400。 */
async function readEventInput(
  body: Record<string, unknown>,
  ownerKey: string,
  fallback?: EventRow,
): Promise<EventInput> {
  const calendarId = Number(body.calendarId ?? fallback?.calendar_id ?? 0);
  const cal = await ownedCalendar(ownerKey, calendarId);
  if (!cal) throw new Error('Validation: unknown calendar');
  const start = ms(body.start) ?? (fallback ? Number(fallback.start_ms) : null);
  const end = ms(body.end) ?? (fallback ? Number(fallback.end_ms) : null);
  if (start == null || end == null || end <= start) throw new Error('Validation: bad time range');
  // 单个事件最长一年:更长的是「一直有效」的状态,不该占日历格子,也防手滑拖出巨块。
  if (end - start > 366 * 86_400_000) throw new Error('Validation: event too long');
  return {
    calendarId,
    title: str(body.title ?? fallback?.title, 300),
    description: str(body.description ?? fallback?.description, 5000),
    location: str(body.location ?? fallback?.location, 300),
    allDay: body.allDay == null ? !!fallback?.all_day : !!body.allDay,
    start,
    end,
    tz: zone(body.tz ?? fallback?.tz, cal.tz),
    rrule: body.rrule == null ? (fallback?.rrule ?? '') : normalizeRrule(body.rrule),
    exdates: body.exdates == null ? (fallback?.exdates ?? '') : normalizeExdates(body.exdates),
    color: body.color == null ? (fallback?.color ?? '') : color(body.color),
    reminders: body.reminders == null ? (fallback?.reminders ?? '') : normalizeReminders(body.reminders),
  };
}

async function insertEvent(
  ownerKey: string,
  input: EventInput,
  series?: { seriesId: number; occurrenceMs: number },
  importId?: number | null,
): Promise<EventRow> {
  const now = Date.now();
  const rows = await query<EventRow>(
    `INSERT INTO calendar_events
       (calendar_id, owner_key, title, description, location, all_day, start_ms, end_ms, tz,
        rrule, exdates, series_id, occurrence_ms, color, reminders, import_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     RETURNING ${EVENT_COLS}`,
    [input.calendarId, ownerKey, input.title, input.description, input.location, input.allDay,
      input.start, input.end, input.tz, input.rrule, input.exdates,
      series?.seriesId ?? null, series?.occurrenceMs ?? null, input.color, input.reminders,
      importId ?? null, now, now],
  );
  return rows[0];
}

/** 这个 import id 是不是调用者自己的、且还没撤销;不是就当没传。 */
async function ownedImportId(ownerKey: string, raw: unknown): Promise<number | null> {
  const id = Number(raw);
  if (!Number.isFinite(id) || id <= 0) return null;
  const rows = await query<{ id: string }>(
    'SELECT id FROM calendar_imports WHERE id = ? AND owner_key = ? AND undone_at IS NULL', [id, ownerKey],
  );
  return rows[0] ? id : null;
}

/** 事件行,且必须属于调用者。 */
async function ownedEvent(ownerKey: string, id: number): Promise<EventRow | null> {
  const rows = await query<EventRow>(
    `SELECT ${EVENT_COLS} FROM calendar_events WHERE id = ? AND owner_key = ?`, [id, ownerKey],
  );
  return rows[0] ?? null;
}

/** 嘉宾名单写入 + 给新加入的人发通知。传 undefined 表示不动名单。 */
async function syncGuests(
  event: EventRow,
  keys: string[] | undefined,
  actor: { key: string; name: string },
): Promise<void> {
  if (!keys) return;
  const eventId = Number(event.id);
  const wanted = [...new Set(keys.map((k) => String(k).slice(0, 20)).filter((k) => k && k !== actor.key))]
    .slice(0, MAX_GUESTS_PER_EVENT);
  const existing = await query<{ guest_key: string }>(
    'SELECT guest_key FROM calendar_guests WHERE event_id = ?', [eventId],
  );
  const had = new Set(existing.map((r) => r.guest_key));
  const added = wanted.filter((k) => !had.has(k));
  const removed = [...had].filter((k) => !wanted.includes(k));

  const now = Date.now();
  for (const k of added) {
    await query(
      `INSERT INTO calendar_guests (event_id, guest_key, status, created_at)
       VALUES (?, ?, 'pending', ?) ON CONFLICT DO NOTHING`,
      [eventId, k, now],
    );
  }
  if (removed.length) {
    await query(
      `DELETE FROM calendar_guests WHERE event_id = ? AND guest_key IN (${removed.map(() => '?').join(',')})`,
      [eventId, ...removed],
    );
  }
  if (added.length) {
    await notify({
      recipients: added,
      kind: 'cal_invite',
      actorKey: actor.key,
      actorName: actor.name,
      title: event.title || '(无标题)',
      excerpt: new Date(Number(event.start_ms)).toISOString(),
      link: '/calendar',
    });
  }
}

calendarRoutes.post('/calendar/events', async (c) => {
  c.header('Cache-Control', NO_STORE);
  checkRateLimit(getIp(c));
  const me = await requireAuth(c);
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({} as Record<string, unknown>));
  const count = await query<{ n: number }>(
    'SELECT COUNT(*)::int AS n FROM calendar_events WHERE owner_key = ?', [me.wcaId],
  );
  if ((count[0]?.n ?? 0) >= MAX_EVENTS_PER_USER) return c.json({ error: 'too many events' }, 400);
  const input = await readEventInput(body, me.wcaId);
  const row = await insertEvent(me.wcaId, input);
  await syncGuests(row, Array.isArray(body.guestKeys) ? (body.guestKeys as string[]) : undefined,
    { key: me.wcaId, name: me.name });
  const guests = await guestsFor([Number(row.id)]);
  return c.json({ event: toEvent(row, guests.get(Number(row.id)) ?? []) });
});

/** ICS 导入:一次塞多条,全部落在同一个日历里。 */
calendarRoutes.post('/calendar/events/bulk', async (c) => {
  c.header('Cache-Control', NO_STORE);
  // 一份 Google 导出动辄几千条 = 十几批,10 次/分钟会把正常导入卡在半路。
  checkRateLimit(getIp(c), { bucket: 'cal-bulk', max: 30 });
  const me = await requireAuth(c);
  const body = await c.req.json<{ calendarId?: number; importId?: number; events?: Record<string, unknown>[] }>()
    .catch(() => ({} as { calendarId?: number; importId?: number; events?: Record<string, unknown>[] }));
  const list = Array.isArray(body.events) ? body.events : [];
  if (list.length === 0) return c.json({ error: 'no events' }, 400);
  // 超出就退回去让调用方切批。原来是 slice 掉多的,于是「导入 500 条」看着像成功,
  // 其实后面几千条被无声吞了。
  if (list.length > MAX_BULK) return c.json({ error: `at most ${MAX_BULK} events per request` }, 400);
  const count = await query<{ n: number }>(
    'SELECT COUNT(*)::int AS n FROM calendar_events WHERE owner_key = ?', [me.wcaId],
  );
  if ((count[0]?.n ?? 0) + list.length > MAX_EVENTS_PER_USER) return c.json({ error: 'too many events' }, 400);

  const importId = await ownedImportId(me.wcaId, body.importId);
  let added = 0;
  const failed: number[] = [];
  for (let i = 0; i < list.length; i++) {
    try {
      const input = await readEventInput({ ...list[i], calendarId: body.calendarId }, me.wcaId);
      await insertEvent(me.wcaId, input, undefined, importId);
      added++;
    } catch {
      failed.push(i);
    }
  }
  if (importId != null && added > 0) {
    await query('UPDATE calendar_imports SET event_count = event_count + ? WHERE id = ?', [added, importId]);
  }
  return c.json({ added, failed: failed.length });
});

// ── 导入批次 ────────────────────────────────────────────────────────────────
//
// 一次导入跨多个请求(每个日历一批、每批最多 MAX_BULK 条),所以先开一个批次、把 id 带在
// 后面每个请求上。撤销就是照着这个 id 把事件删干净 —— 不这么记的话只能按时间戳猜哪些是
// 一起进来的,用户自己在导入前后手建的日程会被误伤。

calendarRoutes.post('/calendar/imports', async (c) => {
  c.header('Cache-Control', NO_STORE);
  checkRateLimit(getIp(c), { bucket: 'cal-import', max: 20 });
  const me = await requireAuth(c);
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({} as Record<string, unknown>));
  const rows = await query<{ id: string }>(
    'INSERT INTO calendar_imports (owner_key, source, created_at) VALUES (?, ?, ?) RETURNING id',
    [me.wcaId, str(body.source, 120), Date.now()],
  );
  return c.json({ id: Number(rows[0].id) });
});

/** 最近几次导入,给「撤销」用。撤销过的也列出来,免得用户以为记录丢了。 */
calendarRoutes.get('/calendar/imports', async (c) => {
  c.header('Cache-Control', NO_STORE);
  checkRateLimit(getIp(c));
  const me = await requireAuth(c);
  const rows = await query<ImportRow>(
    `SELECT id, source, event_count, created_at, undone_at
       FROM calendar_imports WHERE owner_key = ? ORDER BY id DESC LIMIT 10`, [me.wcaId],
  );
  // 一条都没导成的批次(全失败 / 中途关页)对用户没有意义,不占位置。
  return c.json({ imports: rows.filter((r) => r.event_count > 0).map(toImport) });
});

calendarRoutes.delete('/calendar/imports/:id', async (c) => {
  c.header('Cache-Control', NO_STORE);
  checkRateLimit(getIp(c), { bucket: 'cal-import', max: 20 });
  const me = await requireAuth(c);
  const id = Number(c.req.param('id'));
  const rows = await query<ImportRow>(
    `SELECT id, source, event_count, created_at, undone_at
       FROM calendar_imports WHERE id = ? AND owner_key = ?`, [id, me.wcaId],
  );
  if (!rows[0]) return c.json({ error: 'not found' }, 404);
  if (rows[0].undone_at != null) return c.json({ error: 'already undone' }, 400);

  // 事件先走:日历上还挂着东西的话下面那步就不该删它。
  const gone = await query<{ id: string }>(
    'DELETE FROM calendar_events WHERE import_id = ? AND owner_key = ? RETURNING id', [id, me.wcaId],
  );
  // 这次导入新建、且此刻确实空了的日历才删。用户后来往里加过日程就留着 —— 撤销导入不该
  // 顺手带走人家自己写的东西。主日历永远不动。
  const dropped = await query<{ id: string }>(
    `DELETE FROM calendars c
      WHERE c.import_id = ? AND c.owner_key = ? AND NOT c.is_default
        AND NOT EXISTS (SELECT 1 FROM calendar_events e WHERE e.calendar_id = c.id)
      RETURNING c.id`, [id, me.wcaId],
  );
  await query('UPDATE calendar_imports SET undone_at = ? WHERE id = ?', [Date.now(), id]);
  return c.json({ removedEvents: gone.length, removedCalendars: dropped.length });
});

/**
 * 改事件。scope 决定动谁:
 *   this      —— 在主事件上 EXDATE 掉这一次,另存一条覆盖行(series_id 指回主事件)
 *   following —— 把主事件截到这一次之前(UNTIL / COUNT 相应改小),之后另起一条新序列
 *   all       —— 直接改主事件;时间变化按「这一次的位移」整体平移
 */
calendarRoutes.patch('/calendar/events/:id', async (c) => {
  c.header('Cache-Control', NO_STORE);
  checkRateLimit(getIp(c));
  const me = await requireAuth(c);
  const id = Number(c.req.param('id'));
  const row = await ownedEvent(me.wcaId, id);
  if (!row) return c.json({ error: 'not found' }, 404);
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({} as Record<string, unknown>));
  const scope = String(c.req.query('scope') || 'all');
  const occurrence = ms(body.occurrenceMs ?? c.req.query('occurrence'));
  const guestKeys = Array.isArray(body.guestKeys) ? (body.guestKeys as string[]) : undefined;
  const recurring = row.rrule !== '';

  // 单次覆盖行 / 不重复事件:没有 scope 之分,原地改。
  if (!recurring || (scope === 'this' && row.series_id != null)) {
    const input = await readEventInput(body, me.wcaId, row);
    const updated = await updateEventRow(id, me.wcaId, input);
    await syncGuests(updated, guestKeys, { key: me.wcaId, name: me.name });
    return c.json({ event: toEvent(updated, (await guestsFor([id])).get(id) ?? []) });
  }

  if (scope === 'this') {
    if (occurrence == null) return c.json({ error: 'occurrence required' }, 400);
    const input = await readEventInput(body, me.wcaId, row);
    // 覆盖行自己不带重复规则,它只是「那一天的那一场」。
    const override = await insertEvent(me.wcaId, { ...input, rrule: '', exdates: '' },
      { seriesId: id, occurrenceMs: occurrence });
    const ex = [...numList(row.exdates), occurrence];
    await query('UPDATE calendar_events SET exdates = ?, updated_at = ? WHERE id = ? AND owner_key = ?',
      [normalizeExdates(ex), Date.now(), id, me.wcaId]);
    await syncGuests(override, guestKeys, { key: me.wcaId, name: me.name });
    return c.json({ event: toEvent(override), splitFrom: id });
  }

  if (scope === 'following') {
    if (occurrence == null) return c.json({ error: 'occurrence required' }, 400);
    const input = await readEventInput(body, me.wcaId, row);
    const before = truncateSeries(row, occurrence);
    if (before.remaining === 0) {
      // 从第一次就开始改 = 整条序列都改,退化成 all。
      const updated = await updateEventRow(id, me.wcaId, { ...input, rrule: input.rrule || row.rrule });
      await syncGuests(updated, guestKeys, { key: me.wcaId, name: me.name });
      return c.json({ event: toEvent(updated, (await guestsFor([id])).get(id) ?? []) });
    }
    await query('UPDATE calendar_events SET rrule = ?, updated_at = ? WHERE id = ? AND owner_key = ?',
      [before.rrule, Date.now(), id, me.wcaId]);
    const tail = await insertEvent(me.wcaId, {
      ...input,
      rrule: before.tailRrule,
      // 截断点之后的 EXDATE 跟着新序列走,之前的留给老序列。
      exdates: normalizeExdates(numList(row.exdates).filter((x) => x >= occurrence)),
    });
    await syncGuests(tail, guestKeys, { key: me.wcaId, name: me.name });
    return c.json({ event: toEvent(tail), splitFrom: id });
  }

  // scope=all:拖动其中一次要把整条序列一起挪,位移量按「这一次」算。
  const input = await readEventInput(body, me.wcaId, row);
  let start = input.start;
  let end = input.end;
  if (occurrence != null && body.start != null) {
    const delta = input.start - occurrence;
    start = Number(row.start_ms) + delta;
    end = start + (input.end - input.start);
  }
  const updated = await updateEventRow(id, me.wcaId, { ...input, start, end });
  await syncGuests(updated, guestKeys, { key: me.wcaId, name: me.name });
  return c.json({ event: toEvent(updated, (await guestsFor([id])).get(id) ?? []) });
});

async function updateEventRow(id: number, ownerKey: string, input: EventInput): Promise<EventRow> {
  const rows = await query<EventRow>(
    `UPDATE calendar_events SET
       calendar_id = ?, title = ?, description = ?, location = ?, all_day = ?,
       start_ms = ?, end_ms = ?, tz = ?, rrule = ?, exdates = ?, color = ?, reminders = ?, updated_at = ?
     WHERE id = ? AND owner_key = ?
     RETURNING ${EVENT_COLS}`,
    [input.calendarId, input.title, input.description, input.location, input.allDay,
      input.start, input.end, input.tz, input.rrule, input.exdates, input.color, input.reminders,
      Date.now(), id, ownerKey],
  );
  return rows[0];
}

/**
 * 把序列截到 occurrence 之前:算出老序列该保留几次,并给出「后半段」应该用的规则。
 * COUNT 型规则要拆成两半(否则后半段会多发),UNTIL / 无界型只需给老的补一个 UNTIL。
 */
function truncateSeries(row: EventRow, occurrence: number): { rrule: string; tailRrule: string; remaining: number } {
  const rule = parseRRule(row.rrule);
  if (!rule) return { rrule: row.rrule, tailRrule: row.rrule, remaining: 0 };
  const before = expandOccurrences({
    rrule: row.rrule, start: Number(row.start_ms), tz: row.tz,
    from: 0, to: occurrence, limit: 2000,
  });
  const kept = before.length;
  if (kept === 0) return { rrule: row.rrule, tailRrule: row.rrule, remaining: 0 };
  if (rule.count > 0) {
    return {
      rrule: formatRRule({ ...rule, count: kept, until: 0 }),
      tailRrule: formatRRule({ ...rule, count: Math.max(1, rule.count - kept), until: 0 }),
      remaining: kept,
    };
  }
  return {
    rrule: formatRRule({ ...rule, count: 0, until: occurrence - 1000 }),
    tailRrule: row.rrule,
    remaining: kept,
  };
}

calendarRoutes.delete('/calendar/events/:id', async (c) => {
  c.header('Cache-Control', NO_STORE);
  checkRateLimit(getIp(c));
  const me = await requireAuth(c);
  const id = Number(c.req.param('id'));
  const row = await ownedEvent(me.wcaId, id);
  if (!row) return c.json({ error: 'not found' }, 404);
  const scope = String(c.req.query('scope') || 'all');
  const occurrence = ms(c.req.query('occurrence'));

  if (row.rrule !== '' && scope === 'this' && occurrence != null) {
    const ex = [...numList(row.exdates), occurrence];
    await query('UPDATE calendar_events SET exdates = ?, updated_at = ? WHERE id = ? AND owner_key = ?',
      [normalizeExdates(ex), Date.now(), id, me.wcaId]);
    // 这一次如果有单次覆盖行,一并删掉,否则它会孤零零地留在格子里。
    await query('DELETE FROM calendar_events WHERE series_id = ? AND occurrence_ms = ? AND owner_key = ?',
      [id, occurrence, me.wcaId]);
    return c.json({ ok: true });
  }
  if (row.rrule !== '' && scope === 'following' && occurrence != null) {
    const cut = truncateSeries(row, occurrence);
    if (cut.remaining > 0) {
      await query('UPDATE calendar_events SET rrule = ?, updated_at = ? WHERE id = ? AND owner_key = ?',
        [cut.rrule, Date.now(), id, me.wcaId]);
      await query('DELETE FROM calendar_events WHERE series_id = ? AND occurrence_ms >= ? AND owner_key = ?',
        [id, occurrence, me.wcaId]);
      return c.json({ ok: true });
    }
  }
  // 主事件删掉时,覆盖行靠 series_id 的 ON DELETE CASCADE 一起走。
  await query('DELETE FROM calendar_events WHERE id = ? AND owner_key = ?', [id, me.wcaId]);
  return c.json({ ok: true });
});

/** 受邀者回应邀请(接受 / 拒绝),并通知发起人。 */
calendarRoutes.post('/calendar/events/:id/rsvp', async (c) => {
  c.header('Cache-Control', NO_STORE);
  checkRateLimit(getIp(c));
  const me = await requireAuth(c);
  const id = Number(c.req.param('id'));
  const body = await c.req.json<{ status?: string }>().catch(() => ({} as { status?: string }));
  const status = body.status === 'accepted' ? 'accepted' : body.status === 'declined' ? 'declined' : '';
  if (!status) return c.json({ error: 'bad status' }, 400);
  const rows = await query<{ owner_key: string; title: string }>(
    `UPDATE calendar_guests g SET status = ?
     FROM calendar_events e
     WHERE g.event_id = e.id AND g.event_id = ? AND g.guest_key = ?
     RETURNING e.owner_key, e.title`,
    [status, id, me.wcaId],
  );
  if (rows.length === 0) return c.json({ error: 'not found' }, 404);
  await notify({
    recipients: [rows[0].owner_key],
    kind: 'cal_rsvp',
    actorKey: me.wcaId,
    actorName: me.name,
    title: rows[0].title || '(无标题)',
    excerpt: status === 'accepted' ? '接受了邀请 / accepted' : '拒绝了邀请 / declined',
    link: '/calendar',
  });
  return c.json({ ok: true, status });
});

// ── 站内用户搜索(加嘉宾用)────────────────────────────────────────────────

calendarRoutes.get('/calendar/people', async (c) => {
  c.header('Cache-Control', NO_STORE);
  checkRateLimit(getIp(c));
  await requireAuth(c);
  const q = (c.req.query('q') || '').trim().slice(0, 40);
  if (q.length < 2) return c.json({ people: [] });
  const rows = await query<ProfileRow>(
    `SELECT wca_id, id AS uid, display_name, avatar_url FROM app_users
     WHERE display_name ILIKE ? OR wca_id ILIKE ?
     ORDER BY (wca_id IS NOT NULL) DESC, display_name
     LIMIT 8`,
    [`%${q}%`, `${q}%`],
  );
  return c.json({
    people: rows.map((r) => ({
      key: r.wca_id || `u${r.uid}`,
      name: r.display_name || (r.wca_id ?? ''),
      userId: Number(r.uid),
      avatar: r.avatar_url || '',
      wcaId: r.wca_id || '',
    })),
  });
});

// ── 分享 ────────────────────────────────────────────────────────────────────

calendarRoutes.put('/calendar/share', async (c) => {
  c.header('Cache-Control', NO_STORE);
  checkRateLimit(getIp(c));
  const me = await requireAuth(c);
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({} as Record<string, unknown>));
  const cur = await ensureShare(me.wcaId, zone(body.tz, 'UTC'));
  const mine = new Set((await listCalendars(me.wcaId)).map((x) => x.id));
  const ids = Array.isArray(body.calendarIds)
    ? [...new Set((body.calendarIds as unknown[]).map(Number).filter((n) => mine.has(n)))]
    : numList(cur.calendar_ids);
  const rows = await query<ShareRow>(
    `UPDATE calendar_shares SET enabled = ?, detail = ?, title = ?, calendar_ids = ?, tz = ?, updated_at = ?
     WHERE owner_key = ?
     RETURNING token, enabled, detail, title, calendar_ids, tz`,
    [body.enabled == null ? cur.enabled : !!body.enabled,
      body.detail === 'full' ? 'full' : body.detail === 'busy' ? 'busy' : cur.detail,
      typeof body.title === 'string' ? str(body.title, 80) : cur.title,
      ids.join(','), zone(body.tz, cur.tz), Date.now(), me.wcaId],
  );
  return c.json({ share: shareJson(rows[0]) });
});

/** 换一条链接:旧链接立刻失效(发错人了就靠这个收回)。 */
calendarRoutes.post('/calendar/share/rotate', async (c) => {
  c.header('Cache-Control', NO_STORE);
  checkRateLimit(getIp(c));
  const me = await requireAuth(c);
  await ensureShare(me.wcaId, 'UTC');
  const rows = await query<ShareRow>(
    `UPDATE calendar_shares SET token = ?, updated_at = ? WHERE owner_key = ?
     RETURNING token, enabled, detail, title, calendar_ids, tz`,
    [newToken(), Date.now(), me.wcaId],
  );
  return c.json({ share: shareJson(rows[0]) });
});

interface PublicPayload {
  title: string;
  detail: ShareDetail;
  tz: string;
  ownerName: string;
  ownerUserId: number | null;
  calendars: { id: number; name: string; color: string }[];
  events: CalEvent[];
}

/** 分享设置 + 参与展示的日历 + 事件(已按档位脱敏)。token 无效 / 未开启 → null。 */
async function loadPublic(token: string, from: number, to: number): Promise<PublicPayload | null> {
  if (!/^[A-Za-z0-9_-]{8,32}$/.test(token)) return null;
  const shares = await query<ShareRow & { owner_key: string }>(
    'SELECT owner_key, token, enabled, detail, title, calendar_ids, tz FROM calendar_shares WHERE token = ?',
    [token],
  );
  const share = shares[0];
  if (!share || !share.enabled) return null;

  const cals = await listCalendars(share.owner_key);
  const picked = numList(share.calendar_ids);
  const visible = picked.length ? cals.filter((x) => picked.includes(x.id)) : cals;
  if (visible.length === 0) {
    return { title: share.title, detail: share.detail, tz: share.tz, ownerName: '', ownerUserId: null, calendars: [], events: [] };
  }
  const ids = visible.map((x) => x.id);
  const rows = await query<EventRow>(
    `SELECT ${EVENT_COLS} FROM calendar_events
     WHERE calendar_id IN (${ids.map(() => '?').join(',')})
       AND (rrule <> '' OR (start_ms < ? AND end_ms > ?))
     ORDER BY start_ms`,
    [...ids, to, from],
  );
  const profile = (await profilesFor([share.owner_key])).get(share.owner_key);
  // 脱敏在这里做,不是在前端不渲染 —— busy 档下标题根本不进响应体。
  const events = rows.map((r) => {
    const e = toEvent(r);
    delete e.ownerKey;
    return share.detail === 'busy' ? redactBusy(e) : e;
  });
  return {
    title: share.title,
    detail: share.detail,
    tz: share.tz,
    ownerName: profile?.name || '',
    ownerUserId: profile?.userId ?? null,
    calendars: visible.map((x) => ({ id: x.id, name: x.name, color: x.color })),
    events,
  };
}

calendarRoutes.get('/calendar/public/:token', async (c) => {
  // 分享页随时可能被关掉 / 换 token,别让 CDN 替失效链接续命。
  c.header('Cache-Control', 'no-store');
  checkRateLimit(getIp(c), { bucket: 'cal-public', max: 120 });
  const from = ms(c.req.query('from')) ?? Date.now() - 60 * 86_400_000;
  const to = ms(c.req.query('to')) ?? from + 200 * 86_400_000;
  if (to <= from || to - from > MAX_WINDOW_MS) return c.json({ error: 'invalid window' }, 400);
  const data = await loadPublic(c.req.param('token'), from, to);
  if (!data) return c.json({ error: 'not found' }, 404);
  return c.json(data);
});

/** 订阅源:Google / Apple 日历「通过网址添加」直接吃这个地址。 */
calendarRoutes.get('/calendar/public/:token/ics', async (c) => {
  checkRateLimit(getIp(c), { bucket: 'cal-ics', max: 60 });
  const now = Date.now();
  const data = await loadPublic(c.req.param('token'), now - 180 * 86_400_000, now + 400 * 86_400_000);
  if (!data) return c.text('Not found', 404);
  const busy = data.detail === 'busy';
  const text = eventsToIcs({
    name: data.title || (data.ownerName ? `${data.ownerName}` : 'CubeRoot Calendar'),
    tz: data.tz,
    events: prepareForIcs(data.events),
    busyLabel: busy ? 'Busy' : undefined,
    refreshMinutes: 60,
  });
  c.header('Content-Type', 'text/calendar; charset=utf-8');
  c.header('Cache-Control', 'public, max-age=600');
  c.header('Content-Disposition', 'inline; filename="cuberoot.ics"');
  return c.body(text);
});

/** 自己的完整导出(需登录)。 */
calendarRoutes.get('/calendar/export', async (c) => {
  checkRateLimit(getIp(c), { bucket: 'cal-export', max: 20 });
  const me = await requireAuth(c);
  const cals = await listCalendars(me.wcaId);
  const names = new Map(cals.map((x) => [x.id, x.name]));
  const rows = await query<EventRow>(
    `SELECT ${EVENT_COLS} FROM calendar_events WHERE owner_key = ? ORDER BY start_ms`, [me.wcaId],
  );
  const text = eventsToIcs({
    name: 'CubeRoot',
    tz: cals[0]?.tz || 'UTC',
    events: prepareForIcs(rows.map((r) => toEvent(r))),
    calendarName: (e) => names.get(e.calendarId) || undefined,
  });
  c.header('Content-Type', 'text/calendar; charset=utf-8');
  c.header('Cache-Control', NO_STORE);
  c.header('Content-Disposition', 'attachment; filename="cuberoot-calendar.ics"');
  return c.body(text);
});

/**
 * 导出前的一步修正:被「只改这一次」替换掉的那些 occurrence,我们内部同时写了 EXDATE 和
 * 一条覆盖行。ICS 的规矩是覆盖行用 RECURRENCE-ID 认领那一次,若同时又被 EXDATE 排除,
 * 严格的订阅端会把它整场丢掉。所以导出时把「有覆盖行认领」的 EXDATE 摘掉。
 */
function prepareForIcs(events: CalEvent[]): CalEvent[] {
  const claimed = new Map<number, Set<number>>();
  for (const e of events) {
    if (e.seriesId != null && e.occurrenceMs != null) {
      const set = claimed.get(e.seriesId) ?? new Set<number>();
      set.add(e.occurrenceMs);
      claimed.set(e.seriesId, set);
    }
  }
  return events.map((e) => {
    const set = claimed.get(e.id);
    return set ? { ...e, exdates: e.exdates.filter((x) => !set.has(x)) } : e;
  });
}

// ── 提醒扫描 ────────────────────────────────────────────────────────────────

const SWEEP_INTERVAL_MS = 60_000;
/** 最长提前量(一周);扫描窗口按它取。 */
const MAX_LEAD_MS = 10_080 * 60_000;
/** 补发宽限:进程重启 / 卡顿导致错过的提醒,10 分钟内仍然补发一次(再久就没意义了)。 */
const GRACE_MS = 10 * 60_000;

async function sweepReminders(): Promise<void> {
  const now = Date.now();
  const rows = await query<EventRow>(
    `SELECT ${EVENT_COLS} FROM calendar_events
     WHERE reminders <> '' AND (rrule <> '' OR (end_ms > ? AND start_ms < ?))`,
    [now - GRACE_MS, now + MAX_LEAD_MS],
  );
  if (rows.length === 0) return;

  const guestMap = await guestsFor(rows.map((r) => Number(r.id)));
  for (const row of rows) {
    const e = toEvent(row, guestMap.get(Number(row.id)) ?? []);
    const dur = e.end - e.start;
    // 只看「现在起最多一周」这段:提前量最大就是一周。
    const occurrences = expandOccurrences({
      rrule: e.rrule, start: e.start, tz: e.tz, exdates: e.exdates,
      from: now - GRACE_MS, to: now + MAX_LEAD_MS + 60_000, durationMs: dur, limit: 200,
    });
    for (const occ of occurrences) {
      for (const minutes of e.reminders) {
        const fireAt = occ - minutes * 60_000;
        if (fireAt > now || fireAt <= now - GRACE_MS) continue;
        const recipients = [e.ownerKey ?? '', ...e.guests.filter((g) => g.status === 'accepted').map((g) => g.key)]
          .filter(Boolean);
        for (const key of recipients) {
          const claimed = await query<{ event_id: string }>(
            `INSERT INTO calendar_reminder_log (event_id, occurrence_ms, minutes, user_key, sent_at)
             VALUES (?, ?, ?, ?, ?) ON CONFLICT DO NOTHING RETURNING event_id`,
            [e.id, occ, minutes, key, now],
          );
          // 抢到插入的那一次才发:同一条提醒重复扫到(补发窗口重叠)不会轰炸两遍。
          if (claimed.length === 0) continue;
          await notify({
            recipients: [key],
            kind: 'cal_reminder',
            actorKey: '',
            actorName: '',
            title: e.title || '(无标题)',
            excerpt: reminderExcerpt(occ, minutes, e.tz, e.location),
            link: '/calendar',
          });
        }
      }
    }
  }
  // 日志只用于去重,过期的清掉(30 天足够覆盖最长提前量 + 补发窗口)。
  await query('DELETE FROM calendar_reminder_log WHERE sent_at < ?', [now - 30 * 86_400_000]);
}

function reminderExcerpt(occ: number, minutes: number, tz: string, location: string): string {
  const when = new Intl.DateTimeFormat('sv-SE', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(new Date(occ));
  const lead = minutes === 0 ? '现在开始 / starting now' : `${minutes} 分钟后 / in ${minutes} min`;
  return `${when} (${tz}) — ${lead}${location ? ` @ ${location}` : ''}`;
}

/** 常驻进程启动时挂上(index.ts)。失败只记日志,不拖垮 API。 */
export function startCalendarReminderSweep(): void {
  const run = (): void => {
    void sweepReminders().catch((e: unknown) => {
      console.warn('[calendar] reminder sweep failed:', (e as Error).message);
    });
  };
  setTimeout(run, 15_000);
  setInterval(run, SWEEP_INTERVAL_MS);
}
