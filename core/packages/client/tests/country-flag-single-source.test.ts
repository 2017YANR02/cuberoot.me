import { describe, expect, it } from 'vitest';

import { flagHtml, flagInfo } from '@/components/Flag';

describe('Web country flag compatibility entry', () => {
  it('delegates country-name normalization and Chinese Taipei to timer-ui', () => {
    expect(flagInfo('China')).toMatchObject({
      kind: 'span',
      className: 'fi fi-cn',
    });
    const taipei = flagInfo('Chinese Taipei');
    expect(taipei).toMatchObject({ kind: 'img', alt: 'Chinese Taipei' });
    if (taipei.kind === 'img') expect(taipei.src).not.toMatch(/^https?:/);
    expect(flagHtml('TW')).toContain('ChineseTaipei.svg');
  });
});
