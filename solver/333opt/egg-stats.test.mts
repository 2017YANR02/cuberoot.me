import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeEggResult } from './solve-egg.mts';
import { statsEngine } from './stats-engine.mts';

const pending = [{ id: '501', scramble: 'R' }, { id: '902', scramble: 'U' }];
const result = (index: number, moves: string, length = 1, ok = true) => JSON.stringify({ type: 'solved', index, moves, length, ok });
test('out-of-order Egg indices retain WCA IDs and reject repeated results', () => {
  const seen = new Set<number>();
  assert.equal(decodeEggResult(result(1, "U'"), pending, seen)?.id, '902');
  assert.throws(() => decodeEggResult(result(1, "U'"), pending, seen), /duplicate/);
  assert.equal(decodeEggResult(result(0, "R'"), pending, seen)?.id, '501');
  assert.equal(decodeEggResult('{"type":"total","cubes":2}', pending, seen), null);
});
test('failed, malformed, out-of-range and missing solves cannot be appended', () => {
  for (const raw of [result(0, "R'", 1, false), result(0, "R'", 2), result(2, "R'"), result(0, 'x'), '{"type":"total","cubes":2}']) {
    assert.throws(() => decodeEggResult(raw, pending, new Set()));
  }
});
test('128 GiB machines select Egg 64G with matching table and resource budget', () => {
  const config = statsEngine('/repo', {}, 128 * 2 ** 30);
  assert.equal(config.engine, 'egg');
  assert.equal(config.rssLimit, 64 * 2 ** 30);
  assert.equal(config.expectedBytes, 62_261_825_536);
  assert.equal(config.h, 11);
  assert.equal(config.startupRequiredBytes, 67 * 2 ** 30);
  assert.match(config.table, /h11$/);
});
test('64 GiB machines select Egg 32G; intermediate memory never selects the larger table', () => {
  for (const physicalGiB of [64, 96, 127]) {
    const config = statsEngine('/repo', {}, physicalGiB * 2 ** 30);
    assert.equal(config.engine, 'egg');
    assert.equal(config.memoryGiB, 32);
    assert.equal(config.h, 10);
    assert.equal(config.rssLimit, 32 * 2 ** 30);
    assert.equal(config.startupRequiredBytes, 35 * 2 ** 30);
    assert.equal(config.expectedBytes, 31_130_914_816);
    assert.match(config.table, /h10$/);
  }
  assert.throws(() => statsEngine('/repo', {}, 32 * 2 ** 30), /physical memory/);
});
test('explicit legacy selection remains available', () => {
  assert.equal(statsEngine('/repo', { H10_ENGINE: 'opt10' }).expectedBytes, 31_130_911_744);
});
