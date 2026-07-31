'use client';

/**
 * /alg landing — port of packages/client-vite/src/pages/alg/AlgIndexPage.tsx.
 *
 * admin 的「校验全库」在标题行右侧(AlgAdminValidate,scope = all)—— 全站唯一一处
 * 一次扫完所有 (puzzle, set) 的入口。
 */
import Link from '@/components/AppLink';
import { useTranslation } from 'react-i18next';
import { ALG_PUZZLES } from '@cuberoot/shared';
import AlgAdminValidate from '@/components/AlgAdminValidate';
import BackHome from '@/components/BackHome';
import { EventIcon } from '@/components/EventIcon/EventIcon';
import { eventDisplayName } from '@/lib/wca-events';
import { GraduationCap } from 'lucide-react';
import './alg.css';
import { tr } from '@/i18n/tr';

// 三盲 / 桥式 / Skewb 的训练器入口只在各自魔方页的「训练专区」里(/alg/3x3、/alg/skewb),
// 落地页不再重复一排 —— 同一个入口出现两次,反而看不出它属于哪个魔方。

export default function AlgIndexPage() {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');

  return (
    <div className="alg-root">
      <BackHome />
      <div className="alg-index-header">
        <div className="alg-index-header-row">
          <h1 className="alg-index-title">{tr({ zh: '公式库', en: 'Algorithm DB'
        })}</h1>
          <div className="alg-index-header-actions">
            <Link href="/alg/progress" className="alg-index-progress-link" prefetch={false}>
              <GraduationCap size={16} aria-hidden="true" />
              {tr({ zh: '学习进度', en: 'Progress' })}
            </Link>
            <AlgAdminValidate
              scope={{ kind: 'all' }}
              label={tr({ zh: '校验全库', en: 'Validate all' })}
            />
          </div>
        </div>
      </div>

      <div className="alg-puzzle-grid">
        {ALG_PUZZLES.map((p) => (
          <Link key={p} href={`/alg/${p}`} className="alg-puzzle-card">
            <div className="alg-puzzle-name">
              <EventIcon event={p} className="alg-puzzle-icon" />
              <span>{eventDisplayName(p, isZh)}</span>
            </div>
          </Link>
        ))}
        <Link href="/alg/commutator" className="alg-puzzle-card">
          <div className="alg-puzzle-name">
            <span className="alg-puzzle-icon alg-bracket-icon" aria-hidden="true">
              [,]
            </span>
            <span>{tr({ zh: '换位子', en: 'Commutator' })}</span>
          </div>
        </Link>
      </div>

      <p className="alg-index-credit">
        {tr({ zh: '部分数据来源: ', en: 'Some data from: ' })}
        <a href="https://speedcubedb.com" target="_blank" rel="noopener noreferrer">
          speedcubedb.com
        </a>
      </p>
    </div>
  );
}
