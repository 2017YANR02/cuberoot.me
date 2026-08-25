// NOTE: 从已生成的 wr_metric.json 中提取每个项目的 WR 值和 top 2 WCA ID
// 直接读取 compute_all 已生成的 JSON，无需 MySQL 连接
//
// 输出：stats/wr_ids.json — calc 页面依赖此文件获取当前 WR 数据
// 用法：npx tsx src/bin/gen_wr_ids.ts
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, '../../../../../stats');
const OUTPUT_PATH = resolve(__dirname, '../../../../../stats/wr_ids.json');

// NOTE: 项目中英文名 → 项目 ID 映射（从 events.ts 概念反转而来）
// 因为 wr_metric.json 的 sections 用英文名作 title
import { EVENTS } from '../core/events.js';

// NOTE: 反转映射：英文名 → 项目 ID
const NAME_TO_ID: Record<string, string> = {};
for (const [id, name] of Object.entries(EVENTS)) {
  NAME_TO_ID[name] = id;
}

// NOTE: 从 person_link markdown 提取 WCA ID
// 格式: [Name](https://www.worldcubeassociation.org/persons/2023GENG02)
function extractWcaId(personLink: string): string | null {
  const match = personLink.match(/\/persons\/([^)\]]+)/);
  return match ? match[1] : null;
}

// NOTE: 从显示字符串解析为 centiseconds
function parseCentiseconds(str: string): number | null {
  // 格式: "1:23.45" → 8345
  const mmss = str.match(/^(\d+):(\d+\.\d+)$/);
  if (mmss) {
    return Math.round(Number(mmss[1]) * 6000 + Number(mmss[2]) * 100);
  }
  // 格式: "6.78" → 678
  const sec = str.match(/^\d+\.\d+$/);
  if (sec) {
    return Math.round(Number(str) * 100);
  }
  // 格式: "23" (FMC moves) → 2300
  const int = str.match(/^\d+$/);
  if (int) {
    return Number(str) * 100;
  }
  return null;
}

interface WrIdsEntry {
  avg_id_1?: string;
  avg_1?: number;
  avg_id_2?: string;
  avg_2?: number;
  single?: number;
}

function main() {
  const wrMetricPath = resolve(DATA_DIR, 'wr_metric.json');
  if (!existsSync(wrMetricPath)) {
    console.error(`FATAL: ${wrMetricPath} not found. Run compute_all.ts first.`);
    process.exit(1);
  }

  const wrMetric = JSON.parse(readFileSync(wrMetricPath, 'utf-8'));
  const result: Record<string, WrIdsEntry> = {};

  // NOTE: 提取 average WR top 2 — 从 metricPanels 中 id='average' 的 ranking panel
  const avgPanel = wrMetric.metricPanels?.find((mp: Record<string, unknown>) => mp.id === 'average');
  if (avgPanel) {
    const rankingPanel = avgPanel.panels?.find((p: Record<string, unknown>) => p.id === 'ranking');
    if (rankingPanel) {
      for (const section of rankingPanel.sections) {
        const eventId = NAME_TO_ID[section.title];
        if (!eventId) continue;

        if (!result[eventId]) result[eventId] = {};

        // NOTE: ranking rows 格式: [rank, person_link, result, country, date, comp_link, details]
        const top2 = (section.rows as unknown[][]).slice(0, 2);
        for (let idx = 0; idx < top2.length; idx++) {
          const row = top2[idx];
          const personLink = String(row[1]);
          const resultStr = String(row[2]);
          const wcaId = extractWcaId(personLink);
          const cs = parseCentiseconds(resultStr);
          if (!wcaId || !cs || cs <= 0) continue;

          const suffix = idx === 0 ? '1' : '2';
          result[eventId][`avg_id_${suffix}` as keyof WrIdsEntry] = wcaId as never;
          result[eventId][`avg_${suffix}` as keyof WrIdsEntry] = cs as never;
        }
      }
    }
  }

  // NOTE: 提取 single WR — 从 metricPanels 中 id='single' 的 ranking panel
  const singlePanel = wrMetric.metricPanels?.find((mp: Record<string, unknown>) => mp.id === 'single');
  if (singlePanel) {
    const rankingPanel = singlePanel.panels?.find((p: Record<string, unknown>) => p.id === 'ranking');
    if (rankingPanel) {
      for (const section of rankingPanel.sections) {
        const eventId = NAME_TO_ID[section.title];
        if (!eventId) continue;

        if (!result[eventId]) result[eventId] = {};

        const firstRow = section.rows?.[0] as unknown[] | undefined;
        if (!firstRow) continue;

        const cs = parseCentiseconds(String(firstRow[2]));
        if (cs && cs > 0) result[eventId].single = cs;
      }
    }
  }

  // NOTE: 校验
  const hasIds = Object.values(result).some(v => v.avg_id_1);
  if (!hasIds) {
    console.error('FATAL: wr_ids.json has no player IDs. Check wr_metric.json.');
    process.exit(1);
  }

  writeFileSync(OUTPUT_PATH, JSON.stringify(result, null, 2) + '\n', 'utf-8');
  console.log(`Generated ${OUTPUT_PATH} (${Object.keys(result).length} events)`);
}

main();
