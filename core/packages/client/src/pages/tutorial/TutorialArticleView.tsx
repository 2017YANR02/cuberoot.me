import { useTranslation } from 'react-i18next';
import type { ArticlePostContent, Lang } from './useTutorialCatalog';
import { TutorialContent } from './TutorialContent';

interface TutorialArticleViewProps {
  post: ArticlePostContent;
  lang: Lang;
}

export function TutorialArticleView({ post, lang }: TutorialArticleViewProps) {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  // 优先当前语言；缺则 fallback 另一语言
  const html =
    post.content[lang] ?? post.content[lang === 'zh' ? 'en' : 'zh'] ?? '';
  if (!html) {
    return (
      <div className="tutorial-content">
        <p style={{ color: 'var(--tutorial-text-muted)' }}>{isZh ? '(无内容)' : '(no content)'}</p>
      </div>
    );
  }
  return <TutorialContent html={html} />;
}
