/// <reference lib="webworker" />
import { loadAlg } from '@cuberoot/shared/alg';
import { analyzeCubePhoto, type PhotoAnalysisInput, type PhotoAnalysisMessage } from '@cuberoot/shared/cube-photo/analyze';
export type { PhotoAnalysisInput, PhotoAnalysisMessage } from '@cuberoot/shared/cube-photo/analyze';

self.onmessage = async (event: MessageEvent<PhotoAnalysisInput>) => {
  const send = (message: PhotoAnalysisMessage) => self.postMessage(message);
  try {
    await analyzeCubePhoto(event.data, set => loadAlg('3x3', set), send);
  } catch { send({ type: 'error' }); }
};
