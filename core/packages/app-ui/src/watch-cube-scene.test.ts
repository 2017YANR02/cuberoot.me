import { expect, it } from 'vitest';
import { createNativeCubeScene } from './watch-cube-scene';
import { createWatchReplay } from './watch-replay';
import type { WatchTimerRecord } from './watch-timer';
import { smartCubeTargetFacelets } from '@cuberoot/shared/smart-cube/cubie';
import { cubeMove } from '@cuberoot/puzzle-solvers/timer-333-cube';

it('reuses real iOS geometry and turns from an arbitrary connected state, including resync and catch-up', () => {
  const scene = createNativeCubeScene();
  try {
    const assets = scene.assets();
    expect(assets.meshes.map(mesh => mesh.capacity)).toEqual([26,26,26,26,54,54]);
    let facelets = smartCubeTargetFacelets("R U2 F' L D B2")!;
    scene.reset(facelets);
    expect(scene.frame(1000).facelets).toBe(facelets);
    let now = 1000;
    for (const move of ['U','R',"F'",'D','L',"B'"] as const) {
      now += 5000; // first move after idle must animate, not immediately snap.
      scene.advance(now);
      facelets = cubeMove(facelets, move);
      scene.move(move, facelets, now, now);
      expect(scene.frame(now).active).toBe(true);
      const intermediate = scene.frame(now + 30);
      expect(intermediate.updates.some(update => update.id === 1 && update.matrix)).toBe(true);
      expect(scene.frame(now + 120).facelets).toBe(facelets);
    }
    const replacement = smartCubeTargetFacelets("D2 B R' F U")!;
    scene.reset(replacement);
    expect(scene.frame(now + 150).facelets).toBe(replacement);
    const after = cubeMove(replacement, 'R');
    scene.move('R', after, now - 2000, now + 160);
    expect(scene.frame(now + 160).facelets).toBe(after);
    now += 500;
    scene.advance(now);
    const next = cubeMove(after, 'R');
    scene.move('R', next, now, now);
    const latest = cubeMove(next, 'L');
    scene.move('L', latest, now, now);
    expect(scene.frame(now).active).toBe(true);
    scene.frame(now + 30);
    scene.frame(now + 10); // a coalesced gyro sample must not rewind animation time.
    expect(scene.frame(now + 120).facelets).toBe(latest);
    scene.gyro({ w: 1, x: 0, y: 0, z: 0 });
    const initialPose = scene.frame(now + 180).updates.map(update => update.matrix);
    scene.gyro({ w: Math.SQRT1_2, x: 0, y: Math.SQRT1_2, z: 0 });
    expect(scene.frame(now + 200).updates.length).toBe(6);
    scene.resetOrientation({ w: Math.SQRT1_2, x: 0, y: Math.SQRT1_2, z: 0 });
    const recalibrated = scene.frame(now + 220);
    expect(recalibrated.updates.map(update => update.matrix)).toEqual(initialPose);
    expect(recalibrated.facelets).toBe(latest); // pose reset does not alter stickers
  } finally { scene.dispose(); }
});

it('replays the persisted encoder stream through shared indexing and the original scene, including seeking', () => {
  const scene = createNativeCubeScene();
  const record: WatchTimerRecord = { version: 1, id: 'replay', ts: 0, timeMs: 500, penalty: 'ok', inspectionMs: 0,
    slot: { id: 'slot', sessionId: 'session', sessionName: '', event: '333', eventName: '', scramble: 'R', inspectionSec: 0, holdMs: 300 },
    moves: [{ m: 'R', ts: 0 }, { m: 'R', ts: 250 }, { m: 'R', ts: 500 }] };
  try {
    const replay = createWatchReplay(scene, record);
    expect(replay.dispatch({ now: 1000 }).facelets).toBe(smartCubeTargetFacelets('R'));
    replay.dispatch({ kind: 'replay-action', action: {type:'play'}, now: 1000 });
    replay.dispatch({ now: 1500 });
    const done = replay.dispatch({ now: 1700 });
    expect(done.facelets).toBe(smartCubeTargetFacelets(''));
    expect(done.replay.index).toBe(3);
    expect(done.replay.playing).toBe(false);
    expect(done.replay.htm).toBe(1);
    expect(done.replay.tps).toBe(2);
    const back = replay.dispatch({ kind: 'replay-action', action: {type:'seek',value:1}, now: 1800 });
    expect(back.facelets).toBe(smartCubeTargetFacelets('R2'));
    expect(back.replay.timeMs).toBe(0);
    expect(replay.dispatch({ kind: 'replay-action', action: {type:'seek',value:0}, now: 1900 }).facelets).toBe(smartCubeTargetFacelets('R'));
    replay.dispatch({ kind: 'replay-action', action: {type:'play'}, now: 2000 });
    replay.dispatch({ kind: 'replay-pause', now: 2010 });
    replay.dispatch({ kind: 'replay-pause', now: 2020 });
    const awake = replay.dispatch({ now: 100000 });
    expect(awake.replay.playing).toBe(false);
    expect(awake.replay.index).toBe(1);
    expect(awake.replay.timeMs).toBe(0);
  } finally { scene.dispose(); }
});
