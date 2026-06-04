/**
 * 关注选手生涯 PR 基线(厘秒)—— 走 PG watched_pr_baseline 表。
 * 移植 Python wca_pr_cache.py 的「意图」:原 Python 把 warm/warm_all/dump 误嵌在
 * is_tied_value 的 return 之后成了死代码,这里按原意拆成独立函数实现。
 *
 * PR 语义:WCA 厘秒越小越好,value 不大于历史最优即破 PR;持平(value===current)
 * 也算(WCA Live 持平 PR 仍亮橙色 PR 徽章)。
 */
import { query } from '../db/connection.js';
import { isTiedValue } from '../utils/record_format.js';

type RecType = 'single' | 'average';

export async function getPr(wcaId: string, eventId: string, recType: RecType): Promise<number | null> {
  const rows = await query<{ value: number }>(
    `SELECT value FROM watched_pr_baseline WHERE wca_id = ? AND event_id = ? AND rec_type = ?`,
    [wcaId, eventId, recType],
  );
  return rows.length > 0 ? Number(rows[0]!.value) : null;
}

/** 写入 / 更新基线;value<=0(DNF/DNS 等无效)直接忽略。 */
export async function setPr(wcaId: string, eventId: string, recType: RecType, value: number): Promise<void> {
  if (value <= 0) return;
  await query(
    `INSERT INTO watched_pr_baseline (wca_id, event_id, rec_type, value, updated_at)
     VALUES (?, ?, ?, ?, NOW())
     ON CONFLICT (wca_id, event_id, rec_type) DO UPDATE SET
       value = EXCLUDED.value,
       updated_at = NOW()`,
    [wcaId, eventId, recType, value],
  );
}

/** value 有效且不劣于历史最优(破或平 PR)。无基线时任意有效成绩都算。 */
export async function isNewPr(wcaId: string, eventId: string, recType: RecType, value: number): Promise<boolean> {
  if (value <= 0) return false;
  const current = await getPr(wcaId, eventId, recType);
  return current === null || value <= current;
}

/** 与历史最优持平(非破)。复用 record_format.isTiedValue。 */
export async function isTiedPr(wcaId: string, eventId: string, recType: RecType, value: number): Promise<boolean> {
  const current = await getPr(wcaId, eventId, recType);
  return isTiedValue(value, current);
}

interface ApiRecord {
  eventId: string;
  type: RecType;
  best: number;
}

/**
 * 从 WCA API 拉每个选手生涯个人最优,upsert 进基线表。本文件唯一联网调用,供 seeding(Phase 4)用。
 * 并发<=8、温和;返回成功预热的选手数。
 */
export async function warmBaseline(wcaIds: string[]): Promise<number> {
  let warmed = 0;
  const queue = [...wcaIds];

  async function worker(): Promise<void> {
    for (;;) {
      const id = queue.shift();
      if (!id) return;
      try {
        const res = await fetch(
          `https://www.worldcubeassociation.org/api/v0/persons/${encodeURIComponent(id)}/personal_records`,
        );
        if (!res.ok) continue;
        const data = (await res.json()) as { personal_records?: ApiRecord[] } | ApiRecord[];
        const records = Array.isArray(data) ? data : data.personal_records ?? [];
        for (const rec of records) {
          if (rec.type !== 'single' && rec.type !== 'average') continue;
          await setPr(id, rec.eventId, rec.type, rec.best);
        }
        warmed++;
      } catch (e) {
        console.warn(`[pr-baseline] warm ${id}:`, (e as Error).message);
      }
    }
  }

  const n = Math.min(8, queue.length);
  await Promise.all(Array.from({ length: n }, () => worker()));
  return warmed;
}
