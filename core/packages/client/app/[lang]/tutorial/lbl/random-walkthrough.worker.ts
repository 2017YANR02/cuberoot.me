import { normalizeWcaScramble } from '@cuberoot/shared/normalize-wca-scramble';
import { m2pScramble333 } from '@/lib/m2p-scramble';
import { buildWhiteUpWalkthrough } from './complete-demo-state';

export type RandomWalkthrough = ReturnType<typeof buildWhiteUpWalkthrough>;
export type WalkthroughWorkerRequest = { exclude: readonly string[] };
export type WalkthroughWorkerReply = { walkthrough: RandomWalkthrough } | { error: string };

const worker = self as unknown as DedicatedWorkerGlobalScope;
worker.onmessage = async ({ data }: MessageEvent<WalkthroughWorkerRequest>) => {
  const seen = new Set(data.exclude);
  let error = 'Could not generate a different scramble';
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const scramble = await m2pScramble333();
      if (!scramble || seen.has(scramble)) continue;
      // The stage planner uses the yellow-up teaching grip after the first z2.
      const teachingScramble = normalizeWcaScramble(`z2 ${scramble}`);
      if (!teachingScramble) continue;
      const walkthrough = buildWhiteUpWalkthrough(teachingScramble);
      if (seen.has(walkthrough.scramble)) continue;
      worker.postMessage({ walkthrough } satisfies WalkthroughWorkerReply);
      return;
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
    }
  }
  worker.postMessage({ error } satisfies WalkthroughWorkerReply);
};
