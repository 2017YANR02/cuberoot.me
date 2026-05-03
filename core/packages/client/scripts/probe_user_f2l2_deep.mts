import { detectStage, crossOnDRotation, evaluateCanonical, F2L_SLOT_DEFS } from '../src/utils/stage_detect.ts';
import { patternFromAlg, isAlgPrefix, simplifyAlg } from '../src/utils/cube3.ts';
import { lookupF2lAlgs } from '../src/utils/f2l_lookup.ts';

const scramble = "L2 B2 F' L D' F2 D R' F2 R2 D' B' L' D2 B D' U L2";
const moves = "y x' F R2 U' L2' x' y U2 F' U' F";
const startState = await patternFromAlg(`${scramble} ${moves}`);

const canonRot = await crossOnDRotation(startState);
const startCanonical = canonRot ? startState.applyAlg(canonRot) : startState;
const preEval = evaluateCanonical(startCanonical);
const solvedSet = new Set(preEval.solvedSlots);

console.log('canonRot:', JSON.stringify(canonRot));
console.log('preEval.solvedSlots:', preEval.solvedSlots);

let totalCandidates = 0;
let passedPrefix = 0;
let passedTargetSolved = 0;
let passedPreserved = 0;

for (let slotIdx = 0; slotIdx < F2L_SLOT_DEFS.length; slotIdx++) {
  const slotId = F2L_SLOT_DEFS[slotIdx].id;
  if (solvedSet.has(slotId)) continue;
  const entries = await lookupF2lAlgs(startCanonical, slotIdx);
  console.log(`\n--- Slot ${slotId} (idx ${slotIdx}): ${entries.length} candidates ---`);
  totalCandidates += entries.length;
  let shown = 0;
  for (const e of entries) {
    const rawAlg = canonRot ? simplifyAlg(`${canonRot} ${e.alg}`) : e.alg;
    if (!rawAlg) continue;
    if (!isAlgPrefix("", rawAlg)) continue;
    passedPrefix++;
    let post;
    try { post = startState.applyAlg(rawAlg); } catch { continue; }
    const postInfo = await detectStage(post);
    const targetSolved = postInfo.solvedSlots.includes(slotId);
    if (!targetSolved) {
      if (shown < 3) {
        console.log(`  [target NOT solved] ${e.caseName}: ${rawAlg}`);
        console.log(`    postInfo.stage: ${postInfo.stage}, solvedSlots: ${postInfo.solvedSlots}`);
        console.log(`    postInfo.solvedPairs: ${JSON.stringify(postInfo.solvedPairs)}`);
        shown++;
      }
      continue;
    }
    passedTargetSolved++;
    let preserved = true;
    for (const prevSlot of preEval.solvedSlots) {
      if (!postInfo.solvedSlots.includes(prevSlot)) { preserved = false; break; }
    }
    if (!preserved) {
      if (shown < 3) {
        console.log(`  [prev NOT preserved] ${e.caseName}: ${rawAlg}`);
        console.log(`    postInfo.solvedSlots: ${postInfo.solvedSlots}`);
        shown++;
      }
      continue;
    }
    passedPreserved++;
    if (shown < 3) {
      console.log(`  [PASS] ${e.caseName}: ${rawAlg}`);
      shown++;
    }
  }
}

console.log(`\n=== Totals ===`);
console.log(`candidates: ${totalCandidates}`);
console.log(`passed isAlgPrefix: ${passedPrefix}`);
console.log(`passed targetSolved: ${passedTargetSolved}`);
console.log(`passed preserved: ${passedPreserved}`);
