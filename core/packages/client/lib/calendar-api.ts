// /calendar 的 API 层 —— 全站 apiUrl() + authHeaders/handleApi 那一套(lib/admin-api),
// 不自己拼 origin、不自己写 token 读取。
//
// 事件在库里是「主事件 + 规则」,不是一条条展开的行,所以这里只负责搬运原始事件;
// 按可视范围展开成格子里的块是 lib/calendar-store 的事(共用 @cuberoot/shared/recur)。

import { apiUrl, publicApiUrl } from './api-base';
import { authHeaders, handleApi } from './admin-api';
import type {
  CalEvent, CalendarImport, CalendarMeta, EditScope, ShareDetail, ShareSettings,
} from '@cuberoot/shared/calendar';

export interface BootstrapPayload {
  calendars: CalendarMeta[];
  share: ShareSettings;
  me: { key: string; name: string; avatar: string };
}

export interface EventsPayload {
  events: CalEvent[];
  /** 其中哪些是别人邀请我的(不是我建的) */
  invitedIds: number[];
}

/** 新建 / 保存事件时前端能给的字段(id 之外全可选,后端会补默认值)。 */
export interface EventDraft {
  calendarId: number;
  title?: string;
  description?: string;
  location?: string;
  allDay?: boolean;
  start: number;
  end: number;
  tz?: string;
  rrule?: string;
  exdates?: number[];
  color?: string;
  reminders?: number[];
  guestKeys?: string[];
  /** 改重复事件时,当前操作的是哪一次 */
  occurrenceMs?: number;
}

export async function fetchBootstrap(tz: string): Promise<BootstrapPayload> {
  const r = await fetch(apiUrl(`/v1/calendar/bootstrap?tz=${encodeURIComponent(tz)}`), {
    headers: authHeaders(false), cache: 'no-store',
  });
  return handleApi<BootstrapPayload>(r);
}

export async function fetchEvents(from: number, to: number): Promise<EventsPayload> {
  const r = await fetch(apiUrl(`/v1/calendar/events?from=${from}&to=${to}`), {
    headers: authHeaders(false), cache: 'no-store',
  });
  return handleApi<EventsPayload>(r);
}

export async function createCalendar(
  input: { name: string; color: string; tz: string; importId?: number },
): Promise<CalendarMeta> {
  const r = await fetch(apiUrl('/v1/calendar/calendars'), {
    method: 'POST', headers: authHeaders(), body: JSON.stringify(input),
  });
  return (await handleApi<{ calendar: CalendarMeta }>(r)).calendar;
}

export async function updateCalendar(
  id: number, input: Partial<{ name: string; color: string; tz: string }>,
): Promise<CalendarMeta> {
  const r = await fetch(apiUrl(`/v1/calendar/calendars/${id}`), {
    method: 'PATCH', headers: authHeaders(), body: JSON.stringify(input),
  });
  return (await handleApi<{ calendar: CalendarMeta }>(r)).calendar;
}

export async function deleteCalendar(id: number): Promise<void> {
  const r = await fetch(apiUrl(`/v1/calendar/calendars/${id}`), {
    method: 'DELETE', headers: authHeaders(false),
  });
  await handleApi<{ ok: boolean }>(r);
}

export async function createEvent(draft: EventDraft): Promise<CalEvent> {
  const r = await fetch(apiUrl('/v1/calendar/events'), {
    method: 'POST', headers: authHeaders(), body: JSON.stringify(draft),
  });
  return (await handleApi<{ event: CalEvent }>(r)).event;
}

export async function updateEvent(id: number, draft: EventDraft, scope: EditScope): Promise<CalEvent> {
  const r = await fetch(apiUrl(`/v1/calendar/events/${id}?scope=${scope}`), {
    method: 'PATCH', headers: authHeaders(), body: JSON.stringify(draft),
  });
  return (await handleApi<{ event: CalEvent }>(r)).event;
}

export async function deleteEvent(id: number, scope: EditScope, occurrenceMs?: number): Promise<void> {
  const q = `scope=${scope}${occurrenceMs != null ? `&occurrence=${occurrenceMs}` : ''}`;
  const r = await fetch(apiUrl(`/v1/calendar/events/${id}?${q}`), {
    method: 'DELETE', headers: authHeaders(false),
  });
  await handleApi<{ ok: boolean }>(r);
}

export async function importEvents(
  calendarId: number, events: Omit<EventDraft, 'calendarId'>[], importId?: number,
): Promise<{ added: number; failed: number }> {
  const r = await fetch(apiUrl('/v1/calendar/events/bulk'), {
    method: 'POST', headers: authHeaders(), body: JSON.stringify({ calendarId, importId, events }),
  });
  return handleApi<{ added: number; failed: number }>(r);
}

/** 开一个导入批次 —— 之后的建日历 / 塞事件都挂在它下面,用来整批撤销。 */
export async function startImport(source: string): Promise<number> {
  const r = await fetch(apiUrl('/v1/calendar/imports'), {
    method: 'POST', headers: authHeaders(), body: JSON.stringify({ source }),
  });
  return (await handleApi<{ id: number }>(r)).id;
}

export async function listImports(): Promise<CalendarImport[]> {
  const r = await fetch(apiUrl('/v1/calendar/imports'), {
    headers: authHeaders(false), cache: 'no-store',
  });
  return (await handleApi<{ imports: CalendarImport[] }>(r)).imports;
}

/** 撤销:删掉那次导入进来的全部事件,以及它新建且此刻仍空着的日历。 */
export async function undoImport(id: number): Promise<{ removedEvents: number; removedCalendars: number }> {
  const r = await fetch(apiUrl(`/v1/calendar/imports/${id}`), {
    method: 'DELETE', headers: authHeaders(false),
  });
  return handleApi<{ removedEvents: number; removedCalendars: number }>(r);
}

export async function rsvp(id: number, status: 'accepted' | 'declined'): Promise<void> {
  const r = await fetch(apiUrl(`/v1/calendar/events/${id}/rsvp`), {
    method: 'POST', headers: authHeaders(), body: JSON.stringify({ status }),
  });
  await handleApi<{ ok: boolean }>(r);
}

export async function saveShare(input: {
  enabled?: boolean; detail?: ShareDetail; title?: string; calendarIds?: number[]; tz?: string;
}): Promise<ShareSettings> {
  const r = await fetch(apiUrl('/v1/calendar/share'), {
    method: 'PUT', headers: authHeaders(), body: JSON.stringify(input),
  });
  return (await handleApi<{ share: ShareSettings }>(r)).share;
}

export async function rotateShareToken(): Promise<ShareSettings> {
  const r = await fetch(apiUrl('/v1/calendar/share/rotate'), {
    method: 'POST', headers: authHeaders(false),
  });
  return (await handleApi<{ share: ShareSettings }>(r)).share;
}

export interface PersonHit {
  key: string;
  name: string;
  avatar: string;
  wcaId: string;
}

export async function searchPeople(q: string): Promise<PersonHit[]> {
  const r = await fetch(apiUrl(`/v1/calendar/people?q=${encodeURIComponent(q)}`), {
    headers: authHeaders(false), cache: 'no-store',
  });
  return (await handleApi<{ people: PersonHit[] }>(r)).people;
}

/** 导出:后端直接吐 .ics 文本(要带 Bearer,所以不能直接开链接下载)。 */
export async function exportIcs(): Promise<string> {
  const r = await fetch(apiUrl('/v1/calendar/export'), { headers: authHeaders(false), cache: 'no-store' });
  if (!r.ok) throw new Error(`export failed ${r.status}`);
  return r.text();
}

export interface PublicCalendar {
  title: string;
  detail: ShareDetail;
  tz: string;
  ownerName: string;
  calendars: { id: number; name: string; color: string }[];
  events: CalEvent[];
}

/** 公开分享页读取(免登录)。busy 档下服务端已经把内容抹掉了,前端拿到的就是空标题。 */
export async function fetchPublicCalendar(token: string, from: number, to: number): Promise<PublicCalendar> {
  const r = await fetch(apiUrl(`/v1/calendar/public/${encodeURIComponent(token)}?from=${from}&to=${to}`), {
    cache: 'no-store',
  });
  return handleApi<PublicCalendar>(r);
}

/** 订阅地址(Google / Apple 日历「通过网址添加」用的那个)。 */
export function icsFeedUrl(token: string): string {
  // 这条地址是给用户**复制出去**粘进 Google / Apple 日历的,必须是绝对的公网地址 ——
  // apiUrl() 在 dev 下返回相对路径('' + /v1/…),粘到别处就是一条打不开的链接。
  return publicApiUrl(`/v1/calendar/public/${encodeURIComponent(token)}/ics`);
}
