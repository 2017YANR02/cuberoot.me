import type { Solve } from '@cuberoot/shared/timer';
import { tr } from '@/i18n/tr';
import { persistItem } from '@/lib/safe-storage';
import { readTimerSolves } from '@/lib/video-recon/engine/cube-timer';
import { LocalReplayStorage } from '@/lib/video-recon/engine/timer-replay-cache';
import { cameraTimerMoves } from '../../_shared/useCameraTimerCapture';
import { importNamedSessions, loadAllSessionData } from './db';

const legacyKey = 'live-recognition.timer.v1';
const migratedKey = 'cuberoot.timer.camera-migrated.v1';
let migration: Promise<void> | undefined;

async function migrate() {
  if (localStorage.getItem(migratedKey)) return;
  const legacy = readTimerSolves(localStorage.getItem(legacyKey));
  if (!legacy.length) return;
  const known = new Set(loadAllSessionData().flatMap(({ byEvent }) =>
    Object.values(byEvent).flat().map(solve => solve.id)));
  const replayStorage = new LocalReplayStorage();
  const solves: Solve[] = [];
  for (const solve of legacy) {
    if (known.has(solve.id)) continue;
    const ts = Date.parse(solve.startedAt);
    if (!Number.isFinite(ts)) continue;
    const replay = await replayStorage.load(solve.id).catch(() => undefined);
    const result = replay?.reconstruction;
    const moves = result && await cameraTimerMoves(result, solve.elapsedMs).catch(() => null);
    solves.push({
      id: solve.id, ts, event: '333', scramble: solve.scramble, timeMs: solve.elapsedMs,
      penalty: solve.penalty === 'none' ? 'ok' : solve.penalty,
      moves: moves ?? undefined, videoReconstruction: moves ? 'solved' : 'failed',
    });
  }
  if (!solves.length || importNamedSessions([{
    name: tr({ zh: '摄像头计时', en: 'Camera timer' }), event: '333', solves,
  }])) persistItem(migratedKey, '1');
}

/** Import old local attempts through the ordinary timer's session importer. */
export function importLegacyCameraSession() {
  return migration ??= migrate().finally(() => { migration = undefined; });
}
