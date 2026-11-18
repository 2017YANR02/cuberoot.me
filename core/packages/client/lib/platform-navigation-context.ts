'use client';

import { createContext } from 'react';

/** Only descendants of the Platform shell adapt shared main-site links. */
export const PlatformNavigationContext = createContext(false);
