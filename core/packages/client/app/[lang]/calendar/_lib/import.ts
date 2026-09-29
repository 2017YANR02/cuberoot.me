// 从别家日历搬进来 —— 主要面向 Google 日历的「导出」。
//
// Google 那个导出按钮给的不是一份 .ics,是一个 .zip:账号下每个日历一份 .ics,文件名是
// 日历的 id(`someone@gmail.com.ics` / `xxx@group.calendar.google.com.ics`),真正的名字在
// 文件头的 X-WR-CALNAME 里。所以这里做三件本地的事,再交给 API:
//
//   1. 拆 zip(zip 里非 .ics 的条目 —— Takeout 会塞 Tasks 的 json —— 直接跳过)
//   2. 每份 .ics 认领一个同名日历:已有就并进去,没有就新建,重复导入不会长出一堆同名日历
//   3. 按 ICS_IMPORT_BATCH 切批送 —— 后端一次只收这么多,不切的话超出部分会被退回来
//
// 解析本身(含重复规则、覆盖行、提醒)在 @cuberoot/shared/calendar 的 parseIcs 里,
// 前端后端和导出端共用同一份。

import { unzipSync, strFromU8 } from 'fflate';
import {
  parseIcs, icsCalendarName, icsCalendarColor, ICS_IMPORT_BATCH, CALENDAR_COLORS,
  type CalendarMeta, type ParsedIcsEvent,
} from '@cuberoot/shared/calendar';
import { createCalendar, importEvents, startImport, fetchBootstrap } from '@/lib/calendar-api';
import { readGoogleBackup, reviewGoogleBackup } from '@/lib/google-calendar-backup';

/** 一份待导入的日历:一个 .ics 文件的内容。 */
export interface IcsSource {
  /** 文件未提供时留空，不声称恢复了来源颜色。 */
  color?: string;
  tz?: string;
  /** 目标日历名 */
  name: string;
  events: ParsedIcsEvent[];
}

export interface ImportProgress {
  /** 已经送进去的条数(含失败的) */
  done: number;
  total: number;
}

export interface ImportResult {
  added: number;
  failed: number;
  /** 落进了哪几个日历(按名字) */
  calendars: string[];
  /** 这次导入的批次 id,用来整批撤销;一条都没进就没有 */
  importId: number | null;
}

/** 429 之后的退避:后端 cal-bulk 是 60 秒滑窗,等一小段再试就过去了。 */
const RETRY_WAIT_MS = 8_000;
const MAX_RETRY = 8;

const sleep = (ms: number): Promise<void> => new Promise((r) => { setTimeout(r, ms); });

const isRateLimit = (e: unknown): boolean => /rate limit/i.test((e as Error)?.message ?? '');

/** zip 里挑出 .ics;不是 zip 就当成单份 .ics 文本。 */
export async function readIcsSources(file: File, fallbackTz: string): Promise<IcsSource[]> {
  const backup = await readGoogleBackup(file);
  if (backup) return reviewGoogleBackup(backup).sources;
  const zip = /\.zip$/i.test(file.name) || file.type === 'application/zip'
    || file.type === 'application/x-zip-compressed';
  if (!zip) {
    const text = await file.text();
    return [{
      name: icsCalendarName(text) || file.name.replace(/\.ics$/i, ''),
      ...(icsCalendarColor(text) ? { color: icsCalendarColor(text) } : {}),
      events: parseIcs(text, fallbackTz),
    }];
  }

  const entries = unzipSync(new Uint8Array(await file.arrayBuffer()), {
    filter: (f) => /\.ics$/i.test(f.name) && f.size > 0,
  });
  const out: IcsSource[] = [];
  for (const [path, bytes] of Object.entries(entries)) {
    const text = strFromU8(bytes);
    const base = path.split('/').pop() ?? path;
    out.push({
      name: icsCalendarName(text) || base.replace(/\.ics$/i, ''),
      ...(icsCalendarColor(text) ? { color: icsCalendarColor(text) } : {}),
      events: parseIcs(text, fallbackTz),
    });
  }
  return out;
}

/**
 * 找 / 建这份 .ics 该落进的日历。
 * 名字对上就并进已有的那个 —— 同一份导出重导一次不该多出一列同名日历。
 * 建不出来就中止，不能悄悄把其他日历混入主日历并丢掉来源色。
 */
async function resolveCalendar(
  name: string, existing: CalendarMeta[], fallbackId: number, tz: string, importId: number, sourceColor?: string,
): Promise<{ id: number; name: string; created: CalendarMeta | null }> {
  const clean = name.trim().slice(0, 60);
  if (!clean) return { id: fallbackId, name: '', created: null };
  const hit = existing.find((c) => c.name.trim().toLowerCase() === clean.toLowerCase());
  if (hit) return { id: hit.id, name: hit.name, created: null };
    // 无来源颜色用中性默认值，不能把任意轮换配色当作原始颜色。
    const color = sourceColor || 'graphite';
    // importId 让撤销时知道这列是这次导入建的 —— 撤销时它若已空就一并删掉。
    const made = await createCalendar({ name: clean, color, tz, importId });
    if (sourceColor && made.color.toLowerCase() !== sourceColor.toLowerCase()) throw new Error('calendar_color_not_supported');
    return { id: made.id, name: made.name, created: made };
}

/** 送一批,撞限流就退避重试(导入是一次性动作,等几秒也比丢一半强)。 */
async function sendBatch(
  calendarId: number, batch: ParsedIcsEvent[], importId: number,
): Promise<{ added: number; failed: number }> {
  const payload = batch.map((p) => ({
    title: p.title, description: p.description, location: p.location,
    allDay: p.allDay, start: p.start, end: p.end, tz: p.tz,
    rrule: p.rrule, exdates: p.exdates, reminders: p.reminders,
    ...(p.color ? { color: p.color } : {}),
  }));
  for (let attempt = 0; ; attempt++) {
    try {
      return await importEvents(calendarId, payload, importId);
    } catch (e) {
      if (!isRateLimit(e) || attempt >= MAX_RETRY) throw e;
      await sleep(RETRY_WAIT_MS);
    }
  }
}

/**
 * 导入一个文件(.ics 或 Google 导出的 .zip)。
 * `calendars` 传当前已有的日历,用来认领同名的那个;新建出来的会 append 进去(调用方随后
 * reload 一次即可拿到权威列表)。
 */
export async function importCalendarFile(opts: {
  file: File;
  tz: string;
  calendars: CalendarMeta[];
  defaultCalendarId: number;
  onProgress?: (p: ImportProgress) => void;
}): Promise<ImportResult> {
  const sources = (await readIcsSources(opts.file, opts.tz)).filter((s) => s.events.length > 0);
  const total = sources.reduce((n, s) => n + s.events.length, 0);
  if (total === 0) return { added: 0, failed: 0, calendars: [], importId: null };
  const extendedColor = (color: string | undefined) => color && !(CALENDAR_COLORS as readonly string[]).includes(color);
  if (sources.some(s => extendedColor(s.color) || s.events.some(e => extendedColor(e.color)))) {
    if ((await fetchBootstrap(opts.tz)).colorFormatVersion !== 2) throw new Error('calendar_color_upgrade_required');
  }

  // 批次先开:后面建的日历、塞的事件都挂在它下面,一次「撤销」就能全收回。
  const importId = await startImport(opts.file.name);

  const known = [...opts.calendars];
  const landed = new Set<string>();
  let added = 0;
  let failed = 0;
  let done = 0;
  opts.onProgress?.({ done, total });

  for (const src of sources) {
    // 单份 .ics 且名字撞不上已有日历时也照建 —— 用户导进来的是「另一个日历」,
    // 混进主日历就分不开了。
    const target = await resolveCalendar(src.name, known, opts.defaultCalendarId, src.tz || opts.tz, importId, src.color);
    if (target.created) known.push(target.created);
    if (target.name) landed.add(target.name);

    for (let i = 0; i < src.events.length; i += ICS_IMPORT_BATCH) {
      const batch = src.events.slice(i, i + ICS_IMPORT_BATCH);
      const r = await sendBatch(target.id, batch, importId);
      added += r.added;
      failed += r.failed;
      done += batch.length;
      opts.onProgress?.({ done, total });
    }
  }

  return { added, failed, calendars: [...landed], importId };
}
