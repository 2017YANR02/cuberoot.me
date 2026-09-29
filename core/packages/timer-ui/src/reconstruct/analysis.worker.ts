import { buildReconText } from '@cuberoot/shared/timer/reconstruct/recon-text';
import { computeStageReferences, computeF2lSlotReferences } from '@cuberoot/shared/timer/reconstruct/reference';
import type { AnalysisRequest, AnalysisResponse } from './analysis-protocol';

// One request at a time, enforced by analysis-client. Cancellation terminates
// this worker, including an IDA* search that cannot receive a cancel message.
self.onmessage = async ({ data }: MessageEvent<AnalysisRequest>) => {
  const { id, input: { text, scoreable } } = data;
  const send = (result: Omit<AnalysisResponse, 'id'>) => self.postMessage({ id, ...result });
  const failed = (error: unknown) => send({ error: String(error) });
  try {
    // The visible move list must not wait for the optional reference searches.
    send({ patch: { text: await buildReconText(text) } });
  } catch (error) { failed(error); }
  const physical = text.physical ?? text;
  if (scoreable && text.metrics) {
    try {
      send({ patch: { reference: computeStageReferences(physical.scramble, physical.moves, text.metrics) } });
    } catch (error) { failed(error); }
    try {
      if (text.slots) {
        send({ patch: { slotReference: computeF2lSlotReferences(physical.scramble, physical.moves, text.slots) } });
      }
    } catch (error) { failed(error); }
  }
  send({ done: true });
};
