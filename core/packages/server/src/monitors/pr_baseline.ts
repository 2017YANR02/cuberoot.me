/**
 * 关注选手生涯 PR 基线(厘秒)—— 走 PG watched_pr_baseline 表。
 * 移植 Python wca_pr_cache.py 的「意图」:原 Python 把 warm/warm_all/dump 误嵌在
 * is_tied_value 的 return 之后成了死代码,这里按原意拆成独立函数实现。
 *
 * PR 语义:WCA 厘秒越小越好,value 不大于历史最优即破 PR;持平(value===current)
 * 也算(WCA Live 持平 PR 仍亮橙色 PR 徽章)。
 */
import { query } from '../db/connection.js';

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

interface ApiRecord {
  eventId: string;
  type: RecType;
  best: number;
}

const WCA_PR_API = 'https://www.worldcubeassociation.org/api/v0/persons';

/** 拉某选手 personal_records 数组(官方生涯 PR)。失败/超时返回 null。 */
async function fetchPersonalRecords(wcaId: string): Promise<ApiRecord[] | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10000);
  try {
    const res = await fetch(`${WCA_PR_API}/${encodeURIComponent(wcaId)}/personal_records`, {
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { personal_records?: ApiRecord[] } | ApiRecord[];
    return Array.isArray(data) ? data : data.personal_records ?? [];
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/**
 * 官方生涯最优(厘秒)—— 单人单事件单类型;失败/无记录返回 null。
 * 直播比赛的当前成绩尚未导出官方库,故该值 = 本场之前的生涯最优,天然可用来判「平/破」。
 */
export async function fetchCareerBest(wcaId: string, eventId: string, recType: RecType): Promise<number | null> {
  const records = await fetchPersonalRecords(wcaId);
  if (!records) return null;
  for (const r of records) {
    if (r.eventId === eventId && r.type === recType) return r.best;
  }
  return null;
}

/**
 * 权威判定「破/平/非 PR」—— 本地基线(watched_pr_baseline)可能陈旧或缺失(选手晚于上次
 * warm 才加入 watchlist、进程久未重启漏掉近期比赛的 live PR、基线被 warm 覆盖回退等),仅凭
 * 本地基线会把「持平生涯 PR」误判成「真破」漏掉 (平) 角标(见 Yufang Du @ NanchangSummer2026:
 * 4.36 平 Hangzhou 2026 的 4.36 却推成纯 PR)。这里再拉一次官方生涯最优做二次确认,并顺手把
 * 本地基线只降不升地校正(PR 单调,永不回退)。官方 API 失败时回退纯本地判定(优雅降级)。
 *
 * 仅对已通过 isNewPr(本地便宜预筛)的候选调用,故每场 PR 至多一次联网,不会 hammer 官方。
 */
export async function reconcilePr(
  wcaId: string,
  eventId: string,
  recType: RecType,
  value: number,
): Promise<{ isPr: boolean; tied: boolean }> {
  if (value <= 0) return { isPr: false, tied: false };
  const local = await getPr(wcaId, eventId, recType);
  const official = await fetchCareerBest(wcaId, eventId, recType);

  let best = local;
  if (official != null && official > 0) best = best == null ? official : Math.min(best, official);
  // 校正本地基线(只降不升);best 恒 <= local 或 local===null。
  if (best != null && best !== local) await setPr(wcaId, eventId, recType, best);

  if (best == null) return { isPr: true, tied: false };  // 生涯首个有效成绩 → 真 PR
  if (value < best) return { isPr: true, tied: false };   // 真破
  if (value === best) return { isPr: true, tied: true };  // 持平 → (平)
  return { isPr: false, tied: false };                    // 官方已有更优成绩 → 非 PR
}

/**
 * 从 WCA API 拉每个选手生涯个人最优,upsert 进基线表。进程首扫一次性预热全部 watchlist。
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
        const records = await fetchPersonalRecords(id);
        if (!records) continue;
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
