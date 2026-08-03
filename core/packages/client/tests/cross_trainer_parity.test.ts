/*
 * Does the trainer's difficulty MEAN what the rest of the site means by it?
 *
 * The generator promises one thing above all (docs/cross-trainer-difficulty.md §0.2): "标准 ·
 * 十字 · 白 · 5 步" is the same statement whether you draw it from WCA scrambles or generate it.
 * Every other test in this directory checks the generator against itself — its own tables, its own
 * histograms, its own oracle. This one checks it against something it did not write:
 * `stats/scramble/comp_steps*`, the per-scramble step counts the Rust engines produced for
 * /scramble/stats and the WCA-real-scramble filter. Six columns per stage, one per cross colour,
 * in the pipeline's own order (W Y R O B G — the analyzers' `_z0 _z2 _z3 _z1 _x3 _x1` suffixes).
 *
 * Reading it: `EXACT` are the stages where every column of every scramble agrees. `DIVERGENT` are
 * the three that do not, with the rate locked by value — they were already shipped that way, and
 * a locked number turns "someone changed the metric" into a review signal instead of silence. A
 * fix should raise one of them to full and move it up into EXACT, never loosen the assertion.
 *
 * stats/ lives outside CI's sparse checkout (test.yml pulls core/ only), so the whole file
 * degrades to a no-op there rather than failing.
 */

import path from 'node:path';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { stageMetric } from '@/lib/cross-trainer';
import { applySequence, parseMoves, solvedCubie } from '@/app/[lang]/timer/_lib/scramble/kociemba/cube';

/** Column order of every comp_steps file: the analyzers' six view rotations, named by colour. */
const COLUMNS = ['W', 'Y', 'R', 'O', 'B', 'G'];
/** 3BLD scrambles carry a wide-move orientation suffix; the model here is face turns only. */
const PLAIN = /^[URFDLB'2 ]+$/;
/** Four competition files ≈ 224 scrambles × 6 colours = 1,344 columns per stage. */
const FILES = 4;

interface Case { dir: string; offset: number; variant: string; stage: string; hits?: number }

/** Agreement is exact unless `hits` says otherwise — see the header. */
const CASES: Case[] = [
  { dir: 'comp_steps', offset: 0, variant: 'std', stage: 'cross' },
  { dir: 'comp_steps', offset: 6, variant: 'std', stage: 'xcross' },
  { dir: 'comp_steps', offset: 12, variant: 'std', stage: 'xxcross' },
  { dir: 'comp_steps_pair', offset: 0, variant: 'pair', stage: 'cross_pair' },
  { dir: 'comp_steps_pair', offset: 6, variant: 'pair', stage: 'xcross_pair' },
  { dir: 'comp_steps_pseudo', offset: 0, variant: 'pseudo', stage: 'pseudo_cross' },
  { dir: 'comp_steps_eoline', offset: 0, variant: 'eoline', stage: 'eo' },
  { dir: 'comp_steps_eoline', offset: 6, variant: 'eoline', stage: 'eoline' },
  { dir: 'comp_steps_222', offset: 0, variant: '222', stage: 'block222' },
  // Known divergences, measured 2026-08-03 and tracked in docs/cross-trainer-difficulty.md §6.1.
  // All three involve a definition the port guessed rather than read off the engine: EOCross's
  // orientation axis, and what "pseudo" means once a slot is in play.
  { dir: 'comp_steps_eo', offset: 0, variant: 'eo', stage: 'eo_cross', hits: 959 },
  { dir: 'comp_steps_pseudo', offset: 6, variant: 'pseudo', stage: 'pseudo_xcross', hits: 822 },
  { dir: 'comp_steps_pseudo_pair', offset: 0, variant: 'pseudo_pair', stage: 'pseudo_cross_pseudo_pair', hits: 911 },
];

const STATS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../stats/scramble');

function corpus(dir: string): Array<[string, number[]]> {
  const root = path.join(STATS, dir);
  if (!existsSync(root)) return [];
  const out: Array<[string, number[]]> = [];
  for (const name of readdirSync(root).slice(0, FILES)) {
    const rows = JSON.parse(readFileSync(path.join(root, name), 'utf-8')) as Record<string, number[]>;
    for (const [scramble, steps] of Object.entries(rows)) {
      if (PLAIN.test(scramble)) out.push([scramble, steps]);
    }
  }
  return out;
}

describe('cross-trainer / parity with the site’s own step counts', () => {
  for (const c of CASES) {
    const name = `${c.variant}/${c.stage}`;
    it(`${name} reproduces ${c.dir}`, () => {
      const rows = corpus(c.dir);
      if (!rows.length) return;                       // stats/ absent (CI): nothing to compare
      let hits = 0;
      const misses: string[] = [];
      for (const [scramble, steps] of rows) {
        const state = applySequence(solvedCubie(), parseMoves(scramble));
        COLUMNS.forEach((colour, i) => {
          const got = stageMetric(c.variant, c.stage, state, colour);
          if (got === steps[c.offset + i]) hits++;
          else if (misses.length < 3) misses.push(`${colour} ${scramble}: got ${got}, site ${steps[c.offset + i]}`);
        });
      }
      const total = rows.length * COLUMNS.length;
      expect(total, `${name} corpus size`).toBe(1344);
      expect(hits, `${name}\n  ${misses.join('\n  ')}`).toBe(c.hits ?? total);
    }, 300_000);
  }
});
