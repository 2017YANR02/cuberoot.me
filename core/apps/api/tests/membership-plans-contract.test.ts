import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('membership plan visibility contract', () => {
  it('keeps public plans active-only while returning hidden plans to administrators', async () => {
    const route = await readFile(new URL('../src/routes/membership.ts', import.meta.url), 'utf8');
    const publicStart = route.indexOf("membershipRoutes.get('/membership/plans'");
    const adminStart = route.indexOf("membershipRoutes.get('/membership/admin/list'");
    const adminEnd = route.indexOf("membershipRoutes.delete('/membership/admin/member", adminStart);
    const publicBlock = route.slice(publicStart, route.indexOf("membershipRoutes.get('/membership/me'", publicStart));
    const adminBlock = route.slice(adminStart, adminEnd);

    expect(route).toContain('active: p.active !== false');
    expect(publicBlock).toContain("c.header('Cache-Control', 'no-store')");
    expect(publicBlock).toContain('WHERE active = TRUE');
    expect(adminBlock).toContain('SELECT * FROM membership_plans ORDER BY sort, price_cents');
    expect(adminBlock).toContain('plans: plans.map(planToJson)');
    expect(adminBlock).not.toContain('WHERE active = TRUE');
  });
});
