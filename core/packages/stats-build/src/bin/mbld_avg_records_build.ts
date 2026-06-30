// NOTE: 非官方多盲平均(333mbf / 333mbo Mo3)的区域纪录(WR / 大洲 / NR)builder。
// WCA 不追踪多盲平均,故 results 表无 regional_average_record 标记。这里对全体选手的
// 每条「3 把全成功」多盲成绩现算 Mo3(口径同 core/mbf_average.ts,与 records_build 注入
// world.json 的 WR 一致),按比赛时间序遍历,维护世界 / 大洲 / 国家三级「历史最佳」,给每条
// 刷新所在区域纪录的结果打最高一级标签(WR > 大洲码 > NR)。
//
// 产物:stats/records/mbld_avg_records.json
//   { updated, tags: { "<wcaId>|<compId>|<eventId>|<roundTypeId>": "WR"|"ER"|"NR"|... } }
// 选手页(ByEventView / ByCompList)按 key 查到则给平均列上 RecordBadge(lib/mbld-avg-records.ts)。
//
// 接入 CI:stats.yml 在 records_build 之后加一步跑本脚本;产出走现成的 git add -A stats/ +
// sync_toolkit,随「update stats」自动重算上线。Mo3 极少(多盲多为 Bo1,3 把轮次罕见)→ JSON 很小。
//
// 用法:npx tsx src/bin/mbld_avg_records_build.ts
import { writeFileSync, mkdirSync, statSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { query, closePool } from '../core/database.js';
import { mbfMo3 } from '../core/mbf_average.js';
import type { RowDataPacket } from 'mysql2';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = resolve(__dirname, '../../../../../stats/records/mbld_avg_records.json');

const EVENTS = ['333mbf', '333mbo'] as const;

// 同一比赛同一天多轮时的时间序(老轮在前);多盲基本单轮,保险起见对齐 progress.ts。
const CHRONO_ROUND_ORDER: Record<string, number> = {
  h: 0, '1': 1, d: 1, '2': 2, g: 2, '3': 3, sf: 3, b: 4, c: 4, f: 5,
};

interface ResultRow extends RowDataPacket {
  wca_id: string;
  country_id: string;
  continent_id: string;
  comp_id: string;
  round_type_id: string;
  start_date: string;
  attempts: string | null;
}

function attemptsQuery(eventId: string): string {
  return `
    SELECT
      result.person_id   AS wca_id,
      person.country_id  AS country_id,
      country.continent_id AS continent_id,
      result.competition_id AS comp_id,
      result.round_type_id  AS round_type_id,
      DATE_FORMAT(competition.start_date, '%Y-%m-%d') AS start_date,
      (SELECT GROUP_CONCAT(ra.value ORDER BY ra.attempt_number)
         FROM result_attempts ra WHERE ra.result_id = result.id) AS attempts
    FROM results result
    JOIN persons person       ON person.wca_id = result.person_id AND person.sub_id = 1
    JOIN countries country    ON country.id = person.country_id
    JOIN competitions competition ON competition.id = result.competition_id
    WHERE result.event_id = '${eventId}'
    ORDER BY competition.start_date
  `;
}

// 一轮 attempts → Mo3 编码值(越小越好);非「3 把全成功」→ null(不参与纪录)。
function validMo3(attemptsCsv: string | null): number | null {
  if (!attemptsCsv) return null;
  const vals = attemptsCsv.split(',').map(Number).filter((v) => v !== 0);
  if (vals.length !== 3) return null;
  if (vals.some((v) => v < 0 || Number.isNaN(v))) return null;
  return mbfMo3(vals[0], vals[1], vals[2]);
}

async function main() {
  const t0 = Date.now();

  // 大洲 record_name(ER / NAR / AsR / AfR / OcR / SAR) —— 大洲纪录标签直接用它。
  const continents = await query<RowDataPacket[]>(`SELECT id, record_name FROM continents`);
  const contCode = new Map<string, string>();
  for (const c of continents) contCode.set(String(c.id), String(c.record_name ?? 'CR'));

  const tags: Record<string, string> = {};

  for (const eventId of EVENTS) {
    const rows = await query<ResultRow[]>(attemptsQuery(eventId));
    // 时间序:比赛日期 → 轮次时间序 → 结果 id(同日同轮稳定)。
    const ordered = rows
      .map((r) => ({ r, mo3: validMo3(r.attempts) }))
      .filter((x): x is { r: ResultRow; mo3: number } => x.mo3 !== null)
      .sort((a, b) => {
        const da = String(a.r.start_date), db = String(b.r.start_date);
        if (da !== db) return da < db ? -1 : 1;
        const ra = CHRONO_ROUND_ORDER[a.r.round_type_id] ?? 99;
        const rb = CHRONO_ROUND_ORDER[b.r.round_type_id] ?? 99;
        return ra - rb;
      });

    let worldBest: number | null = null;
    const contBest = new Map<string, number>();
    const countryBest = new Map<string, number>();

    for (const { r, mo3 } of ordered) {
      const contId = String(r.continent_id);
      const ctryId = String(r.country_id);
      const cb = contBest.get(contId);
      const kb = countryBest.get(ctryId);
      // 越小越好;<= 让并列也算纪录(对齐 WCA 并列纪录约定)。
      const isWR = worldBest === null || mo3 <= worldBest;
      const isCR = cb === undefined || mo3 <= cb;
      const isNR = kb === undefined || mo3 <= kb;
      if (isWR) worldBest = mo3;
      if (isCR) contBest.set(contId, mo3);
      if (isNR) countryBest.set(ctryId, mo3);
      const tag = isWR ? 'WR' : isCR ? (contCode.get(contId) ?? 'CR') : isNR ? 'NR' : null;
      if (tag) tags[`${r.wca_id}|${r.comp_id}|${eventId}|${r.round_type_id}`] = tag;
    }
    console.log(`[mbld-avg-records] ${eventId}: ${ordered.length} valid Mo3, ${Object.keys(tags).length} cumulative tags`);
  }

  const today = new Date().toISOString().slice(0, 10);
  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, JSON.stringify({ updated: today, tags }));
  console.log(`[mbld-avg-records] wrote ${Object.keys(tags).length} tags → ${OUTPUT_PATH} (${statSync(OUTPUT_PATH).size} bytes, ${((Date.now() - t0) / 1000).toFixed(1)}s)`);

  await closePool();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
