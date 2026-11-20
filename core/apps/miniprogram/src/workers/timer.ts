import { createTimerTrainerWorkerHandler, type TrainerWorkerRequest } from '@cuberoot/shared/timer/random-difficulty-worker';
import { generateSeededBasicWcaScramble } from '@cuberoot/shared/timer/seeded/wca';
import type { NativeTimerProjectScrambleRequest, NativeWcaScrambleRequest, NativeWcaWorkerScrambleRequest } from '../lib/native-timer-random-scramble';
import type { NativeTimerWorkerEnvelope } from '../lib/native-timer-worker';
import { handleNativeLiveAnalysis } from './live-analysis';

declare const worker: {
  onMessage(listener: (message: NativeTimerWorkerEnvelope) => void): void;
  postMessage(message: NativeTimerWorkerEnvelope): void;
};

const handleTrainer = createTimerTrainerWorkerHandler();
worker.onMessage(async (envelope) => {
  if (envelope.channel === 'live-analysis') {
    await handleNativeLiveAnalysis(envelope, message => worker.postMessage(message));
    return;
  }
  if (envelope.channel === 'trainer') {
    const payload = envelope.payload as { id: number; request: TrainerWorkerRequest };
    worker.postMessage({ ...envelope, payload: handleTrainer(payload) });
    return;
  }
  const { id, request } = envelope.payload as { id: number; request: unknown };
  try {
    let value: unknown;
    if (envelope.channel === 'stage-solver') {
      const { handleStageSolverPayload } = require('./stage-solver.js') as {
        handleStageSolverPayload(request: unknown): Promise<unknown>;
      };
      value = await handleStageSolverPayload(request);
    } else if (envelope.channel === 'wca-scramble') {
      const scramble = request as NativeWcaWorkerScrambleRequest;
      if ('ticket' in scramble) value = generateSeededBasicWcaScramble(scramble);
      else {
        const { handleWcaScramblePayload } = require('./wca-scramble.js') as {
          handleWcaScramblePayload(request: NativeWcaScrambleRequest | NativeTimerProjectScrambleRequest): Promise<string>;
        };
        value = await handleWcaScramblePayload(scramble);
      }
    } else if (envelope.channel === 'sq1-hint') {
      const { solveSq1Hint } = require('./sq1-hint.js') as { solveSq1Hint(scramble: string): string };
      if (typeof request !== 'string') throw new Error('Invalid Square-1 scramble');
      value = solveSq1Hint(request);
    } else if (envelope.channel === 'timer-preview') {
      const { handleTimerPreviewPayload } = require('./wca-scramble.js') as {
        handleTimerPreviewPayload(request: unknown): Promise<string | null>;
      };
      value = await handleTimerPreviewPayload(request);
    } else return;
    worker.postMessage({ ...envelope, payload: { id, ok: true, value } });
  } catch (error) {
    worker.postMessage({
      ...envelope, payload: { id, ok: false, error: error instanceof Error ? error.message : String(error) },
    });
  }
});
