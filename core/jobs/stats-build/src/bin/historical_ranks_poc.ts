// NOTE: PoC ── (event=333, year=2015, single) 一年快照
// 目标：量出单文件大小 + 计算耗时，外推 462 个文件总量
// 用法：npx tsx src/bin/historical_ranks_poc.ts
import { writeFileSync, mkdirSync, statSync } from 'fs';
import { gzipSync } from 'zlib';
import { closePool, query as dbQuery } from '../core/database.js';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

interface Row {
  person_id: string;
  best: number;
  person_country_id: string;
  name: string;
}

interface Person {
  id: string;
  name: string;
  best: number;
  ctry: string;
  wr: number;
  cr: number;
}

async function snapshot(eventId: string, year: number): Promise<Person[]> {
  const t0 = Date.now();

  // 拉取该项目截至 year 年末的所有 single 成绩 + 选手信息
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = await dbQuery<any>(`
    SELECT r.person_id, r.best, r.country_id AS person_country_id, p.name
    FROM results r
    JOIN competitions c ON c.id = r.competition_id
    JOIN persons p ON p.wca_id = r.person_id AND p.sub_id = 1
    WHERE r.event_id = '${eventId}'
      AND r.best > 0
      AND c.start_date <= '${year}-12-31'
  `);
  console.log(`[query] ${rows.length.toLocaleString()} rows in ${Date.now() - t0}ms`);

  // 每人取 MIN(best)
  const byPerson = new Map<string, { best: number; ctry: string; name: string }>();
  for (const r of rows as Row[]) {
    const cur = byPerson.get(r.person_id);
    if (!cur || r.best < cur.best) {
      byPerson.set(r.person_id, { best: r.best, ctry: r.person_country_id, name: r.name });
    }
  }
  console.log(`[group] ${byPerson.size.toLocaleString()} unique persons`);

  // 按 best 升序
  const list = [...byPerson.entries()]
    .map(([id, v]) => ({ id, name: v.name, best: v.best, ctry: v.ctry, wr: 0, cr: 0 }))
    .sort((a, b) => a.best - b.best);

  // World rank（并列 → 同名次）
  let prevBest = -1;
  let prevRank = 0;
  list.forEach((p, i) => {
    if (p.best === prevBest) {
      p.wr = prevRank;
    } else {
      p.wr = i + 1;
      prevBest = p.best;
      prevRank = i + 1;
    }
  });

  // Country rank（同样并列 → 同名次）
  const ctryState = new Map<string, { prev: number; rank: number; count: number }>();
  for (const p of list) {
    let st = ctryState.get(p.ctry);
    if (!st) {
      st = { prev: -1, rank: 0, count: 0 };
      ctryState.set(p.ctry, st);
    }
    if (p.best === st.prev) {
      // 并列保持上一名 rank
    } else {
      st.rank = st.count + 1;
      st.prev = p.best;
    }
    p.cr = st.rank;
    st.count++;
  }

  console.log(`[total] ${((Date.now() - t0) / 1000).toFixed(2)}s`);
  return list;
}

async function main() {
  try {
    const samples: Array<[string, number]> = [
      ['333', 2003],   // 第一年
      ['333', 2015],
      ['333', 2025],   // 最大
      ['333fm', 2025], // 小项目
      ['333mbf', 2025],
      ['minx', 2025],
    ];

    const outDir = resolve(__dirname, '../../../../../stats/historical');
    mkdirSync(outDir, { recursive: true });

    let totalRaw = 0;
    let totalGz = 0;
    const summary: Array<{ key: string; persons: number; raw: number; gz: number; ms: number }> = [];

    for (const [event, year] of samples) {
      const t0 = Date.now();
      const data = await snapshot(event, year);
      const ms = Date.now() - t0;
      const json = JSON.stringify(data);
      const outPath = resolve(outDir, `${event}_${year}_single.json`);
      writeFileSync(outPath, json, 'utf-8');
      const raw = statSync(outPath).size;
      const gz = gzipSync(json).length;
      totalRaw += raw;
      totalGz += gz;
      summary.push({ key: `${event}_${year}`, persons: data.length, raw, gz, ms });
    }

    console.log('\n=== Summary ===');
    console.log('cell             persons    raw     gzip    ms');
    for (const s of summary) {
      console.log(
        `${s.key.padEnd(15)} ${String(s.persons).padStart(8)}  ${(s.raw / 1024).toFixed(0).padStart(5)}KB  ${(s.gz / 1024).toFixed(0).padStart(5)}KB  ${s.ms}ms`,
      );
    }
    const avgRaw = totalRaw / samples.length;
    const avgGz = totalGz / samples.length;
    console.log(`\nAvg: raw ${(avgRaw / 1024).toFixed(0)}KB, gzip ${(avgGz / 1024).toFixed(0)}KB`);
    console.log(`外推 462 个: raw ~${((avgRaw * 462) / 1024 / 1024).toFixed(0)}MB, gzip ~${((avgGz * 462) / 1024 / 1024).toFixed(0)}MB`);
  } finally {
    await closePool();
  }
}

main();
