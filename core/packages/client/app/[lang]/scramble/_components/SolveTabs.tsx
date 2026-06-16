'use client';

/**
 * 统一「求解」中心的标签导航(/scramble 的 求解/分布/各魔方求解 入口)。
 *
 * 第一行 = 功能(求解 / 分布),两个模式共用,是顶层主导航。
 * 求解模式下第二行才出项目(3×3 / 2×2×2 / 金字塔 / 斜转),项目=3×3 时再出一行
 * 子标签(最优解 / 阶段 / CFOP / DR)。
 * 分布模式不出项目行 —— 分布页自带 WcaEventSelector 是唯一的项目/事件选择器,
 * 避免「上面有项目、下面又有项目」的双重选择器。
 *
 * 关键:3×3 最优解(/scramble/solver)是全站唯一发 COOP/COEP 的文档(cubeopt 要
 * SharedArrayBuffer);其余工具在 COEP 下 worker 会被拦死。Next 软导航不换响应头,
 * 所以**只有跨 solver 边界**(进/出 /scramble/solver)才用原生 <a> 硬导航,其余
 * 一律 AppLink 软导航(秒切、不刷新)。两者都带真实 href,中键/Ctrl 新开正常。
 *
 * active 状态完全由各页以 props 传入(本组件不读 useSearchParams,避免 Suspense/SSG
 * 退化、秒渲染)。
 */

import AppLink from '@/components/AppLink';
import { useParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Sparkles, BarChart3 } from 'lucide-react';
import { EventIcon } from '@/components/EventIcon/EventIcon';
import { useT } from '@/hooks/useT';
import './solve_tabs.css';

export type SolvePuzzle = '3x3' | '2x2x2' | 'pyraminx' | 'skewb';
export type SolveSub = 'optimal' | 'stage' | 'cfop' | 'fmc';

interface SolveTabsProps {
  /** 当前项目;dist 模式落在 4 项目之外的事件时传 null(项目行不高亮) */
  puzzle: SolvePuzzle | null;
  mode: 'solve' | 'dist';
  /** 当前子标签(仅 puzzle==='3x3' && mode==='solve' 有效) */
  sub?: SolveSub;
}

const PUZZLES: SolvePuzzle[] = ['3x3', '2x2x2', 'pyraminx', 'skewb'];

const SOLVE_ROUTE: Record<SolvePuzzle, string> = {
  '3x3': '/scramble/solver',
  '2x2x2': '/scramble/pocket',
  pyraminx: '/scramble/pyraminx',
  skewb: '/scramble/skewb',
};
const EVENT_ID: Record<SolvePuzzle, string> = {
  '3x3': '333',
  '2x2x2': '222',
  pyraminx: 'pyram',
  skewb: 'skewb',
};
const SUB_ROUTE: Record<SolveSub, string> = {
  optimal: '/scramble/solver',
  stage: '/scramble/analyzer?tool=stage',
  cfop: '/scramble/analyzer?tool=cfop',
  fmc: '/scramble/analyzer?tool=fmc',
};

const distHref = (p: SolvePuzzle | null) => `/scramble/stats?event=${p ? EVENT_ID[p] : '333'}`;
const isSolverHref = (href: string) => href === '/scramble/solver' || href.startsWith('/scramble/solver?');

export default function SolveTabs({ puzzle, mode, sub }: SolveTabsProps) {
  const params = useParams();
  const lang = params?.lang;
  const prefix = lang === 'zh' ? '/zh' : '';
  const t = useT();
  const { i18n } = useTranslation();
  void i18n;

  // 当前是不是 COEP 的 3×3 最优解文档
  const currentIsSolver = mode === 'solve' && puzzle === '3x3' && sub === 'optimal';

  // 「求解」功能标签的目标:当前项目的求解页(项目无在线求解器时退回 3×3 最优解)。
  const solveHref = puzzle ? SOLVE_ROUTE[puzzle] : '/scramble/solver';

  // 跨 solver 边界 → 硬导航(原生 a),否则软导航(AppLink)
  const tab = (key: string, href: string, active: boolean, content: React.ReactNode, extraClass = '') => {
    const cls = `solve-tab${active ? ' is-active' : ''}${extraClass ? ` ${extraClass}` : ''}`;
    const hard = currentIsSolver !== isSolverHref(href);
    if (hard) {
      return (
        <a key={key} href={`${prefix}${href}`} className={cls} aria-current={active ? 'page' : undefined}>
          {content}
        </a>
      );
    }
    return (
      <AppLink key={key} href={href} className={cls} aria-current={active ? 'page' : undefined}>
        {content}
      </AppLink>
    );
  };

  const puzzleLabel = (p: SolvePuzzle) =>
    p === '3x3' ? '3×3'
      : p === '2x2x2' ? '2×2×2'
        : p === 'pyraminx' ? t('金字塔', 'Pyraminx')
          : t('斜转', 'Skewb');

  return (
    <nav className="solve-tabs" aria-label={t('求解中心导航', 'Solve center navigation')}>
      {/* 第一行:功能(求解 / 分布)— 顶层主导航,两个模式共用 */}
      <div className="solve-tab-row solve-tab-modes">
        {tab(
          'solve',
          solveHref,
          mode === 'solve',
          <><Sparkles size={15} /><span>{t('求解', 'Solve')}</span></>,
          'solve-tab-mode',
        )}
        {tab(
          'dist',
          distHref(puzzle),
          mode === 'dist',
          <><BarChart3 size={15} /><span>{t('分布', 'Distribution')}</span></>,
          'solve-tab-mode',
        )}
      </div>

      {/* 第二行(仅求解):项目选择 — 4 个有在线求解器的项目。
          分布模式不再重复项目行:分布页自带的 WcaEventSelector 是唯一的项目/事件选择器,
          避免「上面有项目、下面又有项目」的双重选择器。 */}
      {mode === 'solve' && (
        <div className="solve-tab-row solve-tab-puzzles">
          {PUZZLES.map((p) =>
            tab(
              p,
              SOLVE_ROUTE[p],
              puzzle === p,
              <>
                <EventIcon event={EVENT_ID[p]} className="solve-tab-evt" />
                <span>{puzzleLabel(p)}</span>
              </>,
              'solve-tab-puzzle',
            ),
          )}
        </div>
      )}

      {/* 第三行(仅 3×3 求解):子标签(最优解 / 阶段 / CFOP / DR) */}
      {mode === 'solve' && puzzle === '3x3' && (
        <div className="solve-tab-row solve-tab-subs">
          {tab('optimal', SUB_ROUTE.optimal, sub === 'optimal', t('最优解', 'Optimal'), 'solve-tab-sub')}
          {tab('stage', SUB_ROUTE.stage, sub === 'stage', t('阶段', 'Stage'), 'solve-tab-sub')}
          {tab('cfop', SUB_ROUTE.cfop, sub === 'cfop', 'CFOP', 'solve-tab-sub')}
          {tab('fmc', SUB_ROUTE.fmc, sub === 'fmc', 'DR', 'solve-tab-sub')}
        </div>
      )}
    </nav>
  );
}
