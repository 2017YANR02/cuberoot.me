import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { createContext, runInContext } from 'node:vm';
import { extractFunction } from '../../tests/_cstimer_sandbox';

// Read-only oracle. No copied/reimplemented regression or edits to tools/cstimer.
// csTimer is already credited in about/credits_data.json. Keep its license in cache.
export const CSTIMER_COMMIT = '103f4c2ccdddc0d0c3a574aac1f3e378d02a06e5';
export const CSTIMER_FILES = {
  'src/js/tools/bluetoothutil.js': 'ae2904ea3dd392c001716edcfa6f371f8f0f9bd5e2081ddcfbedff8091b86dff',
  'src/js/timer/giiker.js': '2d61926d8237ed08c51d244de1a5221478799f099d65ac076739bc2962f295ab',
  LICENSE: '589ed823e9a84c56feb95ac58e7cf384626b9cbf4fda2a907bc36e103de1bad2',
} as const;

export function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

export type CstimerRow = [move: string, deviceMs: number | null, localMs: number | null];
export interface CstimerInput { row: CstimerRow; arrivalMs: number }
export interface CstimerResult {
  timeMs: number;
  correctedTimesMs: number[];
  slope: number;
  signals: number;
}

export async function loadCstimer(cacheRoot: string, offline = false) {
  const sources: Record<string, string> = {};
  for (const [file, expectedHash] of Object.entries(CSTIMER_FILES)) {
    const path = join(cacheRoot, CSTIMER_COMMIT, file);
    let bytes: Buffer;
    try {
      bytes = await readFile(path);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      if (offline) throw new Error(`Missing pinned csTimer source in offline mode: ${path}`);
      const url = `https://raw.githubusercontent.com/cs0x7f/cstimer/${CSTIMER_COMMIT}/${file}`;
      const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
      if (!response.ok) throw new Error(`csTimer fetch failed: ${response.status} ${url}`);
      bytes = Buffer.from(await response.arrayBuffer());
      assert.equal(sha256(bytes), expectedHash, `Downloaded csTimer source changed: ${file}`);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, bytes);
    }
    // A corrupt cache is an error, never a silent skip or a fallback algorithm.
    assert.equal(sha256(bytes), expectedHash, `Cached csTimer source changed: ${file}`);
    sources[file] = bytes.toString('utf8');
  }

  const utilityFunctions = ['tsLinearFit', 'tsApplyFixes', 'tsLinearFix'];
  const timerFunctions = ['giikerCallback', 'isGiiSolved'];
  const extracted = [
    ...utilityFunctions.map(name => extractFunction(sources['src/js/tools/bluetoothutil.js'], name)),
    ...timerFunctions.map(name => extractFunction(sources['src/js/timer/giiker.js'], name)),
  ];
  const context = createContext({});
  runInContext(`
    'use strict';
    ${extracted.join('\n')}
    var DEBUG = false, enable = true, enableVRC = false;
    var currentFacelet, curPuzzle, rawMoves, totPhases, insTime;
    var hostNow, phase, start, result, saved, corrected, signals;
    var $ = { now: function() { return hostNow; } };
    function noop() {}
    function clearReadyTid() {}
    var kernel = {
      getProp: function() { return 'n'; },
      pushSignal: function(name, value) {
        if (name === 'time') { saved = value[2].slice(); signals++; }
      }
    };
    var cubeutil = {
      getProgress: function(facelet) { return facelet === 'solved' ? 0 : 1; },
      getStepCount: function() { return 1; },
      isFaceletSolved: function(facelet) { return facelet === 'solved'; },
      getPrettyReconstruction: function() { return { totalMoves: 0, prettySolve: '' }; },
      getConjMoves: function(value) { return value; },
      moveSeq2str: function(rows) { corrected = rows.map(function(row) { return row[1]; }); return ''; }
    };
    var giikerutil = { tsLinearFix: tsLinearFix, reSync: noop, setLastSolve: noop };
    var timer = {
      status: function(value) { if (value !== undefined) phase = value; return phase; },
      startTime: function(value) { if (value !== undefined) start = value; return start; },
      curTime: function(value) { if (value !== undefined) result = value; return result; },
      checkUseIns: function() { return false; },
      updateMulPhase: noop,
      lcd: { reset: noop, fixDisplay: noop }
    };
    function runSolve(input) {
      // The same armed, single-phase, no-inspection solve as CubeRoot below.
      currentFacelet = 'scrambled'; curPuzzle = '333'; rawMoves = [];
      phase = -2; start = 0; result = []; saved = null; corrected = []; signals = 0;
      var rows = input.map(function(event) { return event.row.slice(); });
      var fit = tsLinearFit(tsApplyFixes(rows));
      input.forEach(function(event, index) {
        hostNow = event.arrivalMs;
        giikerCallback(index === input.length - 1 ? 'solved' : 'scrambled',
          [event.row[0]], [event.row[1], event.row[2]], '333');
      });
      return { timeMs: saved && saved[1], correctedTimesMs: corrected, slope: fit[0], signals: signals };
    }
  `, context, { timeout: 1000, filename: `cstimer-${CSTIMER_COMMIT}-timing.js` });

  return {
    functionHashes: Object.fromEntries([...utilityFunctions, ...timerFunctions]
      .map((name, index) => [name, sha256(extracted[index])])),
    run(input: CstimerInput[]): CstimerResult {
      context.input = structuredClone(input);
      const result = runInContext('runSolve(input)', context, { timeout: 1000 }) as CstimerResult;
      assert.equal(result.signals, 1, 'Actual csTimer callback must emit exactly one saved solve');
      assert.ok(Number.isFinite(result.timeMs), 'csTimer saved time must be finite');
      assert.equal(result.correctedTimesMs.length, input.length);
      assert.equal(result.timeMs, result.correctedTimesMs.at(-1));
      return structuredClone(result);
    },
  };
}
