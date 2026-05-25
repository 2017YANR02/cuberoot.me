'use client';

import { useState, type ReactNode } from 'react';
import { I18nextProvider } from 'react-i18next';
import i18n from './i18n-client';

export default function I18nProvider({ children }: { children: ReactNode }) {
  // useState locks the i18n reference for the tree lifetime — i18n-client.ts
  // is a module singleton so this is just a stable handle.
  const [instance] = useState(() => i18n);
  return <I18nextProvider i18n={instance}>{children}</I18nextProvider>;
}
