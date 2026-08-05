/// <reference lib="webworker" />

import { findTwoToolsSolutions, type TwoToolsSearchInput } from './two-tools-solver';
import { TWO_TOOLS_TIMINGS } from './two-tools-timings';

interface Request { id: number; input: TwoToolsSearchInput }

self.onmessage = (event: MessageEvent<Request>) => {
  const { id, input } = event.data;
  try {
    self.postMessage({ id, solutions: findTwoToolsSolutions(input, TWO_TOOLS_TIMINGS) });
  } catch (error) {
    self.postMessage({ id, error: error instanceof Error ? error.message : String(error) });
  }
};

export {};
