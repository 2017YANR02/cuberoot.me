import { random333Scramble, setIsInsideWorker } from 'watch-cubing-333';
import { smartCubeTargetFacelets } from '@cuberoot/shared/smart-cube/cubie';

// Only runs on the native serial generation queue, never the UI/BLE queue.
setIsInsideWorker(true);
Object.assign(globalThis, { crypto: { getRandomValues(array: Uint32Array) {
  if (!(array instanceof Uint32Array) || array.byteLength > 65536) throw new Error('Invalid random buffer');
  for (let i = 0; i < array.length; i++) array[i] = (globalThis as any).__watchRandomUInt32();
  return array;
} } });
let result: unknown = null;
(globalThis as any).WatchScramble = {
  start() {
    result = null;
    random333Scramble().then(alg => {
      const scramble = alg.toString();
      result = { scramble, facelets: smartCubeTargetFacelets(scramble) };
    }).catch(error => { result = { error: String(error) }; });
  },
  result: () => JSON.stringify(result),
};
