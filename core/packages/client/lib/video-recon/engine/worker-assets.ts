export const VIDEO_RECON_ASSETS = '/vendor/video-recon/';

type WorkerName = 'inference' | 'capture' | 'pose' | 'move-search' | 'move-search-side';

export function createVideoWorker(name: WorkerName): Worker {
  return new Worker(`${VIDEO_RECON_ASSETS}workers/${name}.js`, { type: 'module' });
}
