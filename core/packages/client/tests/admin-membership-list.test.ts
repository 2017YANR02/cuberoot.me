// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';

vi.mock('@/hooks/useT', () => ({ useT: () => (zh: string) => zh }));
vi.mock('@/i18n/tr', () => ({ useLang: () => 'zh' }));
vi.mock('@/lib/membership-api', async (original) => ({
  ...await original<typeof import('@/lib/membership-api')>(),
  adminList: async () => ({
    members: ['yearly', 'monthly', 'enterprise_yearly', 'enterprise_monthly', 'lifetime', 'unknown'].map((planSlug, index) => ({
      wcaId: `u${index}`, name: planSlug, planSlug, active: false,
      // Identical expiry dates must not determine the purchased period.
      expiresAt: '2027-10-04T00:00:00Z', lifetime: planSlug === 'lifetime',
      source: index === 4 ? 'manual' : 'wechat',
      payment: index === 0 ? { provider: 'xunhupay', payChannel: 'wechat', paidAt: '2026-10-02T12:00:00Z', amountCents: 19900, currency: 'CNY' }
        : index === 4 ? { provider: 'manual', payChannel: null, paidAt: '2026-10-02T12:00:00Z', amountCents: 0, currency: 'CNY' } : null,
    })),
    plans: [
      { slug: 'yearly', period: 'year' }, { slug: 'monthly', period: 'month' },
      { slug: 'enterprise_yearly', period: 'year' }, { slug: 'enterprise_monthly', period: 'month' },
    ].map(plan => ({ ...plan, periodCount: 1, nameZh: plan.slug, nameEn: plan.slug })),
    orders: [],
  }),
}));
import MembershipList from '@/app/[lang]/admin/users/MembershipList';

it('shows personal/enterprise and purchased periods without guessing from expiry or missing plans', async () => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement('div');
  const root = createRoot(host);
  try {
    await act(async () => root.render(createElement(MembershipList, { onChanged: vi.fn() })));
    const rows = [...host.querySelectorAll('tbody tr')].map(row => [...row.querySelectorAll('td')].map(cell => cell.textContent));
    expect(rows.map(row => [row[1], row[2]])).toEqual([
      ['个人', '年度 · 1 年'], ['个人', '非年度 · 1 个月'],
      ['企业', '年度 · 1 年'], ['企业', '非年度 · 1 个月'],
      ['个人', '非年度 · 永久'], ['个人', '周期未记录'],
    ]);
    expect(host.querySelectorAll('tbody button')).toHaveLength(0);
    expect(rows[0].slice(4, 7)).toEqual(['微信支付', '2026-10-02', '¥199 CNY']);
    expect(rows[4].slice(4, 7)).toEqual(['手动开通', '—', '无支付']);
    expect(rows[5].slice(4, 7)).toEqual(['未记录', '未记录', '未记录']);
  } finally {
    await act(async () => root.unmount());
  }
});
