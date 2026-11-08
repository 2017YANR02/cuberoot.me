import { parentPort, workerData } from 'node:worker_threads';
import sharp from 'sharp';
import { resizePhotoPixels } from '@cuberoot/shared/cube-photo/pixels';
import { locateCubePhotoAuto, analyzeCubePhoto } from '@cuberoot/shared/cube-photo/analyze';
import { recognizePhoto, recognizeFour } from '@cuberoot/shared/cube-photo/recognize';
import { recognizePocket } from '@cuberoot/shared/cube-photo/pocket';
import { POCKET_EXTENDED_PHOTO_ALG_SETS, photoRecognitionSets, type PhotoAlgSet } from '@cuberoot/shared/cube-photo/lookup';
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
  const { detection, puzzleSize } = locateCubePhotoAuto(pixels);
  const corners = detection.candidates[0]?.corners;
  const result: CubePhotoResult = { width: pixels.width, height: pixels.height, corners, status: 'no-grid',
    results: [], requestedSets: input.sets, assumptions: { f2lSolved: puzzleSize === 3 ? true : 'not-required', standardColorScheme: true, puzzleSize, ...(puzzleSize === 4 ? { pllParity: true } : {}) } };
  if (!corners) { port.postMessage({ type: 'result', result }); port.close(); }
  else {
    let pocketStage: 'eg' | 'last-slot' = input.sets?.some(set => POCKET_EXTENDED_PHOTO_ALG_SETS.some(s => s === set)) ? 'last-slot' : 'eg';
    let recognition = puzzleSize === 4 ? recognizeFour(pixels, corners) : puzzleSize === 2
      ? recognizePocket(pixels, corners, {}, undefined, pocketStage === 'eg' ? 4 : 3) : recognizePhoto(pixels, corners);
    if (puzzleSize === 2 && !recognition.candidates.length && pocketStage === 'eg') {
      const lastSlot = recognizePocket(pixels, corners, {}, undefined, 3);
      if (lastSlot.candidates.length) { recognition = lastSlot; pocketStage = 'last-slot'; }
    }
    if (puzzleSize === 2) result.assumptions.pocketStage = pocketStage;
    Object.assign(result, { recognition, status: recognition.status });
    if (recognition.status === 'corners-only') result.assumptions.f2lSolved = 'not-required';
    if (recognition.status !== 'ok' && recognition.status !== 'corners-only' && recognition.status !== 'partial') { port.postMessage({ type: 'result', result }); port.close(); }
    else {
      const sets = photoRecognitionSets(recognition).filter(set => !input.sets || input.sets.includes(set));
      port.once('message', async (libraries: Partial<Record<PhotoAlgSet, AlgFile>>) => {
        try {
          const analysis = await analyzeCubePhoto({ pixels, corners, puzzleSize, pocketStage, corrections: {}, sets }, async set => {
            if (!libraries[set]) throw new Error('catalog_unavailable');
            return libraries[set]!;
          });
          port.postMessage({ type: 'result', result: { ...result, ...analysis } });
        } catch { port.postMessage({ type: 'error' }); }
        finally { port.close(); }
      });
      port.postMessage({ type: 'catalogs', sets, puzzle: puzzleSize === 4 ? '4x4' : puzzleSize === 2 ? '2x2' : '3x3' });
    }
  }
} catch { port.postMessage({ type: 'error' }); port.close(); }
