// NOTE: 性别(女子/男子)历史 records 静态 JSON builder — /wca/records 性别下拉的数据源.
// WCA 不追踪性别纪录(results 表的 regional_X_record 标记是整体口径),故这里自己派生
// 「该性别在该区域的历史最快进程(running-best)」:按日期顺序扫该性别该区域的有效成绩,
// 每次严格刷新即一条纪录行(同日同值并列也记,供「当前」视图显示并列纪录保持者).
//
// 输出(只做 world + 6 大洲,跳过国家级 — 稀疏 + 文件膨胀):
//   stats/records/history/gender/<m|f>/world.json
//   stats/records/history/gender/<m|f>/continent/<slug>.json
// 行形状与 records_build.ts 的 Row 完全同构,前端 RowsTable 直接复用;l 取最高级别
// (world 刷新→'WR',否则该洲刷新→洲标记 AfR/AsR/ER/NAR/OcR/SAR),洲文件含该洲选手的
// {WR ∪ 洲纪录} 进程,复刻 records_build 的 continent 切片语义.
//
// 用法:npx tsx src/bin/records_gender_build.ts
import { writeFileSync, mkdirSync, statSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { query, closePool } from '../core/database.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_ROOT = resolve(__dirname, '../../../../../stats/records/history/gender');

const CONTINENT_SLUG: Record<string, string> = {
  '_Africa': 'africa',
  '_Asia': 'asia',
  '_Europe': 'europe',
  '_North America': 'northAmerica',
  '_Oceania': 'oceania',
  '_South America': 'southAmerica',
};

const GENDERS = ['m', 'f'] as const;
type Gender = (typeof GENDERS)[number];

interface Row {
  e: string; t: 's' | 'a'; v: number; l: string;
  p: string; pn: string; pc: string;
  c: string; cn: string; cc: string;
  d: string; a: number[] | null;
}

// 富化后的候选行(progression 输入);rid 用于事后批量补 attempts.
interface ER {
  e: string; t: 's' | 'a'; v: number;
  p: string; pn: string; pc: string;
  c: string; cn: string; cc: string;
  d: string; rid: number; cont: string;
}

interface CountryMeta { iso2: string; continent_id: string }

// running-best:按 (date asc, value asc) 扫,严格更小=新纪录;同日同值并列也保留.
function progressionRefresh(rows: ER[]): ER[] {
  const sorted = [...rows].sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : a.v - b.v));
  let best = Infinity;
  let bestDate = '';
  const out: ER[] = [];
  for (const r of sorted) {
    if (r.v < best) { best = r.v; bestDate = r.d; out.push(r); }
    else if (r.v === best && r.d === bestDate) { out.push(r); }
  }
  return out;
}

async function main() {
  const t0 = Date.now();
  console.log('[records-gender] loading small tables...');

  // 1) persons gender map(主记录 sub_id=1)。persons.id 是数字主键,WCA id 在 wca_id 列;
  // results.person_id 是 WCA id 字符串,故按 wca_id 建表(同 historical_ranks_build)。
  const persons = await query<any>(`SELECT wca_id, gender FROM persons WHERE sub_id = 1`);
  const genderMap = new Map<string, string>();
  for (const p of persons) genderMap.set(String(p.wca_id), String(p.gender ?? ''));

  // 2) countries:id → iso2 + continent_id
  const countries = await query<any>(`SELECT id, iso2, continent_id FROM countries`);
  const countryById = new Map<string, CountryMeta>();
  for (const c of countries) {
    countryById.set(String(c.id), { iso2: String(c.iso2 ?? ''), continent_id: String(c.continent_id) });
  }

  // 3) continents marker
  const continents = await query<any>(`SELECT id, record_name FROM continents`);
  const continentMarker: Record<string, string> = {};
  for (const c of continents) continentMarker[String(c.id)] = String(c.record_name ?? '');

  // 4) competitions:id → start_date(yyyy-mm-dd) + country_id + cell_name
  const comps = await query<any>(
    `SELECT id, DATE_FORMAT(start_date,'%Y-%m-%d') d, country_id, cell_name FROM competitions`,
  );
  const compById = new Map<string, { d: string; country_id: string; cn: string }>();
  for (const c of comps) {
    compById.set(String(c.id), { d: String(c.d), country_id: String(c.country_id), cn: String(c.cn ?? '') });
  }

  // 5) event 列表(含废弃项目,与 records_build 一致;前端 ALL_EVENT_IDS 决定展示)
  const events = await query<any>(`SELECT id FROM events ORDER BY \`rank\``);
  const eventIds = events.map((e: any) => String(e.id));
  console.log(`[records-gender] ${persons.length} persons, ${comps.length} comps, ${eventIds.length} events (${Date.now() - t0}ms)`);

  // 累加器:每性别 world 行 + 每性别每洲行(带 rid,事后补 attempts)
  const worldAcc: Record<Gender, { er: ER; l: string }[]> = { m: [], f: [] };
  const contAcc: Record<Gender, Record<string, { er: ER; l: string }[]>> = { m: {}, f: {} };

  for (const ev of eventIds) {
    const results = await query<any>(
      `SELECT id, person_id, person_name, country_id, competition_id, best, average FROM results WHERE event_id = '${ev}'`,
    );
    // 富化 + 按 gender|type 分桶
    const buckets: Record<string, ER[]> = {};
    const push = (g: string, t: 's' | 'a', er: ER) => {
      (buckets[`${g}|${t}`] ??= []).push(er);
    };
    for (const r of results as any[]) {
      const g = genderMap.get(String(r.person_id));
      if (g !== 'm' && g !== 'f') continue;
      const comp = compById.get(String(r.competition_id));
      if (!comp) continue;
      const pc = countryById.get(String(r.country_id));
      if (!pc?.iso2) continue;
      const cc = countryById.get(comp.country_id);
      if (!cc?.iso2) continue;
      const base = {
        e: ev, p: String(r.person_id), pn: String(r.person_name), pc: pc.iso2,
        c: String(r.competition_id), cn: comp.cn, cc: cc.iso2,
        d: comp.d, rid: Number(r.id), cont: pc.continent_id,
      };
      if (Number(r.best) > 0) push(g, 's', { ...base, t: 's', v: Number(r.best) });
      if (Number(r.average) > 0) push(g, 'a', { ...base, t: 'a', v: Number(r.average) });
    }

    for (const g of GENDERS) {
      for (const t of ['s', 'a'] as const) {
        const rows = buckets[`${g}|${t}`];
        if (!rows || rows.length === 0) continue;
        const worldRefresh = progressionRefresh(rows);
        const worldRid = new Set(worldRefresh.map(r => r.rid));
        for (const er of worldRefresh) worldAcc[g].push({ er, l: 'WR' });
        // 按洲分组算洲进程
        const byCont = new Map<string, ER[]>();
        for (const r of rows) {
          if (!continentMarker[r.cont]) continue; // 跳过 _Multiple Continents(无标记)
          let arr = byCont.get(r.cont);
          if (!arr) { arr = []; byCont.set(r.cont, arr); }
          arr.push(r);
        }
        for (const [contId, crows] of byCont) {
          const marker = continentMarker[contId];
          const contRefresh = progressionRefresh(crows);
          for (const er of contRefresh) {
            const l = worldRid.has(er.rid) ? 'WR' : marker;
            (contAcc[g][contId] ??= []).push({ er, l });
          }
        }
      }
    }
  }

  // ── 补 attempts:收集所有用到的 rid,批量查 result_attempts ──
  const ridSet = new Set<number>();
  for (const g of GENDERS) {
    for (const x of worldAcc[g]) ridSet.add(x.er.rid);
    for (const contId in contAcc[g]) for (const x of contAcc[g][contId]) ridSet.add(x.er.rid);
  }
  console.log(`[records-gender] ${ridSet.size} distinct record rows, fetching attempts...`);
  const attMap = new Map<number, number[]>();
  const rids = [...ridSet];
  for (let i = 0; i < rids.length; i += 5000) {
    const chunk = rids.slice(i, i + 5000);
    const ra = await query<any>(
      `SELECT result_id, GROUP_CONCAT(value ORDER BY attempt_number) atts
         FROM result_attempts WHERE result_id IN (${chunk.join(',')}) GROUP BY result_id`,
    );
    for (const r of ra as any[]) {
      const vals: number[] = [];
      for (const s of String(r.atts).split(',')) {
        const n = Number(s);
        if (n !== 0 && !Number.isNaN(n)) vals.push(n);
      }
      attMap.set(Number(r.result_id), vals);
    }
  }

  const toRow = (x: { er: ER; l: string }): Row => {
    const a = attMap.get(x.er.rid);
    return {
      e: x.er.e, t: x.er.t, v: x.er.v, l: x.l,
      p: x.er.p, pn: x.er.pn, pc: x.er.pc,
      c: x.er.c, cn: x.er.cn, cc: x.er.cc,
      d: x.er.d, a: a && a.length > 0 ? a : null,
    };
  };
  const byDateDescValAsc = (a: Row, b: Row) => (a.d !== b.d ? (a.d < b.d ? 1 : -1) : a.v - b.v);

  // ── 写文件 ──
  const today = new Date().toISOString().slice(0, 10);
  let fileCount = 0;
  let totalSize = 0;
  for (const g of GENDERS) {
    const gDir = resolve(OUTPUT_ROOT, g);
    mkdirSync(resolve(gDir, 'continent'), { recursive: true });

    const worldRows = worldAcc[g].map(toRow).sort(byDateDescValAsc);
    const worldPath = resolve(gDir, 'world.json');
    writeFileSync(worldPath, JSON.stringify({ updated: today, rows: worldRows }));
    fileCount++; totalSize += statSync(worldPath).size;

    for (const [contId, slug] of Object.entries(CONTINENT_SLUG)) {
      const acc = contAcc[g][contId] ?? [];
      const rows = acc.map(toRow).sort(byDateDescValAsc);
      const p = resolve(gDir, 'continent', `${slug}.json`);
      writeFileSync(p, JSON.stringify({ updated: today, rows }));
      fileCount++; totalSize += statSync(p).size;
    }
    console.log(`[records-gender] ${g}: world ${worldRows.length} rows`);
  }

  console.log(`[records-gender] wrote ${fileCount} files, ${(totalSize / 1024).toFixed(1)} KB total`);
  console.log(`[records-gender] done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  await closePool();
}

main().catch(err => { console.error(err); process.exit(1); });
