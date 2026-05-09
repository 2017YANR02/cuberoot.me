/**
 * /alg landing — 4 puzzle cards (2x2 / 3x3 / 4x4 / 5x5).
 *
 * Each puzzle card → /alg/<puzzle> showing every set under that puzzle.
 */
import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldCheck } from 'lucide-react';
import { ALG_PUZZLES, ALG_CATALOG } from '@cuberoot/shared';
import LangToggle from '../../components/LangToggle';
import { EventIcon } from '../../components/EventIcon';
import { eventDisplayName } from '../../utils/wca_events';
import { useAuthStore, ADMIN_WCA_IDS } from '../../stores/auth_store';
import ValidationReportModal from './ValidationReportModal';
import './alg.css';

export default function AlgIndexPage() {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);
  const isAdmin = user !== null && ADMIN_WCA_IDS.includes(user.wcaId);
  const [validationOpen, setValidationOpen] = useState(false);

  return (
    <div className="alg-root">
      <div className="alg-index-header">
        <div className="alg-index-header-row">
          <h1 className="alg-index-title">{isZh ? '公式库' : 'Algorithm DB'}</h1>
          {isAdmin && (
            <button
              type="button"
              className="alg-admin-add-btn"
              onClick={() => setValidationOpen(true)}
              title={isZh ? '校验全库公式' : 'Validate all sets'}
            >
              <ShieldCheck size={14} /> {isZh ? '校验全库' : 'Validate all'}
            </button>
          )}
          <LangToggle variant="inline" />
        </div>
        <p className="alg-index-subtitle">
          {(isZh ? '魔方公式速查 — ' : 'Cube algorithm reference — ') +
            ALG_PUZZLES.map(p => eventDisplayName(p, isZh)).join(' / ')}
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
              <div className="alg-puzzle-name">
                <EventIcon event={p} className="alg-puzzle-icon" />
                <span>{eventDisplayName(p, isZh)}</span>
              </div>
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

      {validationOpen && (
        <ValidationReportModal
          scope={{ kind: 'all' }}
          isZh={isZh}
          onClose={() => setValidationOpen(false)}
          onPickCase={(p, s) => {
            // 全库 modal 不直接打开 case editor;关闭后跳到该 set 详情页,admin 自己再点编辑
            setValidationOpen(false);
            navigate(`/alg/${p}/${s}`);
          }}
        />
      )}
    </div>
  );
}
