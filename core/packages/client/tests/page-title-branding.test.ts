import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { metadataFromEntry, PAGE_META } from '@/lib/page-meta';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('browser title branding', () => {
  it('uses only the localized page name in subpage metadata', () => {
    const metadata = metadataFromEntry(
      { title: { zh: '计时器', en: 'Timer' } },
      'zh',
    );

    expect(metadata.title).toBe('计时器');
    expect(metadata.openGraph).toMatchObject({ title: 'CubeRoot — 计时器' });
    expect(metadata.twitter).toMatchObject({ title: 'CubeRoot — 计时器' });
  });

  it('keeps the landing-page title as CubeRoot', () => {
    expect(metadataFromEntry(PAGE_META[''], 'zh').title).toBe('CubeRoot');
    expect(metadataFromEntry(PAGE_META[''], 'en').title).toBe('CubeRoot');
  });

  it('uses the same complete branded title in the learning homepage and share metadata', () => {
    const metadata = metadataFromEntry(PAGE_META.platform, 'zh');
    const title = '魔方根 CubeRoot — 课程与学习';
    expect(metadata.title).toBe(title);
    expect(metadata.openGraph).toMatchObject({ title });
    expect(metadata.twitter).toMatchObject({ title });
  });

  it('keeps the hydrated title page-only too', () => {
    const hook = readFileSync(join(ROOT, 'hooks', 'useDocumentTitle.ts'), 'utf8');
    expect(hook).toContain('if (document.title !== title) document.title = title;');
    expect(hook).toContain('new MutationObserver(applyTitle)');
    expect(hook).not.toMatch(/document\.title\s*=\s*page\s*\?[^;]*BRAND/);
  });

  it('adds the brand back only for the default WeChat share title', () => {
    const sync = readFileSync(join(ROOT, 'components', 'WeChatShareSync.tsx'), 'utf8');
    expect(sync).toContain("pageTitle.startsWith('魔方根 CubeRoot — ')");
    expect(sync).toContain("alreadyBranded ? pageTitle : `CubeRoot — ${pageTitle}`");
  });
});
