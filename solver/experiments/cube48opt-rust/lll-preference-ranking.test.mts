import assert from 'node:assert/strict';
import test from 'node:test';
import { moveFeatures, trainPreference, preferenceScore, comparePreference, rankPreference } from './lll-preference-ranking.mts';
import { wideTurnCount } from './zbll-mcc-notation.mts';

test('one-constraint optimum has the correct sign and margin', () => {
  const model = trainPreference([{ preferred: { body: 'R', features: { mcc: 1, local: 1 } },
    alternatives: [{ body: 'L', features: { mcc: 1, local: 0 } }] }]);
  assert.equal(model.weights.local, -1);
  assert.equal(model.minimumMargin, 1);
  assert(preferenceScore(model, { mcc: 1, local: 1 }) < preferenceScore(model, { mcc: 1, local: 0 }));
});

test('scoring is independent of case identity, source order and serialisation', () => {
  const preferred = { body: "R U R'", features: moveFeatures("R U R'") };
  const other = { body: 'F2 R2 F2', features: moveFeatures('F2 R2 F2') };
  const model = trainPreference([{ preferred, alternatives: [other] }]);
  const reload = JSON.parse(JSON.stringify(model));
  assert.equal(preferenceScore(model, preferred.features), preferenceScore(reload, preferred.features));
  assert.deepEqual(moveFeatures("R2' U R'"), moveFeatures("R2 U R'"));
  assert(!Object.keys(preferred.features).some(k => /case|source|preferred|rank/i.test(k)));
  assert(Object.keys(preferred.features).filter(k => /^moves\d:/.test(k)).every(k => k.split(':')[1].split(' ').length <= 3));
});

test('identical feature vectors cannot be claimed as strictly ranked', () => {
  const item = { body: 'R', features: { mcc: 1 } };
  const model = trainPreference([{ preferred: item, alternatives: [item] }]);
  assert.equal(model.minimumMargin, 0);
  assert.equal(preferenceScore(model, item.features), 1);
});

test('equal-margin numerical noise falls back to MCC in a transitive ordering', () => {
  const a = { body: 'R', score: 3.413189285, mcc: 26.7 };
  const b = { body: 'U', score: 3.413189383, mcc: 16.6 };
  assert(comparePreference(a, b) > 0);
  assert.equal(comparePreference(a, b), -comparePreference(b, a));
  assert(comparePreference({ ...a, score: 2.413189285 }, b) < 0);
});

test('same-MCC single-layer preference overrides model scores without comparison cycles', () => {
  const wide = { body: "r U r'", score: 0, mcc: 5 };
  const other = { body: 'F2', score: 1, mcc: 6 };
  const single = { body: "R U R'", score: 2, mcc: 5 };
  for (const input of [[wide, other, single], [single, wide, other], [other, single, wide]]) {
    const ranked = rankPreference(input);
    assert.deepEqual(ranked, [single, other, wide]);
    assert.deepEqual(rankPreference(ranked), ranked);
  }
  assert.deepEqual(rankPreference([other, wide]), [wide, other]);
});

test('two-layer notation is distinct from half-turns, rotations, and single slices', () => {
  assert.equal(wideTurnCount("R R2 U2 M M2 E S2 x y'"), 0);
  assert.equal(wideTurnCount("r r' r2 u Uw Rw2' f2"), 7);
});
