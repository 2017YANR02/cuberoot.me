import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rankSolution, compareSolutions, PairSelection } from './double-zbll-selection.mjs';
test('saved candidates do not retain their source CSV chunks', { skip: !global.gc }, () => {
  const s = new PairSelection({ N: 16, cases: Array(16), states: Array.from({ length: 16 }, (_, caseIndex) => ({ caseIndex })) });
  global.gc!();
  const before = process.memoryUsage().heapUsed;
  let count = 0;
  for (let a = 0; a < 16 && count < 64; a++) for (let b = a; b < 16 && count < 64; b++, count++) {
    // At most 4 MiB of synthetic input; no solver, table or actual journal.
    const chunk = Buffer.from(`${a * 16 + b},17,${Array(17).fill('R').join(' ')}\n${' '.repeat(65_000)}`).toString();
    const match = /^(\d+),(\d+),([URFDLB2' ]+)$/m.exec(chunk)!;
    s.accept(Number(match[1]), 17, match[3]);
  }
  global.gc!();
  const retained = process.memoryUsage().heapUsed - before;
  assert.equal(s.snapshot().rows.length, 64);
  assert.ok(retained < 2 * 2 ** 20, `64 short candidates retained ${retained} bytes`);
});
test('HTM, then QTM, then generator count; face identity never breaks ties',()=>{
  assert.deepEqual(rankSolution("R R' R2 U"),{htm:4,qtm:5,generators:2});
  assert.ok(compareSolutions(rankSolution('R2 U2'),rankSolution('R U F'))<0);
  assert.ok(compareSolutions(rankSolution('R U F'),rankSolution('R2 U R'))<0);
  assert.ok(compareSolutions(rankSolution('R U R'),rankSolution('R U F'))<0);
  assert.equal(compareSolutions(rankSolution('R U R'),rankSolution('R F R')),0);
  assert.throws(()=>rankSolution('Rw U')); assert.throws(()=>rankSolution(''));
});
test('all AUF candidates and swapped pair share ranking, and full ties retain prior candidate',()=>{
  const s=new PairSelection({N:4,cases:[{},{}],states:[{caseIndex:0},{caseIndex:0},{caseIndex:1},{caseIndex:1}]});
  s.accept(2,3,'R2 U F'); s.accept(3,3,'R U F'); s.accept(6,3,'R U R');
  s.accept(12,3,'R F R'); // Swapped pair and same metrics: keep the previous candidate.
  assert.equal(s.get(1)!.stateId,6);
  assert.deepEqual(s.get(1),{pair:1,top:0,bottom:1,stateId:6,solution:'R U R',htm:3,qtm:3,generators:2});
  s.accept(7,2,'R2 U2');assert.equal(s.get(1)!.stateId,7);
  assert.equal(s.snapshot().rows.length,1);
  assert.throws(()=>s.accept(16,2,'R U'));assert.throws(()=>s.accept(1,2,'R'));
});
