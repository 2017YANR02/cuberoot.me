/// <reference lib="webworker" />

import { findSq1PblSolutions, type Sq1PblSearchInput } from '@/lib/sq1-pbl';

interface SearchRequest {
  id: number;
  input: Sq1PblSearchInput;
}

self.onmessage = (event: MessageEvent<SearchRequest>) => {
  const { id, input } = event.data;
  try {
    const result = findSq1PblSolutions(input, (completed, total) => {
      self.postMessage({ id, type: 'progress', completed, total });
    });
    self.postMessage({ id, type: 'result', result });
  } catch (error) {
    self.postMessage({
      id,
      type: 'error',
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

export {};
