// NOTE: 导出每场比赛产生的 regional records
// 用于 UpcomingCompsPage 日历徽章 + 比赛 modal 详情。
//
// 输出两个文件：
//   stats/comp_records_summary.json — {compId: "WR"|"CR"|"NR"}  日历首屏用（~50KB）
//   stats/comp_records_detail.json  — {compId: [{t,k,e,p,n,v},...]} modal 打开时 lazy fetch
//
// 字段缩写（为压缩 JSON）:
//   t = level 原值 (WR/AfR/AsR/ER/NAR/OcR/SAR/NR)
//   k = 'single' | 'average' → 's' | 'a'
//   e = WCA event_id (如 '333')
//   p = WCA person ID
//   n = persons.name (含括号中文，如 "Yiheng Wang (王艺衡)")
//   v = centiseconds (best / average)
//
// 用法: npx tsx src/bin/gen_comp_records.ts

import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { query, closePool } from '../core/database.js';
import type { RowDataPacket } from 'mysql2';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_SUMMARY = resolve(__dirname, '../../../../../stats/comp_records_summary.json');
const OUT_DETAIL = resolve(__dirname, '../../../../../stats/comp_records_detail.json');

const CR_LEVELS = new Set(['AfR', 'AsR', 'ER', 'NAR', 'OcR', 'SAR']);

// NOTE: 派生顶级别用于 summary——WR > CR > NR
function topLevel(levels: Set<string>): 'WR' | 'CR' | 'NR' | null {
  if (levels.has('WR')) return 'WR';
  for (const l of levels) if (CR_LEVELS.has(l)) return 'CR';
  if (levels.has('NR')) return 'NR';
  return null;
}

// NOTE: 项目排序——与 gen_all_comps 对齐
const EVENT_ORDER: Record<string, number> = {
  '333': 0, '222': 1, '444': 2, '555': 3, '666': 4, '777': 5,
  '333bf': 6, '333fm': 7, '333oh': 8, 'minx': 9, 'pyram': 10,
  'clock': 11, 'skewb': 12, 'sq1': 13, '444bf': 14, '555bf': 15,
  '333mbf': 16, '333ft': 17, '333mbo': 18, 'magic': 19, 'mmagic': 20,
};
// NOTE: 单次=0，平均=1（同一项目单次排前）
const KIND_ORDER: Record<string, number> = { 's': 0, 'a': 1 };

interface Row extends RowDataPacket {
  c_id: string;
  p_id: string;
  e_id: string;
  single_r: string | null;
  avg_r: string | null;
  best: number;
  average: number;
  p_name: string;
}

interface Entry {
  t: string;
  k: 's' | 'a';
  e: string;
  p: string;
  n: string;
  v: number;
}

async function main() {
  const start = Date.now();

  const sql = `
    SELECT
      r.competition_id AS c_id,
      r.person_id AS p_id,
      r.event_id AS e_id,
      r.regional_single_record AS single_r,
      r.regional_average_record AS avg_r,
      r.best,
      r.average,
      p.name AS p_name
    FROM results r
    JOIN persons p ON p.wca_id = r.person_id AND p.sub_id = 1
    WHERE (r.regional_single_record IS NOT NULL AND r.regional_single_record != '')
       OR (r.regional_average_record IS NOT NULL AND r.regional_average_record != '')
  `;

  const rows = await query<Row[]>(sql);

  const byComp = new Map<string, Entry[]>();

  for (const r of rows) {
    const list = byComp.get(r.c_id) ?? [];

    if (r.single_r) {
      list.push({ t: r.single_r, k: 's', e: r.e_id, p: r.p_id, n: r.p_name, v: Number(r.best) });
    }
    if (r.avg_r) {
      list.push({ t: r.avg_r, k: 'a', e: r.e_id, p: r.p_id, n: r.p_name, v: Number(r.average) });
    }

    byComp.set(r.c_id, list);
  }

  // NOTE: 每场内部排序——项目 → 单次/平均 → level 强度（WR 前）
  const levelStrength = (t: string): number => t === 'WR' ? 0 : CR_LEVELS.has(t) ? 1 : 2;

  const summary: Record<string, 'WR' | 'CR' | 'NR'> = {};
  const detail: Record<string, Entry[]> = {};

  for (const [compId, entries] of byComp) {
    entries.sort((a, b) => {
      const ea = EVENT_ORDER[a.e] ?? 999;
      const eb = EVENT_ORDER[b.e] ?? 999;
      if (ea !== eb) return ea - eb;
      if (a.k !== b.k) return KIND_ORDER[a.k] - KIND_ORDER[b.k];
      return levelStrength(a.t) - levelStrength(b.t);
    });

    const levels = new Set(entries.map(e => e.t));
    const top = topLevel(levels);
    if (top) summary[compId] = top;
    detail[compId] = entries;
  }

  // NOTE: 稳定输出——按 compId 排序
  const summaryOut: Record<string, string> = {};
  const detailOut: Record<string, Entry[]> = {};
  for (const id of Object.keys(summary).sort()) summaryOut[id] = summary[id];
  for (const id of Object.keys(detail).sort()) detailOut[id] = detail[id];

  mkdirSync(dirname(OUT_SUMMARY), { recursive: true });
  writeFileSync(OUT_SUMMARY, JSON.stringify(summaryOut), 'utf-8');
  writeFileSync(OUT_DETAIL, JSON.stringify(detailOut), 'utf-8');

  const elapsed = ((Date.now() - start) / 1000).toFixed(2);
  const summaryBytes = JSON.stringify(summaryOut).length;
  const detailBytes = JSON.stringify(detailOut).length;
  console.log(`Generated comp_records in ${elapsed}s`);
  console.log(`  summary: ${Object.keys(summaryOut).length} comps, ${(summaryBytes / 1024).toFixed(1)} KB`);
  console.log(`  detail:  ${Object.keys(detailOut).length} comps, ${(detailBytes / 1024).toFixed(1)} KB`);

  await closePool();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
