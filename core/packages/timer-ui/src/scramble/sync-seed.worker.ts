/// <reference lib="webworker" />
import { generateSeededTimerScrambleAsync, type TimerSeedRequest } from '@cuberoot/shared/timer/seeded/generate';
self.onmessage = async (event: MessageEvent<{ id: number; payload: TimerSeedRequest }>) => {
  const { id, payload } = event.data;
  try { self.postMessage({ id, ok: true, value: await generateSeededTimerScrambleAsync(payload) }); }
  catch (error) { self.postMessage({ id, ok: false, error: String(error) }); }
};
