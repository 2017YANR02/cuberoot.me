import { describe, expect, it } from 'vitest';
import { matchNotices, type PageNotice } from '@/lib/page-notices-api';

function notice(overrides: Partial<PageNotice>): PageNotice {
  return {
    id: 1,
    path: '/',
    level: 'info',
    bodyEn: 'Notice',
    bodyZh: '通知',
    enabled: true,
    dismissible: false,
    updatedAt: '2026-08-24T00:00:00.000Z',
    ...overrides,
  };
}

describe('page notice placement matching', () => {
  it('does not render homepage featured news in the global page-top bar', () => {
    const rows = [
      notice({ id: 1, placement: 'home_featured', href: '/regulation/news#4-pad-2027' }),
      notice({ id: 2, placement: 'page_top', path: '/*' }),
    ];

    expect(matchNotices(rows, '/').map((row) => row.id)).toEqual([2]);
  });

  it('treats responses from the pre-placement API as page-top notices', () => {
    expect(matchNotices([notice({ placement: undefined })], '/').map((row) => row.id)).toEqual([1]);
  });
});
