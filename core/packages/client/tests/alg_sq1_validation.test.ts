import type { AlgSticker } from '@cuberoot/shared';
import { describe, expect, it } from 'vitest';
import { validateAlgCase, validateStoredAlgCase } from '@/lib/alg_validation';
import { scanCases } from '@/lib/alg_validation_scan';

const RAW_STICKER: AlgSticker = { kind: 'raw', tag: 'sqcube', attrs: {} };
const SETUP_3_1 = '1,0 / -3,0 / -1,0';

describe('Square-1 CO validation', () => {
  it('accepts the valid 3-1 algorithm and rejects the three wrong variants', async () => {
    await expect(validateAlgCase(SETUP_3_1, '1,0 / 3,0 / -1,0', RAW_STICKER, 'sq1', 'co'))
      .resolves.toEqual({ ok: true, auf: '' });

    for (const alg of [
      '1,0 / -3,0 / -1,0',
      '1,0 / 0,3 / -1,0',
      '1,0 / 0,-3 / -1,0',
    ]) {
      const result = await validateAlgCase(SETUP_3_1, alg, RAW_STICKER, 'sq1', 'co');
      expect(result).toEqual({ ok: false, reason: '八个角没全部翻色' });
    }
  });

  it('allows layer permutation after CO is complete', async () => {
    await expect(validateAlgCase('', '3,0', RAW_STICKER, 'sq1', 'co'))
      .resolves.toEqual({ ok: true, auf: '' });
  });
});

describe('Square-1 EP stored-alg validation', () => {
  const setup = '(1,0) / (2,-1) / (1,1) / (-3,0) / (-1,0)';
  const complete = '1,0 / 3,0 / -1,-1 / -2,1 / -1';
  // 等价于漏掉最后的 (-1,0)：EP 已完成，但顶层仍偏转一步。
  const missingFinalLayerTurn = '1,0 / 3,0 / -1,-1 / -2,1 /';

  it('keeps stage validation AUF-tolerant but requires stored formulas to align both layers', async () => {
    await expect(validateAlgCase(setup, missingFinalLayerTurn, RAW_STICKER, 'sq1', 'ep'))
      .resolves.toEqual({ ok: true, auf: '' });
    await expect(validateStoredAlgCase(setup, complete, RAW_STICKER, 'sq1', 'ep'))
      .resolves.toEqual({ ok: true, auf: '' });

    const result = await validateStoredAlgCase(setup, missingFinalLayerTurn, RAW_STICKER, 'sq1', 'ep');
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('U/D');
  });

  it('the admin scan reports an EP formula missing its final layer turn', async () => {
    const failures = await scanCases('sq1', 'ep', [{
      name: 'Adj / Adj',
      subgroup: '',
      setup,
      sticker: RAW_STICKER,
      algs: [[{ alg: missingFinalLayerTurn }]],
    }]);
    expect(failures).toHaveLength(1);
    expect(failures[0]).toMatchObject({ alg: missingFinalLayerTurn, oriIdx: 0, algIdx: 0 });
  });

  it('rejects a formula whose slash tries to cut through a piece', async () => {
    const legacySetup = '(1,0)/(-1,-1)/(-6,0)/(1,1)/(-1,0)/(0,-3)/(-1,-1)/(-6,0)/(1,1)/(-1,0)';
    const legacyAlg = '1,0/-1,-1/6,0/1,1/0,3/1,0/-1,-1/6,0/1,1/-1,0';
    const result = await validateStoredAlgCase(legacySetup, legacyAlg, RAW_STICKER, 'sq1', 'ep');
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/无法切片|cannot be sliced/);
  });
});
