// guard-registry: tracked at /dev/guards (app/[lang]/dev/guards/_guards.ts)
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { decodeGyroTrack } from '@/app/[lang]/timer/_lib/bluetooth/gyro_track';
import { buildCoreTrack } from '@/app/[lang]/timer/_lib/reconstruct/core_track';
import { computeF2lSlots } from '@/app/[lang]/timer/_lib/reconstruct/f2l_slots';
import { initialPoseRotation, normalizeSolve } from '@/app/[lang]/timer/_lib/reconstruct/orient';
import { buildReconText } from '@/app/[lang]/timer/_lib/reconstruct/recon_text';
import { computeStageSegments } from '@/app/[lang]/timer/_lib/reconstruct/stage_segments';
import { computeStepMetrics } from '@/app/[lang]/timer/_lib/reconstruct/step_metrics';
import { decodeReplayParam } from '@/app/[lang]/timer/_lib/share/decode';

interface GroundTruthFixture {
  id: string;
  source: string;
  replay: string;
  truth: string;
  currentWrong: string;
  note: string;
}

const HERE = dirname(fileURLToPath(import.meta.url));
const CLIENT_ROOT = join(HERE, '..');
const SYNC_SCRIPT = join(CLIENT_ROOT, 'scripts', 'sync-recon-ground-truth.mjs');
const SNAPSHOT_PATH = join(HERE, 'fixtures', 'recon-ground-truth.json');

const syncCheck = spawnSync(process.execPath, [SYNC_SCRIPT, 'check'], {
  cwd: CLIENT_ROOT,
  encoding: 'utf8',
});
if (syncCheck.status !== 0) {
  throw new Error(syncCheck.stderr.trim() || 'ground-truth snapshot check failed');
}

const snapshot = JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8')) as {
  version?: unknown;
  fixtures?: unknown;
};
if (snapshot.version !== 1 || !Array.isArray(snapshot.fixtures) || snapshot.fixtures.length === 0) {
  throw new Error('recon-ground-truth.json 格式错误或没有 fixture');
}
const FIXTURES = snapshot.fixtures as GroundTruthFixture[];

function expectedFromTruth(truth: string): {
  scramble: string;
  inspection: string;
  lines: Array<{ moves: string[]; label: string }>;
} {
  const [scramble, inspectionLine, ...stepLines] = truth.split('\n');
  return {
    scramble,
    inspection: inspectionLine.split('//')[0].trim(),
    lines: stepLines.map((line) => {
      const [movesText, label = ''] = line.split(/\s+\/\/\s+/);
      return {
        // The manager exports canonical moves, but this scan keeps the regression
        // parser tolerant of older snapshots with glued notation such as D2U'.
        moves: movesText.match(/[xyzMESUDFBLRudfblr](?:2'?|')?/g) ?? [],
        label: label.trim(),
      };
    }),
  };
}

describe('reconstruction ground truth', () => {
  for (const fixture of FIXTURES) {
    it(fixture.id, async () => {
      const replay = decodeReplayParam(fixture.replay);
      if (!replay) throw new Error(`fixture ${fixture.id}: invalid replay`);
      const segs = computeStageSegments(replay.scramble, replay.moves, replay.totalMs)!;
      const metrics = computeStepMetrics(replay.scramble, replay.moves, replay.totalMs)!;
      const slots = computeF2lSlots(replay.scramble, replay.moves, replay.totalMs, segs);
      const samples = replay.gyro ? decodeGyroTrack(replay.gyro) : [];
      const view = normalizeSolve(replay.scramble, replay.moves, {
        preferredRotation: initialPoseRotation(samples, replay.device?.model),
      });
      const core = replay.device && samples.length > 0
        ? buildCoreTrack(samples, { brand: replay.device.model })
        : null;
      const result = await buildReconText({
        scramble: view.scramble,
        moves: view.moves,
        totalMs: replay.totalMs,
        segs,
        metrics,
        slots,
        core,
        physical: { scramble: replay.scramble, moves: replay.moves },
        viewRotation: view.rotation,
      });
      const expected = expectedFromTruth(fixture.truth);
      expect(result.scramble).toBe(expected.scramble);
      expect(result.inspection).toBe(expected.inspection);
      expect(result.lines.map((line) => ({ moves: line.moves, label: line.label }))).toEqual(expected.lines);
    });
  }
});
