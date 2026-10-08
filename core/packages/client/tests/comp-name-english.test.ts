import { readFileSync } from 'node:fs';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { createCompNameEnResolver, localizeCompName, stripWcaPrefix } from '@cuberoot/shared/comp-localize';
import { buildReconDescription, buildReconTitle, fetchCompNamesForSeo } from '@/lib/recon-seo';

const names = JSON.parse(readFileSync(new URL('../../../../stats/comp_names_zh.json', import.meta.url), 'utf8')) as Record<string, string>;
const resolveNameEnFromZh = createCompNameEnResolver(names);
const opts = { resolveNameEnFromZh, date: '2026-10-05' };

afterEach(() => vi.unstubAllGlobals());

describe('English competition names', () => {
  it('resolves both known shortened recon names without duplicating the date year', () => {
    expect(localizeCompName('GuangzhouGrandOpen2026', '广州公开赛2026', false, opts)).toBe('Guangzhou Grand Open');
    expect(localizeCompName('MaomingOpen2026', '茂名公开赛2026', false, opts)).toBe('Maoming Open');
  });

  it('covers every official and display-form Chinese name in the generated mapping', () => {
    for (const zh of Object.values(names)) {
      expect(resolveNameEnFromZh(zh)).not.toBe('');
      expect(resolveNameEnFromZh(stripWcaPrefix(zh))).toBe(resolveNameEnFromZh(zh));
    }
  });

  it('preserves editions, unknown user places, English names and Chinese display', () => {
    expect(resolveNameEnFromZh('广州公开赛1900')).toBe('');
    expect(localizeCompName('', '学校', false, opts)).toBe('学校');
    expect(localizeCompName('', 'Guangzhou Grand Open 2026', false, opts)).toBe('Guangzhou Grand Open');
    expect(localizeCompName('GuangzhouGrandOpen2026', '广州公开赛2026', true, opts)).toBe('广州公开赛');
  });

  it('loads metadata translations without the browser flag cache or changing the solve', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => names }));
    const mappings = await fetchCompNamesForSeo();
    const solve = { id: 2795, official: 'wca' as const, compWcaId: 'GuangzhouGrandOpen2026', comp: '广州公开赛2026', person: 'Xuanyi Geng', event: '3x3', value: '2.51' };
    expect(buildReconTitle(solve, false, mappings)).toContain('Guangzhou Grand Open 2026');
    expect(buildReconDescription(solve, false, mappings)).toContain('Guangzhou Grand Open 2026');
    expect(solve.comp).toBe('广州公开赛2026');
  });
});
