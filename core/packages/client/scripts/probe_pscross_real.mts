import { patternFromAlg } from '../src/utils/cube3';
import { detectStage } from '../src/utils/stage_detect';
import { buildCommentSuggestions } from '../src/utils/popup_suggest';

// Construct a scramble + partial solve that lands at pscross with F2L disturbed.
// We want: cross all on D BUT side stickers off by D-rotation, AND F2L not done.
//
// Build state: solved · D2 (= pscross-but-otherwise-solved) → that's 'oll' in
// detectStage. To force pscross detection we need F2L NOT done — apply some
// moves that disturb F2L but keep cross-on-D.
//
// Strategy: pscross = solved · D2 · "R U R' U'" (sledgehammer-ish). The R move
// disturbs DR cubie though — breaks cross. Try U-only after D2.
//
// U-only after D2: doesn't touch D-layer, F2L slots only edges (E-slice) get
// disturbed by... wait U doesn't touch E-slice either. U just moves U-corners
// and U-edges. F2L corners (D-corners 4..7) untouched. F2L edges (E-slice
// 8..11) untouched. So solved · D2 · U-only = pscross + U-layer scrambled,
// but D-layer corners and E-slice solved. detectStage picks orientation
// where F2L corners + edges are solved → 'f2l' or 'oll'.
//
// We need to disturb F2L edges (E-slice). Use F or B moves which move FR/FL or BR/BL.
const targetBuild = "D2 R U R' F'";  // breaks F2L FR slot
const userScramble = "F R U' R'";    // arbitrary scramble user might see
// User's perceived solve: scramble · solve = targetBuild. So solve = invert(userScramble) + targetBuild.
// Let's just pick a scramble and check what state we get.

const scramble = userScramble;
const partialSolve = "F R U' R' D2";  // partial solve with D2 baked in — actually let me try without it
const partialSolveNoD2 = "F R U' R'";  // user does cross attempt without final alignment

const state1 = await patternFromAlg(`${scramble} ${partialSolveNoD2}`);
console.log(`scramble: ${scramble}`);
console.log(`partial solve (no D2): ${partialSolveNoD2}`);
console.log(`state stage: ${(await detectStage(state1)).stage}`);

// Maybe a different approach: just hand-build a pscross+broken-F2L state.
// solved · "F U F' U'" gives a state with FR/UF disturbed but cross intact?
// Let me check various states.

console.log('\n--- search for pscross state via short setups ---');
const setups = [
  "D2",
  "D2 R",
  "D2 R U R'",
  "D2 F R U R' U' F'",
  "D",
  "D' R U R' U'",
  "F R U R' U' F' D2",
  "U R U R' D2",
  "R U2 R' D2",
];
for (const setup of setups) {
  const s = await patternFromAlg(setup);
  const i = await detectStage(s);
  console.log(`  ${setup} → stage=${i.stage}`);
  if (i.stage === 'pscross') {
    console.log('    ✓ FOUND PSCROSS');
    // Build a "scramble" so prev stage is 'none' (mimicking real user flow).
    // If our setup = X · Y where X scrambles enough that prev is 'none', use X as scramble.
    // For "D' R U R' U'" — prev would be after some scramble. Use "R F R' F'" as scramble:
    const scrambleAlg = "R F R' F'";
    const prev = await patternFromAlg(scrambleAlg);
    const post = await patternFromAlg(`${scrambleAlg} ${setup}`);
    const sugg = await buildCommentSuggestions({
      prevPattern: prev, currPattern: post, lineMovesText: setup, moveCount: setup.split(/\s+/).length,
    });
    console.log(`    prev stage: ${(await detectStage(prev)).stage}, post stage: ${(await detectStage(post)).stage}`);
    console.log('    suggestions:', sugg);
  }
}
