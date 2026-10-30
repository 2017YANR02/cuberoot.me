import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { localizeCity } from '@/lib/city-localize';

const clientRoot = join(__dirname, '..');
const accountPage = readFileSync(join(clientRoot, 'components/account/AccountSettings.tsx'), 'utf8');
const countryInput = readFileSync(join(clientRoot, 'components/CountryInput/CountryInput.tsx'), 'utf8');
const sharedCountryInput = readFileSync(new URL(import.meta.resolve('@cuberoot/timer-ui/country-input')), 'utf8');

describe('账号基本资料 UI 契约', () => {
  it('keeps the avatar settings menu accessible with a 44px touch target', () => {
    const menu = readFileSync(join(clientRoot, 'components/ChatAccountMenu.tsx'), 'utf8');
    const css = readFileSync(join(clientRoot, 'components/chat-account-menu.css'), 'utf8');
    expect(menu).toContain("ariaLabel={t('账号菜单', 'Account menu')}");
    expect(menu).toContain('href="/chat?settings=account"');
    expect(menu).toContain('<Settings size={18}');
    expect(css).toMatch(/width:\s*44px/);
    expect(css).toMatch(/height:\s*44px/);
  });
  it('生日和国家复用全站规范组件，省份与城市按层级出现', () => {
    expect(accountPage).toContain('id="account-full-name"');
    expect(accountPage).toContain('autoComplete="name"');
    expect(accountPage).toContain('<DateInput');
    expect(accountPage).toContain('<CountryInput');
    expect(accountPage).toContain('updateAccountBasicProfile');
    expect(accountPage).toContain('id="account-location"');
    expect(accountPage).toContain('setLocationMenuRegion(region.code)');
    expect(accountPage).toContain('updateDraft({ regionCode: menuRegion.code, cityName: city })');
  });

  it('WCA 国家只读，未绑定时才允许编辑', () => {
    expect(accountPage).toContain("profile.countrySource === 'wca'");
    expect(accountPage).toMatch(/countryLocked\s*\?\s*\([\s\S]*?<Flag[\s\S]*?\)\s*:\s*\([\s\S]*?<CountryInput/);
  });

  it('共享国家输入支持表单标签和无障碍名称', () => {
    expect(countryInput).toContain("from '@cuberoot/timer-ui/country-input'");
    expect(countryInput).toContain('<SharedCountryInput {...props}');
    expect(sharedCountryInput).toContain('id?: string;');
    expect(sharedCountryInput).toContain('ariaLabel?: string;');
    expect(sharedCountryInput).toContain('id={id}');
    expect(sharedCountryInput).toContain('aria-label={ariaLabel}');
  });
});

describe('账号地区中文名称', () => {
  it.each([['Hong Kong SAR', '香港'], ['Macau SAR', '澳门'], ['Macao SAR', '澳门']])('%s → %s', (name, expected) => {
    expect(localizeCity(name, true, 'CN')).toBe(expected);
    expect(localizeCity(name, false, 'CN')).toBe(name);
  });
});
