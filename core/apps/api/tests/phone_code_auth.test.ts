import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  issueCode: vi.fn(), markCodeDelivery: vi.fn(), sendSmsCode: vi.fn(),
  withVerifiedCode: vi.fn(), loginWithIdentity: vi.fn(), beginIdentityLogin: vi.fn(),
  addIdentity: vi.fn(), replaceCredentialIdentity: vi.fn(), findUserByIdentity: vi.fn(),
  transaction: { fixture: true },
}));
vi.mock('../src/db/connection.js', () => ({ transactionQuery: () => mocks.transaction }));
vi.mock('../src/utils/account.js', () => ({
  issueCode: mocks.issueCode, markCodeDelivery: mocks.markCodeDelivery,
  withVerifiedCode: mocks.withVerifiedCode, loginWithIdentity: mocks.loginWithIdentity,
  addIdentity: mocks.addIdentity, replaceCredentialIdentity: mocks.replaceCredentialIdentity,
  findUserByIdentity: mocks.findUserByIdentity,
  IdentityNotFoundError: class IdentityNotFoundError extends Error {},
}));
vi.mock('../src/utils/identity_choice.js', () => ({ beginIdentityLogin: mocks.beginIdentityLogin }));
vi.mock('../src/utils/sms.js', () => ({ sendSmsCode: mocks.sendSmsCode }));

import { PhoneCodeActionError, bindPhoneWithCode, issuePhoneCode, loginWithPhoneCode } from '../src/utils/phone_code_auth.js';

describe('phone code delivery and account mutation', () => {
  beforeEach(() => {
    for (const value of Object.values(mocks)) if (vi.isMockFunction(value)) value.mockReset();
    mocks.issueCode.mockResolvedValue({ id: 'reservation', code: '123456' });
    mocks.markCodeDelivery.mockResolvedValue(true);
    mocks.withVerifiedCode.mockImplementation(async (_channel, _target, _purpose, _code, action) =>
      ({ verified: true, value: await action(mocks.transaction) }));
  });

  it('keeps the SMS code pending until provider acceptance, then activates that reservation', async () => {
    let accept!: () => void;
    mocks.sendSmsCode.mockReturnValue(new Promise<void>(resolve => { accept = resolve; }));
    const issuing = issuePhoneCode('+8613800138000', 'login');

    await vi.waitFor(() => expect(mocks.sendSmsCode).toHaveBeenCalledTimes(1));
    expect(mocks.issueCode).toHaveBeenCalledWith('phone', '+8613800138000', 'login', undefined, { deliveryStatus: 'pending' });
    expect(mocks.markCodeDelivery).not.toHaveBeenCalled();

    accept();
    await expect(issuing).resolves.toEqual({ ok: true });
    expect(mocks.markCodeDelivery).toHaveBeenCalledWith('reservation', 'sent');
  });

  it('never activates a rejected SMS and does not retry provider delivery', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      mocks.sendSmsCode.mockRejectedValue(new Error('provider rejected'));
      await expect(issuePhoneCode('+8613800138000', 'link')).rejects.toMatchObject({ code: 'send_failed' });
      expect(mocks.markCodeDelivery).toHaveBeenCalledWith('reservation', 'failed');
      expect(mocks.markCodeDelivery).not.toHaveBeenCalledWith('reservation', 'sent');
      expect(mocks.sendSmsCode).toHaveBeenCalledTimes(1);
    } finally { log.mockRestore(); }
  });

  it('passes the proof transaction through login and rolls back a binding conflict', async () => {
    mocks.beginIdentityLogin.mockResolvedValue({ pending: { ticket: 'ticket' } });
    await loginWithPhoneCode('+8613800138000', '123456', false);
    expect(mocks.beginIdentityLogin).toHaveBeenCalledWith(expect.objectContaining({ provider: 'phone' }), { transaction: mocks.transaction });

    mocks.addIdentity.mockResolvedValue('conflict');
    await expect(bindPhoneWithCode(42, '+8613800138000', '123456')).rejects.toEqual(new PhoneCodeActionError('conflict'));
    expect(mocks.addIdentity).toHaveBeenCalledWith(42, 'phone', '+8613800138000', undefined, undefined, undefined, undefined, undefined, mocks.transaction);
  });
});
