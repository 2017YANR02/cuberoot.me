import { describe, it, expect } from 'vitest';
import { renewalPlanConfigured, RENEWAL_TEMPLATES } from '../src/payment/membership-renewal-policy.js';
describe('enterprise renewal template approval', () => {
  const slug = 'enterprise_monthly_auto_renew';
  const env = { WECHAT_PAPAY_ENTERPRISE_MONTHLY_PLAN_ID: '345001', WECHAT_PAPAY_ENTERPRISE_MONTHLY_APPROVED: '345001' };
  it('requires approval of the exact template for the monthly plan', () => {
    expect(renewalPlanConfigured(slug, {})).toBe(false);
    expect(renewalPlanConfigured(slug, { ...env, WECHAT_PAPAY_ENTERPRISE_MONTHLY_APPROVED: 'true' })).toBe(false);
    expect(renewalPlanConfigured(slug, env)).toBe(true);
    expect(renewalPlanConfigured('enterprise_yearly_auto_renew', env)).toBe(false);
  });
  it('rejects personal templates', () => {
    for (const id of ['225492', '225493']) expect(renewalPlanConfigured(slug, {
      WECHAT_PAPAY_ENTERPRISE_MONTHLY_PLAN_ID: id, WECHAT_PAPAY_ENTERPRISE_MONTHLY_APPROVED: id,
    })).toBe(false);
    expect(renewalPlanConfigured('enterprise_monthly', env)).toBe(false);
  });
  it('locks reviewed prices and periods', () => {
    expect(RENEWAL_TEMPLATES.enterprise_monthly_auto_renew.cents).toBe(29900);
    expect(RENEWAL_TEMPLATES.enterprise_monthly_auto_renew.period).toBe('month');
  });
});
