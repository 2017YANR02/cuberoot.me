// `/code/*` 介绍页通用 LangCtx + L 组件。
// 之前 30+ 个 IntroPage 各自重复 createContext/useContext/L 几乎逐字相同的 12 行,这里收口。

import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';

export type Lang = 'zh' | 'en';

export const LangCtx = createContext<Lang>('zh');

export const useLang = () => useContext(LangCtx);

export function L({ zh, en }: { zh: ReactNode; en: ReactNode }) {
  return <>{useLang() === 'zh' ? zh : en}</>;
}
