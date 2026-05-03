import { Alg } from 'cubing/alg';
function simp1(a: string) { return new Alg(a).experimentalSimplify({ cancel: true }).toString(); }
function simp2(a: string) { return new Alg(a).experimentalSimplify({ cancel: { puzzleSpecificModWrap: 'canonical-centered' } }).toString(); }
function simp3(a: string) { return new Alg(a).experimentalSimplify({ cancel: { puzzleSpecificModWrap: 'gravest' } }).toString(); }
function simp4(a: string) { return new Alg(a).experimentalSimplify({ cancel: { directional: 'any-direction', puzzleSpecificModWrap: 'canonical-centered' } }).toString(); }
function simp5(a: string) { return new Alg(a).experimentalSimplify({ cancel: { directional: 'any-direction', puzzleSpecificModWrap: 'gravest' } }).toString(); }
import { simplifyAlg } from '../src/utils/cube3';
const tests = [
  "U U F D R D' F'",
  "U U U F D R D' F'",
  "U U U U F D R D' F'",
  "U U U U U F D R D' F'",
  "U2 U F2 L' U' L U F2",
  "U2 U' R U' R2 f' U' f R",
];
for (const a of tests) console.log(`  ${a}`);
console.log('---');
for (const a of tests) {
  console.log(`  in: ${a}`);
  try { console.log(`    cancel:true                    → ${simp1(a)}`); } catch (e) { console.log('    err:', (e as Error).message); }
  try { console.log(`    cancel.modWrap=canonical-centered → ${simp2(a)}`); } catch (e) { console.log('    err:', (e as Error).message); }
  try { console.log(`    cancel.modWrap=gravest         → ${simp3(a)}`); } catch (e) { console.log('    err:', (e as Error).message); }
  try { console.log(`    directional+canonical-centered → ${simp4(a)}`); } catch (e) { console.log('    err:', (e as Error).message); }
  try { console.log(`    directional+gravest            → ${simp5(a)}`); } catch (e) { console.log('    err:', (e as Error).message); }
  console.log(`    via simplifyAlg                → ${simplifyAlg(a)}`);
}
