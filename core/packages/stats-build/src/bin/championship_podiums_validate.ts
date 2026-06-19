// 校验锦标赛领奖台计算:对指定选手打印分档领奖台,人工对照 WCA 官网 / cubingchina。
// 用法: npx tsx src/bin/championship_podiums_validate.ts 2012PARK03
import mysql from 'mysql2/promise';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parse as parseYaml } from 'yaml';
import { computeChampionshipPodiums } from '../core/championship_podiums.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  const wcaId = (process.argv[2] ?? '2012PARK03').toUpperCase();
  const cfg = parseYaml(readFileSync(resolve(__dirname, '../../database.yml'), 'utf-8')) as
    { database: string; username: string; password: string; host: string };
  const conn = await mysql.createConnection({
    host: cfg.host, user: cfg.username, password: cfg.password, database: cfg.database, dateStrings: true,
  });

  const [countries] = await conn.query<mysql.RowDataPacket[]>(`SELECT id, iso2, continent_id FROM countries`);
  const continentOf = new Map<string, string>();
  const iso2Of = new Map<string, string>();
  for (const c of countries) {
    continentOf.set(c['id'] as string, c['continent_id'] as string);
    if (c['iso2']) iso2Of.set(c['id'] as string, (c['iso2'] as string).toUpperCase());
  }
  const [eligibles] = await conn.query<mysql.RowDataPacket[]>(
    `SELECT championship_type, eligible_country_iso2 FROM eligible_country_iso2s_for_championship`);
  const eligByType = new Map<string, string[]>();
  for (const e of eligibles) {
    const t = e['championship_type'] as string;
    const arr = eligByType.get(t) ?? [];
    arr.push((e['eligible_country_iso2'] as string).toUpperCase());
    eligByType.set(t, arr);
  }
  const [championships] = await conn.query<mysql.RowDataPacket[]>(
    `SELECT championship_type, competition_id FROM championships`);

  const t0 = Date.now();
  const all = await computeChampionshipPodiums(
    conn,
    championships.map((c) => ({ championship_type: c['championship_type'] as string, competition_id: c['competition_id'] as string })),
    continentOf, iso2Of, eligByType,
  );
  console.log(`computed ${all.length} podium rows in ${Date.now() - t0}ms`);

  const mine = all.filter((r) => r.wcaId === wcaId);

  // 同时产出端点形态 JSON(join 比赛名/日期),供前端 localStorage 注入做可视校验。
  const compIds = [...new Set(mine.map((r) => r.compId))];
  const compMeta = new Map<string, { name: string; date: string; country: string }>();
  if (compIds.length) {
    const [crows] = await conn.query<mysql.RowDataPacket[]>(
      `SELECT id, name, start_date, country_id FROM competitions WHERE id IN (${compIds.map(() => '?').join(',')})`,
      compIds,
    );
    for (const c of crows) compMeta.set(c['id'] as string, {
      name: c['name'] as string, date: String(c['start_date']).slice(0, 10), country: c['country_id'] as string,
    });
  }
  const endpointRows = mine.map((r) => ({
    compId: r.compId,
    compName: compMeta.get(r.compId)?.name ?? r.compId,
    compDate: compMeta.get(r.compId)?.date ?? null,
    compCountryId: compMeta.get(r.compId)?.country ?? null,
    eventId: r.eventId, level: r.level, place: r.place,
    best: r.best, average: r.average, attempts: r.attempts,
    singleRecord: r.singleRecord || null, averageRecord: r.averageRecord || null,
  }));
  const { writeFileSync, mkdirSync } = await import('fs');
  mkdirSync(resolve(__dirname, '../../../../.tmp'), { recursive: true });
  const outJson = resolve(__dirname, `../../../../.tmp/champ-podiums-${wcaId}.json`);
  writeFileSync(outJson, JSON.stringify(endpointRows));
  console.log(`wrote endpoint JSON → ${outJson} (${endpointRows.length} rows)`);

  const byLevel = new Map<string, typeof mine>();
  for (const r of mine) {
    const a = byLevel.get(r.level) ?? [];
    a.push(r); byLevel.set(r.level, a);
  }
  console.log(`\n=== ${wcaId}: ${mine.length} podium results, levels: ${[...byLevel.keys()].join(', ')} ===`);
  for (const [level, rows] of byLevel) {
    console.log(`\n--- ${level} ---`);
    rows.sort((a, b) => a.compId.localeCompare(b.compId) || a.eventId.localeCompare(b.eventId));
    for (const r of rows) {
      console.log(`  ${r.compId}  ${r.eventId.padEnd(6)} place=${r.place} best=${r.best} avg=${r.average}`);
    }
  }
  await conn.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
