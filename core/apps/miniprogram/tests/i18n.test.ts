import { describe, expect, it } from 'vitest';

import { localeFromLanguage, tr } from '../src/lib/i18n';

describe('mini program i18n', () => {
  it('recognizes Simplified and Traditional Chinese language tags', () => {
    expect(localeFromLanguage('zh_CN')).toBe('zh');
    expect(localeFromLanguage('zh-Hans')).toBe('zh');
    expect(localeFromLanguage('zh-Hant')).toBe('zh');
  });

  it('uses English for other explicit languages and Chinese as the safe fallback', () => {
    expect(localeFromLanguage('en')).toBe('en');
    expect(localeFromLanguage('ja_JP')).toBe('en');
    expect(localeFromLanguage(undefined)).toBe('zh');
  });

  it('selects text without inline language branches at call sites', () => {
    const text = { en: 'Tools', zh: '工具' } as const;

    expect(tr(text, 'en')).toBe('Tools');
    expect(tr(text, 'zh')).toBe('工具');
  });
});
