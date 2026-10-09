/** Production PG loaders for scramble statistics. Called only by the explicit publishing entry. */
import { spawn } from 'node:child_process';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { createGzip } from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { exists, fileSize, jobDir, lineCount, run, wcaDir } from './common.js';

const host = process.env.CUBEROOT_STATIC_HOST ?? 'root@cuberoot';
const remotePass = "$(grep -oP 'DB_PASS=\\K.*' /root/core-api/.env | tr -d '[:space:]')";
const psql = `PGPASSWORD=${remotePass} psql -U recon_user -h 127.0.0.1 -d cuberoot_db -v ON_ERROR_STOP=1`;
const keyColumns = '(competition_id,event_id,round_type_id,group_id,is_extra,scramble_num)';
const stageKeyColumns = '(s.competition_id,s.event_id,s.round_type_id,s.group_id,s.is_extra,s.scramble_num)';
const keyMatch = 't.competition_id=d.competition_id AND t.event_id=d.event_id AND t.round_type_id=d.round_type_id AND t.group_id=d.group_id AND t.is_extra=d.is_extra AND t.scramble_num=d.scramble_num';
type Diff = { total: number; deltaRows: number; deleted: number; delta: string; removed: string; next: string; manifest: string; existed: boolean };

function quote(value: string): string { return `'${value.replaceAll("'", "'\\''")}'`; }
async function capture(program: string, args: string[], cwd = jobDir): Promise<string> {
  const child = spawn(program, args, { cwd, stdio: ['ignore', 'pipe', 'inherit'] });
  let output = '';
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', data => { output += data; });
  const code = await new Promise<number>((done, fail) => { child.on('error', fail); child.on('close', value => done(value ?? 1)); });
  if (code !== 0) throw new Error(`${program} exited ${code}`);
  return output;
}
async function diff(csv: string, manifest: string, header: boolean, scratch: string): Promise<Diff> {
  const stem = basename(manifest);
  const delta = join(scratch, `${stem}.delta.csv`);
  const removed = join(scratch, `${stem}.deleted.csv`);
  const next = join(scratch, `${stem}.new.tsv`);
  const existed = await exists(manifest);
  const args = [join(jobDir, 'pg_incremental_diff.mjs'), '--csv', csv, '--manifest', manifest, '--key-cols', '6',
    '--out-delta', delta, '--out-deleted', removed, '--out-manifest', next];
  if (header) args.push('--header');
  const result = await capture(process.execPath, args);
  const stats = JSON.parse(result.trim().split(/\r?\n/).at(-1) ?? '{}') as { total: number; deltaRows: number; deleted: number };
  return { ...stats, delta, removed, next, manifest, existed };
}
class RemoteStepsError extends Error {
  constructor(step: string, cause: unknown) { super(`Remote steps ${step} failed: ${String(cause)}`, { cause }); }
}
async function remoteCommand(command: 'scp' | 'ssh', args: string[], step: string): Promise<void> {
  try { await run(command, args, jobDir); }
  catch (error) {
    // A missing local executable is a host setup error, not a failed remote publication.
    if (error && typeof error === 'object' && 'code' in error) throw error;
    throw new RemoteStepsError(step, error);
  }
}
async function upload(local: string, remote: string): Promise<void> { await remoteCommand('scp', [local, `${host}:${remote}`], `scp ${remote}`); }
async function remoteSql(sql: string, name: string, files: Array<[string, string]>, pre = '', extraCleanup: string[] = []): Promise<void> {
  const scratch = await mkdtemp(join(tmpdir(), 'scramble-sql-'));
  const localSql = join(scratch, `${name}.sql`);
  const remoteScript = `/root/_${name}.sql`;
  try {
    await writeFile(localSql, `${sql.trim()}\n`);
    for (const [local, remote] of files) await upload(local, remote);
    await upload(localSql, remoteScript);
    const cleanup = [remoteScript, ...files.map(([, remote]) => remote), ...extraCleanup];
    const cmd = `${pre}${psql} -f ${quote(remoteScript)}; rc=$?; rm -f ${cleanup.map(quote).join(' ')}; exit $rc`;
    await remoteCommand('ssh', [host, cmd], `psql ${name}`);
  } finally { await rm(scratch, { recursive: true, force: true }); }
}
async function gzip(src: string, dst: string): Promise<void> { await pipeline(createReadStream(src), createGzip({ level: 1 }), createWriteStream(dst)); }

export async function loadOptimalToPg(csv: string, tag: '333' | 'puzzle'): Promise<void> {
  if (!await exists(csv) || await lineCount(csv) <= 1) { console.log(`[optimal ${tag}] empty CSV; skip`); return; }
  const scratch = await mkdtemp(join(tmpdir(), `scramble-opt-${tag}-`));
  const manifest = join(wcaDir, 'incremental', `pg_optimal_${tag}_manifest.tsv`);
  try {
    const change = await diff(csv, manifest, true, scratch);
    if (change.existed && !change.deltaRows && !change.deleted) { console.log(`[optimal ${tag}] unchanged`); await rename(change.next, manifest); return; }
    if (!change.existed) {
      const remoteCsv = `/root/_timer_optimal_${tag}.csv`;
      const events = tag === '333' ? "'333','333oh','333ft','333fm'" : "'222','pyram','skewb'";
      await remoteSql(`
\\set ON_ERROR_STOP on
BEGIN;
DELETE FROM wca_scramble_optimal WHERE event_id IN (${events});
\\copy wca_scramble_optimal (competition_id,event_id,round_type_id,group_id,is_extra,scramble_num,htm,optimal_scramble) FROM '${remoteCsv}' WITH (FORMAT csv, HEADER true)
COMMIT;
SELECT count(*) FROM wca_scramble_optimal;`, `timer_optimal_${tag}`, [[csv, remoteCsv]]);
    } else {
      const rd = `/root/_opt_${tag}_delta.csv`; const rr = `/root/_opt_${tag}_del.csv`;
      await remoteSql(`
\\set ON_ERROR_STOP on
BEGIN;
CREATE TEMP TABLE _opt_stage (LIKE wca_scramble_optimal INCLUDING DEFAULTS) ON COMMIT DROP;
\\copy _opt_stage (competition_id,event_id,round_type_id,group_id,is_extra,scramble_num,htm,optimal_scramble) FROM '${rd}' WITH (FORMAT csv, HEADER true)
INSERT INTO wca_scramble_optimal AS t (competition_id,event_id,round_type_id,group_id,is_extra,scramble_num,htm,optimal_scramble)
  SELECT competition_id,event_id,round_type_id,group_id,is_extra,scramble_num,htm,optimal_scramble FROM _opt_stage
  ON CONFLICT ${keyColumns} DO UPDATE SET htm=EXCLUDED.htm, optimal_scramble=EXCLUDED.optimal_scramble;
CREATE TEMP TABLE _opt_del (competition_id varchar(32), event_id varchar(6), round_type_id varchar(1), group_id varchar(3), is_extra smallint, scramble_num int) ON COMMIT DROP;
\\copy _opt_del FROM '${rr}' WITH (FORMAT csv)
DELETE FROM wca_scramble_optimal t USING _opt_del d WHERE ${keyMatch};
COMMIT;
SELECT count(*) FROM wca_scramble_optimal;`, `opt_${tag}`, [[change.delta, rd], [change.removed, rr]]);
    }
    await rename(change.next, manifest);
    console.log(`[optimal ${tag}] saved manifest: ${change.deltaRows} upserts, ${change.deleted} deletions`);
  } finally { await rm(scratch, { recursive: true, force: true }); }
}

function stepsMetaSql(layout: string, stamp: string, hasRare: boolean, rareCsv: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(stamp) || layout.includes('$WSSL$')) throw new Error('Invalid steps metadata');
  JSON.parse(layout);
  const meta = `INSERT INTO wca_scramble_steps_meta (id,layout,generated_at) VALUES (1, $WSSL$${layout}$WSSL$::jsonb, '${stamp}') ON CONFLICT (id) DO UPDATE SET layout=EXCLUDED.layout, generated_at=EXCLUDED.generated_at;`;
  if (!hasRare) return meta;
  const stripped = meta.replace('::jsonb,', "::jsonb - 'tails' - 'rare_k',");
  return `
SELECT (to_regclass('public.wca_scramble_steps_rare') IS NOT NULL)::int AS has_rare
\\gset
\\if :has_rare
CREATE TEMP TABLE _wssr_stage (slot smallint, val smallint, competition_id varchar(32), event_id varchar(6), round_type_id varchar(1), group_id varchar(3), is_extra smallint, scramble_num int, stage6 smallint[]) ON COMMIT DROP;
\\copy _wssr_stage (slot,val,competition_id,event_id,round_type_id,group_id,is_extra,scramble_num,stage6) FROM '${rareCsv}' WITH (FORMAT csv)
TRUNCATE wca_scramble_steps_rare;
INSERT INTO wca_scramble_steps_rare (slot,val,competition_id,event_id,round_type_id,group_id,is_extra,scramble_num,stage6)
  SELECT r.slot,r.val,r.competition_id,r.event_id,r.round_type_id,r.group_id,r.is_extra,r.scramble_num,r.stage6
  FROM _wssr_stage r WHERE EXISTS (SELECT 1 FROM wca_scramble_steps t
    WHERE t.competition_id=r.competition_id AND t.event_id=r.event_id AND t.round_type_id=r.round_type_id
      AND t.group_id=r.group_id AND t.is_extra=r.is_extra AND t.scramble_num=r.scramble_num)
  ON CONFLICT DO NOTHING;
${meta}
\\else
${stripped}
\\endif`;
}

export async function loadStepsToPg(csv: string, layoutPath: string, rarePath: string, stamp: string): Promise<void> {
  if (!await exists(csv) || !await exists(layoutPath)) { console.log('[steps] CSV/layout missing; skip'); return; }
  const scratch = await mkdtemp(join(tmpdir(), 'scramble-steps-'));
  const manifest = join(wcaDir, 'incremental', 'pg_wss_manifest.tsv');
  try {
    const change = await diff(csv, manifest, false, scratch);
    const hasRare = await exists(rarePath);
    const rr = '/root/_wssr.csv';
    const rareGz = `${rr}.gz`;
    const rareUpload = join(scratch, 'rare.csv.gz');
    if (hasRare) await gzip(rarePath, rareUpload);
    const extra: Array<[string, string]> = hasRare ? [[rareUpload, rareGz]] : [];
    const preRare = hasRare ? `gunzip -f ${quote(rareGz)} && ` : '';
    const metaSql = stepsMetaSql((await readFile(layoutPath, 'utf8')).trim(), stamp, hasRare, rr);
    const post = `VACUUM ANALYZE wca_scramble_steps;\n${hasRare ? "\\if :has_rare\nVACUUM ANALYZE wca_scramble_steps_rare;\n\\endif\n" : ''}`;
    if (change.existed && !change.deltaRows && !change.deleted) {
      await remoteSql(`\\set ON_ERROR_STOP on\nBEGIN;\n${metaSql}\nCOMMIT;\n${post}`, 'wss_meta', extra, preRare, hasRare ? [rr] : []);
    } else {
      const stage = `CREATE TEMP TABLE _wss_stage (competition_id varchar(32), event_id varchar(6), round_type_id varchar(1), group_id varchar(3), is_extra smallint, scramble_num int, gm_cross6 smallint, gm_xcross6 smallint, steps smallint[]) ON COMMIT DROP;`;
      const insert = `INSERT INTO wca_scramble_steps AS t (competition_id,event_id,round_type_id,group_id,is_extra,scramble_num,rnd,steps,gm_cross6,gm_xcross6)
  SELECT DISTINCT ON ${stageKeyColumns} s.competition_id,s.event_id,s.round_type_id,s.group_id,s.is_extra,s.scramble_num,w.rnd,s.steps,s.gm_cross6,s.gm_xcross6
  FROM _wss_stage s JOIN wca_scrambles w USING ${keyColumns}
  ORDER BY s.competition_id,s.event_id,s.round_type_id,s.group_id,s.is_extra,s.scramble_num,s.gm_cross6 NULLS LAST,s.gm_xcross6 NULLS LAST,w.rnd`;
      if (change.existed) {
        const rd = '/root/_wss_delta.csv'; const del = '/root/_wss_del.csv';
        await remoteSql(`\\set ON_ERROR_STOP on\nBEGIN;\n${stage}
\\copy _wss_stage (competition_id,event_id,round_type_id,group_id,is_extra,scramble_num,gm_cross6,gm_xcross6,steps) FROM '${rd}' WITH (FORMAT csv)
${insert} ON CONFLICT ${keyColumns} DO UPDATE SET rnd=EXCLUDED.rnd,steps=EXCLUDED.steps,gm_cross6=EXCLUDED.gm_cross6,gm_xcross6=EXCLUDED.gm_xcross6;
CREATE TEMP TABLE _wss_del (competition_id varchar(32), event_id varchar(6), round_type_id varchar(1), group_id varchar(3), is_extra smallint, scramble_num int) ON COMMIT DROP;
\\copy _wss_del FROM '${del}' WITH (FORMAT csv)
DELETE FROM wca_scramble_steps t USING _wss_del d WHERE ${keyMatch};
${metaSql}\nCOMMIT;\n${post}`, 'wss', [[change.delta, rd], [change.removed, del], ...extra], preRare, hasRare ? [rr] : []);
      } else {
        const remoteGz = '/root/_wss.csv.gz'; const remoteCsv = '/root/_wss.csv';
        const zipped = join(scratch, 'steps.csv.gz');
        await gzip(csv, zipped);
        await remoteSql(`\\set ON_ERROR_STOP on\nBEGIN;\n${stage}
\\copy _wss_stage (competition_id,event_id,round_type_id,group_id,is_extra,scramble_num,gm_cross6,gm_xcross6,steps) FROM '${remoteCsv}' WITH (FORMAT csv)
TRUNCATE wca_scramble_steps;
${insert};
${metaSql}\nCOMMIT;\n${post}`, 'wss_load', [[zipped, remoteGz], ...extra], `gunzip -f ${quote(remoteGz)} && ${preRare}`, [remoteCsv, ...(hasRare ? [rr] : [])]);
      }
    }
    await rename(change.next, manifest);
    console.log(`[steps] saved manifest: ${change.deltaRows} upserts, ${change.deleted} deletions`);
  } catch (error) {
    // Only remote transfer/SQL failure is optional. Local diff, layout, compression,
    // SQL-file I/O and manifest errors must fail the publishing entry.
    if (!(error instanceof RemoteStepsError)) throw error;
    console.warn(`[steps] remote load failed; manifest preserved for retry: ${String(error)}`);
  } finally { await rm(scratch, { recursive: true, force: true }); }
}

export async function loadMirrorToPg(): Promise<boolean> {
  const scrambles = join(wcaDir, 'incremental', 'tsv', 'Scrambles.tsv');
  const competitions = join(wcaDir, 'incremental', 'tsv', 'Competitions.tsv');
  if (!await exists(scrambles)) { console.log('[mirror] export TSV missing; skip'); return false; }
  const scratch = await mkdtemp(join(tmpdir(), 'scramble-mirror-'));
  try {
    const counts = join(scratch, 'prod-counts.tsv');
    const prod = await capture('ssh', [host, `${psql} -t -A -c 'SELECT competition_id||chr(9)||count(*) FROM wca_scrambles GROUP BY competition_id'`]);
    await writeFile(counts, prod);
    const delta = join(scratch, 'delta.csv'); const compList = join(scratch, 'comps.txt'); const compCsv = join(scratch, 'competitions.csv');
    const args = [join(jobDir, 'build_mirror_delta.mjs'), '--scrambles', scrambles, '--prod-counts', counts, '--out-delta', delta, '--out-comps', compList];
    if (await exists(competitions)) args.push('--competitions', competitions, '--out-comps-csv', compCsv);
    const output = await capture(process.execPath, args);
    const stat = JSON.parse(output.trim().split(/\r?\n/).at(-1) ?? '{}') as { toLoadComps: number; deltaRows: number; compsRows: number };
    if (stat.toLoadComps > 0) await remoteSql(`
\\set ON_ERROR_STOP on
BEGIN;
CREATE TEMP TABLE _scr_stage (competition_id varchar(32), event_id varchar(6), round_type_id varchar(1), group_id varchar(3), is_extra smallint, scramble_num int, scramble text) ON COMMIT DROP;
\\copy _scr_stage (competition_id,event_id,round_type_id,group_id,is_extra,scramble_num,scramble) FROM '/root/_mirror_delta.csv' WITH (FORMAT csv, HEADER true)
DELETE FROM wca_scrambles WHERE competition_id IN (SELECT DISTINCT competition_id FROM _scr_stage);
INSERT INTO wca_scrambles (competition_id,event_id,round_type_id,group_id,is_extra,scramble_num,scramble)
  SELECT competition_id,event_id,round_type_id,group_id,is_extra,scramble_num,scramble FROM _scr_stage;
COMMIT;`, 'mirror_load', [[delta, '/root/_mirror_delta.csv']]);
    if (stat.compsRows > 0 && await fileSize(compCsv) > 0) await remoteSql(`
\\set ON_ERROR_STOP on
BEGIN;
CREATE TEMP TABLE _comp_stage (id text, name text, country_id text, start_date text, end_date text) ON COMMIT DROP;
\\copy _comp_stage (id,name,country_id,start_date,end_date) FROM '/root/_comps_upsert.csv' WITH (FORMAT csv, HEADER true)
INSERT INTO wca_competitions (id,name,country_id,start_date,end_date)
  SELECT id,name,COALESCE(NULLIF(country_id,''),'unknown'),NULLIF(start_date,'')::date,NULLIF(end_date,'')::date FROM _comp_stage
  ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,
    country_id=CASE WHEN EXCLUDED.country_id <> 'unknown' THEN EXCLUDED.country_id ELSE wca_competitions.country_id END,
    start_date=EXCLUDED.start_date,end_date=EXCLUDED.end_date;
COMMIT;`, 'comps_upsert', [[compCsv, '/root/_comps_upsert.csv']]);
    console.log(`[mirror] ${stat.toLoadComps} competitions / ${stat.deltaRows} scrambles, ${stat.compsRows} competition rows`);
    return stat.toLoadComps > 0;
  } finally { await rm(scratch, { recursive: true, force: true }); }
}
