import { createAssistantAlgorithmLoader } from '@cuberoot/shared/site-assistant-algorithms';
import type { AlgFile } from '@cuberoot/shared/alg-types';
import { apiUrl } from './api-base';

// Read the same public snapshot used by the assistant tool, without model calls.
export const loadNextAssistantAlgorithm = createAssistantAlgorithmLoader(async (puzzle, set) => {
  const response = await fetch(apiUrl(`/v1/alg/sets/${encodeURIComponent(puzzle)}/${encodeURIComponent(set)}`), {signal: AbortSignal.timeout(10000)});
  if (!response.ok) throw new Error('Algorithm library unavailable');
  return await response.json() as AlgFile;
});
