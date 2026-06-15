'use client';

// `/code/*` 介绍页通用 LangCtx + L 组件 (ported from packages/client-vite/src/pages/code/_intro/Lang.tsx).

import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';

export type Lang = 'zh' | 'en';

export const LangCtx = createContext<Lang>('zh');

export const useLang = () => useContext(LangCtx);

export function L({ zh, en }: { zh: ReactNode; en: ReactNode }) {
  return <>{useLang() === 'zh' ? zh : en}</>;
}
