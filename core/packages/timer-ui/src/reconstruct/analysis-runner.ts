import { reconstructionLibraries } from './library-cache';
import { buildReconText, retainConfirmedRecon, simplifyF2lRotations } from '@cuberoot/shared/timer/reconstruct/recon-text';
import { correctReconFromLibrary } from '@cuberoot/shared/timer/reconstruct/library-correction';
import { stageReferenceSteps, slotReferenceSteps } from '@cuberoot/shared/timer/reconstruct/reference';
import { detectSolveMethod, methodFrame } from '@cuberoot/shared/timer/reconstruct/method-walk';
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
    if (data.input.detectLiveMethod) {
      const physical = text.physical ?? text;
      const method = detectSolveMethod(physical.scramble, physical.moves, text.totalMs, undefined, { allowPartial: true });
      if (method !== text.method) {
        const frame = methodFrame(method, physical.scramble, physical.moves);
        text = { ...text, method, scramble: frame.scramble, moves: frame.moves, viewRotation: frame.rotation };
      }
      // A new method/frame changes the meaning of every stage. Retain only a
      // prefix that belongs to this same interpretation of the raw attempt.
      if (text.confirmed && (data.input.confirmedMethod !== method || text.confirmed.inspection !== text.viewRotation)) {
        text = { ...text, confirmed: undefined };
      }
      send({ patch: { method } });
    }
    // The visible move list must not wait for the optional reference searches.
    if (!data.skipText) {
      const original = await buildReconText(text);
      if (isCancelled()) return;
      // A live continuation is published atomically after library correction.
      if (!text.confirmed) send({ patch: { text: original } });
      const corrected = await correctReconFromLibrary(original, reconstructionLibraries.load, text.confirmed?.lines.at(-1)?.toIdx).catch(() => original);
      if (isCancelled()) return;
      const retained = await retainConfirmedRecon(corrected, text.confirmed);
      const presentation = await retainConfirmedRecon(
        !text.method || text.method === 'cfop' ? simplifyF2lRotations(retained) : retained,
        text.confirmed?.presentation,
      );
      send({ patch: { text: { ...retained, presentation: { ...presentation, presentation: undefined } } } });
    }
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
        send({ patch: { slotReference: await runSteps(slotReferenceSteps(physical.scramble, physical.moves, text.slots), isCancelled) } });
      }
    } catch (error) { failed(error); }
  }
  send({ done: true });
}
