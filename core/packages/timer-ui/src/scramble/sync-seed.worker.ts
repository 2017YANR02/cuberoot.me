/// <reference lib="webworker" />
import { generateSeededTimerScramble, type TimerSeedRequest } from '@cuberoot/shared/timer/seeded/generate';
self.onmessage = (event: MessageEvent<{ id: number; payload: TimerSeedRequest }>) => {
  const { id, payload } = event.data;
  try { self.postMessage({ id, ok: true, value: generateSeededTimerScramble(payload) }); }
  catch (error) { self.postMessage({ id, ok: false, error: String(error) }); }
};
