import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

export const ORIGIN = 'https://anchor.douyin.com';
export const CONTENT_PATH = '/anchor_pc_tinker_proxy/lego/native/webcast_api/room/detail/room_stats_content_list';
export const BASE_PATH = '/anchor_pc_tinker_proxy/lego/native/simple/room/replay/room_base_v2';
const TIME = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

export function parseLink(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error('请输入有效的抖音直播复盘链接。'); }
  if (url.origin !== ORIGIN || url.pathname !== '/anchor/review' || url.username || url.password) {
    throw new Error('仅支持 https://anchor.douyin.com/anchor/review 复盘链接。');
  }
  const roomId = url.searchParams.get('roomId');
  if (!/^\d{1,25}$/.test(roomId ?? '')) throw new Error('链接缺少有效的 roomId。');
  return { roomId, url: `${ORIGIN}/anchor/review?type=0&roomId=${roomId}` };
}

export function seconds(value) {
  if (typeof value !== 'string' || !TIME.test(value)) throw new Error('接口返回了无效的北京时间。');
  const n = Date.parse(value.replace(' ', 'T') + '+08:00') / 1000;
  if (!Number.isFinite(n) || formatTime(n) !== value) throw new Error('接口返回了不存在的日期或时间。');
  return n;
}

export function formatTime(value) {
  return new Date((value + 8 * 3600) * 1000).toISOString().slice(0, 19).replace('T', ' ');
}

export function windows(start, end) {
  const from = seconds(start), to = seconds(end);
  if (to < from) throw new Error('直播结束时间早于开始时间。');
  const result = [];
  for (let n = from; n <= to; n += 1800) {
    result.push({ start: formatTime(n), end: formatTime(n + 1799) });
  }
  return result;
}

export class Transcript {
  constructor(roomId) {
    this.roomId = roomId;
    this.meta = null;
    this.batches = new Map();
  }

  // Only retain transcript fields; never retain headers, cookies or avatar URLs.
  ingest(rawUrl, status, body) {
    const url = new URL(rawUrl);
    if (url.origin !== ORIGIN) return false;
    if (url.pathname !== BASE_PATH && url.pathname !== CONTENT_PATH) return false;
    if (status !== 200 || body?.code !== 0 || !Array.isArray(body.data?.series)) return false;
    if (url.pathname === BASE_PATH) {
      const row = body.data.series.find(r => String(r.room_id) === this.roomId);
      if (!row) return false;
      const start = seconds(row.start_time), end = seconds(row.end_time);
      if (end < start) throw new Error('直播尚未结束或接口返回的时间范围无效。');
      this.meta = { title: String(row.title ?? ''), start: row.start_time, end: row.end_time };
      return true;
    }
    if (url.searchParams.get('roomID') !== this.roomId || url.searchParams.get('roomStatsContentType') !== '4') return false;
    const start = url.searchParams.get('startTime'), end = url.searchParams.get('endTime');
    const from = seconds(start), to = seconds(end);
    if (to < from || to - from > 1800) throw new Error('文字记录接口的分段范围无效。');
    const rows = body.data.series.map(r => {
      const time = seconds(r.contentTime);
      if (time < from || time > to || typeof r.content !== 'string' || typeof r.nickname !== 'string') {
        throw new Error('文字记录接口返回了范围外时间或无效文字字段。');
      }
      return { time: r.contentTime, nickname: r.nickname, content: r.content };
    });
    this.batches.set(`${start}/${end}`, { start, end, rows });
    return true;
  }

  get gaps() {
    if (!this.meta) return [];
    let cursor = seconds(this.meta.start);
    const end = seconds(this.meta.end), result = [];
    for (const b of [...this.batches.values()].sort((a, b) => a.start.localeCompare(b.start))) {
      const from = seconds(b.start), to = seconds(b.end);
      if (to < cursor || from > end) continue;
      if (from > cursor) result.push({ start: formatTime(cursor), end: formatTime(Math.min(from - 1, end)) });
      cursor = Math.max(cursor, to + 1);
    }
    if (cursor <= end) result.push({ start: formatTime(cursor), end: formatTime(end) });
    return result;
  }

  get complete() { return Boolean(this.meta) && this.gaps.length === 0; }

  get rows() {
    const unique = new Map();
    for (const b of this.batches.values()) {
      for (const row of b.rows) {
        if (this.meta && (row.time < this.meta.start || row.time > this.meta.end)) continue;
        unique.set(JSON.stringify([row.time, row.nickname, row.content]), row);
      }
    }
    return [...unique.values()].sort((a, b) => a.time.localeCompare(b.time));
  }

  assertComplete() {
    if (!this.meta) throw new Error('未读取到本场直播的起止时间，无法确认是否完整。');
    if (!this.complete) throw new Error(`文字记录尚未完整加载，缺少：${this.gaps.map(g => `${g.start} 至 ${g.end}`).join('；')}`);
  }
}

export async function fromHar(path, roomId) {
  const raw = await readFile(path, 'utf8');
  let har;
  try { har = JSON.parse(raw.replace(/^\uFEFF/, '')); }
  catch { throw new Error('HAR 不是有效的 JSON，请重新导出完整文件。'); }
  if (!Array.isArray(har.log?.entries)) throw new Error('文件不是有效的 HAR。');
  if (!roomId) {
    const ids = new Set();
    for (const entry of har.log.entries) {
      let url;
      try { url = new URL(entry.request.url); } catch { continue; }
      if (url.origin === ORIGIN && url.pathname === CONTENT_PATH && url.searchParams.get('roomStatsContentType') === '4') {
        const id = url.searchParams.get('roomID');
        if (/^\d{1,25}$/.test(id ?? '')) ids.add(id);
      }
    }
    if (ids.size !== 1) throw new Error('HAR 未包含唯一直播间，请同时传入目标复盘链接。');
    roomId = [...ids][0];
  }
  const transcript = new Transcript(roomId);
  for (const entry of har.log.entries) {
    let url;
    try { url = new URL(entry.request.url); } catch { continue; }
    if (url.origin !== ORIGIN || ![BASE_PATH, CONTENT_PATH].includes(url.pathname)) continue;
    const content = entry.response?.content;
    if (!content?.text) continue;
    let body;
    try { body = JSON.parse(content.encoding === 'base64' ? Buffer.from(content.text, 'base64').toString('utf8') : content.text); }
    catch { continue; }
    transcript.ingest(entry.request.url, entry.response.status, body);
  }
  return transcript;
}

export function renderText(transcript) {
  transcript.assertComplete();
  return '\uFEFF' + transcript.rows.map(r => r.content).join('\n\n').replace(/\r\n?/g, '\n') + '\n';
}

export async function saveText(transcript, output) {
  const txt = renderText(transcript);
  const path = resolve(output);
  await mkdir(dirname(path), { recursive: true });
  // Exclusive creation avoids overwriting a previous export or an unrelated file.
  await writeFile(path, txt, { encoding: 'utf8', flag: 'wx' });
  return path;
}
