'use client';
import { useTranslation } from 'react-i18next';
import { useCallback } from 'react';

/**
 * 共享双语翻译器。取代全站各组件手抄的私有 `t(zh, en)`:isZh ? zh : en。
 * 仅当组件的 isZh 等价于 i18n.language.startsWith('zh') 时可换用本 hook;
 * isZh 来自 prop / 自定义 lang 的组件保留各自局部定义。
 */
export function useT() {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  return useCallback((zh: string, en: string) => (isZh ? zh : en), [isZh]);
}
