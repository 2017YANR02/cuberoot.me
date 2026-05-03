import { detectStage } from '../src/utils/stage_detect';
import { patternFromAlg, simplifyAlg } from '../src/utils/cube3';
import { lookupPllAlgs } from '../src/utils/pll_lookup';
import { bestTopRotationAlg } from '../src/utils/stage_detect';

const scramble = "M2 U' M2 U2 M2 U' M2";
const state = await patternFromAlg(scramble);
console.log('stage:', (await detectStage(state)).stage);

const canonRot = await bestTopRotationAlg(state);
const canonical = canonRot ? state.applyAlg(canonRot) : state;
const entries = await lookupPllAlgs(canonical);
console.log(`canonRot: "${canonRot || '(none)'}", PLL candidates: ${entries.length}`);

let best: { alg: string; caseName: string } | null = null;
for (const e of entries) {
  const rawAlg = canonRot ? simplifyAlg(`${canonRot} ${e.alg}`) : e.alg;
  const post = state.applyAlg(rawAlg);
  const info = await detectStage(post);
  if (info.stage === 'solved') {
    if (!best || rawAlg.length < best.alg.length) best = { alg: rawAlg, caseName: e.caseName };
  }
}
console.log(`shortest: ${best?.caseName} → ${best?.alg}`);
