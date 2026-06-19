import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { membershipExpiry, EXPIRE_SOON_DAYS, type Membership } from '@/lib/membership-api';

// 固定「现在」= 2026-06-18T00:00:00Z,让 daysLeft 计算确定可断言。
const NOW = new Date('2026-06-18T00:00:00.000Z');

function m(over: Partial<Membership>): Membership {
  return {
    wcaId: '2017TEST01', name: 'Test', planSlug: 'monthly',
    startedAt: '2026-01-01T00:00:00.000Z', expiresAt: null,
    lifetime: false, active: true, source: 'alipay',
    ...over,
  };
}

describe('membershipExpiry', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW); });
  afterEach(() => { vi.useRealTimers(); });

  it('null 会员返回 null', () => {
    expect(membershipExpiry(null)).toBeNull();
  });

  it('永久会员:lifetime + 不提醒', () => {
    const e = membershipExpiry(m({ lifetime: true, active: true, expiresAt: null }))!;
    expect(e).toMatchObject({ lifetime: true, active: true, expired: false, daysLeft: null, expiringSoon: false });
  });

  it('远期会员:不算即将到期', () => {
    const e = membershipExpiry(m({ expiresAt: '2026-12-18T00:00:00.000Z' }))!;
    expect(e.expiringSoon).toBe(false);
    expect(e.expired).toBe(false);
    expect(e.daysLeft).toBeGreaterThan(EXPIRE_SOON_DAYS);
  });

  it('剩 7 天(阈值边界):算即将到期', () => {
    const e = membershipExpiry(m({ expiresAt: '2026-06-25T00:00:00.000Z' }))!;
    expect(e.daysLeft).toBe(EXPIRE_SOON_DAYS);
    expect(e.expiringSoon).toBe(true);
    expect(e.expired).toBe(false);
  });

  it('剩 8 天:不算即将到期', () => {
    const e = membershipExpiry(m({ expiresAt: '2026-06-26T00:00:00.000Z' }))!;
    expect(e.daysLeft).toBe(8);
    expect(e.expiringSoon).toBe(false);
  });

  it('已过期会员(active=false):expired=true、不重复算 expiringSoon', () => {
    const e = membershipExpiry(m({ active: false, expiresAt: '2026-06-10T00:00:00.000Z' }))!;
    expect(e.expired).toBe(true);
    expect(e.expiringSoon).toBe(false);
    expect(e.daysLeft).toBeLessThan(0);
  });
});
