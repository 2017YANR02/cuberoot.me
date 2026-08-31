import { beforeEach, describe, expect, it, vi } from 'vitest';

const { validateAlgCaseMock, validateStoredAlgCaseMock, setupForCaseMock } = vi.hoisted(() => ({
  validateAlgCaseMock: vi.fn(),
  validateStoredAlgCaseMock: vi.fn(),
  setupForCaseMock: vi.fn(() => 'computed setup'),
}));

vi.mock('@/lib/alg_validation', () => ({
  validateAlgCase: validateAlgCaseMock,
  validateStoredAlgCase: validateStoredAlgCaseMock,
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
    validateStoredAlgCaseMock.mockReset();
    validateStoredAlgCaseMock.mockResolvedValue({ ok: true, auf: '' });
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
    expect(validateStoredAlgCaseMock).toHaveBeenCalledWith(
      'computed setup',
      "R U R' U2",
      input.sticker,
      '3x3',
      'pll',
    );
  });

  it('rejects a stage-valid alg when its final stored state is incomplete', async () => {
    validateAlgCaseMock.mockResolvedValue({ ok: true, auf: '' });
    validateStoredAlgCaseMock.mockResolvedValue({ ok: false, reason: 'layers not aligned' });

    await expect(prepareCommunityAlgForSubmission(input)).resolves.toEqual({
      ok: false,
      kind: 'invalid',
      reason: 'layers not aligned',
    });
  });

  it.each(['y', 'y2', "y'"])('rejects a %s-led top-layer alg before state validation', async (lead) => {
    await expect(prepareCommunityAlgForSubmission({
      ...input,
      raw: `${lead} R U R'`,
    })).resolves.toEqual({
      ok: false,
      kind: 'leading-y-rotation',
      reason: '',
    });
    expect(validateAlgCaseMock).not.toHaveBeenCalled();
  });

  it('allows a leading y in a non-top-layer set', async () => {
    validateAlgCaseMock.mockResolvedValue({ ok: true, auf: '' });
    await expect(prepareCommunityAlgForSubmission({
      ...input,
      setSlug: 'f2l',
      raw: "y R U R'",
    })).resolves.toEqual({ ok: true, alg: "y R U R'" });
  });
});
