/**
 * Side-effect module: imports every Round 1B generator and registers it with
 * the scramble dispatcher (REG in index.ts). Imported once from index.ts.
 *
 * Adding a new event:
 *   1. Add the EventId to types.ts and EVENTS list (other agent's territory —
 *      coordinate first).
 *   2. Add the generator to the appropriate sibling file (bld/relay/etc.).
 *   3. Add a registerScramble(...) line below.
 */

import { registerScramble } from './index';
import {
  scramble333Bld,
  scramble333Ni,
  scrambleMbld,
  scramble444Bld,
  scramble555Bld,
  scramble666Bld,
  scramble777Bld,
} from './bld';
import { scrambleR3, scrambleR4, scrambleR5 } from './relay';
import { scrambleCross, scrambleF2l, scrambleLl } from './cfop_step';
import {
  scrambleOll,
  scramblePll,
  scrambleColl,
  scrambleCmll,
  scrambleZbll,
  scrambleEg1,
  scrambleEg2,
} from './training';
import { scrambleMagic, scrambleMmagic, scrambleCustom } from './others_extra';

// We register inside a microtask so this side-effect runs AFTER index.ts has
// finished evaluating its top-level statements — otherwise registerScramble's
// closure over REG (a `const` initialized later in index.ts source order) hits
// the temporal dead zone since ES module imports are hoisted.
queueMicrotask(() => {
// BLD
registerScramble('333bld', scramble333Bld);
registerScramble('333ni', scramble333Ni);
registerScramble('333mbld', (rng) => scrambleMbld(rng));
registerScramble('444bld', scramble444Bld);
registerScramble('555bld', scramble555Bld);
registerScramble('666bld', scramble666Bld);
registerScramble('777bld', scramble777Bld);

// Relays
registerScramble('r3', scrambleR3);
registerScramble('r4', scrambleR4);
registerScramble('r5', scrambleR5);

// CFOP step
registerScramble('cross', scrambleCross);
registerScramble('f2l', scrambleF2l);
registerScramble('ll', scrambleLl);

// LL training
registerScramble('oll', scrambleOll);
registerScramble('pll', scramblePll);
registerScramble('coll', scrambleColl);
registerScramble('cmll', scrambleCmll);
registerScramble('zbll', scrambleZbll);
registerScramble('eg1', scrambleEg1);
registerScramble('eg2', scrambleEg2);

// Misc puzzles
registerScramble('magic', scrambleMagic);
registerScramble('mmagic', scrambleMmagic);
registerScramble('custom', scrambleCustom);
});
