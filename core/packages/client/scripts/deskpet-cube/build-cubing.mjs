#!/usr/bin/env node
// Build the cubing DeskPet SVGs from the shared engine.
//
// Each row declares only what differs (motion + options); geometry, colours and
// SMIL plumbing come from cube-engine.mjs, so every cube is the same standard
// 3x3 in the same "variant B" look. Add a row (and a builder in the engine if
// it's a new motion) to wire up more of the gallery.
//
//   node scripts/deskpet-cube/build-cubing.mjs            # build all
//   node scripts/deskpet-cube/build-cubing.mjs a02        # build files matching "a02"

import { writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  spin, spinSnap, sway, twoFaceSpin, flip, roll, snapFrames,
  layerTurn, solve, flicker, beat, wrapSvg, assertClear, clawHoldFromStats,
} from './cube-engine.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, '..', '..', 'public', 'deskpet', 'cubing');

const MOTIONS = { spin, spinSnap, sway, twoFaceSpin, flip, roll, snapFrames, layerTurn, solve, flicker, beat };

// move helpers for solves/turns: axis x=±R/L, y=±U/D, z=±F/B; layer ±1; dir ±1
const m = (axis, layer, dir) => ({ axis, layer, dir });
const R = m('x', 1, 1), Ri = m('x', 1, -1);
const U = m('y', 1, 1), Ui = m('y', 1, -1);
const F = m('z', 1, 1), Fi = m('z', 1, -1);

// file → { motion, opts, label, mood }. Every gallery cubing file is generated
// here; motions are picked to match each label's intent.
const ANIMATIONS = [
  // a01 — solves (scramble → resolve), iso 3/4 view
  { file: 'a01-iso-sexy-solve.svg', motion: 'solve', label: 'Sexy-move solve', opts: { dur: '9s', framesPerMove: 4, moves: [R, U, Ri, Ui, R, U] } },
  { file: 'a01-iso-crank-solve.svg', motion: 'solve', label: 'Corner crank', opts: { dur: '11s', framesPerMove: 4, moves: [R, Fi, Ri, F, U, Ri] } },
  { file: 'a01-front-turn-solve.svg', motion: 'solve', label: 'Front turn', opts: { dur: '10s', framesPerMove: 4, moves: [F, U, Fi, Ui, F, Ui], view: { phi: 20 } } },

  // a02 — whole-cube spins about vertical
  { file: 'a02-faceturn-showcase.svg', motion: 'spin', label: 'Y-axis showcase', opts: { dur: '9s', turns: 1 } },
  { file: 'a02-spin-snap.svg', motion: 'spinSnap', label: 'Ratchet spin', opts: { dur: '8s', steps: 8 } },
  { file: 'a02-spin-lean.svg', motion: 'spin', label: 'Proud spin', opts: { dur: '13s', turns: 1 } },

  // a03 — LCD/frame flavour
  { file: 'a03-lcd-spin.svg', motion: 'spin', label: 'LCD spin', opts: { dur: '7s', turns: 1 } },
  { file: 'a03-frame-solve.svg', motion: 'flicker', label: 'Frame solve', opts: { dur: '6s', reveal: true, stages: 8 } },
  { file: 'a03-lcd-twist.svg', motion: 'layerTurn', label: 'U-layer twist', opts: { dur: '5s', move: U } },

  // a04 — showy
  { file: 'a04-one-claw-r-turn.svg', motion: 'layerTurn', label: 'One-claw R-turn', opts: { dur: '5s', move: R } },
  { file: 'a04-show-off-spin.svg', motion: 'spin', label: 'Show-off spin', opts: { dur: '6s', turns: 2 } },
  { file: 'a04-snap-frames.svg', motion: 'snapFrames', label: 'Snap frames', opts: { dur: '6s' } },

  // a05 — small idle fidgets
  { file: 'a05-fidget-twist.svg', motion: 'layerTurn', label: 'Idle twist', opts: { dur: '6s', move: U, frames: 7 } },
  { file: 'a05-fidget-roll.svg', motion: 'sway', label: 'Lazy roll', opts: { dur: '7s', amp: 26 } },
  { file: 'a05-fidget-flip.svg', motion: 'flip', label: 'Idle flip', opts: { dur: '8s', axis: 'x', turns: 1 } },

  // a06 — solve / scramble / reveal
  { file: 'a06-01-layer-solve.svg', motion: 'solve', label: 'Layer solve', opts: { dur: '10s', framesPerMove: 4, moves: [U, R, Ui, Ri, F, Ri] } },
  { file: 'a06-02-slide-shuffle.svg', motion: 'flicker', label: 'Slide shuffle', opts: { dur: '6s', reveal: false, stages: 8 } },
  { file: 'a06-03-flicker-reveal.svg', motion: 'flicker', label: 'Flicker reveal', opts: { dur: '6s', reveal: true, stages: 9 } },

  // a07 — speed
  { file: 'a07-speedsolve-pb.svg', motion: 'solve', label: 'Speedsolve PB', opts: { dur: '8s', framesPerMove: 3, moves: [R, U, Ri, U, R, Ui] } },
  { file: 'a07-two-face-spin.svg', motion: 'twoFaceSpin', label: 'Two-face spin', opts: { dur: '6s' } },
  { file: 'a07-lcd-speedstack.svg', motion: 'solve', label: 'LCD speedstack', opts: { dur: '8s', framesPerMove: 3, moves: [F, R, U, Ri, Fi] } },

  // a08 — turns & rolls
  { file: 'a08-top-u-turn.svg', motion: 'layerTurn', label: 'Top-down U-turn', opts: { dur: '5s', move: U, view: { phi: 60 } } },
  { file: 'a08-side-roll.svg', motion: 'roll', label: 'Side roll', opts: { dur: '7s', turns: 1 } },
  { file: 'a08-turntable-spin.svg', motion: 'spin', label: 'Turntable spin', opts: { dur: '10s', turns: 1 } },

  // a09 — peeks (cube held, body emotes)
  { file: 'a09-peek-double-take.svg', motion: 'beat', label: 'Peek double-take', mood: 'peek', opts: { dur: '6s', motion: 'still' } },
  { file: 'a09-startle-spin-peek.svg', motion: 'beat', label: 'Startle spin', mood: 'startle', opts: { dur: '6s', motion: 'spin', turns: 1 } },
  { file: 'a09-shy-peek-frames.svg', motion: 'beat', label: 'Shy peek', mood: 'shy', opts: { dur: '6s', motion: 'still' } },

  // a10 — celebrations
  { file: 'a10-victory-jump.svg', motion: 'beat', label: 'Victory jump', mood: 'jump', opts: { dur: '6s', motion: 'sway', amp: 10 } },
  { file: 'a10-cube-raise-cheer.svg', motion: 'beat', label: 'Cube raise', mood: 'cheer', opts: { dur: '6s', motion: 'still' } },
  { file: 'a10-pb-sparkle-dance.svg', motion: 'beat', label: 'PB dance', mood: 'dance', opts: { dur: '6s', motion: 'spin', turns: 1 } },
];

const filter = process.argv[2];
let built = 0;
const fails = [];
for (const a of ANIMATIONS) {
  if (filter && !a.file.includes(filter)) continue;
  const build = MOTIONS[a.motion];
  if (!build) throw new Error(`unknown motion "${a.motion}" for ${a.file}`);
  try {
    const cube = build(a.opts || {});
    assertClear(cube.stats, a.file); // guard: never ship a cube that covers eyes/legs
    const svg = wrapSvg({
      polys: cube.polys, anims: cube.anims, label: a.label, mood: a.mood || null,
      clawHold: cube.clawHold || clawHoldFromStats(cube.stats),
    });
    writeFileSync(join(OUT, a.file), svg);
    const s = cube.stats;
    const kb = Math.round(svg.length / 1024);
    console.log(`✓ ${a.file.padEnd(30)} ${String(kb).padStart(3)}KB  x[${s.minX.toFixed(2)},${s.maxX.toFixed(2)}] y[${s.minY.toFixed(2)},${s.maxY.toFixed(2)}] vis ${s.minVis}-${s.maxVis}`);
    built++;
  } catch (e) {
    fails.push(`${a.file}: ${e.message}`);
    console.log(`✗ ${a.file.padEnd(30)} ${e.message}`);
  }
}
console.log(`\n${built} file(s) built → ${OUT.replace(resolve(HERE, '..', '..'), '.')}`);
if (fails.length) { console.error(`\n${fails.length} FAILED:\n  ${fails.join('\n  ')}`); process.exit(1); }
