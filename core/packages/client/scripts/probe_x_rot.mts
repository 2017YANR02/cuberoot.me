import { cube3x3x3 } from 'cubing/puzzles';
const kp = await cube3x3x3.kpuzzle();
const solved = kp.defaultPattern();
for (const r of ["x'", "x", "x2", "z'", "z", "z2"]) {
  const t = solved.applyAlg(r);
  console.log(`${r}:`, t.patternData.CENTERS.pieces);
}
