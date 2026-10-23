/** Asset-only jobs. Existing distribution reports and their provenance hashes
 * are immutable; the caller validates each histogram, then writes only assets.
 * All jobs run through the original serial resource guard, never on import.
 */
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import type { ResumableExactStates } from './exact-coordinate-bfs.mts';

export const EXACT_DOWNLOAD_JOBS = [
  'assets-tetraminx-pyraminx', 'assets-jingpyraminx', 'assets-pyramorphix', 'assets-pyramorphix-qtm',
  'assets-half', 'assets-lsemu', 'assets-skewb', 'assets-dino-both',
] as const;
export type ExactDownloadJob = typeof EXACT_DOWNLOAD_JOBS[number];
export interface PreparedExactDownload {
  event: string;
  histogram: number[];
  total: number;
  allStates: ResumableExactStates;
}
export interface PreparedExactDownloadJob extends PreparedExactDownload {
  job: ExactDownloadJob;
  preparationMs: number;
  checkpointDirectory: string;
  secondaryExports: PreparedExactDownload[];
}
function prepared(event: string, value: { histogram: readonly number[]; allStates: ResumableExactStates }): PreparedExactDownload {
  const histogram = [...value.histogram], total = histogram.reduce((sum, count) => sum + count, 0);
  assert.equal(total, value.allStates.total, `${event}: stream total differs from histogram`);
  assert(value.allStates.resumeKey && typeof value.allStates.resume === 'function', `${event}: stream is not resumable`);
  return { event, histogram, total, allStates: value.allStates };
}

/** `checkpointDirectory` is a distinct persistent model directory for each job.
 * For assets-dino-both it MUST be the original, already-completed Dino BFS
 * directory. Other jobs save completed distance tables there on first use.
 *
 * The caller validates main and secondary histograms against existing artifacts
 * before writing either export. Consume main then secondary in the same process
 * so Tetraminx/tips and the two Dino metrics share one resident distance table.
 * A writer can resume each stream independently using resumeKey/resume(row).
 */
export async function prepareExactDownloadJob(job: ExactDownloadJob, checkpointDirectory: string): Promise<PreparedExactDownloadJob> {
  assert(EXACT_DOWNLOAD_JOBS.includes(job), `Unknown exact download job: ${job}`);
  assert(checkpointDirectory, 'A persistent checkpoint directory is required');
  const started = performance.now(), options = { checkpointDirectory };
  let main: PreparedExactDownload;
  const secondaryExports: PreparedExactDownload[] = [];
  switch (job) {
    case 'assets-tetraminx-pyraminx': {
      const core = await (await import('./tetraminx-exact-distribution.mts')).enumerateTetraminx(options);
      const { pyraminxTipsAllStates, convolvePyraminxTips } = await import('./derive-pyraminx-tips-distribution.mts');
      main = prepared('tetraminx', core);
      secondaryExports.push(prepared('pyram-tips', { histogram: convolvePyraminxTips(core.histogram),
        allStates: pyraminxTipsAllStates(core.allStates) }));
      break;
    }
    case 'assets-jingpyraminx':
      main = prepared('jingpyraminx', await (await import('./jing-pyraminx-exact-distribution.mts')).enumerateJingPyraminx(options));
      break;
    case 'assets-pyramorphix':
      main = prepared('pyramorphix', await (await import('./pyramorphix-exact-distribution.mts')).enumeratePyramorphix(options));
      break;
    case 'assets-pyramorphix-qtm':
      main = prepared('pyramorphix-qtm', await (await import('./pyramorphix-exact-distribution.mts')).enumeratePyramorphixQtm(options));
      break;
    case 'assets-half':
      main = prepared('half', await (await import('./restricted333-exact-distribution.mts')).enumerateHalfTurnCube(options));
      break;
    case 'assets-lsemu':
      main = prepared('lsemu', await (await import('./restricted333-exact-distribution.mts')).enumerateLseMu(options));
      break;
    case 'assets-skewb':
      main = prepared('skewb', (await import('./skewb-exact-state-downloads.mts')).prepareSkewbStateDownloads(options));
      break;
    case 'assets-dino-both': {
      const dino = (await import('./dino-exact-distribution.mts')).prepareDinoStateDownloads(options);
      main = prepared('dino', dino);
      secondaryExports.push(prepared('dino-mirror', dino.mirrorAccepted));
      break;
    }
  }
  return { ...main, job, preparationMs: performance.now() - started, checkpointDirectory, secondaryExports };
}
