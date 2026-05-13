// NOTE: WCA 历史 records 静态 JSON builder
// 输出 ~160 个 region 文件到 stats/records/history/{world.json, continent/<slug>.json, country/<iso2>.json}
// 每个文件包含该 region 视角下所有历史(含已被打破的)纪录行,按日期 desc 排序.
//
// 数据形态参考 WCA worldcubeassociation.org records_controller.rb 的 history 模式:
//   - world.json: results.regional_X_record = 'WR'
//   - continent/<slug>.json: 该洲人 (results.country_id IN continent.country_ids)
//       且 record_name IN ('WR', continent.record_name)
//   - country/<ISO2>.json: 该国人 (results.country_id = country.id) 且 record_name != ''
//
// 用法:
//   pnpm --filter @cuberoot/stats-build run records   # 加 script 或:
//   npx tsx src/bin/records_build.ts
import { writeFileSync, mkdirSync, statSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { query, closePool } from '../core/database.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_ROOT = resolve(__dirname, '../../../../../stats/records/history');

const CONTINENT_SLUG: Record<string, string> = {
  '_Africa': 'africa',
  '_Asia': 'asia',
  '_Europe': 'europe',
  '_North America': 'northAmerica',
  '_Oceania': 'oceania',
  '_South America': 'southAmerica',
};

interface Row {
  e: string;            // event_id
  t: 's' | 'a';         // single/average
  v: number;            // best / average centiseconds (or FMC/MBLD encoded)
  l: string;            // WR / AfR / AsR / ER / NAR / OcR / SAR / NR
  p: string;            // person wca id
  pn: string;           // person name (with parens)
  pc: string;           // person country iso2
  c: string;            // competition id
  cn: string;           // competition cell_name
  cc: string;           // competition country iso2
  d: string;            // start_date yyyy-mm-dd
  a: number[] | null;   // value1..5 (excluding 0s); null if all zero
}

interface CountryMeta { id: string; iso2: string; continent_id: string }

async function main() {
  const t0 = Date.now();
  console.log('[records-build] loading countries + continents...');

  const countries = await query<any>(`SELECT id, iso2, continent_id FROM countries`);
  const continents = await query<any>(`SELECT id, name, record_name FROM continents`);

  const countryById = new Map<string, CountryMeta>();
  for (const c of countries) {
    countryById.set(String(c.id), {
      id: String(c.id),
      iso2: String(c.iso2 ?? ''),
      continent_id: String(c.continent_id),
    });
  }
  const continentMarkers: Record<string, string> = {};
  for (const c of continents) {
    continentMarkers[String(c.id)] = String(c.record_name ?? '');
  }

  console.log(`[records-build] querying record-marked rows...`);
  // NOTE: 同一物理 result 行可能既是 single 又是 average record,所以拆成两个独立 row.
  // attempts via GROUP_CONCAT on result_attempts(result_id, attempt_number, value).
  const rows = await query<any>(`
    SELECT r.event_id           AS e,
           'single'              AS t,
           r.best                AS v,
           r.regional_single_record AS l,
           r.person_id           AS p,
           r.person_name         AS pn,
           r.country_id          AS pc,
           r.competition_id      AS c,
           c.cell_name           AS cn,
           c.country_id          AS cc,
           DATE_FORMAT(c.start_date, '%Y-%m-%d') AS d,
           (SELECT GROUP_CONCAT(ra.value ORDER BY ra.attempt_number)
              FROM result_attempts ra WHERE ra.result_id = r.id) AS atts
    FROM results r
    JOIN competitions c ON c.id = r.competition_id
    WHERE r.regional_single_record <> ''
    UNION ALL
    SELECT r.event_id           AS e,
           'average'             AS t,
           r.average             AS v,
           r.regional_average_record AS l,
           r.person_id           AS p,
           r.person_name         AS pn,
           r.country_id          AS pc,
           r.competition_id      AS c,
           c.cell_name           AS cn,
           c.country_id          AS cc,
           DATE_FORMAT(c.start_date, '%Y-%m-%d') AS d,
           (SELECT GROUP_CONCAT(ra.value ORDER BY ra.attempt_number)
              FROM result_attempts ra WHERE ra.result_id = r.id) AS atts
    FROM results r
    JOIN competitions c ON c.id = r.competition_id
    WHERE r.regional_average_record <> ''
  `);
  console.log(`[records-build] ${rows.length} rows loaded (${Date.now() - t0}ms)`);

  // 转换 + 富化
  const all: Row[] = [];
  let skipNoIso = 0;
  for (const r of rows as any[]) {
    const personCountry = countryById.get(String(r.pc));
    const compCountry = countryById.get(String(r.cc));
    if (!personCountry || !personCountry.iso2 || !compCountry || !compCountry.iso2) {
      skipNoIso++;
      continue;
    }
    const attempts: number[] = [];
    if (r.atts) {
      for (const s of String(r.atts).split(',')) {
        const n = Number(s);
        if (n !== 0 && !Number.isNaN(n)) attempts.push(n);
      }
    }
    all.push({
      e: String(r.e),
      t: r.t === 'single' ? 's' : 'a',
      v: Number(r.v),
      l: String(r.l),
      p: String(r.p),
      pn: String(r.pn),
      pc: personCountry.iso2,
      c: String(r.c),
      cn: String(r.cn),
      cc: compCountry.iso2,
      d: String(r.d),
      a: attempts.length > 0 ? attempts : null,
    });
  }
  if (skipNoIso > 0) console.warn(`[records-build] skipped ${skipNoIso} rows with no iso2`);

  // 按日期 desc, 然后 value asc 排序(同日同区域 — 用于 mixed history 表里更小的成绩先列)
  all.sort((a, b) => {
    if (a.d !== b.d) return a.d < b.d ? 1 : -1;
    return a.v - b.v;
  });

  // ── 切片 ──
  // 为了 country/continent 切片,需要 row.pc 对应的 country.id(因为 continent map 是按 country.id 而非 iso2)
  // 但我们已经在 row 里存 iso2 了 — 反查不便,所以预构 iso2 → continent_id 映射.
  const iso2ToContinent = new Map<string, string>();
  for (const c of countryById.values()) {
    if (c.iso2) iso2ToContinent.set(c.iso2, c.continent_id);
  }

  mkdirSync(OUTPUT_ROOT, { recursive: true });
  mkdirSync(resolve(OUTPUT_ROOT, 'continent'), { recursive: true });
  mkdirSync(resolve(OUTPUT_ROOT, 'country'), { recursive: true });

  const today = new Date().toISOString().slice(0, 10);

  // 1) World
  const worldRows = all.filter(r => r.l === 'WR');
  writeJson(resolve(OUTPUT_ROOT, 'world.json'), { updated: today, rows: worldRows });

  // 2) 6 大洲
  for (const [contId, slug] of Object.entries(CONTINENT_SLUG)) {
    const marker = continentMarkers[contId];
    if (!marker) continue;
    const filtered = all.filter(r => {
      const cont = iso2ToContinent.get(r.pc);
      return cont === contId && (r.l === 'WR' || r.l === marker);
    });
    writeJson(resolve(OUTPUT_ROOT, 'continent', `${slug}.json`), { updated: today, rows: filtered });
  }

  // 3) 国家 — 按 iso2 分组
  const byCountry = new Map<string, Row[]>();
  for (const r of all) {
    if (!r.l) continue;
    const arr = byCountry.get(r.pc) ?? [];
    arr.push(r);
    byCountry.set(r.pc, arr);
  }
  for (const [iso2, list] of byCountry) {
    writeJson(resolve(OUTPUT_ROOT, 'country', `${iso2}.json`), { updated: today, rows: list });
  }

  // ── 4) Manifest:列出可用的 continent slug / country iso2,前端 region 选择器消费
  const manifest = {
    updated: today,
    continents: Object.values(CONTINENT_SLUG).sort(),
    countries: [...byCountry.keys()].sort(),
  };
  writeJson(resolve(OUTPUT_ROOT, 'manifest.json'), manifest);

  // ── summary
  const worldSize = statSync(resolve(OUTPUT_ROOT, 'world.json')).size;
  let totalSize = worldSize;
  for (const slug of Object.values(CONTINENT_SLUG)) {
    try { totalSize += statSync(resolve(OUTPUT_ROOT, 'continent', `${slug}.json`)).size; } catch {}
  }
  for (const iso2 of byCountry.keys()) {
    try { totalSize += statSync(resolve(OUTPUT_ROOT, 'country', `${iso2}.json`)).size; } catch {}
  }
  console.log(`[records-build] world rows: ${worldRows.length}  (${(worldSize/1024).toFixed(1)} KB)`);
  console.log(`[records-build] continent files: ${Object.keys(CONTINENT_SLUG).length}`);
  console.log(`[records-build] country files: ${byCountry.size}`);
  console.log(`[records-build] total size: ${(totalSize/1024/1024).toFixed(2)} MB`);
  console.log(`[records-build] done in ${((Date.now() - t0)/1000).toFixed(1)}s`);

  await closePool();
}

function writeJson(path: string, data: unknown): void {
  writeFileSync(path, JSON.stringify(data));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
