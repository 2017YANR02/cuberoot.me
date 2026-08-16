'use client';

import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';

export type Lang = 'zh' | 'en';

export const LangCtx = createContext<Lang>('zh');

export const useLang = () => useContext(LangCtx);

export function L({ zh, en }: { zh: ReactNode; en: ReactNode }) {
  return <>{useLang() === 'zh' ? zh : en}</>;
}
