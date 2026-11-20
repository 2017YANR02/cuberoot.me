import type { SeededBasicWcaScrambleRequest } from '@cuberoot/shared/timer/seeded/wca';
import type { TimerStoreSettings } from '@cuberoot/shared/timer/persistence';
import {
  createNativeWcaRandomScramble, nativeTimerProjectScrambleAvailable,
} from './native-timer-random-scramble';
import { generateNativeTimerScramble, type NativeTimerEvent } from './native-timer-projects';

export function createNativeTimerScrambleSource() {
  const provider = createNativeWcaRandomScramble();
  let controller: AbortController | undefined;
  return {
    generate(event: NativeTimerEvent, scramble222Mode: TimerStoreSettings['scramble222Mode'], cnMode?: TimerStoreSettings['cnMode']): string | Promise<string> {
      if (nativeTimerProjectScrambleAvailable(event)) {
        controller = new AbortController();
        return provider.generateProject({ event, scramble222Mode, cnMode }, controller.signal);
      }
      // Older native hosts retain already-available project algorithms. A
      // failed Worker request is surfaced and never enters this branch.
      return generateNativeTimerScramble(event, scramble222Mode);
    },
    generateSeeded(request: SeededBasicWcaScrambleRequest) {
      controller = new AbortController();
      return provider.generateSeeded(request, controller.signal);
    },
    cancel() {
      controller?.abort();
      controller = undefined;
    },
    release() {
      controller?.abort();
      controller = undefined;
      provider.dispose();
    },
  };
}
