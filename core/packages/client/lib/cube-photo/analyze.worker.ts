/// <reference lib="webworker" />
import { loadAlg } from '@cuberoot/shared/alg';
import { analyzeCubePhoto, type PhotoAnalysisInput, type PhotoAnalysisMessage } from '@cuberoot/shared/cube-photo/analyze';
import { PhotoCatalogCache } from './catalog-cache';
import type { PhotoWorkerRequest, PhotoWorkerReply } from './workers';
export type { PhotoAnalysisInput, PhotoAnalysisMessage } from '@cuberoot/shared/cube-photo/analyze';

const catalogs = {
  4: new PhotoCatalogCache((set, fresh) => loadAlg('4x4', set, { fresh })),
  3: new PhotoCatalogCache((set, fresh) => loadAlg('3x3', set, { fresh })),
  2: new PhotoCatalogCache((set, fresh) => loadAlg('2x2', set, { fresh })),
};
let active: { id: number; controller: AbortController } | undefined;
self.onmessage = async (event: MessageEvent<PhotoWorkerRequest<PhotoAnalysisInput>>) => {
  const request = event.data;
  if ('cancel' in request) {
    if (active?.id === request.id) { active.controller.abort(); active = undefined; }
    return;
  }
  active?.controller.abort();
  const controller = new AbortController();
  active = { id: request.id, controller };
  const send = (message: PhotoAnalysisMessage) => {
    if (!controller.signal.aborted) self.postMessage({ id: request.id, message } satisfies PhotoWorkerReply<PhotoAnalysisMessage>);
  };
  try {
    await analyzeCubePhoto(request.input, set => catalogs[request.input.puzzleSize ?? 3].load(set, request.fresh), send, controller.signal);
  } catch { send({ type: 'error' }); }
  finally { if (active?.id === request.id) active = undefined; }
};
