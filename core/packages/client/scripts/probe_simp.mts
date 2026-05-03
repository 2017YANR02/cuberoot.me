import { simplifyAlg } from '../src/utils/cube3';
const tests = [
  "U' y2 F U R U2 R' U' R U2 R' U' F'",
  "y2 F U R",
  "U y2 F U R",
  "U2 y2 F U R",
  "U' y2 F U R",
];
for (const a of tests) console.log(`  ${a} → ${simplifyAlg(a)}`);
