import { planDirectYellowCrossSetup, planLessonSetup, type LessonSetupRequest } from './lesson-setup';

const worker = self as unknown as DedicatedWorkerGlobalScope;
worker.onmessage = async ({ data }: MessageEvent<LessonSetupRequest>) => {
  const nearby = planLessonSetup(data);
  if (nearby || data.stage !== 'yellow-cross') {
    worker.postMessage(nearby ?? null);
    return;
  }
  const { m2pScrambleForFacelets } = await import('@/lib/m2p-scramble');
  worker.postMessage(await planDirectYellowCrossSetup(data, m2pScrambleForFacelets) ?? null);
};
