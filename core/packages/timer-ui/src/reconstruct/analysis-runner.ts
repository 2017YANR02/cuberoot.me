import { identifyReplayZbll } from './replay-zbll';
export { identifyReplayZbll } from './replay-zbll';
import { reconstructionLibraries } from './library-cache';
import { runReconstructionNotation } from './analysis-notation';
import { stageReferenceSteps, slotReferenceSteps } from '@cuberoot/shared/timer/reconstruct/reference';
import type { AnalysisWorkerRequest, AnalysisResponse } from './analysis-protocol';

// One request at a time, enforced by analysis-client. Cancellation terminates
// this worker, including an IDA* search that cannot receive a cancel message.
async function runSteps<T>(steps: Generator<void, T>, cancelled: () => boolean): Promise<T | null> {
  for (;;) {
    await new Promise<void>(resolve => setTimeout(resolve, 0));
    if (cancelled()) return null;
    const result = steps.next();
    if (result.done) return result.value;
  }
}
export async function runReconstructionAnalysis(data: AnalysisWorkerRequest, publish: (response: AnalysisResponse) => void, isCancelled: () => boolean = () => false) {
  if ('type' in data && data.type === 'warmup') return reconstructionLibraries.warm();
  if (!('input' in data)) return;
  const { id, input: { scoreable } } = data;
  let text = data.input.text;
  const send = (result: Omit<AnalysisResponse, 'id'>) => publish({ id, ...result });
  const failed = (error: unknown) => send({ error: String(error) });
  try {
    text = await runReconstructionNotation(data, send, reconstructionLibraries.load, isCancelled);
  } catch (error) { failed(error); }
  await new Promise<void>(resolve => setTimeout(resolve, 0));
  if (isCancelled()) return;
  const physical = text.physical ?? text;
  if (scoreable && text.metrics) {
    try {
      send({ patch: { reference: await runSteps(stageReferenceSteps(physical.scramble, physical.moves, text.metrics), isCancelled) } });
    } catch (error) { failed(error); }
    try {
      await new Promise<void>(resolve => setTimeout(resolve, 0));
      if (isCancelled()) return;
      if (text.slots) {
        send({ patch: { slotReference: await runSteps(slotReferenceSteps(physical.scramble, physical.moves, text.slots, true), isCancelled) } });
      }
    } catch (error) { failed(error); }
  }
  if (scoreable && (!text.method || text.method === 'cfop') && !isCancelled()) {
    const zbll = await identifyReplayZbll(text, reconstructionLibraries.load).catch(() => undefined);
    if (isCancelled()) return;
    if (zbll) send({ patch: { zbll } });
  }
  send({ done: true });
}
