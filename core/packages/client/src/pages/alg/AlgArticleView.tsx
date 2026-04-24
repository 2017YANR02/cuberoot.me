import { useTranslation } from 'react-i18next';
import type { ArticlePostContent, Lang } from './useAlgCatalog';
import { AlgContent } from './AlgContent';

interface AlgArticleViewProps {
  post: ArticlePostContent;
  lang: Lang;
}

export function AlgArticleView({ post, lang }: AlgArticleViewProps) {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  // 优先当前语言；缺则 fallback 另一语言
  const html =
    post.content[lang] ?? post.content[lang === 'zh' ? 'en' : 'zh'] ?? '';
  if (!html) {
    return (
      <div className="alg-content">
        <p style={{ color: 'var(--alg-text-muted)' }}>{isZh ? '(无内容)' : '(no content)'}</p>
      </div>
    );
  }
  return <AlgContent html={html} />;
}
