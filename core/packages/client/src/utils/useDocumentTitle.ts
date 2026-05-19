/**
 * 双语 document.title 设置 hook。统一格式 `<page> — CubeRoot`,跟现有
 * `/code/*` 各页面对齐(em-dash 分隔符)。空字符串 ⇒ 仅显示 "CubeRoot",
 * 用于首页这种不需要前缀的场景。
 *
 * 用法:
 *   useDocumentTitle('打乱生成器', 'Scramble Generator');
 *
 * unmount 时 cleanup 把 title reset 回 "CubeRoot",避免上一页 title 残留
 * 到没接 hook 的页面 tab 上(用户在 tab strip 上一眼能看出"这就是首页")。
 */
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

const BRAND = 'CubeRoot';
const SEP = ' — ';

export function useDocumentTitle(zh: string, en: string): void {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  useEffect(() => {
    const page = (isZh ? zh : en).trim();
    document.title = page ? `${page}${SEP}${BRAND}` : BRAND;
    return () => {
      document.title = BRAND;
    };
  }, [zh, en, isZh]);
}
