import { createRandomScrambleClient } from '@cuberoot/timer-ui/random-scramble';
import type { TimerStoreData } from '@cuberoot/shared/timer';
import type { TimerRepository } from './data/timer-repository';
import { watchTimerPreview } from './watch-timer-preview';
import { decodeWatchTimerRecord, WATCH_TIMER_EVENTS, watchTimerConfiguration, watchTimerSlot, type WatchTimerPort } from './watch-timer';

/** Single foreground pump; native inbox remains durable while the WebView is suspended. */
export function startWatchTimerSync(port: WatchTimerPort, repository: TimerRepository,
  imported: (operation: () => Promise<TimerStoreData>) => Promise<void>) {
  let stopped = false, busy = false;
  const controller = new AbortController();
  const random = createRandomScrambleClient();
  const tick = async () => {
    if (stopped || busy || document.visibilityState === 'hidden') return;
    busy = true;
    try {
      const state = await port.read();
      for (const raw of state.records) {
        if (stopped) return;
        const record = decodeWatchTimerRecord(raw);
        if (!record) continue; // Keep incompatible payloads for a later compatible client.
        await imported(() => repository.importWatchSolve(record));
        if (record.reconRevision) await port.acknowledge([record.id], { [record.id]: record.reconRevision });
        else await port.acknowledge([record.id]); // Only after the atomic IndexedDB commit.
      }
      if (!state.installed || stopped) return;
      const data = await repository.load();
      const configuration = watchTimerConfiguration(data);
      if (!state.requestId && state.configuration === configuration) return;
      const slots = [];
      const unsupported = !WATCH_TIMER_EVENTS.includes(data.settings.event);
      if (!unsupported) {
        for (let i = 0; i < 10 && !stopped; i++) {
          // Explicit ordinary random defaults; no accidental inheritance of WCA/manual/training sources.
          const result = await random.next({ event: data.settings.event }, controller.signal);
          if (!result.ok || !result.scramble) throw new Error('Watch scramble generation failed');
          const slot = watchTimerSlot(data, result.scramble);
          try { slot.previewPng = await watchTimerPreview(slot.event, slot.scramble); } catch { /* Keep text usable if rendering fails. */ }
          slots.push(slot);
        }
      }
      if (stopped || configuration !== watchTimerConfiguration(await repository.load())) return;
      const batch = { version: 1 as const, id: crypto.randomUUID(), configuration,
        language: data.settings.language, slots, unsupported };
      // Large Retina batches use WatchConnectivity's file channel.
      while (slots.length > 1 && new TextEncoder().encode(JSON.stringify(batch)).length > 900_000) slots.pop();
      await port.publish(batch, state.requestId);
    } catch {
      // A failed transfer/generation/import is retried; native data is never acknowledged or discarded.
    } finally { busy = false; }
  };
  const timer = setInterval(() => void tick(), 5000);
  const foreground = () => void tick();
  document.addEventListener('visibilitychange', foreground);
  void tick();
  return () => { stopped = true; controller.abort(); random.reset(); clearInterval(timer);
    document.removeEventListener('visibilitychange', foreground); };
}
