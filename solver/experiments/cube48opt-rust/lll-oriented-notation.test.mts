import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { algSpeed } from '../../../core/packages/client/lib/mcc.ts';
import { isAllowedZbllAlgorithm } from './zbll-mcc-notation.mts';
import { orientedSpellings, outerKey, scoreOriented, splitLiteralOrientation, executableAlgorithm, fixedCaseSetup, compareOriented } from './lll-oriented-notation.mts';

const root = resolve(import.meta.dirname, '../../..');
const { puzzles } = await import(resolve(root, 'core/packages/client/node_modules/cubing/dist/lib/cubing/puzzles/index.js'));
const identity = (await puzzles['3x3x3'].kpuzzle()).defaultPattern();
test('website A+ RUD is recovered from the same outer path, without a library candidate injection', () => {
  const standard = "U' x R' U R' D2 R U' R' D2 R2 x'";
  const parts = splitLiteralOrientation(standard)!;
  assert.equal(parts.body, "R' U R' D2 R U' R' D2 R2");
  assert.equal(scoreOriented(parts).mcc, 12.6);
  const output = orientedSpellings(outerKey(standard), ['x']);
  assert(output.some(a => a.algorithm === standard));
  assert.equal(output[0].body, parts.body);
  for (const a of output) {
    assert(isAllowedZbllAlgorithm(a.body));
    assert.deepEqual(identity.applyAlg(a.algorithm).patternData, identity.applyAlg(standard).patternData);
  }
});
test('boundary AUF stays in the case frame; a body U after a rotation is charged', () => {
  const a = splitLiteralOrientation("U' x U R U2 x' U")!;
  assert.equal(a.preAuf, "U'"); assert.equal(a.postAuf, 'U'); assert.equal(a.body, 'U R U2');
  assert.equal(scoreOriented(a).mcc, algSpeed('U R U2', false, false));
  assert.notEqual(scoreOriented(a).mcc, algSpeed('U R U2', false, true));
});
test('orientation metadata cannot conceal forbidden body moves or mid-algorithm rotations', () => {
  for (const alg of ["x l U l' x'", "x B U B' x'", "x R y R' x'", "x R x"]) assert.equal(splitLiteralOrientation(alg), null);
  assert.throws(() => executableAlgorithm({ preAuf: 'B', orientation: '', body: 'R', restoreOrientation: '', postAuf: '' }));
});
test('different starting frames retain exact transforms, including centres', () => {
  for (const alg of ["R U R' U'", "R2 D R2 D'", 'M2 U M2 U2 M2 U M2']) {
    for (const a of orientedSpellings(outerKey(alg))) {
      assert.deepEqual(identity.applyAlg(a.algorithm).patternData, identity.applyAlg(alg).patternData);
    }
  }
});
test('V source setup requires an explicit y-prime correction to the fixed solver frame', () => {
  const source = "R' U R' d' R' F' R2 U' R' U R' F R F U'";
  const fixed = fixedCaseSetup(source);
  assert.equal(fixed.sourceSetup, source);
  assert.equal(fixed.orientationCorrection, "y'");
  assert.deepEqual(identity.applyAlg(fixed.algorithm).patternData, identity.applyAlg(fixed.canonical).patternData);
  assert.notDeepEqual(identity.applyAlg(source).patternData, identity.applyAlg(fixed.canonical).patternData);
});

test('E equal-MCC RUD spelling takes priority over two wide U turns', () => {
  const plain = "x' R U' R' D R U R' D' R U R' D R U' R' D' x";
  const wide = "x' R u' R' D R U R' D' R u R' D R U' R' D' x";
  const a = scoreOriented(splitLiteralOrientation(plain)!);
  const b = scoreOriented(splitLiteralOrientation(wide)!);
  assert.equal(a.mcc, 16.6); assert.equal(b.mcc, 16.6);
  assert(compareOriented(a, b) < 0);
  assert.deepEqual(identity.applyAlg(plain).patternData, identity.applyAlg(wide).patternData);
});
