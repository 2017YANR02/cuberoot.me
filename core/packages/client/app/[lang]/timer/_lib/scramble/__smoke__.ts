/**
 * Smoke test: invoke generateScramble for every EventId in EVENTS and print
 * a one-line preview. Run with:
 *   pnpm --filter @cuberoot/client exec tsx src/pages/timer/scramble/__smoke__.ts
 *
 * Not part of the build — used during development to verify the dispatcher
 * has a generator for every event and none of them throw.
 */

import { EVENTS } from '../types';
import { generateScramble, mulberry32 } from './index';

const rng = mulberry32(0xC0DE);

// register.ts schedules its registrations in a microtask — yield once so
// registrations are in place before we start dispatching.
await new Promise<void>((r) => queueMicrotask(r));

for (const ev of EVENTS) {
  let preview = '';
  try {
    const s = generateScramble(ev.id, rng);
    preview = s.split('\n').join(' | ');
    if (preview.length > 90) preview = preview.slice(0, 87) + '...';
  } catch (e) {
    preview = `THREW: ${(e as Error).message}`;
  }
  console.log(`[${ev.id.padEnd(8)}] (${preview.length.toString().padStart(3)} ch) ${preview}`);
}
