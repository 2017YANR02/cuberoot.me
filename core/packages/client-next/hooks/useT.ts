'use client';
import { useTranslation } from 'react-i18next';
import { useCallback } from 'react';

/**
 * 共享三路翻译器。取代全站各组件手抄的私有 `t(zh, en, zhHant?)`:
 *   zh-Hant → zhHant(缺则回退 zh);其余 → isZh ? zh : en。
 *
 * 第三参 `zhHant` 一律 OpenCC 生成(`pnpm zh:gen-localt`),禁手写——
 * 生成器靠「调用签名第三参名为 zhHant」识别调用点,故签名不可改名。
 *
 * 仅当组件的 isZh 等价于 i18n.language.startsWith('zh') 时可换用本 hook;
 * isZh 来自 prop / 自定义 lang 的组件保留各自局部定义。
 */
export function useT() {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const isHant = i18n.language === 'zh-Hant';
  return useCallback(
    (zh: string, en: string, zhHant?: string) => (isHant ? (zhHant ?? zh) : isZh ? zh : en),
    [isZh, isHant],
  );
}
