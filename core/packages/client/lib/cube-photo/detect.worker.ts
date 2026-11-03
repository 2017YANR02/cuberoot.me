/// <reference lib="webworker" />
import { detectCubePhoto, type PhotoPixels } from './detect';

self.onmessage = (event: MessageEvent<PhotoPixels>) => {
  try {
    const start = performance.now();
    const detection = detectCubePhoto(event.data);
    self.postMessage({ detection, elapsedMs: Math.round(performance.now() - start) });
  } catch {
    self.postMessage({ error: 'detection_failed' });
  }
};
export {};
