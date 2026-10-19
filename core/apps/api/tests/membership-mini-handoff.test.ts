import { afterEach, describe, expect, it, vi } from 'vitest';
import jwt from 'jsonwebtoken';
vi.mock('../src/utils/session.js', () => ({ JWT_SECRET: 'handoff-test-only' }));
import { issueMembershipHandoff, readMembershipHandoff } from '../src/payment/membership-handoff.js';
import { renewalReleased, renewalPilotAllowed, renewalDebitAllowed } from '../src/payment/membership-renewal-policy.js';
import { createPapayMiniEnrollment, signPapay } from '../src/payment/wechat-papay.js';

afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });
describe('mini enrollment boundaries', () => {
  it('binds the plan and owner, expires, and cannot be used as an account JWT', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-19T00:00:00Z'));
    const ticket = issueMembershipHandoff('u12', 'yearly_auto_renew');
    expect(readMembershipHandoff(ticket, 'u12')).toMatchObject({ priceCents: 29900, period: 'year' });
    expect(() => readMembershipHandoff(ticket, 'u13')).toThrow();
    expect(() => jwt.verify(ticket, 'handoff-test-only')).toThrow();
    expect(() => readMembershipHandoff(ticket.slice(0, -5) + 'wrong', 'u12')).toThrow();
    vi.advanceTimersByTime(601000);
    expect(() => readMembershipHandoff(ticket, 'u12')).toThrow();
    expect(() => issueMembershipHandoff('u12', 'monthly')).toThrow();
  });
  it('requires exact released mini identity; H5 approval cannot open the mini channel', () => {
    const env = { WECHAT_PAPAY_MONTHLY_APPROVED: '225492', WECHAT_PAPAY_YEARLY_APPROVED: '225493',
      WECHAT_PAPAY_RELEASE_ENABLED: 'true', WECHAT_PAPAY_SIGNING_CHANNEL: 'miniprogram', WECHAT_PAPAY_H5_APPROVED: 'true',
      WECHAT_PAPAY_APPID: 'wx1f92ba91b7e42015', WECHAT_MINI_APP_ID: 'wx1f92ba91b7e42015', WECHAT_MINI_APP_SECRET: 'fixture',
      WECHAT_PAPAY_MINI_RELEASED: 'wx1f92ba91b7e42015' };
    expect(renewalReleased(env)).toBe(true);
    for (const name of ['WECHAT_PAPAY_MINI_RELEASED', 'WECHAT_MINI_APP_ID', 'WECHAT_MINI_APP_SECRET', 'WECHAT_PAPAY_RELEASE_ENABLED']) {
      expect(renewalReleased({ ...env, [name]: '' })).toBe(false);
    }
  });
  it('signs the immutable fields and only targets the official signing Mini Program', () => {
    const key = 'x'.repeat(32);
    vi.stubEnv('WECHAT_PAPAY_APPID', 'wx1f92ba91b7e42015'); vi.stubEnv('WECHAT_PAPAY_MCHID', '1234567890');
    vi.stubEnv('WECHAT_PAPAY_API_V2_KEY', key);
    const contract = { appid: 'wx1f92ba91b7e42015', mch_id: '1234567890', plan_id: '225492', contract_code: 'test123', contract_id: null };
    const result = createPapayMiniEnrollment(contract, '12345', 'CubeRoot u12');
    expect(result.appId).toBe('wxbd687630cd02ce1d'); expect(result.path).toBe('pages/index/index');
    expect(result.extraData.request_serial).toBe(12345);
    const fields = Object.fromEntries(Object.entries(result.extraData).map(([k, v]) => [k, String(v)]));
    expect(fields.sign).toBe(signPapay(fields, key));
    expect(signPapay({ ...fields, plan_id: '225493' }, key)).not.toBe(fields.sign);
    expect(() => createPapayMiniEnrollment(contract, '9007199254740992', 'CubeRoot u12')).toThrow();
    expect(() => createPapayMiniEnrollment({ ...contract, mch_id: '2' }, '123', 'CubeRoot u12')).toThrow();
  });
});

it('limits private acceptance to its owner, expiry and explicitly enabled first payment', () => {
  const env = { WECHAT_PAPAY_MONTHLY_APPROVED: '225492', WECHAT_PAPAY_YEARLY_APPROVED: '225493',
    WECHAT_PAPAY_SIGNING_CHANNEL: 'miniprogram', WECHAT_PAPAY_APPID: 'wx1f92ba91b7e42015',
    WECHAT_MINI_APP_ID: 'wx1f92ba91b7e42015', WECHAT_MINI_APP_SECRET: 'fixture',
    WECHAT_PAPAY_PILOT_ENABLED: 'true', WECHAT_PAPAY_PILOT_OWNER: 'u12',
    WECHAT_PAPAY_PILOT_UNTIL: new Date(Date.now() + 3600000).toISOString() };
  expect(renewalReleased(env)).toBe(false);
  expect(renewalPilotAllowed('u12', env)).toBe(true);
  expect(renewalPilotAllowed('u13', env)).toBe(false);
  expect(renewalPilotAllowed(undefined, env)).toBe(false);
  expect(renewalPilotAllowed('u12', { ...env, WECHAT_PAPAY_PILOT_UNTIL: new Date(0).toISOString() })).toBe(false);
  expect(renewalPilotAllowed('u12', { ...env, WECHAT_PAPAY_PILOT_UNTIL: new Date(Date.now() + 8 * 86400000).toISOString() })).toBe(false);
  expect(renewalDebitAllowed('u12', 0, env)).toBe(false);
  const paid = { ...env, WECHAT_PAPAY_PILOT_DEBIT_ENABLED: 'true' };
  expect(renewalDebitAllowed('u12', 0, paid)).toBe(true);
  expect(renewalDebitAllowed('u12', 1, paid)).toBe(false);
  expect(renewalDebitAllowed('u13', 0, paid)).toBe(false);
});
