'use client';

/**
 * /alg landing — port of packages/client/src/pages/alg/AlgIndexPage.tsx.
 *
 * Admin "Validate all" button stubbed for now — auth_store + ADMIN_WCA_IDS
 * not yet ported into client-next. The validate-all flow re-enables once
 * @cuberoot/shared exports the OAuth hook and we port useAuthStore.
 */
import Link from '@/components/AppLink';
import { useTranslation } from 'react-i18next';
import { ALG_PUZZLES, ALG_CATALOG } from '@cuberoot/shared';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { EventIcon } from '@/components/EventIcon/EventIcon';
import { eventDisplayName } from '@/lib/wca-events';
import './alg.css';
import { tr } from '@/i18n/tr';
import i18n from '@/i18n/i18n-client';

export default function AlgIndexPage() {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  useDocumentTitle('公式库', 'Algorithms');

  return (
    <div className="alg-root">
      <div className="alg-index-header">
        <div className="alg-index-header-row">
          <h1 className="alg-index-title">{tr({ zh: '公式库', en: 'Algorithm DB',
              zhHant: "公式庫"
        })}</h1>
        </div>
        <p className="alg-index-subtitle">
          {(tr({ zh: '魔方公式速查 — ', en: 'Cube algorithm reference — ' })) +
            ALG_PUZZLES.map((p) => eventDisplayName(p, isZh)).join(' / ')}
        </p>
        <p className="alg-index-credit">
          {tr({ zh: '数据来源: ', en: 'Source: ',
              zhHant: "資料來源: "
        })}
          <a href="https://speedcubedb.com" target="_blank" rel="noopener noreferrer">
            speedcubedb.com
          </a>
        </p>
      </div>

      <div className="alg-puzzle-grid">
        {ALG_PUZZLES.map((p) => {
          const sets = ALG_CATALOG[p];
          return (
            <Link key={p} href={`/alg/${p}`} className="alg-puzzle-card">
              <div className="alg-puzzle-name">
                <EventIcon event={p} className="alg-puzzle-icon" />
                <span>{eventDisplayName(p, isZh)}</span>
              </div>
              <div className="alg-puzzle-count">
                {sets.length} {tr({ zh: '套公式', en: 'sets' })}
              </div>
              <div className="alg-puzzle-preview">
                {sets.slice(0, 6).map((s) => (
                  <span key={s.slug} className="alg-puzzle-chip">
                    {(i18n.language.startsWith('zh') ? s.zh : s.en)}
                  </span>
                ))}
                {sets.length > 6 && (
                  <span className="alg-puzzle-chip is-more">+{sets.length - 6}</span>
                )}
              </div>
            </Link>
          );
        })}
        <Link href="/alg/commutator" className="alg-puzzle-card">
          <div className="alg-puzzle-name">
            <span className="alg-puzzle-icon alg-bracket-icon" aria-hidden="true">
              [,]
            </span>
            <span>{tr({ zh: '换位子', en: 'Commutator',
                zhHant: "換位子"
            })}</span>
          </div>
          <div className="alg-puzzle-count">
            {tr({ zh: '换位子分解工具', en: 'Commutator decomposer',
                zhHant: "換位子分解工具"
            })}
          </div>
          <div className="alg-puzzle-preview">
            <span className="alg-puzzle-chip">{tr({ zh: '分解', en: 'Decompose' })}</span>
            <span className="alg-puzzle-chip">{tr({ zh: '展开', en: 'Expand',
                zhHant: "展開"
            })}</span>
            <span className="alg-puzzle-chip">Excel</span>
          </div>
        </Link>
      </div>
    </div>
  );
}
