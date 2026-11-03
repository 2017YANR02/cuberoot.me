import { parentPort, workerData } from 'node:worker_threads';
import sharp from 'sharp';
import { resizePhotoPixels } from '@cuberoot/shared/cube-photo/pixels';
import { locateCubePhoto, analyzeCubePhoto } from '@cuberoot/shared/cube-photo/analyze';
import { recognizePhoto } from '@cuberoot/shared/cube-photo/recognize';
import { photoAlgSets, type PhotoAlgSet } from '@cuberoot/shared/cube-photo/lookup';
import type { CubePhotoResult } from '@cuberoot/shared/cube-photo/result';
import type { AlgFile } from '@cuberoot/shared/alg';
import type { AssistantImage } from '@cuberoot/shared/site-assistant';

const port = parentPort!;
const input = workerData as { image: AssistantImage; sets?: PhotoAlgSet[] };
sharp.cache(false);
sharp.concurrency(1);
try {
  const { data, info } = await sharp(Buffer.from(input.image.data, 'base64'), { limitInputPixels: 16_000_000, failOn: 'error' })
    .rotate().toColourspace('srgb').ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const pixels = resizePhotoPixels({ width: info.width, height: info.height, data: new Uint8ClampedArray(data) });
  const { corners } = locateCubePhoto(pixels);
  const result: CubePhotoResult = { width: pixels.width, height: pixels.height, corners, status: 'no-grid',
    results: [], requestedSets: input.sets, assumptions: { f2lSolved: true, standardColorScheme: true } };
  if (!corners) { port.postMessage({ type: 'result', result }); port.close(); }
  else {
    const recognition = recognizePhoto(pixels, corners);
    Object.assign(result, { recognition, status: recognition.status });
    if (recognition.status !== 'ok') { port.postMessage({ type: 'result', result }); port.close(); }
    else {
      const sets = photoAlgSets(recognition.candidates[0].facelet).filter(set => !input.sets || input.sets.includes(set));
      port.once('message', async (libraries: Partial<Record<PhotoAlgSet, AlgFile>>) => {
        try {
          const analysis = await analyzeCubePhoto({ pixels, corners, corrections: {}, sets }, async set => {
            if (!libraries[set]) throw new Error('catalog_unavailable');
            return libraries[set]!;
          });
          port.postMessage({ type: 'result', result: { ...result, ...analysis } });
        } catch { port.postMessage({ type: 'error' }); }
        finally { port.close(); }
      });
      port.postMessage({ type: 'catalogs', sets });
    }
  }
} catch { port.postMessage({ type: 'error' }); port.close(); }
