/**
 * WCA 本地名(CJK localName)补全 —— 移植自 Python wca_local_names.py,但改走本地 PG,
 * 不再打 WCA REST API。
 *
 * WCA Live GraphQL 给的是纯英文名(如 "Lim Hung");cubing.com 已是带括号形式
 * ("Lim Hung (林弘)")。本模块从 wca_persons(WCA dump 周更,name 字段含括号本地名)
 * 补查,把 WCA Live 的英文名升级成 "英文名 (本地名)",再交 record_format.splitName 拆中文。
 */
import { query } from '../db/connection.js';

// 进程内缓存:命中括号名 → 全名;查过但无本地名 → ''(空串,避免反复查同一 wcaId)。
const cache = new Map<string, string>();

/** name 已含括号 / 无 wcaId 直接返回;否则查 wca_persons,有括号本地名才替换。 */
export async function enrichName(
  name: string,
  wcaId: string | null | undefined,
): Promise<string> {
  if (!name || name.includes('(') || !wcaId) return name;

  const cached = cache.get(wcaId);
  if (cached !== undefined) return cached || name;

  try {
    const rows = await query<{ name: string }>(
      `SELECT name FROM wca_persons WHERE wca_id = ?`,
      [wcaId],
    );
    const full = rows[0]?.name ?? '';
    const resolved = full.includes('(') ? full : '';
    cache.set(wcaId, resolved);
    return resolved || name;
  } catch {
    return name;
  }
}
