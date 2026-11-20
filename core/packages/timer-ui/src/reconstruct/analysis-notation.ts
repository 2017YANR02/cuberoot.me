import type { AlgFile } from '@cuberoot/shared/alg';
import { buildReconText, retainConfirmedRecon, simplifyF2lRotations } from '@cuberoot/shared/timer/reconstruct/recon-text';
import { correctReconFromLibrary } from '@cuberoot/shared/timer/reconstruct/library-correction';
import { detectSolveMethod, methodFrame } from '@cuberoot/shared/timer/reconstruct/method-walk';
import type { AnalysisRequest, AnalysisResponse } from './analysis-protocol';

export async function runReconstructionNotation(
  request: AnalysisRequest,
  send: (response: Omit<AnalysisResponse, 'id'>) => void,
  loadLibrary: (set: string) => Promise<AlgFile>,
  isCancelled: () => boolean = () => false,
) {
  let text = request.input.text;
  if (request.input.detectLiveMethod) {
    const physical = text.physical ?? text;
    const method = detectSolveMethod(physical.scramble, physical.moves, text.totalMs, undefined, { allowPartial: true });
    if (method !== text.method) {
      const frame = methodFrame(method, physical.scramble, physical.moves);
      text = { ...text, method, scramble: frame.scramble, moves: frame.moves, viewRotation: frame.rotation };
    }
    // A new method/frame changes the meaning of every stage. Retain only a
    // prefix that belongs to this same interpretation of the raw attempt.
    if (text.confirmed && (request.input.confirmedMethod !== method || text.confirmed.inspection !== text.viewRotation)) {
      text = { ...text, confirmed: undefined };
    }
    send({ patch: { method } });
  }
  // The visible move list must not wait for the optional reference searches.
  if (!request.skipText) {
    const original = await buildReconText(text);
    if (isCancelled()) return text;
    // A live continuation is published atomically after library correction.
    if (!text.confirmed) send({ patch: { text: original } });
    const corrected = await correctReconFromLibrary(original, loadLibrary, text.confirmed?.lines.at(-1)?.toIdx).catch(() => original);
    if (isCancelled()) return text;
    const retained = await retainConfirmedRecon(corrected, text.confirmed);
    const presentation = await retainConfirmedRecon(
      !text.method || text.method === 'cfop' ? simplifyF2lRotations(retained) : retained,
      text.confirmed?.presentation,
    );
    send({ patch: { text: { ...retained, presentation: { ...presentation, presentation: undefined } } } });
  }
  return text;
}
