import type { AlgSticker } from '@cuberoot/shared';
import { describe, expect, it } from 'vitest';
import { validateAlgCase } from '@/lib/alg_validation';

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
