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

  it('lists active opted-in members and defaults existing accounts to visible', async () => {
    const route = await readFile(new URL('../src/routes/membership.ts', import.meta.url), 'utf8');
    const migration = await readFile(new URL('../migrations/0210_membership_listing_visibility.sql', import.meta.url), 'utf8');
    const listStart = route.indexOf("membershipRoutes.get('/membership/members'");
    const listBlock = route.slice(listStart, route.indexOf("membershipRoutes.get('/membership/profile", listStart));

    expect(migration).toContain('show_in_member_list BOOLEAN NOT NULL DEFAULT TRUE');
    expect(listBlock).toContain('COALESCE(u.show_in_member_list, TRUE) = TRUE');
    expect(listBlock).toContain('(m.expires_at IS NULL OR m.expires_at > NOW())');
    expect(route).toContain("body.showInMemberList != null && typeof body.showInMemberList !== 'boolean'");
    expect(route).toContain('show_in_member_list = COALESCE(?::boolean, u.show_in_member_list)');
  });

  it('lets administrators edit and publicly display a member profile without a paid membership row', async () => {
    const route = await readFile(new URL('../src/routes/membership.ts', import.meta.url), 'utf8');
    const listStart = route.indexOf("membershipRoutes.get('/membership/members'");
    const profileStart = route.indexOf("membershipRoutes.get('/membership/profile");
    const meStart = route.indexOf("membershipRoutes.get('/membership/me'");
    const updateStart = route.indexOf("membershipRoutes.put('/membership/me/profile'");

    expect(route.slice(listStart, profileStart)).toContain('OR u.is_admin = TRUE');
    expect(route.slice(profileStart, meStart)).toContain('profile.active_member || profile.is_admin || isAdminWcaId(wcaId)');
    expect(route.slice(meStart, updateStart)).toContain('if (!profile && user.isAdmin)');
    expect(route.slice(updateStart)).toContain('!user.isAdmin && !(await hasActiveMembership(user.wcaId))');
  });
});
