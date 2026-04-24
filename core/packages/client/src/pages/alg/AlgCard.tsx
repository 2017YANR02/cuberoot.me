import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FileText } from 'lucide-react';
import type { CatalogEntry, Lang } from './useAlgCatalog';

interface AlgCardProps {
  entry: CatalogEntry;
  lang: Lang;
}

export function AlgCard({ entry, lang }: AlgCardProps) {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const title =
    entry.title[lang] ??
    entry.title[lang === 'zh' ? 'en' : 'zh'] ??
    entry.slug;

  return (
    <Link to={`/alg/${entry.slug}`} className="alg-card">
      <div className="alg-card-thumb">
        {entry.thumb ? (
          <img src={entry.thumb} alt="" loading="lazy" decoding="async" />
        ) : (
          <FileText className="alg-card-thumb-placeholder" />
        )}
      </div>
      <div className="alg-card-body">
        <h3 className="alg-card-title">{title}</h3>
        <div className="alg-card-meta">
          <span className="alg-category-badge">{entry.category}</span>
          {entry.algCount > 0 && (
            <span className="alg-alg-count">
              {entry.algCount} {entry.view === 'algset' ? (isZh ? '个情况' : 'cases') : (isZh ? '个公式' : 'algs')}
            </span>
          )}
        </div>
      </div>
      {entry.view === 'algset' && <span className="alg-corner-badge">{isZh ? '公共库' : 'PUBLIC LIB'}</span>}
    </Link>
  );
}
