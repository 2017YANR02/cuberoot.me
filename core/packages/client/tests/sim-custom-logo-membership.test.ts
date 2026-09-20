import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
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

    expect(simPage).toContain('withCustomLogoAccess(settings, isMember)');
    expect(controls).toContain('setShowCustomLogoUpsell(true)');
    expect(controls).toContain('href="/membership"');
    expect(controls).not.toContain('<option value="custom" disabled={!canUseCustomLogo}>');
    expect(membershipPage).toContain("universalPerks.includes('custom_sim_logo')");
  });
});
