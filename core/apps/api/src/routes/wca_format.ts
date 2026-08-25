/**
 * /v1/wca/format-record — 纪录快讯文案格式化(供前端 comp 弹窗复制按钮 + recent-records 用)。
 *
 * 协议: POST body `{events: [<RecordEvent>, ...]}` → `{cn, en, url}`。
 *       events 长度 1 = 单条,长度 2 = 同 round 合并(WCA Live single+average 双纪录)。
 *
 * 实现: 本地纯函数渲染(utils/record_format),世界排名查本地 wca_results_flat(复用
 *       wca_stats_extra 的 rank-for 引擎)。已删除原先 spawn 跨 repo Python `/opt/wca-monitor`
 *       + 联网拉 WCA 官网排名 + 5s 超时 + 熔断的整条脆弱链。
 */
import { Hono } from 'hono';
import {
  enrich,
  formatCombinedRecords,
  type FormattedRecord,
  type RecordEvent,
} from '../utils/record_format.js';
import { worldRankTop100 } from './wca_stats_extra.js';

export const wcaFormatRoutes = new Hono();

const rankKey = (eid: string, rt: string, ar: number) => `${eid}|${rt}|${ar}`;

/**
 * 纪录文案格式化(本地渲染,无 spawn / 无联网)。
 * 世界排名预解析(每 event ≤1 次,rank-for 24h 缓存 + in-flight 去重)后注入同步纯渲染函数。
 */
export async function formatRecords(eventsIn: RecordEvent[]): Promise<FormattedRecord> {
  const events = eventsIn.map(enrich);
  const rankMap = new Map<string, number | null>();
  await Promise.all(
    events.map(async (e) => {
      const k = rankKey(e.event_id, e.rec_type, e.attempt_result);
      if (!rankMap.has(k)) {
        rankMap.set(k, await worldRankTop100(e.event_id, e.rec_type, e.attempt_result));
      }
    }),
  );
  const getRank = (eid: string, rt: string, ar: number) => rankMap.get(rankKey(eid, rt, ar)) ?? null;
  return formatCombinedRecords(events, getRank);
}

wcaFormatRoutes.post('/wca/format-record', async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body || !Array.isArray(body.events) || body.events.length === 0) {
    return c.json({ error: 'events array required' }, 400);
  }
  if (body.events.length > 2) {
    return c.json({ error: 'events max length 2' }, 400);
  }

  try {
    const result = await formatRecords(body.events as RecordEvent[]);
    return c.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[wca/format-record] failed:', msg);
    return c.json({ error: `format failed: ${msg}` }, 500);
  }
});
