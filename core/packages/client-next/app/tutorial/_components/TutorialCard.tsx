import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { FileText } from 'lucide-react';
import type { CatalogEntry, Lang } from '../_lib/useTutorialCatalog';

interface TutorialCardProps {
  entry: CatalogEntry;
  lang: Lang;
}

export function TutorialCard({ entry, lang }: TutorialCardProps) {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const title =
    entry.title[lang] ??
    entry.title[lang === 'zh' ? 'en' : 'zh'] ??
    entry.slug;

  return (
    <Link href={`/tutorial/p/${entry.slug}`} className="tutorial-card">
      <div className="tutorial-card-thumb">
        {entry.thumb ? (
          <img src={entry.thumb} alt="" loading="lazy" decoding="async" />
        ) : (
          <FileText className="tutorial-card-thumb-placeholder" />
        )}
      </div>
      <div className="tutorial-card-body">
        <h3 className="tutorial-card-title">{title}</h3>
        <div className="tutorial-card-meta">
          <span className="tutorial-category-badge">{entry.category}</span>
          {entry.algCount > 0 && (
            <span className="tutorial-tutorial-count">
              {entry.algCount} {entry.view === 'algset' ? (isZh ? '个情况' : 'cases') : (isZh ? '个公式' : 'algs')}
            </span>
          )}
        </div>
      </div>
      {entry.view === 'algset' && <span className="tutorial-corner-badge">{isZh ? '公共库' : 'PUBLIC LIB'}</span>}
    </Link>
  );
}
