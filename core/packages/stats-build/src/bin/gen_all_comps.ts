// NOTE: 导出 WCA 历史所有已结束比赛 → stats/data/all_past_comps.json
// Globe 页 history 模式消费这个文件。
//
// 数据源：本地 MySQL wca_statistics 库（update_database.ts 每周从 WCA 官方 dump 导入）
// 成本：一次 SQL ~1s + 序列化 ~0.5s，整个脚本 < 2s
//
// 用法：npx tsx src/bin/gen_all_comps.ts
import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { query, closePool } from '../core/database.js';
import type { RowDataPacket } from 'mysql2';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = resolve(__dirname, '../../../../../stats/data/all_past_comps.json');

// NOTE: WCA 内部 event_id → 前端短名（与 scripts/fetch_upcoming_comps.py EVENT_DISPLAY_ORDER 保持一致）
const EVENT_SHORT: Record<string, string> = {
  '333': '3', '222': '2', '444': '4', '555': '5', '666': '6', '777': '7',
  '333bf': '3bf', '333fm': 'fm', '333oh': 'oh',
  'minx': 'minx', 'pyram': 'py', 'clock': 'clock',
  'skewb': 'sk', 'sq1': 'sq1',
  '444bf': '4bf', '555bf': '5bf', '333mbf': 'mbf',
  '333ft': 'ft', '333mbo': 'mbo', 'magic': 'mag', 'mmagic': 'mmag',
};
const EVENT_ORDER: string[] = ['3','2','4','5','6','7','3bf','fm','oh','minx','py','clock','sk','sq1','4bf','5bf','mbf','ft','mbo','mag','mmag'];
const EVENT_RANK: Record<string, number> = Object.fromEntries(EVENT_ORDER.map((k, i) => [k, i]));

interface Row extends RowDataPacket {
  id: string;
  name: string;
  city_name: string;
  country_id: string;
  latitude_degrees: number | string;
  longitude_degrees: number | string;
  start_date: Date | string;
  end_date: Date | string;
  events_csv: string | null;
}

interface RoundRow extends RowDataPacket {
  competition_id: string;
  event_id: string;
  round_count: number;
}

function fmtDate(d: Date | string): string {
  if (d instanceof Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  return String(d).slice(0, 10);
}

async function main() {
  const start = Date.now();

  // NOTE: 过滤 supra-national 聚合代码（与 longest_competitions_path.ts 一致）
  const sql = `
    SELECT
      c.id,
      c.name,
      c.city_name,
      c.country_id,
      c.latitude / 1000000.0 AS latitude_degrees,
      c.longitude / 1000000.0 AS longitude_degrees,
      c.start_date,
      c.end_date,
      GROUP_CONCAT(DISTINCT r.event_id) AS events_csv
    FROM competitions c
    LEFT JOIN results r ON r.competition_id = c.id
    WHERE c.end_date < CURDATE()
      AND c.country_id NOT IN ('XA','XE','XF','XM','XN','XO','XS','XW')
    GROUP BY c.id
    ORDER BY c.start_date
  `;

  const rows = await query<Row[]>(sql);

  // NOTE: 每场比赛每个项目的轮次数。CI 只导入 REQUIRED_TABLES，没有 competition_events / rounds 表，
  // 用 results.round_type_id 的 distinct count 等价替代（past comps 已跑的轮次必然有 results）。
  const roundsSql = `
    SELECT competition_id, event_id, COUNT(DISTINCT round_type_id) AS round_count
    FROM results
    GROUP BY competition_id, event_id
  `;
  const roundRows = await query<RoundRow[]>(roundsSql);
  const roundsByComp = new Map<string, Record<string, number>>();
  for (const rr of roundRows) {
    let m = roundsByComp.get(rr.competition_id);
    if (!m) { m = {}; roundsByComp.set(rr.competition_id, m); }
    const short = EVENT_SHORT[rr.event_id] ?? rr.event_id;
    m[short] = Number(rr.round_count);
  }

  const out = rows
    .filter((r) => {
      const lat = Number(r.latitude_degrees);
      const lng = Number(r.longitude_degrees);
      return Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0);
    })
    .map((r) => {
      const rawEvents = (r.events_csv ?? '').split(',').filter(Boolean);
      const shortEvents = rawEvents
        .map((e) => EVENT_SHORT[e] ?? e)
        .sort((a, b) => (EVENT_RANK[a] ?? 999) - (EVENT_RANK[b] ?? 999));
      const rounds = roundsByComp.get(r.id);
      return {
        id: r.id,
        name: r.name,
        city: r.city_name,
        country: r.country_id,
        latitude_degrees: Number(r.latitude_degrees),
        longitude_degrees: Number(r.longitude_degrees),
        start_date: fmtDate(r.start_date),
        end_date: fmtDate(r.end_date),
        events: shortEvents,
        ...(rounds && Object.keys(rounds).length > 0 ? { rounds } : {}),
      };
    });

  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, JSON.stringify(out), 'utf-8');

  const kb = Math.round((Buffer.byteLength(JSON.stringify(out)) / 1024));
  const dur = ((Date.now() - start) / 1000).toFixed(2);
  console.log(`Generated ${OUTPUT_PATH}: ${out.length} comps, ${kb} KB, ${dur}s`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => closePool());
