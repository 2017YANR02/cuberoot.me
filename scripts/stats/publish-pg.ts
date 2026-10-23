/** Production PG loaders for scramble statistics. Called only by the explicit publishing entry. */
import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { createGzip } from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { exists, fileSize, jobDir, lineCount, run, wcaDir } from './common.js';
import type { PgPublication } from './pg-publication-state.ts';

const host = process.env.CUBEROOT_STATIC_HOST ?? 'root@cuberoot';
const remotePass = "$(grep -oP 'DB_PASS=\\K.*' /root/core-api/.env | tr -d '[:space:]')";
const psql = `PGPASSWORD=${remotePass} psql -U recon_user -h 127.0.0.1 -d cuberoot_db -v ON_ERROR_STOP=1`;
const keyColumns = '(competition_id,event_id,round_type_id,group_id,is_extra,scramble_num)';
const stageKeyColumns = '(s.competition_id,s.event_id,s.round_type_id,s.group_id,s.is_extra,s.scramble_num)';
const keyMatch = 't.competition_id=d.competition_id AND t.event_id=d.event_id AND t.round_type_id=d.round_type_id AND t.group_id=d.group_id AND t.is_extra=d.is_extra AND t.scramble_num=d.scramble_num';
type Diff = { total: number; deltaRows: number; deleted: number; delta: string; removed: string; next: string; manifest: string; existed: boolean };
type Publication = { request: PgPublication; receipt: string; sourceFiles: Array<string | null>; context: string; manifestFingerprint?: string; verifySql?: string; verifyFiles?: Array<[string, string]>; verifyPre?: string; ensureSql?: string };

async function fingerprint(files: Array<string | null>, context = ''): Promise<string> {
  const hashes: Array<string | null> = [];
  for (const path of files) {
    if (path === null) { hashes.push(null); continue; }
    const hash = createHash('sha256'); for await (const chunk of createReadStream(path)) hash.update(chunk); hashes.push(hash.digest('hex'));
  }
  return createHash('sha256').update(JSON.stringify([context, hashes])).digest('hex');
}
async function publication(domain: string, files: Array<string | null>, manifest?: string, nextManifest?: string, context = ''): Promise<Publication> {
  const receipt = join(wcaDir, 'incremental', `pg_publication_${domain}.json`);
  const prior = await exists(receipt) ? JSON.parse(await readFile(receipt, 'utf8')) : undefined;
  const baseline = manifest && await exists(manifest) ? await fingerprint([manifest]) : undefined;
  // A crash between local manifest/receipt writes cannot silently bless a delta
  // computed from a different generation; only an identical remote replay can heal it.
  const before = prior && prior.manifestFingerprint === baseline ? prior.token : null;
  return { request: { domain, before, after: await fingerprint(files, context) }, receipt, sourceFiles: files, context,
    manifestFingerprint: nextManifest ? await fingerprint([nextManifest]) : undefined };
}
export function verifySql(stage: string, live: string, incoming: string, empty: string, extraMatch = 'true'): string {
  return `\\set ON_ERROR_STOP on\nBEGIN;\n${stage}\nSELECT CASE WHEN ${empty} THEN 'empty' WHEN NOT EXISTS ((${live}) EXCEPT ALL (${incoming})) AND NOT EXISTS ((${incoming}) EXCEPT ALL (${live})) AND (${extraMatch}) THEN 'match' ELSE 'different' END;\nROLLBACK;`;
}
function stepsProjection(stage: string): string {
  // The row manifest/delta keeps the first CSV row for each natural key. Full
  // loads and initial verification must select that same row, not a later row
  // with smaller gm values (which made full and incremental results disagree).
  return `SELECT DISTINCT ON ${stageKeyColumns} s.competition_id,s.event_id,s.round_type_id,s.group_id,s.is_extra,s.scramble_num,w.rnd,s.steps,s.gm_cross6,s.gm_xcross6
  FROM ${stage} s JOIN wca_scrambles w USING ${keyColumns}
  ORDER BY s.competition_id,s.event_id,s.round_type_id,s.group_id,s.is_extra,s.scramble_num,s._input_order,w.rnd`;
}
export function stepsVerifySql(fullCsv: string, rareCsv: string | null, layout: string, stamp: string): string {
  stepsMetaSql(layout, stamp, Boolean(rareCsv), rareCsv ?? '');
  const columns = 'competition_id,event_id,round_type_id,group_id,is_extra,scramble_num,gm_cross6,gm_xcross6,steps';
  const rareColumns = 'slot,val,competition_id,event_id,round_type_id,group_id,is_extra,scramble_num,stage6';
  const stage = `CREATE TEMP TABLE _verify_steps ON COMMIT DROP AS SELECT ${columns} FROM wca_scramble_steps WITH NO DATA;\nALTER TABLE _verify_steps ADD _input_order BIGINT GENERATED ALWAYS AS IDENTITY;\n\\copy _verify_steps (${columns}) FROM '${fullCsv}' WITH (FORMAT csv)`;
  const incoming = `SELECT ${columns},rnd FROM (${stepsProjection('_verify_steps')}) AS expected`;
  const base = (rare: boolean) => {
    const rareStage = rare ? `\nCREATE TEMP TABLE _verify_rare ON COMMIT DROP AS SELECT ${rareColumns} FROM wca_scramble_steps_rare WITH NO DATA;\nALTER TABLE _verify_rare ADD _input_order BIGINT GENERATED ALWAYS AS IDENTITY;\n\\copy _verify_rare (${rareColumns}) FROM '${rareCsv}' WITH (FORMAT csv)` : '';
    const rareIncoming = `SELECT DISTINCT ON (slot,val,competition_id,event_id,round_type_id,group_id,is_extra,scramble_num) ${rareColumns} FROM _verify_rare r WHERE EXISTS (SELECT 1 FROM (${incoming}) t WHERE t.competition_id=r.competition_id AND t.event_id=r.event_id AND t.round_type_id=r.round_type_id AND t.group_id=r.group_id AND t.is_extra=r.is_extra AND t.scramble_num=r.scramble_num) ORDER BY slot,val,competition_id,event_id,round_type_id,group_id,is_extra,scramble_num,_input_order`;
    const rareMatch = rare ? `NOT EXISTS ((SELECT ${rareColumns} FROM wca_scramble_steps_rare) EXCEPT (${rareIncoming})) AND NOT EXISTS ((${rareIncoming}) EXCEPT (SELECT ${rareColumns} FROM wca_scramble_steps_rare))` : 'true';
    const expectedLayout = rareCsv && !rare ? `$WSSL$${layout}$WSSL$::jsonb - 'tails' - 'rare_k'` : `$WSSL$${layout}$WSSL$::jsonb`;
    return verifySql(stage + rareStage, `SELECT ${columns},rnd FROM wca_scramble_steps`, incoming,
      `NOT EXISTS (SELECT 1 FROM wca_scramble_steps)${rare ? ' AND NOT EXISTS (SELECT 1 FROM wca_scramble_steps_rare)' : ''}`,
      `${rareMatch} AND EXISTS (SELECT 1 FROM wca_scramble_steps_meta WHERE id=1 AND layout=(${expectedLayout}) AND generated_at='${stamp}')`);
  };
  if (!rareCsv) return base(false);
  return `SELECT (to_regclass('public.wca_scramble_steps_rare') IS NOT NULL)::int AS has_rare\n\\gset\n\\if :has_rare\n${base(true)}\n\\else\n${base(false)}\n\\endif`;
}

/** Names stay private even when independent machines publish the same job. */
export function remoteFiles() {
  const prefix = `/root/_cuberoot_scramble_${randomUUID()}`;
  return (name: string) => {
    if (!/^[a-zA-Z0-9_.-]+$/.test(name)) throw new Error('Invalid remote staging filename');
    return `${prefix}_${name}`;
  };
}

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
async function remoteSql(sql: string, name: string, files: Array<[string, string]>, state: Publication, pre = '', extraCleanup: string[] = []): Promise<void> {
  const scratch = await mkdtemp(join(tmpdir(), 'scramble-sql-'));
  const localSql = join(scratch, `${name}.sql`);
  const remoteScript = remoteFiles()(`${name}.sql`);
  const remoteGuard = `${remoteScript}.ts`, remoteRequest = `${remoteScript}.json`, remoteVerify = `${remoteScript}.verify.sql`, remoteEnsure = `${remoteScript}.ensure.sql`;
  try {
    await writeFile(localSql, `${sql.trim()}\n`);
    for (const [local, remote] of files) await upload(local, remote);
    await upload(localSql, remoteScript);
    await upload(fileURLToPath(new URL('./pg-publication-state.ts', import.meta.url)), remoteGuard);
    const verifyFiles = state.request.before === null ? state.verifyFiles ?? [] : [];
    for (const [local, remote] of verifyFiles) await upload(local, remote);
    if (state.request.before === null && state.verifySql) {
      const path = join(scratch, 'verify.sql'); await writeFile(path, state.verifySql); await upload(path, remoteVerify);
    }
    if (state.ensureSql) { const path = join(scratch, 'ensure.sql'); await writeFile(path, state.ensureSql); await upload(path, remoteEnsure); }
    const cleanup = [remoteScript, remoteGuard, remoteRequest, remoteVerify, remoteEnsure, ...files.map(([, remote]) => remote), ...verifyFiles.map(([, remote]) => remote), ...extraCleanup];
    const apply = `set -e; ${pre}${psql} -f ${quote(remoteScript)}`;
    const verify = state.request.before === null && state.verifySql ? `set -e; ${state.verifyPre ?? ''}${psql} -q -t -A -f ${quote(remoteVerify)}` : undefined;
    const ensure = state.ensureSql ? `${psql} -f ${quote(remoteEnsure)}` : undefined;
    const requestPath = join(scratch, 'request.json'); await writeFile(requestPath, JSON.stringify({ request: state.request, apply, verify, ensure })); await upload(requestPath, remoteRequest);
    if (await fingerprint(state.sourceFiles, state.context) !== state.request.after) throw new Error('PG source changed during upload; candidate was not applied');
    const clean = `rm -f -- ${cleanup.map(quote).join(' ')}`;
    const guarded = `node ${quote(remoteGuard)} /root/.local/state/cuberoot/scramble-pg < ${quote(remoteRequest)}`;
    const cmd = `if flock -w 120 /tmp/cuberoot-scramble-pg.lock sh -c ${quote(guarded)}; then ${clean}; else rc=$?; echo ${quote(`PG candidate retained: ${remoteRequest}`)} >&2; exit $rc; fi`;
    await remoteCommand('ssh', [host, cmd], `psql ${name}`);
    await mkdir(join(wcaDir, 'incremental'), { recursive: true });
    const nextReceipt = `${state.receipt}.${randomUUID()}.next`; await writeFile(nextReceipt, JSON.stringify({ token: state.request.after, manifestFingerprint: state.manifestFingerprint })); await rename(nextReceipt, state.receipt);
  } finally { await rm(scratch, { recursive: true, force: true }); }
}
async function gzip(src: string, dst: string): Promise<void> { await pipeline(createReadStream(src), createGzip({ level: 1 }), createWriteStream(dst)); }

export async function loadOptimalToPg(csv: string, tag: '333' | 'puzzle'): Promise<void> {
  if (!await exists(csv) || await lineCount(csv) <= 1) { console.log(`[optimal ${tag}] empty CSV; skip`); return; }
  const scratch = await mkdtemp(join(tmpdir(), `scramble-opt-${tag}-`));
  const manifest = join(wcaDir, 'incremental', `pg_optimal_${tag}_manifest.tsv`);
  const remote = remoteFiles();
  try {
    const beforeDiff = await fingerprint([csv]);
    const change = await diff(csv, manifest, true, scratch);
    const state = await publication(`optimal-${tag}`, [csv], manifest, change.next);
    if (state.request.after !== beforeDiff) throw new Error('PG optimal source changed during diff; publication stopped');
    const full = remote(`verify_optimal_${tag}.csv`);
    const columns = 'competition_id,event_id,round_type_id,group_id,is_extra,scramble_num,htm,optimal_scramble';
    const events = tag === '333' ? "'333','333oh','333ft','333fm'" : "'222','pyram','skewb'";
    state.verifyFiles = [[csv, full]];
    state.verifySql = verifySql(`CREATE TEMP TABLE _verify_opt ON COMMIT DROP AS SELECT ${columns} FROM wca_scramble_optimal WITH NO DATA;\n\\copy _verify_opt (${columns}) FROM '${full}' WITH (FORMAT csv, HEADER true)`,
      `SELECT ${columns} FROM wca_scramble_optimal WHERE event_id IN (${events})`, `SELECT ${columns} FROM _verify_opt`, `NOT EXISTS (SELECT 1 FROM wca_scramble_optimal WHERE event_id IN (${events}))`);
    if (state.request.before !== null && change.existed && !change.deltaRows && !change.deleted) {
      await remoteSql('SELECT 1;', `optimal_${tag}_unchanged`, [], state);
      console.log(`[optimal ${tag}] unchanged`); await rename(change.next, manifest); return;
    }
    if (!change.existed || state.request.before === null) {
      const remoteCsv = remote(`timer_optimal_${tag}.csv`);
      await remoteSql(`
\\set ON_ERROR_STOP on
BEGIN;
DELETE FROM wca_scramble_optimal WHERE event_id IN (${events});
\\copy wca_scramble_optimal (competition_id,event_id,round_type_id,group_id,is_extra,scramble_num,htm,optimal_scramble) FROM '${remoteCsv}' WITH (FORMAT csv, HEADER true)
COMMIT;
SELECT count(*) FROM wca_scramble_optimal;`, `timer_optimal_${tag}`, [[csv, remoteCsv]], state);
    } else {
      const rd = remote(`opt_${tag}_delta.csv`); const rr = remote(`opt_${tag}_del.csv`);
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
SELECT count(*) FROM wca_scramble_optimal;`, `opt_${tag}`, [[change.delta, rd], [change.removed, rr]], state);
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
CREATE TEMP TABLE _wssr_stage (slot smallint, val smallint, competition_id varchar(32), event_id varchar(6), round_type_id varchar(1), group_id varchar(3), is_extra smallint, scramble_num int, stage6 smallint[], _input_order bigint GENERATED ALWAYS AS IDENTITY) ON COMMIT DROP;
\\copy _wssr_stage (slot,val,competition_id,event_id,round_type_id,group_id,is_extra,scramble_num,stage6) FROM '${rareCsv}' WITH (FORMAT csv)
DELETE FROM wca_scramble_steps_rare;
INSERT INTO wca_scramble_steps_rare (slot,val,competition_id,event_id,round_type_id,group_id,is_extra,scramble_num,stage6)
  SELECT r.slot,r.val,r.competition_id,r.event_id,r.round_type_id,r.group_id,r.is_extra,r.scramble_num,r.stage6
  FROM _wssr_stage r WHERE EXISTS (SELECT 1 FROM wca_scramble_steps t
    WHERE t.competition_id=r.competition_id AND t.event_id=r.event_id AND t.round_type_id=r.round_type_id
      AND t.group_id=r.group_id AND t.is_extra=r.is_extra AND t.scramble_num=r.scramble_num)
  ORDER BY r._input_order ON CONFLICT DO NOTHING;
${meta}
\\else
${stripped}
\\endif`;
}

export async function loadStepsToPg(csv: string, layoutPath: string, rarePath: string, stamp: string): Promise<void> {
  if (!await exists(csv) || !await exists(layoutPath)) { console.log('[steps] CSV/layout missing; skip'); return; }
  const scratch = await mkdtemp(join(tmpdir(), 'scramble-steps-'));
  const manifest = join(wcaDir, 'incremental', 'pg_wss_manifest.tsv');
  const remote = remoteFiles();
  try {
    const hasRare = await exists(rarePath);
    const sources = [csv, layoutPath, hasRare ? rarePath : null];
    const beforeDiff = await fingerprint(sources, stamp);
    const change = await diff(csv, manifest, false, scratch);
    const rr = remote('wssr.csv');
    const rareGz = `${rr}.gz`;
    const rareUpload = join(scratch, 'rare.csv.gz');
    if (hasRare) await gzip(rarePath, rareUpload);
    const extra: Array<[string, string]> = hasRare ? [[rareUpload, rareGz]] : [];
    const preRare = hasRare ? `gunzip -c ${quote(rareGz)} > ${quote(rr)} && ` : '';
    const layout = (await readFile(layoutPath, 'utf8')).trim();
    const metaSql = stepsMetaSql(layout, stamp, hasRare, rr);
    const state = await publication('steps', [csv, layoutPath, hasRare ? rarePath : null], manifest, change.next, stamp);
    if (state.request.after !== beforeDiff) throw new Error('PG steps source changed during diff; publication stopped');
    const full = remote('verify_steps.csv'), fullRare = remote('verify_rare.csv');
    state.verifyFiles = [[csv, full], ...(hasRare ? [[rarePath, fullRare] as [string, string]] : [])];
    state.verifySql = stepsVerifySql(full, hasRare ? fullRare : null, layout, stamp);
    const post = `VACUUM ANALYZE wca_scramble_steps;\n${hasRare ? "\\if :has_rare\nVACUUM ANALYZE wca_scramble_steps_rare;\n\\endif\n" : ''}`;
    if (state.request.before !== null && change.existed && !change.deltaRows && !change.deleted) {
      await remoteSql(`\\set ON_ERROR_STOP on\nBEGIN;\n${metaSql}\nCOMMIT;\n${post}`, 'wss_meta', extra, state, preRare, hasRare ? [rr] : []);
    } else {
      const stage = `CREATE TEMP TABLE _wss_stage (competition_id varchar(32), event_id varchar(6), round_type_id varchar(1), group_id varchar(3), is_extra smallint, scramble_num int, gm_cross6 smallint, gm_xcross6 smallint, steps smallint[], _input_order bigint GENERATED ALWAYS AS IDENTITY) ON COMMIT DROP;`;
      const insert = `INSERT INTO wca_scramble_steps AS t (competition_id,event_id,round_type_id,group_id,is_extra,scramble_num,rnd,steps,gm_cross6,gm_xcross6)\n${stepsProjection('_wss_stage')}`;
      if (state.request.before !== null && change.existed) {
        const rd = remote('wss_delta.csv'); const del = remote('wss_del.csv');
        await remoteSql(`\\set ON_ERROR_STOP on\nBEGIN;\n${stage}
\\copy _wss_stage (competition_id,event_id,round_type_id,group_id,is_extra,scramble_num,gm_cross6,gm_xcross6,steps) FROM '${rd}' WITH (FORMAT csv)
${insert} ON CONFLICT ${keyColumns} DO UPDATE SET rnd=EXCLUDED.rnd,steps=EXCLUDED.steps,gm_cross6=EXCLUDED.gm_cross6,gm_xcross6=EXCLUDED.gm_xcross6;
CREATE TEMP TABLE _wss_del (competition_id varchar(32), event_id varchar(6), round_type_id varchar(1), group_id varchar(3), is_extra smallint, scramble_num int) ON COMMIT DROP;
\\copy _wss_del FROM '${del}' WITH (FORMAT csv)
DELETE FROM wca_scramble_steps t USING _wss_del d WHERE ${keyMatch};
${metaSql}\nCOMMIT;\n${post}`, 'wss', [[change.delta, rd], [change.removed, del], ...extra], state, preRare, hasRare ? [rr] : []);
      } else {
        const remoteCsv = remote('wss.csv'); const remoteGz = `${remoteCsv}.gz`;
        const zipped = join(scratch, 'steps.csv.gz');
        await gzip(csv, zipped);
        await remoteSql(`\\set ON_ERROR_STOP on\nBEGIN;\n${stage}
\\copy _wss_stage (competition_id,event_id,round_type_id,group_id,is_extra,scramble_num,gm_cross6,gm_xcross6,steps) FROM '${remoteCsv}' WITH (FORMAT csv)
DELETE FROM wca_scramble_steps;
${insert};
${metaSql}\nCOMMIT;\n${post}`, 'wss_load', [[zipped, remoteGz], ...extra], state, `gunzip -c ${quote(remoteGz)} > ${quote(remoteCsv)} && ${preRare}`, [remoteCsv, ...(hasRare ? [rr] : [])]);
      }
    }
    await rename(change.next, manifest);
    console.log(`[steps] saved manifest: ${change.deltaRows} upserts, ${change.deleted} deletions`);
  } finally { await rm(scratch, { recursive: true, force: true }); }
}

export async function loadMirrorToPg(): Promise<boolean> {
  const scrambles = join(wcaDir, 'incremental', 'tsv', 'Scrambles.tsv');
  const competitions = join(wcaDir, 'incremental', 'tsv', 'Competitions.tsv');
  if (!await exists(scrambles)) { console.log('[mirror] export TSV missing; skip'); return false; }
  const scratch = await mkdtemp(join(tmpdir(), 'scramble-mirror-'));
  const remote = remoteFiles(), remoteDelta = remote('mirror_delta.csv'), remoteComps = remote('comps_upsert.csv');
  try {
    const sources = [scrambles, await exists(competitions) ? competitions : null];
    const beforeDiff = await fingerprint(sources);
    const counts = join(scratch, 'prod-counts.tsv');
    const prod = await capture('ssh', [host, `${psql} -t -A -c 'SELECT competition_id||chr(9)||count(*) FROM wca_scrambles GROUP BY competition_id'`]);
    await writeFile(counts, prod);
    const delta = join(scratch, 'delta.csv'); const compList = join(scratch, 'comps.txt'); const compCsv = join(scratch, 'competitions.csv');
    const args = [join(jobDir, 'build_mirror_delta.mjs'), '--scrambles', scrambles, '--prod-counts', counts, '--out-delta', delta, '--out-comps', compList];
    if (await exists(competitions)) args.push('--competitions', competitions, '--out-comps-csv', compCsv);
    const output = await capture(process.execPath, args);
    const stat = JSON.parse(output.trim().split(/\r?\n/).at(-1) ?? '{}') as { toLoadComps: number; deltaRows: number; compsRows: number };
    const state = await publication('mirror', sources);
    if (state.request.after !== beforeDiff) throw new Error('PG mirror source changed during diff; publication stopped');
    if (state.request.before === null) {
      const emptyCounts = join(scratch, 'empty-counts.tsv'), full = join(scratch, 'verify-mirror.csv'), fullComps = join(scratch, 'verify-comps.txt');
      await writeFile(emptyCounts, '');
      await capture(process.execPath, [join(jobDir, 'build_mirror_delta.mjs'), '--scrambles', scrambles, '--prod-counts', emptyCounts, '--out-delta', full, '--out-comps', fullComps]);
      const remoteFull = remote('verify_mirror.csv');
      const columns = 'competition_id,event_id,round_type_id,group_id,is_extra,scramble_num,scramble';
      state.verifyFiles = [[full, remoteFull]];
      state.verifySql = verifySql(`CREATE TEMP TABLE _verify_mirror ON COMMIT DROP AS SELECT ${columns} FROM wca_scrambles WITH NO DATA;\n\\copy _verify_mirror (${columns}) FROM '${remoteFull}' WITH (FORMAT csv, HEADER true)`,
        `SELECT ${columns} FROM wca_scrambles`, `SELECT ${columns} FROM _verify_mirror`, 'NOT EXISTS (SELECT 1 FROM wca_scrambles)');
    }
    const statements: string[] = [], uploads: Array<[string, string]> = [];
    if (stat.toLoadComps > 0) {
      uploads.push([delta, remoteDelta]);
      statements.push(`
CREATE TEMP TABLE _scr_stage (competition_id varchar(32), event_id varchar(6), round_type_id varchar(1), group_id varchar(3), is_extra smallint, scramble_num int, scramble text) ON COMMIT DROP;
\\copy _scr_stage (competition_id,event_id,round_type_id,group_id,is_extra,scramble_num,scramble) FROM '${remoteDelta}' WITH (FORMAT csv, HEADER true)
DELETE FROM wca_scrambles WHERE competition_id IN (SELECT DISTINCT competition_id FROM _scr_stage);
INSERT INTO wca_scrambles (competition_id,event_id,round_type_id,group_id,is_extra,scramble_num,scramble)
  SELECT competition_id,event_id,round_type_id,group_id,is_extra,scramble_num,scramble FROM _scr_stage;`);
    }
    if (stat.compsRows > 0 && await fileSize(compCsv) > 0) {
      uploads.push([compCsv, remoteComps]);
      state.ensureSql = `\\set ON_ERROR_STOP on\nBEGIN;
CREATE TEMP TABLE _comp_stage (id text, name text, country_id text, start_date text, end_date text) ON COMMIT DROP;
\\copy _comp_stage (id,name,country_id,start_date,end_date) FROM '${remoteComps}' WITH (FORMAT csv, HEADER true)
INSERT INTO wca_competitions (id,name,country_id,start_date,end_date)
  SELECT id,name,COALESCE(NULLIF(country_id,''),'unknown'),NULLIF(start_date,'')::date,NULLIF(end_date,'')::date FROM _comp_stage
  ON CONFLICT (id) DO NOTHING;\nCOMMIT;`;
    }
    // Daily WCA stats own existing competition metadata. This mirror only fills
    // missing competitions, so an older local dump cannot overwrite newer names/dates.
    await remoteSql(`\\set ON_ERROR_STOP on\nBEGIN;\n${statements.join('\n')}\nCOMMIT;`, 'mirror', uploads, state);
    console.log(`[mirror] ${stat.toLoadComps} competitions / ${stat.deltaRows} scrambles, ${stat.compsRows} competition rows`);
    return stat.toLoadComps > 0;
  } finally { await rm(scratch, { recursive: true, force: true }); }
}
