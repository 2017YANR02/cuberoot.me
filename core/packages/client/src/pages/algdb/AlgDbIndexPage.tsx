/**
 * /algdb landing — bento cards for F2L / Advanced F2L / OLL / PLL.
 *
 * Mirrors AlgIndexPage structure (which lives at /alg) but the algdb pages
 * are pure alg references scraped from speedcubedb (no tutorial markdown).
 */
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Library, Layers, Hexagon, Diamond } from 'lucide-react';
import './algdb.css';

const CATEGORIES = [
  { slug: 'f2l',     icon: Library,  count: 41, en: 'F2L',          zh: 'F2L (基础)' },
  { slug: 'adv-f2l', icon: Layers,   count: 54, en: 'Advanced F2L', zh: 'F2L (进阶)' },
  { slug: 'oll',     icon: Hexagon,  count: 57, en: 'OLL',          zh: 'OLL' },
  { slug: 'pll',     icon: Diamond,  count: 21, en: 'PLL',          zh: 'PLL' },
] as const;

export default function AlgDbIndexPage() {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');

  return (
    <div className="algdb-root">
      <div className="algdb-index-header">
        <h1 className="algdb-index-title">{isZh ? '公式库' : 'Algorithm DB'}</h1>
        <p className="algdb-index-subtitle">
          {isZh
            ? '3x3 公式速查 — F2L / OLL / PLL'
            : '3x3 algorithm reference — F2L, OLL, PLL'}
        </p>
        <p className="algdb-index-credit">
          {isZh ? '数据来源: ' : 'Source: '}
          <a href="https://speedcubedb.com" target="_blank" rel="noopener noreferrer">speedcubedb.com</a>
        </p>
      </div>

      <div className="algdb-bento">
        {CATEGORIES.map(c => {
          const Icon = c.icon;
          return (
            <Link
              key={c.slug}
              to={`/algdb/${c.slug}`}
              className="algdb-bento-card"
            >
              <div className="algdb-bento-icon">
                <Icon size={36} strokeWidth={1.5} />
              </div>
              <div className="algdb-bento-title">{isZh ? c.zh : c.en}</div>
              <div className="algdb-bento-count">{c.count} {isZh ? '个' : 'cases'}</div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
