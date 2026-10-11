import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { DEFAULT_MEMBERSHIP_BENEFITS } from '@cuberoot/shared/membership-benefits';
import {
  DEFAULT_SETTINGS,
  withCustomLogoAccess,
  type SimSettings,
} from '@/app/[lang]/sim/SettingDrawer';

function settingsWithLogo(logo: SimSettings['logo']): SimSettings {
  return { ...DEFAULT_SETTINGS, logo, customLogo: 'data:image/png;base64,member-logo' };
}

describe('simulator custom logo membership access', () => {
  it('keeps a custom logo active for members', () => {
    const settings = settingsWithLogo('custom');
    expect(withCustomLogoAccess(settings, true)).toBe(settings);
  });

  it('hides a custom logo from non-members without deleting the saved image', () => {
    const settings = settingsWithLogo('custom');
    expect(withCustomLogoAccess(settings, false)).toEqual({
      ...settings,
      logo: 'none',
      customLogo: 'data:image/png;base64,member-logo',
    });
  });

  it.each(['none', 'site'] as const)('leaves the %s option available to non-members', (logo) => {
    const settings = settingsWithLogo(logo);
    expect(withCustomLogoAccess(settings, false)).toBe(settings);
  });

  it('wires the member gate into the simulator controls and membership benefits', () => {
    const simPage = readFileSync(new URL('../app/[lang]/sim/SimPage.tsx', import.meta.url), 'utf8');
    const controls = readFileSync(new URL('../app/[lang]/sim/PlayerControls.tsx', import.meta.url), 'utf8');
    const membershipPage = readFileSync(new URL('../app/[lang]/membership/page.tsx', import.meta.url), 'utf8');
    const benefitsHook = readFileSync(new URL('../hooks/useMembershipBenefits.ts', import.meta.url), 'utf8');

    expect(simPage).toContain('withCustomLogoAccess(settings, isMember)');
    expect(controls).toContain('setShowCustomLogoUpsell(true)');
    expect(controls).toContain('href="/membership"');
    expect(controls).not.toContain('<option value="custom" disabled={!canUseCustomLogo}>');
    expect(DEFAULT_MEMBERSHIP_BENEFITS.find(item => item.id === 'custom_sim_logo'))
      .toMatchObject({ group: 'common', enabled: true });
    expect(benefitsHook).toContain('items: DEFAULT_MEMBERSHIP_BENEFITS');
    expect(membershipPage).toContain('useMembershipBenefits()');
    // The grouped inline editor receives the common list and its section heading.
    expect(membershipPage).toContain("benefits.items.filter(item => item.group === 'common').map(item => item.id)");
    expect(membershipPage).toContain("renderPerks(universalPerks, 'common', { id: 'universal-perks-title'");
  });
});
