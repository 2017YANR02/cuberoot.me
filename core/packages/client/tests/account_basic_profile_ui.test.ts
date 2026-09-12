import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { localizeCity } from '@/lib/city-localize';

const clientRoot = join(__dirname, '..');
const accountPage = readFileSync(join(clientRoot, 'app/[lang]/account/page.tsx'), 'utf8');
const countryInput = readFileSync(join(clientRoot, 'components/CountryInput/CountryInput.tsx'), 'utf8');

describe('账号基本资料 UI 契约', () => {
  it('keeps the settings entry accessible with a visible icon and a 44px touch target', () => {
    const gear = accountPage.match(/<AppLink\s+href=\{accountHref\('signin'\)\}\s+className="account-gear"[\s\S]*?<\/AppLink>/)?.[0];
    expect(gear).toContain('aria-label=');
    expect(gear).toContain('<Settings size={28} />');
    const css = readFileSync(join(clientRoot, 'app/[lang]/account/account.css'), 'utf8');
    const rule = css.match(/\.account-gear\s*\{([^}]+)\}/)?.[1];
    expect(rule).toMatch(/width:\s*44px/);
    expect(rule).toMatch(/height:\s*44px/);
    expect(rule).toMatch(/flex-shrink:\s*0/);
  });
  it('生日和国家复用全站规范组件，省份与城市按层级出现', () => {
    expect(accountPage).toContain('id="account-full-name"');
    expect(accountPage).toContain('autoComplete="name"');
    expect(accountPage).toContain('<DateInput');
    expect(accountPage).toContain('<CountryInput');
    expect(accountPage).toContain('updateAccountBasicProfile');
    expect(accountPage).toContain('id="account-region"');
    expect(accountPage).toContain('id="account-city"');
  });

  it('WCA 国家只读，未绑定时才允许编辑', () => {
    expect(accountPage).toContain("profile.countrySource === 'wca'");
    expect(accountPage).toMatch(/countryLocked\s*\?\s*\([\s\S]*?<Flag[\s\S]*?\)\s*:\s*\([\s\S]*?<CountryInput/);
  });

  it('共享国家输入支持表单标签和无障碍名称', () => {
    expect(countryInput).toContain('id?: string;');
    expect(countryInput).toContain('ariaLabel?: string;');
    expect(countryInput).toContain('aria-label={ariaLabel}');
  });
});

describe('账号地区中文名称', () => {
  it.each([['Hong Kong SAR', '香港'], ['Macau SAR', '澳门'], ['Macao SAR', '澳门']])('%s → %s', (name, expected) => {
    expect(localizeCity(name, true, 'CN')).toBe(expected);
    expect(localizeCity(name, false, 'CN')).toBe(name);
  });
});
