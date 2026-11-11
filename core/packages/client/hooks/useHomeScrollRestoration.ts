'use client';

import { usePageScrollRestoration } from './usePageScrollRestoration';

/** Keep the existing homepage storage key for returning visitors. */
export function useHomeScrollRestoration(ready: boolean) {
  usePageScrollRestoration(ready, 'home-scroll');
}
