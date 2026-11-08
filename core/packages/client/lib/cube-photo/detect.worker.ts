/// <reference lib="webworker" />
import { locateCubePhotoAuto } from '@cuberoot/shared/cube-photo/analyze';
import type { PhotoWorkerRequest, PhotoWorkerReply, PhotoDetectionMessage, PhotoDetectionInput } from './workers';

self.onmessage = (event: MessageEvent<PhotoWorkerRequest<PhotoDetectionInput>>) => {
  if ('cancel' in event.data) return;
  const { id, input } = event.data;
  const send = (message: PhotoDetectionMessage) => self.postMessage({ id, message } satisfies PhotoWorkerReply<PhotoDetectionMessage>);
  try {
    const start = performance.now();
    const { detection, puzzleSize } = locateCubePhotoAuto(input, input.puzzleSize);
    send({ detection, puzzleSize, elapsedMs: Math.round(performance.now() - start) });
  } catch {
    send({ error: 'detection_failed' });
  }
};
export {};
