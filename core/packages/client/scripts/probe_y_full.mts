import { getCube3 } from '../src/utils/cube3.ts';

const kp = await getCube3();
const solved = kp.defaultPattern();
const yState = solved.applyAlg('y');

console.log('y on solved cube — full state dump:');
for (const orbit of Object.keys(yState.patternData)) {
  const od = (yState.patternData as any)[orbit];
  console.log(`  ${orbit}.pieces:      `, od.pieces);
  if ('orientation' in od) console.log(`  ${orbit}.orientation:`, od.orientation);
}

console.log('\nFor comparison, cube3 Uw equivalent:');
const uwState = solved.applyAlg('Uw');
for (const orbit of Object.keys(uwState.patternData)) {
  const od = (uwState.patternData as any)[orbit];
  console.log(`  ${orbit}.pieces:      `, od.pieces);
  if ('orientation' in od) console.log(`  ${orbit}.orientation:`, od.orientation);
}

console.log("\nFor comparison, U' Dw' equivalent (y = U Dw'):");
const u_dw = solved.applyAlg("U Dw'");
for (const orbit of Object.keys(u_dw.patternData)) {
  const od = (u_dw.patternData as any)[orbit];
  console.log(`  ${orbit}.pieces:      `, od.pieces);
  if ('orientation' in od) console.log(`  ${orbit}.orientation:`, od.orientation);
}
