import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const clientRoot = join(__dirname, '..');
const accountPage = readFileSync(join(clientRoot, 'app/[lang]/account/page.tsx'), 'utf8');
const countryInput = readFileSync(join(clientRoot, 'components/CountryInput/CountryInput.tsx'), 'utf8');

describe('账号基本资料 UI 契约', () => {
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
