import { describe, expect, it } from 'vitest';
import {
  isPlatformQrLinkHref,
  normalizePlatformQrLinks,
  platformQrCardStudioHref,
  platformQrLinksProblem,
  platformQrTargetProblem,
  resolvePlatformQrLanding,
} from '@/lib/platform-qr-landing';

const defaults = {
  english: false,
  defaultTitle: '默认标题',
  defaultIntro: '默认介绍',
  defaultLinks: [{ label: '首页', href: '/' }],
} as const;

describe('Platform QR landing contract', () => {
  it('opens the requested code as the sole active card in the studio', () => {
    expect(platformQrCardStudioHref('campaign / 01')).toBe('/platform/admin/qr/cards?codes=campaign%20%2F%2001&edit=campaign%20%2F%2001');
  });

  it('keeps landing type independent from target kind', () => {
    expect(resolvePlatformQrLanding({ status: 'active', type: 'landing', targetKind: 'external_url', targetValue: 'https://example.com' }, defaults).mode).toBe('landing');
    expect(resolvePlatformQrLanding({ status: 'active', type: 'redirect', targetKind: 'content', targetValue: 'hello' }, defaults).mode).toBe('landing');
    expect(resolvePlatformQrLanding({ status: 'active', type: 'redirect', targetKind: 'internal_path', targetValue: '/alg' }, defaults)).toMatchObject({ mode: 'redirect', target: '/alg' });
  });

  it('makes disabled state win over redirect behavior', () => {
    expect(resolvePlatformQrLanding({ status: 'disabled', type: 'redirect', targetKind: 'external_url', targetValue: 'https://example.com' }, defaults).mode).toBe('disabled');
  });

  it('uses projected card intro and term with localized title fallback', () => {
    expect(resolvePlatformQrLanding({ titleZh: '中文', titleEn: 'English', intro: '卡片介绍', term: 'OLL' }, defaults)).toMatchObject({
      title: '中文',
      intro: '卡片介绍',
      term: 'OLL',
    });
  });

  it('never exposes the private administrator label as a public title', () => {
    expect(resolvePlatformQrLanding({ label: '内部批次 A', title: 'public-code' }, defaults).title).toBe('public-code');
    expect(resolvePlatformQrLanding({ label: '内部批次 A' }, defaults).title).toBe('默认标题');
  });

  it('accepts site paths and credential-free HTTP links only', () => {
    expect(isPlatformQrLinkHref('/community')).toBe(true);
    expect(isPlatformQrLinkHref('/search?q=%E9%AD%94%E6%96%B9')).toBe(true);
    expect(isPlatformQrLinkHref('https://example.com/path')).toBe(true);
    expect(isPlatformQrLinkHref('//example.com')).toBe(false);
    expect(isPlatformQrLinkHref('/未编码')).toBe(false);
    expect(isPlatformQrLinkHref('https://user:pass@example.com')).toBe(false);
    expect(isPlatformQrLinkHref('javascript:alert(1)')).toBe(false);
  });

  it('validates target kinds without coupling them to page behavior', () => {
    expect(platformQrTargetProblem('content', 'Kept as editable content')).toBeNull();
    expect(platformQrTargetProblem('content', '')).toBe('required');
    expect(platformQrTargetProblem('internal_path', '/alg')).toBeNull();
    expect(platformQrTargetProblem('internal_path', '//example.com')).toBe('internal');
    expect(platformQrTargetProblem('external_url', 'https://example.com')).toBeNull();
    expect(platformQrTargetProblem('external_url', 'https://user:pass@example.com')).toBe('external');
  });

  it('normalizes valid links without leaking invalid destinations', () => {
    expect(normalizePlatformQrLinks([
      { label: ' 社群 ', href: ' /community ', note: ' 讨论 ' },
      { label: 'Bad', href: 'javascript:alert(1)' },
      null,
    ])).toEqual([{ label: '社群', href: '/community', note: '讨论' }]);
  });

  it('reports link field and count violations before submission', () => {
    expect(platformQrLinksProblem([{ label: '', href: '/' }])).toBe('label');
    expect(platformQrLinksProblem([{ label: 'Bad', href: '//example.com' }])).toBe('href');
    expect(platformQrLinksProblem(Array.from({ length: 21 }, (_, index) => ({ label: String(index), href: '/' })))).toBe('limit');
  });
});
