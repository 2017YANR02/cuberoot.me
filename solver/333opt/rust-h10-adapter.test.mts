import assert from 'node:assert/strict';
import test from 'node:test';
import { rustCsv, rustScramble } from './rust-h10-adapter.mts';
test('paired x2 conjugation retains the frame and rejects unsupported setup notation', () => {
  assert.equal(rustScramble("R x2 U D' F2 B L R' x2 U"), "R D U' B2 F L R' U");
  assert.throws(() => rustScramble('x2 U'));
  assert.throws(() => rustScramble('y R'));
});
test('Rust output preserves move sequence and HTM in existing checkpoint format', () => {
  assert.equal(rustCsv(JSON.stringify({ id: '123', solution: "R U2 R'", length: 3, cancelled: false })), "123,3,R U2 R'");
});
test('partial searches, bad ids, invalid moves and length mismatches cannot become saved results', () => {
  const good = { id: '123', solution: 'R U2', length: 2, cancelled: false };
  for (const delta of [{ cancelled: true }, { cancelled: undefined }, { id: '12,3' }, { length: 3 }, { solution: 'x R' }, { solution: null }])
    assert.throws(() => rustCsv(JSON.stringify({ ...good, ...delta })));
});
