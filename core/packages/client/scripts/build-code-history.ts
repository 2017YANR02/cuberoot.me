// Offline orchestration for GitHub Linguist. No network or checkout mutations.
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { withLocalLock } from '../../../../scripts/wca-data/local-lock.ts';

export const ENGINE_VERSION = '9.7.0';
export const METADATA = { engine: `github-linguist ${ENGINE_VERSION}`, timezone: 'America/Los_Angeles', branch: 'main' };
export const OUTPUT = 'core/packages/client/app/[lang]/dev/architecture/_components/code-history/history.json';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
type Languages = Record<string, number>;
type Cache = Record<string, unknown>; // Official Linguist cache, never reinterpreted.
export type Row = { date: string; sha: string; languages: Languages };
export type State = { rows: Row[]; sha?: string | null; cache?: Cache | null } & Partial<typeof METADATA>;
export type Day = [date: string, sha: string];
export type Analysis = { languages: Languages; cache: Cache };
export type Engine = {
  analyze(sha: string, previousSha?: string | null, cache?: Cache | null): Promise<Analysis>;
  close(): Promise<void>;
};

function git(root: string, ...args: string[]) {
  return execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, timeout: 30_000 }).trim();
}
const localDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: METADATA.timezone, year: 'numeric', month: '2-digit', day: '2-digit',
});
export function dailyCommits(log: string): Day[] {
  const daily = new Map<string, string>();
  for (const line of log.trim().split('\n').filter(Boolean)) {
    const [timestamp, sha] = line.split(' ');
    const date = localDate.format(new Date(Number(timestamp) * 1000));
    if (!daily.has(date)) daily.set(date, sha);
  }
  return [...daily].sort(([a], [b]) => a.localeCompare(b));
}
export function sourceChanged(root: string, previous: string | undefined, head: string) {
  return !previous || git(root, 'log', '--first-parent', '--format=%H', '-1',
    `${previous}..${head}`, '--', '.', `:(top,exclude)${OUTPUT}`) !== '';
}

// Carry-forward calendar rows are display data, not extra analyzed commits.
export function commitRows(rows: Row[]) {
  return rows.filter((row, index) => index === 0 || rows[index - 1].sha !== row.sha);
}
export function prepareState(expected: Day[], state: State, ancestor: (old: string, current: string) => boolean) {
  const saved = commitRows(state.rows);
  let matched = 0;
  while (matched < saved.length && expected[matched]?.[0] === saved[matched].date && expected[matched]?.[1] === saved[matched].sha) matched++;
  const last = saved.at(-1);
  const replacement = expected[matched];
  if (matched !== saved.length && !(matched === saved.length - 1 && replacement &&
    last?.date === replacement[0] && ancestor(last.sha, replacement[1]))) {
    throw new Error('Saved history changed before its final day; preserve the checkpoint and snapshot before rebuilding');
  }
  const rows = saved.slice(0, matched);
  const cached = !!(state.cache && state.sha === last?.sha);
  const pending = expected.slice(rows.length);
  return { rows, cached, pending, bootstrap: !cached && rows.length > 0 && pending.length > 0 };
}
export function calendarRows(rows: Row[]): Row[] {
  if (!rows.length) throw new Error('main has no commits');
  const byDate = new Map(rows.map(row => [row.date, row]));
  const result: Row[] = [];
  let previous = rows[0];
  const last = Date.parse(`${rows.at(-1)!.date}T00:00:00Z`);
  for (let time = Date.parse(`${rows[0].date}T00:00:00Z`); time <= last; time += 86_400_000) {
    const date = new Date(time).toISOString().slice(0, 10);
    previous = byDate.get(date) ?? previous;
    result.push({ ...previous, date });
  }
  return result;
}
export function atomicJson(path: string, value: unknown) {
  const json = JSON.stringify(value);
  if (existsSync(path) && readFileSync(path, 'utf8') === json) return;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(`${path}.next`, json);
  renameSync(`${path}.next`, path);
}

export function createEngine(root: string, ruby = process.env.CODE_HISTORY_RUBY ?? 'ruby'): Engine {
  const child = spawn(ruby, [fileURLToPath(new URL('./linguist-engine.rb', import.meta.url)), ENGINE_VERSION, root],
    { stdio: ['pipe', 'pipe', 'pipe'] });
  let failure: Error | undefined;
  let stderr = '';
  child.on('error', error => { failure = error; });
  child.stdin.on('error', error => { failure = error; });
  child.stderr.setEncoding('utf8').on('data', chunk => { stderr = (stderr + chunk).slice(-8000); });
  const ended = new Promise<void>(resolveEnd => child.once('close', code => {
    if (code !== 0) failure ??= new Error(`Linguist exited ${code}: ${stderr}`);
    resolveEnd();
  }));
  const lines = createInterface({ input: child.stdout })[Symbol.asyncIterator]();
  return {
    async analyze(sha, previousSha, cache) {
      if (failure) throw failure;
      await new Promise<void>((resolveWrite, reject) => {
        child.stdin.write(`${JSON.stringify({ sha, previousSha, cache })}\n`, error => error ? reject(error) : resolveWrite());
      });
      const line = await Promise.race([lines.next(), ended.then(() => { throw failure ?? new Error('Linguist ended without a result'); })]);
      if (line.done) { await ended; throw failure ?? new Error('Linguist ended without a result'); }
      return JSON.parse(line.value) as Analysis;
    },
    async close() { child.stdin.end(); await ended; if (failure) throw failure; },
  };
}

export function planHistory(root = ROOT) {
  const output = join(root, OUTPUT);
  const checkpoint = join(root, '.local-data/code-language-history/checkpoint.json');
  const legacy = resolve(root, git(root, 'rev-parse', '--git-path', 'code-language-history.json'));
  const candidates = [checkpoint, legacy, output];
  const source = candidates.find(path => existsSync(path));
  const savedJson = source ? readFileSync(source, 'utf8') : undefined;
  const state: State = savedJson ? JSON.parse(savedJson) : { rows: [] };
  if (source && source !== legacy && Object.entries(METADATA).some(([key, value]) => state[key as keyof typeof METADATA] !== value)) {
    throw new Error(`Incompatible language history metadata: ${source}`);
  }
  const head = git(root, 'rev-parse', 'main^{commit}');
  const expected = dailyCommits(git(root, 'log', '--first-parent', '--format=%ct %H', head));
  if (!expected.length) throw new Error('main has no commits');
  const prepared = prepareState(expected, state, (old, current) => {
    try { git(root, 'merge-base', '--is-ancestor', old, current); return true; }
    catch (error) { if ((error as { status?: number }).status === 1) return false; throw error; }
  });
  const published: State | undefined = existsSync(output) ? JSON.parse(readFileSync(output, 'utf8')) : undefined;
  const plan = { ...METADATA, head, source: source ?? null, checkpoint, reusedDays: prepared.rows.length,
    analyzedDays: prepared.pending.length, cacheBootstrap: prepared.bootstrap,
    sourceChanged: sourceChanged(root, published?.rows.at(-1)?.sha, head), lastDate: expected.at(-1)![0] };
  return { output, checkpoint, candidates, source, savedJson, state, prepared, expected, plan };
}

export async function runHistory(options: {
  root?: string; planOnly?: boolean; engineFactory?: (root: string) => Engine; log?: (message: string) => void;
} = {}) {
  const root = options.root ?? ROOT;
  const log = options.log ?? console.log;
  const { output, checkpoint, candidates, source, savedJson, state, prepared, expected, plan } = planHistory(root);
  if (options.planOnly) { log(JSON.stringify(plan, null, 2)); return plan; }
  // Different from the former persistent flock file; reuse the repository's
  // exclusive owner lock and never steal a lock left by an interrupted writer.
  await withLocalLock(`${checkpoint}.writer.lock`, async () => {
    if (candidates.find(path => existsSync(path)) !== source || (source && readFileSync(source, 'utf8') !== savedJson)) {
      throw new Error('Language history changed while planning; run again using the new checkpoint');
    }
    const { rows, cached, pending, bootstrap } = prepared;
    if (pending.length) {
      const engine = (options.engineFactory ?? createEngine)(root);
      const progress: State = { ...METADATA, rows, sha: cached ? state.sha : null, cache: cached ? state.cache : null };
      try {
        if (bootstrap) {
          const last = rows.at(-1)!;
          const analysis = await engine.analyze(last.sha);
          if (!isDeepStrictEqual(analysis.languages, last.languages)) throw new Error('Linguist baseline differs from the saved snapshot');
          progress.sha = last.sha; progress.cache = analysis.cache;
          atomicJson(checkpoint, progress);
          log(`Restored cache at ${last.date}`);
        }
        for (const [date, sha] of pending) {
          const started = performance.now();
          const analysis = await engine.analyze(sha, progress.sha, progress.cache);
          const values = Object.values(analysis.languages);
          if (!values.length || values.some(value => !Number.isSafeInteger(value) || value < 0) || !analysis.cache) throw new Error(`Invalid analysis for ${date}`);
          rows.push({ date, sha, languages: analysis.languages });
          progress.sha = sha; progress.cache = analysis.cache;
          atomicJson(checkpoint, progress);
          log(`${rows.length}/${expected.length} ${date} ${((performance.now() - started) / 1000).toFixed(2)}s`);
        }
      } finally { await engine.close(); }
    }
    const filled = calendarRows(rows);
    atomicJson(output, { ...METADATA, rows: filled });
    log(`Saved ${filled.length} calendar days through ${filled.at(-1)!.date} (${plan.head}); reused ${plan.reusedDays}, analyzed ${pending.length}`);
  });
  return plan;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === '--engine-version') console.log(ENGINE_VERSION);
  else if (args.length === 0 || (args.length === 1 && args[0] === '--plan')) {
    await runHistory({ planOnly: args[0] === '--plan' });
  } else throw new Error('Usage: build-code-history.ts [--plan | --engine-version]');
}
