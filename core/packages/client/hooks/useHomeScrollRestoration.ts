'use client';

import { usePageScrollRestoration } from './usePageScrollRestoration';

/** Keep the existing homepage storage key for returning visitors. */
export function useHomeScrollRestoration(ready: boolean, section = 'home') {
  usePageScrollRestoration(ready, 'home-scroll', section === 'home' ? '' : `:${section}`);
}
