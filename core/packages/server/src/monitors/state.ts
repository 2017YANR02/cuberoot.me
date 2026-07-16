/**
 * 各监控已推送 uid 去重台账 —— PG 写穿,替代 Python 各 monitor 的 known_*.json。
 *
 * - countPushed:某监控历史推送总数(首跑 silent-absorb 检测:0 行即首跑)。
 * - getPushedSet:给一批 uid,返回其中已推送过的子集(去重)。
 * - markPushed:批量记下本轮推送的 uid(幂等 upsert)。
 */
import { query } from '../db/connection.js';

export type MonitorId =
  | 'wca_live_record'
  | 'cubing_record'
  | 'cubing_comp'
  | 'wca_comp'
  | 'wca_live_pr'
  | 'wca_past_results'
  | 'foreign_reg';

/** 某监控历史推送总数。0 = 首跑,调用方据此 silent-absorb 当前快照不推送。 */
export async function countPushed(monitor: MonitorId): Promise<number> {
  const rows = await query<{ n: string | number }>(
    `SELECT COUNT(*) AS n FROM monitor_pushed_state WHERE monitor = ?`,
    [monitor],
  );
  return Number(rows[0]?.n ?? 0);
}

/** 给一批 uid,返回其中已在台账里的子集。uids 空 → 空 Set。 */
export async function getPushedSet(monitor: MonitorId, uids: string[]): Promise<Set<string>> {
  if (uids.length === 0) return new Set();
  const placeholders = uids.map(() => '?').join(',');
  const rows = await query<{ uid: string }>(
    `SELECT uid FROM monitor_pushed_state WHERE monitor = ? AND uid IN (${placeholders})`,
    [monitor, ...uids],
  );
  return new Set(rows.map((r) => r.uid));
}

/** 批量记下本轮推送的 uid(幂等)。uids 空 → no-op。 */
export async function markPushed(monitor: MonitorId, uids: string[]): Promise<void> {
  if (uids.length === 0) return;
  const valuesSql = uids.map(() => '(?, ?)').join(',');
  const params: unknown[] = [];
  for (const uid of uids) params.push(monitor, uid);
  await query(
    `INSERT INTO monitor_pushed_state (monitor, uid) VALUES ${valuesSql}
     ON CONFLICT (monitor, uid) DO NOTHING`,
    params,
  );
}
