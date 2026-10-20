import { createNativeCubeScene } from '@cuberoot/app-ui/watch-cube-scene';
import './watch-runtime-base64';

let now = 0;
Object.assign(globalThis, { performance: { now: () => now } });
const scene = createNativeCubeScene();
let replay: { dispatch(input: Record<string, any>): unknown; analysisPending(): boolean; dispose(): void } | null = null;
(globalThis as any).WatchScene = {
  assets: () => JSON.stringify(scene.assets()),
  analysisPending: () => replay?.analysisPending() ?? false,
  dispatch(input: Record<string, any>) {
    now = Math.max(now, input.now);
    (globalThis as any).WatchReplay?.tick();
    if (input.kind === 'replay-load') { replay?.dispose(); replay = (globalThis as any).WatchReplay.create(scene, input.record, input.language === 'zh' ? 'zh' : 'en', input.method, input.history, input.capabilities); }
    if (replay) return JSON.stringify(replay.dispatch({ ...input, now }));
    scene.advance(now);
    if (input.kind === 'snapshot') scene.reset(input.facelets);
    if (input.kind === 'move') scene.move(input.move, input.facelets, input.timestamp, now);
    if (input.kind === 'gyro') scene.gyro(input.quaternion);
    if (input.kind === 'gyro-reset') scene.resetOrientation(input.quaternion);
    return JSON.stringify(scene.frame(now));
  },
};
