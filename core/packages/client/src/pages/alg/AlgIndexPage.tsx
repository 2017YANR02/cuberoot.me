/**
 * /alg landing — 4 puzzle cards (2x2 / 3x3 / 4x4 / 5x5).
 *
 * Each puzzle card → /alg/<puzzle> showing every set under that puzzle.
 */
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ALG_PUZZLES, ALG_CATALOG, type AlgPuzzle } from '@cuberoot/shared';
import LangToggle from '../../components/LangToggle';
import './alg.css';

const PUZZLE_LABEL: Record<AlgPuzzle, { en: string; zh: string }> = {
  '2x2': { en: '2x2',         zh: '二阶' },
  '3x3': { en: '3x3',         zh: '三阶' },
  '4x4': { en: '4x4',         zh: '四阶' },
  '5x5': { en: '5x5',         zh: '五阶' },
};

export default function AlgIndexPage() {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');

  return (
    <div className="alg-root">
      <div className="alg-index-header">
        <div className="alg-index-header-row">
          <h1 className="alg-index-title">{isZh ? '公式库' : 'Algorithm DB'}</h1>
          <LangToggle variant="inline" />
        </div>
        <p className="alg-index-subtitle">
          {isZh
            ? '魔方公式速查 — 2x2 / 3x3 / 4x4 / 5x5'
            : 'Cube algorithm reference — 2x2 / 3x3 / 4x4 / 5x5'}
        </p>
        <p className="alg-index-credit">
          {isZh ? '数据来源: ' : 'Source: '}
          <a href="https://speedcubedb.com" target="_blank" rel="noopener noreferrer">speedcubedb.com</a>
        </p>
      </div>

      <div className="alg-puzzle-grid">
        {ALG_PUZZLES.map(p => {
          const sets = ALG_CATALOG[p];
          return (
            <Link key={p} to={`/alg/${p}`} className="alg-puzzle-card">
              <div className="alg-puzzle-name">{isZh ? PUZZLE_LABEL[p].zh : PUZZLE_LABEL[p].en}</div>
              <div className="alg-puzzle-count">{sets.length} {isZh ? '套公式' : 'sets'}</div>
              <div className="alg-puzzle-preview">
                {sets.slice(0, 6).map(s => (
                  <span key={s.slug} className="alg-puzzle-chip">{isZh ? s.zh : s.en}</span>
                ))}
                {sets.length > 6 && <span className="alg-puzzle-chip is-more">+{sets.length - 6}</span>}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
