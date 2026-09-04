import type { ArticlePostContent, Lang } from '../_lib/useTutorialCatalog';
import { TutorialContent } from './TutorialContent';
import { tr } from '@/i18n/tr';

interface TutorialArticleViewProps {
  post: ArticlePostContent;
  lang: Lang;
}

export function TutorialArticleView({ post, lang }: TutorialArticleViewProps) {
  // 优先当前语言；缺则 fallback 另一语言
  const html =
    post.content[lang] ?? post.content[lang === 'zh' ? 'en' : 'zh'] ?? '';
  if (!html) {
    return (
      <div className="tutorial-content">
        <p style={{ color: 'var(--tutorial-text-muted)' }}>{tr({ zh: '(无内容)', en: '(no content)'
        })}</p>
      </div>
    );
  }
  return <TutorialContent html={html} />;
}
