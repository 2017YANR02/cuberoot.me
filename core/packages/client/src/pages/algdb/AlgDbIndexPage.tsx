/**
 * /algdb landing — 4 puzzle cards (2x2 / 3x3 / 4x4 / 5x5).
 *
 * Each puzzle card → /algdb/<puzzle> showing every set under that puzzle.
 */
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ALGDB_PUZZLES, ALGDB_CATALOG, type AlgdbPuzzle } from '@cuberoot/shared';
import './algdb.css';

const PUZZLE_LABEL: Record<AlgdbPuzzle, { en: string; zh: string }> = {
  '2x2': { en: '2x2',         zh: '二阶' },
  '3x3': { en: '3x3',         zh: '三阶' },
  '4x4': { en: '4x4',         zh: '四阶' },
  '5x5': { en: '5x5',         zh: '五阶' },
};

export default function AlgDbIndexPage() {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');

  return (
    <div className="algdb-root">
      <div className="algdb-index-header">
        <h1 className="algdb-index-title">{isZh ? '公式库' : 'Algorithm DB'}</h1>
        <p className="algdb-index-subtitle">
          {isZh
            ? '魔方公式速查 — 2x2 / 3x3 / 4x4 / 5x5'
            : 'Cube algorithm reference — 2x2 / 3x3 / 4x4 / 5x5'}
        </p>
        <p className="algdb-index-credit">
          {isZh ? '数据来源: ' : 'Source: '}
          <a href="https://speedcubedb.com" target="_blank" rel="noopener noreferrer">speedcubedb.com</a>
        </p>
      </div>

      <div className="algdb-puzzle-grid">
        {ALGDB_PUZZLES.map(p => {
          const sets = ALGDB_CATALOG[p];
          return (
            <Link key={p} to={`/algdb/${p}`} className="algdb-puzzle-card">
              <div className="algdb-puzzle-name">{isZh ? PUZZLE_LABEL[p].zh : PUZZLE_LABEL[p].en}</div>
              <div className="algdb-puzzle-count">{sets.length} {isZh ? '套公式' : 'sets'}</div>
              <div className="algdb-puzzle-preview">
                {sets.slice(0, 6).map(s => (
                  <span key={s.slug} className="algdb-puzzle-chip">{isZh ? s.zh : s.en}</span>
                ))}
                {sets.length > 6 && <span className="algdb-puzzle-chip is-more">+{sets.length - 6}</span>}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
