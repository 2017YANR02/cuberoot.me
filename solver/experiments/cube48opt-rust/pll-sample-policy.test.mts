import test from 'node:test';
import assert from 'node:assert/strict';
import { pllRequest, pllPolicy, validatePllSession } from './pll-sample-policy.mts';
test('PLL is fixed, bounded and cannot reset resource history or reuse a receipt', () => {
  const r = pllRequest(); assert.equal(pllPolicy(r).deadlineMs, 600000);
  for (const x of [{ ...r, args: [...r.args.slice(0, -1), '0'] }, { ...r, label: 'other' },
    { ...r, env: { ...r.env, CUBEOPT_SEARCH_THREADS: '4' } }, { ...r, env: { ...r.env, CUBEOPT_H: '11' } }]) assert.throws(() => pllPolicy(x));
  const e = { boot: 'same boot', swapouts: 16 }, n = { ...e, pressure: 1, available: 15565455360 + 4 * 2 ** 30 };
  const s = { schema: 'cuberoot.pll-21.session.v1', request: r, evidence: e, ...e, preparedAt: new Date().toISOString() };
  validatePllSession(s, e, n);
  for (const x of [{ ...n, swapouts: 17 }, { ...n, boot: 'changed' }, { ...n, pressure: 2 }, { ...n, available: n.available - 1 }]) assert.throws(() => validatePllSession(s, e, x));
  assert.throws(() => validatePllSession(s, e, n, true)); assert.throws(() => validatePllSession(s, e, n, false, true));
});
