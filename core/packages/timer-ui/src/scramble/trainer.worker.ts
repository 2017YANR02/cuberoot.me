/// <reference lib="webworker" />

import { createTimerTrainerWorkerHandler, type TrainerWorkerRequest } from '@cuberoot/shared/timer/random-difficulty-worker';

const scope = self as unknown as DedicatedWorkerGlobalScope;
const handleRequest = createTimerTrainerWorkerHandler();

scope.addEventListener('message', (event: MessageEvent<{
  id: number;
  request: TrainerWorkerRequest;
}>) => {
  scope.postMessage(handleRequest(event.data));
});

export {};
