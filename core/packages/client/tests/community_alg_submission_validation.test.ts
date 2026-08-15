import { beforeEach, describe, expect, it, vi } from 'vitest';

const { validateAlgCaseMock, setupForCaseMock } = vi.hoisted(() => ({
  validateAlgCaseMock: vi.fn(),
  setupForCaseMock: vi.fn(() => 'computed setup'),
}));

vi.mock('@/lib/alg_validation', () => ({
  validateAlgCase: validateAlgCaseMock,
  setupForCase: setupForCaseMock,
}));

import { prepareCommunityAlgForSubmission } from '@/components/CommunityAlgs';

const input = {
  raw: "R U R'",
  puzzle: '3x3',
  setSlug: 'pll',
  sticker: {
    kind: 'face' as const,
    us: 'UUUUUUUUU',
    ub: 'UUU',
    uf: 'UUU',
    ul: 'UUU',
    ur: 'UUU',
  },
  setup: "R U' R'",
  firstAlg: "R U R'",
};

describe('community alg submission validation', () => {
  beforeEach(() => {
    validateAlgCaseMock.mockReset();
    setupForCaseMock.mockClear();
  });

  it('returns no writable alg when the cube state is wrong', async () => {
    validateAlgCaseMock.mockResolvedValue({ ok: false, reason: 'wrong cube state' });

    await expect(prepareCommunityAlgForSubmission(input)).resolves.toEqual({
      ok: false,
      kind: 'invalid',
      reason: 'wrong cube state',
    });
  });

  it('fails closed when the validator is unavailable', async () => {
    validateAlgCaseMock.mockRejectedValue(new Error('validator crashed'));

    await expect(prepareCommunityAlgForSubmission(input)).resolves.toEqual({
      ok: false,
      kind: 'unavailable',
      reason: 'validator crashed',
    });
  });

  it('only returns a writable alg after validation and appends the required AUF', async () => {
    validateAlgCaseMock.mockResolvedValue({ ok: true, auf: 'U2' });

    await expect(prepareCommunityAlgForSubmission(input)).resolves.toEqual({
      ok: true,
      alg: "R U R' U2",
    });
    expect(validateAlgCaseMock).toHaveBeenCalledWith(
      'computed setup',
      "R U R'",
      input.sticker,
      '3x3',
      'pll',
    );
  });
});
