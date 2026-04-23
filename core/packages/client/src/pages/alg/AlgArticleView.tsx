import type { ArticlePostContent, Lang } from './useAlgCatalog';
import { AlgContent } from './AlgContent';

interface AlgArticleViewProps {
  post: ArticlePostContent;
  lang: Lang;
}

export function AlgArticleView({ post, lang }: AlgArticleViewProps) {
  // 优先当前语言；缺则 fallback 另一语言
  const html =
    post.content[lang] ?? post.content[lang === 'zh' ? 'en' : 'zh'] ?? '';
  if (!html) {
    return (
      <div className="alg-content">
        <p style={{ color: 'var(--alg-text-muted)' }}>(no content)</p>
      </div>
    );
  }
  return <AlgContent html={html} />;
}
