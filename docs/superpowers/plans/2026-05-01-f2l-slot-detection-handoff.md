# Handoff: F2L slot detection + cubedb 100% parity

**Status as of:** 2026-05-01 evening, end of session 1
**Next session must:** read this entire file before touching code
**Last commit:** `70a9b721 fix(recon-autofill): cube-state-aware alg ranking`

---

## What works ✅

- `/algdb` route — F2L (41) / Adv F2L (54) / OLL (57) / PLL (21) all scraped from speedcubedb, mini cube preview, click-to-copy. Already in user's hands.
- `/recon/submit` autofill basics:
  - **Tab** is the universal trigger and **never escapes the textarea** (`preventDefault` always).
  - Comment popup contents derived from cube state diff via `cubing.js KPattern`.
  - Three-form pair aliases (ordinal / 2-letter / full-color) + `(N)` move-count variant.
  - Cross detection works in rotated solves (e.g. user's `x'` inspection): uses **set-equality** at slots 4–7 — accepts `{0,1,2,3}` (white cross) or `{4,5,6,7}` (yellow cross) — instead of strict piece-at-slot identity.
  - Verified parity with cubedb on `// cross` line for the user's ZBLL recon.
- `cubing.js` replaces my hand-rolled simulator. `cube3_sim.ts` is now legacy (still imported by `MiniCube.tsx` + `AlgDbCategoryPage.tsx` — fine to leave for v1 since the algdb pages don't need cubing.js benefits).
- Ground-truth dataset at `core/packages/client/src/pages/recon/components/__fixtures__/cubedb_ground_truth.ts`: **13 recons, 99 tabPoints**, each one with the exact popup output cubedb produces. This is the test corpus.

---

## What is BROKEN 🔴 (this is your job)

### Bug 1 — F2L slot detection still uses strict piece identity

`utils/stage_detect.ts:slotSolved()` does:
```ts
function slotSolved(p, slot) {
  return pieceHome(p, 'CORNERS', slot.cornerSlot) && pieceHome(p, 'EDGES', slot.edgeSlot);
}
```
where `pieceHome` requires `pieces[slot] === slot && orientation[slot] === 0`.

**This is exactly the same bug class as the cross detection.** After `x'` / `x2` inspection rotation, pieces are PERMUTED in cubing.js's frame — the WHITE F2L pieces aren't at "their" slot, they're at the slots they NEEDED to migrate to in order to look correct on the rotated cube.

**Symptom:**
- After `x' // insp\n(D U')↑ L l D' L' // W cross\nU' R' U' R` the user's `U' R' U' R` should solve the FR (or whichever) F2L pair.
- My alg ranking applies each candidate to the pre-state and asks `detectStage(post).solvedSlots` to count newly-solved slots.
- `slotSolved` returns false for every slot because pieces are permuted.
- So `U' R' U' R` scores 0 (no slot newly solved) → not in top suggestions.
- Cubedb DOES rank it highly because it visually solves the FR slot (correct stickers showing on each face).

### Bug 2 — multiple downstream features blocked on this

- 2nd / 3rd / 4th pair detection
- `// SS` / `// SB` extra labels (last-slot insertions)
- Combined-pair labels (`// 1st & 2nd pairs`)
- xcross / xxcross / xxxcross transition labelling (depends on counting solved slots)
- OLL / PLL detection in rotated solves

Once you fix Bug 1, most of these work for free.

---

## How to fix Bug 1 — sticker-color-aware F2L slot check

Cubedb checks **visual** solve, not piece-at-home: a slot is solved if all 5 stickers (corner D-side + corner 2 side stickers + edge 2 side stickers) match the colors of the centers they're adjacent to.

### What you need

Two static tables + 1 function in `utils/stage_detect.ts`.

**Table A — EDGE_STICKERS:** for each of 12 edge pieces, the colors of its primary and secondary sticker.

```ts
// Color codes 0..5 = U,R,F,L,B,D = W,R,G,O,B,Y (matches cubing.js piece numbering of CENTERS)
const EDGE_STICKERS: Array<[number, number]> = [
  [0, 2],  // 0 UF: white, green
  [0, 1],  // 1 UR: white, red
  [0, 4],  // 2 UB: white, blue
  [0, 3],  // 3 UL: white, orange
  [5, 2],  // 4 DF: yellow, green
  [5, 1],  // 5 DR: yellow, red
  [5, 4],  // 6 DB: yellow, blue
  [5, 3],  // 7 DL: yellow, orange
  [2, 1],  // 8 FR: green, red
  [2, 3],  // 9 FL: green, orange
  [4, 1],  // 10 BR: blue, red
  [4, 3],  // 11 BL: blue, orange
];
```

**Table B — EDGE_SLOT_FACES:** for each of 12 edge slots, the FACE INDICES (0..5 in U/R/F/L/B/D order, matching CENTERS slots) of its primary and secondary direction.

```ts
const EDGE_SLOT_FACES: Array<[number, number]> = [
  [0, 2],  // 0 UF slot: U-side, F-side
  [0, 1],  // 1 UR: U, R
  [0, 4],  // 2 UB: U, B
  [0, 3],  // 3 UL: U, L
  [5, 2],  // 4 DF: D, F
  [5, 1],  // 5 DR: D, R
  [5, 4],  // 6 DB: D, B
  [5, 3],  // 7 DL: D, L
  [2, 1],  // 8 FR: F, R
  [2, 3],  // 9 FL: F, L
  [4, 1],  // 10 BR: B, R
  [4, 3],  // 11 BL: B, L
];
```

> **VERIFY THESE BY PROBE FIRST.** Don't trust me. Run a probe like the ones already in `/d/cube/cuberoot.me/core/packages/client/probe*.mjs` history (search git log for examples) — apply known single-piece insertions (`U R U' R'`, `L' U' L U`, etc.) from solved and inspect which slots/orientations changed. Adjust the tables if my sketch is wrong. Slot ↔ piece numbering convention was verified earlier; sticker-direction convention may not be.

**Function — `edgeStickerOnFace(pattern, edgeSlot, faceIdx)`:** returns the sticker color (0..5) shown at `faceIdx` for the edge currently at `edgeSlot`.

```ts
function edgeStickerOnFace(p: KPattern, slot: number, face: number): number | null {
  const piece = p.patternData.EDGES.pieces[slot];
  const ori = p.patternData.EDGES.orientation[slot] ?? 0;
  const [pPri, pSec] = EDGE_STICKERS[piece];
  const [sPri, sSec] = EDGE_SLOT_FACES[slot];
  // ori=0: primary sticker on slot's primary side
  // ori=1: flipped
  if (face === sPri) return ori === 0 ? pPri : pSec;
  if (face === sSec) return ori === 0 ? pSec : pPri;
  return null; // face not adjacent to this edge slot
}
```

Same idea for **corners** but with 3 stickers each, ori in {0,1,2}, and the cyclic-rotation rule.

### Then `slotSolved` becomes:

```ts
function slotSolved(p: KPattern, slot: typeof F2L_SLOT_DEFS[number]): boolean {
  const c = p.patternData.CENTERS.pieces;
  // For the edge at slot.edgeSlot:
  //   the F-side sticker should match the F center's color, and similar for R.
  const edge = slot.edgeSlot;
  const [eF1, eF2] = EDGE_SLOT_FACES[edge];
  if (edgeStickerOnFace(p, edge, eF1) !== c[eF1]) return false;
  if (edgeStickerOnFace(p, edge, eF2) !== c[eF2]) return false;

  // For the corner at slot.cornerSlot:
  //   D-side sticker = D-center color, F-side = F-center color, R-side = R-center color.
  // (write CORNER_STICKERS / CORNER_SLOT_FACES / cornerStickerOnFace analogously)
  ...
  return true;
}
```

### Rule of thumb for tackling corner orientations

cubing.js corner orientation 0/1/2 cycle:
- ori 0: piece's "U/D-color sticker" lines up with slot's "U/D" face
- ori 1: piece is rotated 120° CW (looking from outside the cube)
- ori 2: rotated 120° CCW

So at corner slot `[fU, fA, fB]` (U/D face + 2 side faces in CW order from outside):
- piece stickers `[cU, cA, cB]` mapped:
  - ori 0 → (cU→fU, cA→fA, cB→fB)
  - ori 1 → (cB→fU, cU→fA, cA→fB)  (or flip — verify experimentally)
  - ori 2 → (cA→fU, cB→fA, cU→fB)

Define CORNER_SLOT_FACES carefully — order matters. The CW-from-outside ordering needs to be correct for ori 1/2 to work.

### Verification approach

Before touching `slotSolved`:

1. Write a probe `probe_slot_color.mjs` in `core/packages/client/`:
   - Apply known-good "FR slot inserted from solved" alg to default pattern: e.g., `(R' U R) U' R' U R` (sledgehammer-like) preceded by `R U' R'` to set up the FR slot. Or just apply nothing and verify FR is solved.
   - Print `edgeStickerOnFace(...)` and `cornerStickerOnFace(...)` for slot 8 + slot 4.
   - Confirm they match center colors at F and R faces.
2. Iteratively fix the tables until matches are correct.
3. Run with rotated cube state (`x'` applied first), confirm slot detection still works.
4. Apply Max Park's `x2 + xxcross` and confirm 2 of the 4 F2L slots are detected as solved.

---

## How to test parity once Bug 1 is fixed

The ground truth fixture file:
```
core/packages/client/src/pages/recon/components/__fixtures__/cubedb_ground_truth.ts
```
exports `RECON_GROUND_TRUTH: ReconFixture[]`. Each fixture has:
- `scramble`
- `solution` (full text)
- `tabPoints[]`: array of `{ afterText, expected: string[] }`

Write a quick test harness:
```ts
// test_against_ground_truth.mjs (or a vitest spec — repo has no test runner yet so .mjs is fine)
import { RECON_GROUND_TRUTH } from './__fixtures__/cubedb_ground_truth.ts';
import { buildCommentSuggestions } from '../../utils/popup_suggest';
import { patternFromAlg } from '../../utils/cube3';

let pass = 0, fail = 0;
for (const fixture of RECON_GROUND_TRUTH) {
  for (const tp of fixture.tabPoints) {
    // Compute prev/curr patterns from afterText, build suggestions
    // Compare against tp.expected (array equality + order)
    // Log pass/fail with diff
  }
}
console.log(`${pass} / ${pass+fail} pass`);
```
Use this as the iteration loop: fix → run harness → check fail diffs → fix → repeat.

---

## What is in the legacy / not-yet-deleted bucket

- `core/packages/client/src/utils/cube3_sim.ts` — old hand-rolled simulator (~280 lines). Still used by `MiniCube.tsx` and `AlgDbCategoryPage.tsx`. Migration to cubing.js is **Task 10** in the original plan but low priority — algdb pages work fine as-is.
- `core/packages/client/src/utils/recon_alg_match.ts` — old ranking logic. Replaced by inline ranking in `ReconAutofill.tsx`. Safe to delete; no current consumers.

---

## Reference for related code

- `core/packages/client/src/pages/recon/components/ReconAutofill.tsx` — main UI component with Tab handler, popup state machine, alg ranking via `patternFromAlg + applyAlg` simulation.
- `core/packages/client/src/utils/stage_detect.ts` — **YOU WILL EDIT THIS.** Contains `crossSolved` (already fixed via set-equality), `slotSolved` (broken), `bestOrientation`, `detectStage`.
- `core/packages/client/src/utils/popup_suggest.ts` — generates the popup string entries from a pre→curr stage transition. Once `slotSolved` is fixed, the pair/xcross/xxcross transitions in here will work correctly.
- `core/packages/client/src/utils/cube3.ts` — cubing.js wrappers (`patternFromAlg`, `invertAlg`, `isAlgPrefix`, `countMoves`).

---

## Things I tried & abandoned

- **Normalising centers to identity then checking pieces 4-7 home**: works for cubes that were never rotated, fails after `x'` / `x2` inspections (pieces are permuted).
- **`bestOrientation` iterates 24 orientations and picks max-score**: this is the right technique, but it scores using `slotSolved` which is the broken function — fixing the function fixes the scoring.
- **`KPattern.experimentalIsSolved({stickering:'Cross'})`**: cubing.js's API only checks "fully solved" using the mask, not "stage progress matches expected for this mask". Useless for partial-state detection.
- **Using cubing.js `stickeringMask` to derive sticker colors**: the masks tell you which stickers MATTER ('regular' / 'ignored' / etc.), not their expected colors — orthogonal to what we need.

Don't repeat these.

---

## Quick start for next session

```bash
# 1. Sanity-check the current state
cd /d/cube/cuberoot.me/core
pnpm --filter @cuberoot/client typecheck
git log --oneline main ^origin/main | head -15

# 2. Read this doc fully before any code changes
cat docs/superpowers/plans/2026-05-01-f2l-slot-detection-handoff.md

# 3. Probe sticker conventions
# write probe_slot_color.mjs in core/packages/client/, run with `node probe_slot_color.mjs`

# 4. Fix slotSolved in utils/stage_detect.ts

# 5. Run ground-truth harness; iterate until 99/99 pass
```

End of handoff.
