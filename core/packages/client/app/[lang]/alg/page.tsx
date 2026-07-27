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
import { Eye, Blocks, GraduationCap, type LucideIcon } from 'lucide-react';
import './alg.css';
import { tr } from '@/i18n/tr';

/**
 * Standalone method trainers (not per-set timing drills) — surfaced on the landing.
 * Skewb 技巧训练不列在这 —— /alg/skewb 的「训练专区」已经有入口了,这里再放一张是重复。
 */
const LANDING_TRAINERS: { href: string; zh: string; en: string; Icon: LucideIcon }[] = [
  { href: '/alg/3bld', zh: '三盲', en: '3BLD', Icon: Eye },
  { href: '/alg/roux', zh: '桥式', en: 'Roux', Icon: Blocks },
];

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

      <h2 className="alg-index-subheading">{tr({ zh: '训练器', en: 'Trainers' })}</h2>
      <div className="alg-puzzle-grid">
        {LANDING_TRAINERS.map((t) => (
          <Link key={t.href} href={t.href} className="alg-puzzle-card" prefetch={false}>
            <div className="alg-puzzle-name">
              <t.Icon className="alg-puzzle-icon" size={20} aria-hidden="true" />
              <span>{tr({ zh: t.zh, en: t.en })}</span>
            </div>
          </Link>
        ))}
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
