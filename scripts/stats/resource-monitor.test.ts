import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawn, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { once } from 'node:events';
import { parseProcesses } from '../../core/scripts/mac-system-recorder.mts';
import { GiB, analyzerTableNames, archiveReviewedStatsStop, inspectCompletion, isTsxService, parseIdentities, resourceLimits, resourceValues, resolveStatsAnalyzerEnv, runWhileMonitored, sameIdentity, selectStatsEoProfile, selectStatsStandardStageMode, startupRequiredBytes, statsAnalyzerStartupDecision, statsResourcePlan, tableBudget, trackedTree, validateResumeReview, validateStatsDeepTableMetadata, type Identity, type ProcessRow, type TableBudget } from './resource-monitor.js';
import { sq1GrindLadder, sq1GrindResourcePlan } from './sq1-grind.js';

const identity = (pid: number, command = `process-${pid}`, start = 'Wed Oct 21 12:00:00 2026'): Identity => ({ pid, start, command });
const row = (pid: number, ppid: number, rssBytes = 0): ProcessRow => ({ pid, ppid, rssBytes, cpuPercent: 0, state: 'S', name: `process-${pid}` });
const observation = { sampledAt: '', boot: '123', swapouts: 0, pressure: 1, available: 50 * GiB, computeRunning: false, lockExists: false };
const budget: TableBudget = { binary: 'fixture', profile: 'high-memory', tableBytes: 40 * GiB, mapped: true, rssLimit: 44 * GiB, files: [] };

test('resource boundaries preserve boot and Swapouts and deduct only active mapped RSS', () => {
  const rows = [row(1, 0, GiB), row(2, 1, 40 * GiB)], budgets = new Map([[2, budget]]);
  assert.equal(resourceLimits(observation, observation, rows, budgets).headroom, 9.5 * GiB);
  assert.equal(resourceValues(observation, [row(1, 0), row(2, 1, GiB)], budgets).mappedEstimate, GiB);
  assert.equal(resourceValues(observation, rows, new Map([[2, { ...budget, mapped: false }]])).headroom, 49.5 * GiB);
  for (const change of [{ boot: '456' }, { swapouts: 1 }, { pressure: 2 }])
    assert.throws(() => resourceLimits(observation, { ...observation, ...change }, rows, budgets));
  assert.equal(resourceLimits(observation, { ...observation, available: 42.5 * GiB }, rows, budgets).headroom, 2 * GiB);
  assert.throws(() => resourceLimits(observation, { ...observation, available: 42.5 * GiB - 1 }, rows, budgets), /headroom/);
  assert.throws(() => resourceLimits(observation, observation, [row(2, 1, 44 * GiB + 1)], budgets), /RSS/);
  assert.throws(() => resourceLimits(observation, observation, [row(2, 1), row(3, 1)], new Map([[2, budget], [3, budget]])), /Concurrent/);
});

test('table plan follows EO profile and optional table flags; unknown binaries fail closed', () => {
  const normal = analyzerTableNames('eo_cross_analyzer', {}, 55 * GiB);
  const high = analyzerTableNames('eo_cross_analyzer', {}, 56 * GiB);
  assert.equal(normal.names.length, 18);
  assert.equal(high.names.length, 23);
  assert.equal(analyzerTableNames('eo_cross_analyzer', { CUBE_TABLE_PROFILE: 'default', CUBE_EO_NO_DIAG: '1' }, 64 * GiB).names.length, 17);
  assert.throws(() => analyzerTableNames('unknown_analyzer', {}, 64 * GiB), /No reviewed/);
  const inspect = (() => ({ isFile: () => true, size: 100, mtimeMs: 0, ino: 1, dev: 1 })) as Parameters<typeof tableBudget>[3];
  assert.equal(tableBudget('eo_cross_analyzer', {}, 64 * GiB, inspect).rssLimit, 2300 + 4 * GiB);
  assert.equal(tableBudget('sq1_analyzer', {}, 64 * GiB, inspect).workingBytes, 240_000_000 * 114);
  assert.equal(tableBudget('sq1_analyzer', {}, 64 * GiB, inspect).mapped, false);
  assert.equal(tableBudget('sq1_analyzer', { SQ1_SLASH_VIA_WCA: '1' }, 64 * GiB, inspect).tableBytes, 0);
  assert.equal(tableBudget('sq1_analyzer', { SQ1_TT_BUDGET: '10' }, 64 * GiB, inspect).workingBytes, 1140);
  assert.throws(() => tableBudget('sq1_analyzer', { SQ1_TT_BUDGET: '-1' }, 64 * GiB, inspect));
  assert.throws(() => tableBudget('sq1_analyzer', { SQ1_TT_BUDGET: '' }, 64 * GiB, inspect));
  assert.equal(tableBudget('sq1_slash_mitm', {}, 64 * GiB, inspect).workingBytes, 20_736_638_976);
});

test('new stage PDBs enter budgets only for their requested consumers', () => {
  const names = (binary: string, env: NodeJS.ProcessEnv) => analyzerTableNames(binary, env, 128 * GiB).names;
  assert(names('pair_analyzer', { CUBE_PAIR_JOINT_MODE: 'first' }).includes('pt_cross_pair_C4E0.bin'));
  assert(names('pair_analyzer', {}).includes('pt_cross_pair_C4E0.bin'));
  assert(!names('pseudo_pair_analyzer', {}).some(n => n.startsWith('pt_pscross_pair_')));
  assert.equal(names('pseudo_pair_analyzer', { CUBE_PAIR_JOINT_MODE: 'all' }).filter(n => n.startsWith('pt_pscross_pair_')).length, 4);
  assert(!names('pair_analyzer', { CUBE_PAIR_JOINT_MODE: 'off' }).includes('pt_cross_pair_C4E0.bin'));
  for (const binary of ['f2leo_analyzer', 'pseudo_f2leo_analyzer']) assert(names(binary, { CUBE_F2LEO_COMPACT_MODE: 'first' }).includes('pt_cross_eo_E0E1E2E3.bin'));
  assert(names('f2leo_analyzer', {}).includes('pt_cross_eo_E0E1E2E3.bin'));
  assert(!names('f2leo_analyzer', { CUBE_F2LEO_COMPACT_MODE: 'off' }).includes('pt_cross_eo_E0E1E2E3.bin'));
  assert(names('std_analyzer', { CUBE_STAGE_JOINT_MODE: 'both' }).includes('pt_cross_C4C6E0E1E2.bin'));
  assert(!names('f2b_analyzer', { CUBE_STAGE_JOINT_MODE: 'both' }).includes('pt_cross_C4C6E0E1E2.bin'));
  for (const mode of ['middle', 'both']) {
    const tables = names('f2b_analyzer', { CUBE_STAGE_JOINT_MODE: mode });
    assert(tables.includes('mt_edge4.bin'));
    assert(tables.includes('pt_C4C5C6C7E0E1E2E3.bin'));
  }
  assert(!names('f2b_analyzer', { CUBE_STAGE_JOINT_MODE: 'off' }).includes('mt_edge4.bin'));
  assert(names('f2b_analyzer', {}).includes('mt_edge4.bin'));
  assert(names('f2b_analyzer', {}).includes('pt_C4C5C6C7E0E1E2E3.bin'));
  assert(!names('f2b_analyzer', { CUBE_STAGE_JOINT_MODE: 'off' }).includes('mt_edge4.bin'), 'Opt-in inventory must not mutate its base');
  assert.deepEqual(names('f2b_analyzer', { CUBE_F2B_LIGHT: '1' }), ['mt_corn2.bin', 'mt_edge3.bin']);
  assert.deepEqual(names('f2b_analyzer', { CUBE_F2B_LIGHT: '1', CUBE_STAGE_JOINT_MODE: 'middle' }), ['mt_corn2.bin', 'mt_edge3.bin']);
  assert(!names('std_analyzer', {}).includes('pt_C4C5C6C7E0E1E2E3.bin'));
  assert(!names('std_analyzer', {}).includes('pt_cross_C4C6E0E1E2.bin'), 'Explicit candidates must not mutate base inventories');
});

test('Deep projection omits exactly the redundant diagonal file and preserves reserves', () => {
  const full = { CUBE_STAGE_JOINT_MODE: 'deep' };
  const projected = { ...full, CUBE_STAGE_DEEP_NO_DIAG: '1' };
  const oldDiagonal = 'pt_cross_C4C6E0E2.bin';
  const names = (env: NodeJS.ProcessEnv) => analyzerTableNames('std_analyzer', env, 128 * GiB).names;
  assert.deepEqual(names(projected), names(full).filter(name => name !== oldDiagonal));
  assert(names(projected).includes('pt_cross_C4C5E0E1.bin'), 'Retain adjacent pair goal checks');
  assert(names(full).includes(oldDiagonal), 'Candidate calls must not mutate the full inventory');
  assert(names({ ...projected, CUBE_STAGE_DEEP_NO_DIAG: '0' }).includes(oldDiagonal));
  const inspect = ((path: string) => ({ isFile: () => true, size: path.endsWith(oldDiagonal) ? 10_729_635_856 : 100, mtimeMs: 0, ino: 1, dev: 1 })) as Parameters<typeof tableBudget>[3];
  const original = tableBudget('std_analyzer', full, 128 * GiB, inspect);
  const candidate = tableBudget('std_analyzer', projected, 128 * GiB, inspect);
  assert.equal(original.rssLimit - candidate.rssLimit, 10_729_635_856);
  assert.equal(candidate.rssLimit - candidate.tableBytes, 4 * GiB);
  assert.equal(startupRequiredBytes(candidate.rssLimit) - candidate.rssLimit, 2.5 * GiB);
  for (const mode of ['off', 'middle', 'default', undefined]) assert.throws(() => names({ ...projected, CUBE_STAGE_JOINT_MODE: mode }));
  assert.throws(() => names({ ...projected, CUBE_STAGE_DEEP_NO_DIAG: 'default' }));
  for (const binary of ['pair_analyzer', 'f2leo_analyzer', 'f2b_analyzer']) assert.throws(() => analyzerTableNames(binary, projected, 128 * GiB));
});

test('EO auto freezes a profile at the unchanged startup boundary and preserves native eligibility', () => {
  const highRssLimit = 47_452_533_712, required = 50_136_888_272;
  const original = { CUBE_TABLE_PROFILE: 'auto', CUBE_EO_NO_DIAG: '0' };
  assert.equal(selectStatsEoProfile(original, 49_692_983_296, () => highRssLimit, 64 * GiB).CUBE_TABLE_PROFILE, 'default');
  assert.equal(selectStatsEoProfile(original, required - 1, () => highRssLimit, 64 * GiB).CUBE_TABLE_PROFILE, 'default');
  const high = selectStatsEoProfile(original, required, () => highRssLimit, 64 * GiB);
  assert.equal(high.CUBE_TABLE_PROFILE, 'high-memory');
  assert.equal(original.CUBE_TABLE_PROFILE, 'auto');
  const unavailable = () => { throw Error('Optional high-memory table is absent'); };
  assert.equal(selectStatsEoProfile({}, 100 * GiB, unavailable, 32 * GiB).CUBE_TABLE_PROFILE, 'default');
  assert.equal(selectStatsEoProfile({ CUBE_TABLE_PROFILE: '' }, required, () => highRssLimit, 64 * GiB).CUBE_TABLE_PROFILE, 'high-memory');
  assert.equal(selectStatsEoProfile(high, 0, unavailable, 64 * GiB), high);
  const explicitDefault = { CUBE_TABLE_PROFILE: 'default' };
  assert.equal(selectStatsEoProfile(explicitDefault, 100 * GiB, unavailable, 64 * GiB), explicitDefault);
  assert.equal(resolveStatsAnalyzerEnv('eo_cross_analyzer', explicitDefault), explicitDefault);
  assert.equal(resolveStatsAnalyzerEnv('std_analyzer', original), original);
  assert.equal(selectStatsEoProfile(original, 0, () => highRssLimit, 64 * GiB).CUBE_TABLE_PROFILE, 'default');
});

const fullStdEnv = { CUBE_RUN_FULL_STD: '1', CUBE_ALLOW_HUGE_TABLES: '1' };
const deepMetadata = { isFile: () => true, size: 65_910_624_256, mtimeMs: 1794385000000, ino: 42, dev: 1 };
function sealDeepRecord(record: Buffer) {
  let hash = 0xcbf29ce484222325n;
  for (let i = 0; i < 504; i += 8) hash = BigInt.asUintN(64, (hash ^ record.readBigUInt64LE(i)) * 0x100000001b3n);
  record.writeBigUInt64LE(hash, 504);
}
// Rust STGJPDB1's fixed-width LE metadata, including its wrapping u64 checksum.
function deepHeader(changes: Record<number, bigint> = {}) {
  const header = Buffer.alloc(4096), record = header.subarray(0, 512);
  record.write('STGJPDB1', 0, 'ascii');
  const values = [1n, 2n, 258n, 510_935_040n, 128_755_722_240n, 14n, 13n, 1n, 1n, 0xfedcba9876543210n,
    ...Array.from({ length: 15 }, (_, i) => i === 0 ? 1n : i === 13 ? 128_755_722_239n : 0n)];
  for (const [index, value] of Object.entries(changes)) values[Number(index)] = value;
  values.forEach((value, i) => record.writeBigUInt64LE(value, 8 + i * 8));
  sealDeepRecord(record);
  return header;
}

test('standard stage auto selects Deep only at its unchanged budget and freezes both choices', () => {
  const limit = 78 * GiB, required = startupRequiredBytes(limit);
  let calls = 0;
  const inspect = () => { calls++; return limit; };
  const selected = selectStatsStandardStageMode(fullStdEnv, required, inspect, 128 * GiB);
  assert.equal(selected.CUBE_STAGE_JOINT_MODE, 'deep');
  assert.equal(selected.CUBE_STAGE_DEEP_NO_DIAG, '1');
  assert.deepEqual(fullStdEnv, { CUBE_RUN_FULL_STD: '1', CUBE_ALLOW_HUGE_TABLES: '1' });
  const low = selectStatsStandardStageMode(fullStdEnv, required - 1, inspect, 128 * GiB);
  assert.equal(low.CUBE_STAGE_JOINT_MODE, 'off'); assert.equal(low.CUBE_STAGE_DEEP_NO_DIAG, '0');
  const forbidden = () => { throw Error('Do not re-inspect tables for a frozen choice'); };
  assert.equal(selectStatsStandardStageMode(selected, 0, forbidden, 128 * GiB), selected);
  assert.equal(selectStatsStandardStageMode(low, 128 * GiB, forbidden, 128 * GiB), low);
  assert.equal(calls, 2);
  for (const explicit of [{ CUBE_STAGE_JOINT_MODE: 'off' }, { CUBE_STAGE_JOINT_MODE: 'deep' },
    { CUBE_STAGE_JOINT_MODE: 'both', CUBE_STAGE_DEEP_NO_DIAG: '1' }, { CUBE_STAGE_DEEP_NO_DIAG: '0' }]) {
    const env = { ...fullStdEnv, ...explicit };
    assert.equal(selectStatsStandardStageMode(env, 0, forbidden, 128 * GiB), env);
  }
  for (const env of [{}, { CUBE_RUN_FULL_STD: '1' }, { CUBE_ALLOW_HUGE_TABLES: '1' },
    { ...fullStdEnv, CUBE_TABLE_PROFILE: 'default' }])
    assert.equal(selectStatsStandardStageMode(env, 128 * GiB, forbidden, 128 * GiB).CUBE_STAGE_JOINT_MODE, 'off');
  assert.equal(selectStatsStandardStageMode(fullStdEnv, 128 * GiB, forbidden, 128 * GiB - 1).CUBE_STAGE_JOINT_MODE, 'off');
  assert.equal(selectStatsStandardStageMode({ ...fullStdEnv, CUBE_TABLE_PROFILE: 'high-memory' }, required, () => limit, 128 * GiB).CUBE_STAGE_JOINT_MODE, 'deep');
  const missing = () => { throw Object.assign(Error('missing Deep table'), { code: 'ENOENT' }); };
  assert.equal(selectStatsStandardStageMode(fullStdEnv, 128 * GiB, missing, 128 * GiB).CUBE_STAGE_JOINT_MODE, 'off');
  for (const code of ['EACCES', 'EIO', 'ENOTDIR']) assert.throws(() => selectStatsStandardStageMode(fullStdEnv, required,
    () => { throw Object.assign(Error(code), { code }); }, 128 * GiB), new RegExp(code));
  for (const invalid of [0, -1, Number.NaN, Number.MAX_SAFE_INTEGER])
    assert.throws(() => selectStatsStandardStageMode(fullStdEnv, required, () => invalid, 128 * GiB), /budget/);
});

test('standard stage auto validates Rust Deep metadata with exact BigInt checksums', () => {
  const path = '/fixture/pt_cross_C4C6E0E1E2.bin';
  const valid = validateStatsDeepTableMetadata(path, deepMetadata, deepHeader());
  assert.equal(valid.completedDepth, 13); assert.equal(valid.full, true);
  assert.equal(valid.reached, 128_755_722_240); assert.equal(valid.checksum, 'fedcba9876543210');
  for (const change of [{ size: deepMetadata.size - 1 }, { isFile: () => false }, { mtimeMs: Number.NaN }, { ino: 0.5 }, { dev: -1 }])
    assert.throws(() => validateStatsDeepTableMetadata(path, { ...deepMetadata, ...change }, deepHeader()), /metadata/);
  const invalidRecords: Array<Record<number, bigint>> = [{ 0: 2n }, { 1: 1n }, { 2: 257n }, { 3: 510_935_039n }, { 4: 128_755_722_239n },
    { 5: BigInt(Number.MAX_SAFE_INTEGER) + 1n }, { 6: 15n }, { 7: 0n }, { 8: 0n }, { 10: 0n }, { 24: 1n },
    { 6: 11n, 21: 128_755_722_239n, 23: 0n }];
  for (const change of invalidRecords)
    assert.throws(() => validateStatsDeepTableMetadata(path, deepMetadata, deepHeader(change)), /metadata/);
  const corrupt = deepHeader(); corrupt[90] ^= 1;
  assert.throws(() => validateStatsDeepTableMetadata(path, deepMetadata, corrupt), /metadata/);
  const highBitMagic = deepHeader(); highBitMagic[0] |= 0x80; sealDeepRecord(highBitMagic.subarray(0, 512));
  assert.equal(highBitMagic.subarray(0, 8).toString('ascii'), 'STGJPDB1', 'ASCII decoding would hide the invalid byte');
  assert.throws(() => validateStatsDeepTableMetadata(path, deepMetadata, highBitMagic), /metadata/);
  assert.throws(() => validateStatsDeepTableMetadata(path, deepMetadata, deepHeader().subarray(0, 4095)), /metadata/);
  const redundant = deepHeader(); corrupt.copy(redundant, 512, 0, 512);
  assert.equal(validateStatsDeepTableMetadata(path, deepMetadata, redundant).generation, 14, 'Ignore a torn alternate record');
  const pending = deepHeader({ 5: 15n, 7: 0n, 8: 0n }); pending.copy(redundant, 512, 0, 512);
  assert.throws(() => validateStatsDeepTableMetadata(path, deepMetadata, redundant), /metadata/, 'Never fall back past a newer unpublished record');
  deepHeader({ 7: 0n, 8: 0n }).copy(redundant, 512, 0, 512);
  assert.throws(() => validateStatsDeepTableMetadata(path, deepMetadata, redundant), /metadata/, 'Rust chooses the second valid record on a generation tie');
  deepHeader({ 9: 0xfedcba9876543211n }).copy(redundant, 512, 0, 512);
  assert.equal(validateStatsDeepTableMetadata(path, deepMetadata, redundant).checksum, 'fedcba9876543211');
});

test('standard stage read-only plan uses the real full-std flags and exposes optional Deep budget', () => {
  const directory = '/fixture/tables', path = join(directory, 'pt_cross_C4C6E0E1E2.bin');
  let headerReads = 0;
  const inspect = ((file: string) => file === path ? deepMetadata : { ...deepMetadata, size: 100 }) as NonNullable<Parameters<typeof tableBudget>[3]>;
  const context = { available: 128 * GiB, physicalBytes: 128 * GiB, inspect,
    readHeader: (file: string) => { assert.equal(file, path); headerReads++; return deepHeader(); } };
  const env = { CUBE_TABLE_DIR: directory, CUBE_ALLOW_HUGE_TABLES: '1' };
  const [high] = statsResourcePlan(['std_analyzer'], env, false, context) as any[];
  assert.equal(high.tableBytes, deepMetadata.size + 900);
  assert.equal(high.rssLimit, high.tableBytes + 4 * GiB);
  assert.equal(high.startupRequiredBytes, high.rssLimit + 2.5 * GiB);
  assert.equal(high.standardStageSelection.selected, 'deep'); assert.equal(high.standardStageSelection.noDiagonal, '1');
  assert.equal(high.standardStageSelection.frozen, false);
  assert.equal(high.standardStageSelection.optionalDeep.budget.rssLimit, high.rssLimit);
  assert(!high.files.some((file: any) => file.path.endsWith('pt_cross_C4C6E0E2.bin')));
  const [low] = statsResourcePlan(['std_analyzer'], env, false, { ...context, available: high.startupRequiredBytes - 1 }) as any[];
  assert.equal(low.standardStageSelection.selected, 'off'); assert.equal(low.tableBytes, 1000);
  assert.equal(low.standardStageSelection.optionalDeep.startupRequiredBytes, high.startupRequiredBytes);
  assert.equal(headerReads, 2);
  const missing = ((file: string) => {
    if (file === path) throw Object.assign(Error('absent'), { code: 'ENOENT' });
    return inspect(file);
  }) as Parameters<typeof tableBudget>[3];
  const [fallback] = statsResourcePlan(['std_analyzer'], env, false, { ...context, inspect: missing }) as any[];
  assert.equal(fallback.standardStageSelection.optionalStatus, 'missing'); assert.equal(fallback.tableBytes, 1000);
  assert.equal(headerReads, 2, 'Missing metadata must not open the payload');
  const [damaged] = statsResourcePlan(['std_analyzer'], env, false, { ...context, readHeader: () => Buffer.alloc(4096) }) as any[];
  assert.match(damaged.error, /DeepSeven metadata/); assert.equal(damaged.tableBytes, undefined);
  const [explicit] = statsResourcePlan(['std_analyzer'], { ...env, CUBE_STAGE_JOINT_MODE: 'off' }, false,
    { ...context, readHeader: () => { throw Error('Explicit off must not inspect Deep'); } }) as any[];
  assert.equal(explicit.standardStageSelection.requested, 'explicit'); assert.equal(explicit.tableBytes, 1000);
});

test('daily SQ1 ladder budgets every rung and skips only optional attempts below the unchanged threshold', () => {
  assert.deepEqual(sq1GrindLadder.map(rung => [rung.budget, rung.split]), [[240_000_000, 0], [240_000_000, 2], [300_000_000, 2]]);
  const fixture = mkdtempSync(join(tmpdir(), 'stats-sq1-plan-'));
  try {
    // Metadata-only fixture: budget arithmetic never allocates or reads a table.
    writeFileSync(join(fixture, 'sq1_wca_jsqfull.bin'), 'fixture');
    const plan = sq1GrindResourcePlan({ CUBE_TABLE_DIR: fixture });
    assert.equal(plan.length, 3);
    for (const [index, item] of plan.entries()) {
      assert(!('error' in item));
      const entries = sq1GrindLadder[index].budget;
      assert.equal(item.rssLimit, 7 + entries * 114 + 4 * GiB);
      assert.equal(item.startupRequiredBytes, item.rssLimit + 2.5 * GiB);
      assert.equal(statsAnalyzerStartupDecision(item.startupRequiredBytes, item.rssLimit, true), 'start');
      assert.equal(statsAnalyzerStartupDecision(item.startupRequiredBytes - 1, item.rssLimit, true), 'skip');
      assert.equal(statsAnalyzerStartupDecision(item.startupRequiredBytes - 1, item.rssLimit, false), 'reject');
    }
    const actualHighCap = 13_005_619_200 + 300_000_000 * 114 + 4 * GiB;
    assert.equal(startupRequiredBytes(actualHighCap), 54_184_941_056);
    assert.equal(statsAnalyzerStartupDecision(47 * GiB, actualHighCap, true), 'skip');
    assert.equal(statsAnalyzerStartupDecision(47 * GiB, actualHighCap, false), 'reject');
  } finally { rmSync(fixture, { recursive: true, force: true }); }
});

test('completed reviewed stop archives original bytes before clearing only the matching active latch', () => {
  const dir = mkdtempSync(join(tmpdir(), 'stats-stop-archive-'));
  const run = join(dir, 'run'); mkdirSync(run);
  const path = join(dir, 'protected-stop.json'), reviewPath = join(dir, 'resume-review.json');
  const bytes = Buffer.from('{"baseline":{"boot":"123","swapouts":0}, "reason":"earlier stop"}\n');
  const sha256 = createHash('sha256').update(bytes).digest('hex'), reviewed = { path, sha256 };
  const review = JSON.stringify({ stopPath: path, stopSha256: sha256, reason: 'Reviewed resources' });
  try {
    writeFileSync(path, bytes); writeFileSync(reviewPath, review);
    assert.throws(() => archiveReviewedStatsStop(dir, join(dir, 'missing-directory'), reviewed));
    assert.deepEqual(readFileSync(path), bytes);
    assert.equal(archiveReviewedStatsStop(dir, run, reviewed), true);
    assert.deepEqual(readFileSync(join(run, 'reviewed-protected-stop.json')), bytes);
    assert.equal(readFileSync(join(run, 'completed-resume-review.json'), 'utf8'), review);
    assert.equal(existsSync(path), false); assert.equal(existsSync(reviewPath), false);
    assert.equal(archiveReviewedStatsStop(dir, run, reviewed), false);
    writeFileSync(path, '{"reason":"new stop"}'); writeFileSync(reviewPath, review);
    assert.equal(archiveReviewedStatsStop(dir, run, reviewed), false);
    assert.equal(readFileSync(path, 'utf8'), '{"reason":"new stop"}');
    assert.equal(readFileSync(reviewPath, 'utf8'), review);
    assert.deepEqual(readFileSync(join(run, 'reviewed-protected-stop.json')), bytes);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('unexpected monitor exit, including code zero, interrupts a pending action', async () => {
  for (const code of [0, 1]) {
    let failed = false;
    await assert.rejects(runWhileMonitored(() => new Promise(() => {}), Promise.resolve(code), () => { failed = true; }), /monitor exited/);
    assert.equal(failed, true);
  }
  let failed = false;
  let exit!: (code: number) => void;
  const exited = new Promise<number>(done => { exit = done; });
  await runWhileMonitored(async () => {}, exited, () => { failed = true; });
  exit(0);
  await exited;
  assert.equal(failed, false);
});

test('tree tracking retains known orphans, excludes monitor descendants and rejects PID reuse', () => {
  const root = identity(1), original = identity(2), monitor = identity(3);
  const known = new Map([[1, root], [2, original]]);
  const current = new Map([[1, root], [2, original], [3, monitor], [4, identity(4)], [5, identity(5)]]);
  const rows = [row(1, 0), row(2, 0), row(3, 1), row(4, 3), row(5, 2)];
  assert.deepEqual(trackedTree(root, known, rows, current, 3).map(p => p.pid), [1, 2, 5]);
  current.set(2, identity(2, 'unrelated', 'Wed Oct 21 12:01:00 2026'));
  current.set(5, identity(5, 'unrelated-child'));
  assert.deepEqual(trackedTree(root, known, rows, current, 3).map(p => p.pid), [1]);
  assert.equal(sameIdentity(original, current.get(2)), false);
  assert.deepEqual(parseIdentities(' 2 Wed Oct  7 12:00:00 2026 /path with spaces --arg\n'), [{ pid: 2, start: 'Wed Oct 7 12:00:00 2026', command: '/path with spaces --arg' }]);
});

test('completion refreshes stale snapshots and only ignores explicit zombies', () => {
  const root = identity(1), child = identity(2, '(pair_analyzer)');
  const known = new Map([[1, root], [2, child]]);
  const stale = { rows: [row(1, 0), row(2, 1)], identities: new Map([[1, root], [2, child]]) };
  assert.deepEqual(trackedTree(root, known, stale.rows, stale.identities, -1).map(p => p.pid), [1, 2]);
  let reads = 0;
  const reaped = inspectCompletion(root, known, -1, () => {
    reads++;
    return { rows: [row(1, 0)], identities: new Map([[1, root]]) };
  });
  assert.equal(reads, 1);
  assert.deepEqual(reaped.family.map(p => p.pid), [1]);
  assert.deepEqual(reaped.survivors, []);

  const inspect = (state: string) => inspectCompletion(root, known, -1, () => ({
    ...stale, rows: [row(1, 0), { ...row(2, 1, 0), state }],
  }));
  for (const state of ['Z', 'Z+']) {
    assert.deepEqual(inspect(state).survivors, []);
    assert.equal(inspect(state).family[1].state, state, 'Retain terminal process state for audit');
  }
  for (const state of ['R', 'S', 'T', 'U', 'D', 'I', '', '?', 'X']) {
    assert.deepEqual(inspect(state).survivors.map(p => p.pid), [2], `Do not exempt state ${state}, zero RSS or a parenthesized command`);
  }
});

test('completion retains live grandchildren beneath zombies and fails closed on unknown service state', () => {
  const root = identity(1), zombie = identity(2, '(pair_analyzer)'), worker = identity(3), monitor = identity(4);
  const current = new Map([[1, root], [2, zombie], [3, worker], [4, monitor], [5, identity(5)]]);
  const inspected = inspectCompletion(root, new Map(), 4, () => ({
    identities: current,
    rows: [row(1, 0), { ...row(2, 1), state: 'Z' }, row(3, 2), row(4, 1), row(5, 4)],
  }));
  assert.deepEqual(inspected.family.map(p => p.pid), [1, 2, 3]);
  assert.deepEqual(inspected.survivors.map(p => p.pid), [3]);

  const service = identity(2, '/app/node_modules/@esbuild/darwin-arm64/bin/esbuild --service=0.25.0 --ping');
  for (const state of ['S', 'R', '?', '', 'T']) {
    const result = inspectCompletion(root, new Map(), -1, () => ({
      identities: new Map([[1, root], [2, service]]), rows: [row(1, 0), { ...row(2, 1), name: 'esbuild', state }],
    }));
    assert.deepEqual(result.survivors.map(p => p.pid), ['S', 'R'].includes(state) ? [] : [2]);
  }
});

test('resume review binds exact retained proof and cannot refresh its original baseline', () => {
  const stop = { path: '/retained-stop.json', sha256: 'abc', baseline: observation };
  const review = { schema: 'cuberoot.stats-resource-review/v1', stopPath: stop.path, stopSha256: stop.sha256, boot: '123', swapouts: 0, reason: 'Explicitly reviewed', reviewedAt: '2026-10-21T12:00:00Z' };
  validateResumeReview(review, stop, observation);
  for (const change of [{ stopSha256: 'def' }, { swapouts: 1 }, { boot: '456' }, { reason: '' }])
    assert.throws(() => validateResumeReview({ ...review, ...change }, stop, observation));
  assert.throws(() => validateResumeReview(review, stop, { ...observation, swapouts: 1 }));
});

test('actual idle tsx fixture only exempts its esbuild service from completion', { skip: process.platform !== 'darwin', timeout: 8000 }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'stats-monitor-tsx-'));
  const file = join(dir, 'fixture.ts');
  writeFileSync(file, 'const pid: number = process.pid; console.log(pid); setTimeout(() => {}, 2000);\n');
  const child = spawn(resolve('core/node_modules/.bin/tsx'), [file], { stdio: ['ignore', 'pipe', 'inherit'] });
  const closed = once(child, 'close');
  try {
    const [data] = await once(child.stdout, 'data');
    const pid = Number(String(data).trim());
    assert(Number.isSafeInteger(pid));
    const identities = new Map(parseIdentities(execFileSync('/bin/ps', ['-axo', 'pid=,lstart=,command='], { encoding: 'utf8', env: { ...process.env, LC_ALL: 'C' } })).map(p => [p.pid, p]));
    const rows = parseProcesses(execFileSync('/bin/ps', ['-axo', 'pid,ppid,rss,pcpu,stat,comm'], { encoding: 'utf8' }));
    const descendants = trackedTree(identities.get(pid)!, new Map(), rows, identities, -1).filter(p => p.pid !== pid);
    assert.equal(descendants.length, 1);
    assert.equal(isTsxService(descendants[0], identities.get(descendants[0].pid)), true);
    assert.equal(isTsxService({ ...descendants[0], name: 'eo_cross_analyzer' }, identities.get(descendants[0].pid)), false);
    assert.equal(isTsxService(descendants[0], identity(descendants[0].pid, '/tmp/esbuild --service=0.25.0 --ping')), false);
    await closed;
  } finally { child.kill('SIGTERM'); await closed; rmSync(dir, { recursive: true, force: true }); }
});

test('isolated real watcher completes normally and fails closed before child-close continuation', { skip: process.platform !== 'darwin', timeout: 25000 }, async () => {
  const temporary = mkdtempSync(join(tmpdir(), 'stats-monitor-lifecycle-'));
  const fixture = join(temporary, 'entry.mts');
  const scheduler = `
    const { spawn } = require('node:child_process');
    const { writeFileSync } = require('node:fs');
    const state = process.argv[1];
    process.on('SIGTERM', () => {});
    const work = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)']);
    writeFileSync(state + '/work.pid', String(work.pid));
    work.on('close', () => writeFileSync(state + '/unexpected-child-continuation', 'BUG'));
    setInterval(() => {}, 1000);
  `;
  writeFileSync(fixture, `
    import { spawn } from 'node:child_process';
    import { mkdirSync, writeFileSync } from 'node:fs';
    import { createHash } from 'node:crypto';
    import { once } from 'node:events';
    import { registerStatsSummary, withStatsResourceMonitor } from ${JSON.stringify(resolve('scripts/stats/resource-monitor.ts'))};
    import { observeStatsResources } from ${JSON.stringify(resolve('solver/experiments/cube48opt-rust/stats-resume-review.mts'))};
    if (process.argv[3].startsWith('reviewed-')) {
      const state = process.argv[2]; mkdirSync(state, { recursive: true });
      const baseline = observeStatsResources(); baseline.boot = baseline.boot.match(/sec\\s*=\\s*(\\d+)/)[1];
      const bytes = Buffer.from(JSON.stringify({ baseline, reason: 'Fixture retained stop' }) + '\\n');
      const stopPath = state + '/protected-stop.json';
      writeFileSync(stopPath, bytes); writeFileSync(state + '/initial-stop.json', bytes);
      writeFileSync(state + '/resume-review.json', JSON.stringify({ schema: 'cuberoot.stats-resource-review/v1', stopPath,
        stopSha256: createHash('sha256').update(bytes).digest('hex'), boot: baseline.boot, swapouts: baseline.swapouts,
        reason: 'Fixture resource review', reviewedAt: new Date().toISOString() }));
    }
    await withStatsResourceMonitor(async () => {
      if (process.argv[3] === 'normal') return;
      if (process.argv[3].startsWith('reviewed-')) {
        if (process.argv[3] === 'reviewed-failed') throw Error('Fixture action failure');
        if (process.argv[3] === 'reviewed-partial') process.exitCode = 2;
        return;
      }
      writeFileSync(process.argv[2] + '/summary.json', JSON.stringify({ status: 'running' }));
      registerStatsSummary(process.argv[2] + '/summary.json');
      const child = spawn(process.execPath, ['-e', ${JSON.stringify(scheduler)}, process.argv[2]]);
      writeFileSync(process.argv[2] + '/scheduler.pid', String(child.pid));
      await once(child, 'close');
      writeFileSync(process.argv[2] + '/unexpected-continuation', 'BUG');
      await new Promise(() => {});
    }, process.argv[2]);
  `);
  const waitFor = async (condition: () => boolean) => {
    const deadline = Date.now() + 8000;
    while (!condition()) {
      if (Date.now() > deadline) throw Error('Lifecycle fixture readiness timeout');
      await new Promise(done => setTimeout(done, 25));
    }
  };
  try {
    for (const mode of ['normal', 'crash', 'protected-stop', 'reviewed-complete', 'reviewed-partial', 'reviewed-failed']) {
      const state = join(temporary, mode);
      const child = spawn(process.execPath, [...process.execArgv, fixture, state, mode], { stdio: ['ignore', 'pipe', 'pipe'] });
      let output = '';
      child.stdout.on('data', data => { output += data; }); child.stderr.on('data', data => { output += data; });
      const closed = once(child, 'close');
      let watcher: number | undefined, work: number | undefined, schedulerPid: number | undefined;
      try {
        if (mode === 'crash' || mode === 'protected-stop') {
          await waitFor(() => existsSync(join(state, 'work.pid')) || child.exitCode !== null);
          assert.equal(child.exitCode, null, output);
          work = Number(readFileSync(join(state, 'work.pid'), 'utf8'));
          schedulerPid = Number(readFileSync(join(state, 'scheduler.pid'), 'utf8'));
          const run = join(state, 'runs', readdirSync(join(state, 'runs'))[0]);
          watcher = JSON.parse(readFileSync(join(run, 'owner.json'), 'utf8')).monitor.pid;
          if (mode === 'crash') process.kill(watcher!, 'SIGKILL');
          else writeFileSync(join(run, 'request-stop.json'), JSON.stringify({ reason: 'Fixture resource protection' }));
        }
        const [code, signal] = await closed;
        assert.equal(code, mode === 'protected-stop' ? null : mode === 'crash' || mode === 'reviewed-failed' ? 1 : mode === 'reviewed-partial' ? 2 : 0, output);
        if (mode === 'protected-stop') assert.equal(signal, 'SIGKILL', output);
        assert.equal(existsSync(join(state, 'protected-stop.json')), ['crash', 'protected-stop', 'reviewed-failed'].includes(mode));
        assert.equal(existsSync(join(state, 'unexpected-continuation')), false);
        assert.equal(existsSync(join(state, 'unexpected-child-continuation')), false);
        if (mode.startsWith('reviewed-')) {
          const run = join(state, 'runs', readdirSync(join(state, 'runs'))[0]);
          const initial = readFileSync(join(state, 'initial-stop.json'));
          assert.equal(existsSync(join(state, 'resume-review.json')), mode === 'reviewed-failed');
          if (mode === 'reviewed-failed') {
            assert.deepEqual(readFileSync(join(state, 'protected-stop.json')), initial);
            assert.equal(existsSync(join(run, 'reviewed-protected-stop.json')), false);
          } else assert.deepEqual(readFileSync(join(run, 'reviewed-protected-stop.json')), initial);
        }
        else if (mode === 'normal') assert.equal(existsSync(join(state, 'active.lock')), false);
        else {
          const stop = JSON.parse(readFileSync(join(state, 'protected-stop.json'), 'utf8'));
          assert.equal(stop.reason, mode === 'crash' ? 'Statistics resource monitor failed' : 'Fixture resource protection');
          assert.equal(JSON.parse(readFileSync(join(state, 'summary.json'), 'utf8')).status, 'protected-stop');
          for (const pid of [schedulerPid, work]) await waitFor(() => { try { process.kill(pid!, 0); return false; } catch { return true; } });
        }
      } finally {
        if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
        for (const pid of [watcher, schedulerPid, work]) if (pid) { try { process.kill(pid, 'SIGKILL'); } catch { /* fixture exited */ } }
        await closed;
      }
    }
  } finally { rmSync(temporary, { recursive: true, force: true }); }
});
