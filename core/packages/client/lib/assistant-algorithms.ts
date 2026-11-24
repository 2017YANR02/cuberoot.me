import type { AssistantAlgorithmCard } from '@cuberoot/shared/site-assistant';
import { toMoveStringStrict } from '@cuberoot/shared/alg-notation';
import { buildSimQuery } from './sim-recon-link';
import { createAssistantAlgorithmLoader } from '@cuberoot/shared/site-assistant-algorithms';
import type { AlgFile } from '@cuberoot/shared/alg-types';
import { apiUrl } from './api-base';

export function assistantAlgorithmDiagramOptions(puzzle: AssistantAlgorithmCard['puzzle']) {
  return { fullState: puzzle === '5x5' || puzzle === '6x6' || puzzle === 'sq1', sq1SideBySide: puzzle === 'sq1' };
}

// Read the same public snapshot used by the assistant tool, without model calls.
export const loadNextAssistantAlgorithm = createAssistantAlgorithmLoader(async (puzzle, set) => {
  const response = await fetch(apiUrl(`/v1/alg/sets/${encodeURIComponent(puzzle)}/${encodeURIComponent(set)}`), {signal: AbortSignal.timeout(10000)});
  if (!response.ok) throw new Error('Algorithm library unavailable');
  return await response.json() as AlgFile;
});

/** A diagram with an explicit setup starts there. Otherwise the selected
 * solution defines the case by its inverse, just as in the thumbnail. */
export function assistantCardPlayback(card: AssistantAlgorithmCard): string | undefined {
  if (card.puzzle !== '3x3') return;
  // Check repetition sizes before expanding stored annotations during rendering.
  if ([card.alg, card.setup ?? ''].some(text => text.length > 1200 || /\)\d{2}|\([^()]*\(/.test(text))) return;
  try {
    const moves = toMoveStringStrict(card.alg);
    const setup = card.setup ? toMoveStringStrict(card.setup) : '';
    if (!moves || (card.setup && !setup)) return;
    const params = new URLSearchParams(buildSimQuery('3', setup, moves));
    if (setup) params.set('anchor', 'start');
    return '/sim?' + params.toString();
  } catch {
    return;
  }
}
