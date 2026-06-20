'use client';

/**
 * 统一「求解」中心的标签导航(/scramble 的 求解/分布/各魔方求解 入口)。
 *
 * 第一行 = 功能(求解 / 分布),两个模式共用,是顶层主导航。
 * 求解模式下第二行才出项目,直接复用全站 WcaEventSelector(同一图标选择器,只放出有
 * 在线求解器的 5 个项目:3×3 / 2×2×2 / 金字塔 / 斜转 / SQ1),与分布模式的项目选择器同款;
 * 项目=3×3 时再出一行子标签(最优解 / 阶段 / CFOP / DR)。
 * 分布模式不出项目行 —— 分布页自带 WcaEventSelector 是唯一的项目/事件选择器,
 * 避免「上面有项目、下面又有项目」的双重选择器。
 *
 * 关键:5 个项目共用一个路由 /scramble/solver?event=<id>(按 event 分发求解器),但只有
 * 3×3(event=333,cubeopt 要 SharedArrayBuffer)是发 COOP/COEP 的文档;其余 event 是普通
 * 文档(rust-cross worker/跨域表在 COEP 下会被拦死,绝不能套)。Next 软导航不换响应头,
 * 所以**只有跨 333 边界**(进/出 event=333)才用原生 <a> 硬导航,非 333 之间一律 AppLink
 * 软导航(秒切、不刷新)。两者都带真实 href,中键/Ctrl 新开正常。
 *
 * active 状态完全由各页以 props 传入(本组件不读 useSearchParams,避免 Suspense/SSG
 * 退化、秒渲染)。
 */

import AppLink from '@/components/AppLink';
import { useParams } from 'next/navigation';
import { Sparkles, BarChart3 } from 'lucide-react';
import WcaEventSelector from '@/components/WcaEventSelector';
import NonWcaPuzzlePicker from '@/components/NonWcaPuzzlePicker/NonWcaPuzzlePicker';
import { CSTIMER_SOLVABLE_IDS } from '@/lib/cstimer-scramble';
import { useT } from '@/hooks/useT';
import './solve_tabs.css';

export type SolvePuzzle = '3x3' | '2x2x2' | 'pyraminx' | 'skewb' | 'sq1' | 'ivy' | '133' | '223' | '8p';
export type SolveSub = 'optimal' | 'stage' | 'cfop' | 'fmc';

interface SolveTabsProps {
  /** 当前项目;dist 模式落在 4 项目之外的事件时传 null(项目行不高亮) */
  puzzle: SolvePuzzle | null;
  mode: 'solve' | 'dist';
  /** 当前子标签(仅 puzzle==='3x3' && mode==='solve' 有效) */
  sub?: SolveSub;
}

// 求解模式 5 个项目统一走一个路由 /scramble/solver?event=<id>,由该路由按 event 分发到
// 对应求解器(333→cubeopt/COEP、222/pyram/skewb→PuzzleOptimalSolver、sq1→SQ1),和分布
// /scramble/stats?event= 完全对称。event 是真正的选择器(决定渲染哪个求解器),无冗余路由名。
const SOLVE_BASE = '/scramble/solver';
const EVENT_ID: Record<SolvePuzzle, string> = {
  '3x3': '333',
  '2x2x2': '222',
  pyraminx: 'pyram',
  skewb: 'skewb',
  sq1: 'sq1',
  ivy: 'ivy',
  '133': '133',
  '223': '223',
  '8p': '8p',
};
// 求解中心项目行复用全站 WcaEventSelector(同一图标选择器),仅放出有在线求解器的 WCA 项目
//(5 个图标)。非 WCA 求解项目(ivy 等)塞不进图标行,改走 NonWcaPuzzlePicker 分组下拉
//(数据驱动:lib/cstimer-scramble 标 solvable 的 puzzle 自动出现),后续 puzzle 免改本组件。
const PUZZLE_BY_EVENT: Record<string, SolvePuzzle> = {
  '333': '3x3', '222': '2x2x2', pyram: 'pyraminx', skewb: 'skewb', sq1: 'sq1', ivy: 'ivy', '133': '133', '223': '223', '8p': '8p',
};
// 图标行只放 WCA 求解项目(非 WCA 走分组下拉)。
const WCA_SOLVE_EVENTS = new Set(['333', '222', 'pyram', 'skewb', 'sq1']);
// 有「分布」数据的求解项目;ivy 走理论全空间分布(/scramble/stats?event=ivy)。
const HAS_DISTRIBUTION: ReadonlySet<SolvePuzzle> = new Set(['3x3', '2x2x2', 'pyraminx', 'skewb', 'sq1', 'ivy', '133', '223', '8p']);

const withEvent = (href: string, eventId: string) =>
  `${href}${href.includes('?') ? '&' : '?'}event=${eventId}`;
const solveHrefFor = (p: SolvePuzzle) => withEvent(SOLVE_BASE, EVENT_ID[p]);

// 3×3 子标签:最优解 = 统一路由的 event=333;阶段/CFOP/DR 是另一个工具 /scramble/analyzer
// (非 COEP),均属 333 带 event=333。
const SUB_ROUTE: Record<SolveSub, string> = {
  optimal: '/scramble/solver?event=333',
  stage: '/scramble/analyzer?tool=stage&event=333',
  cfop: '/scramble/analyzer?tool=cfop&event=333',
  fmc: '/scramble/analyzer?tool=fmc&event=333',
};

const distHref = (p: SolvePuzzle | null) =>
  `/scramble/stats?event=${p && HAS_DISTRIBUTION.has(p) ? EVENT_ID[p] : '333'}`;

// COEP 边界 = 全站唯一发 COOP/COEP 的文档 = /scramble/solver?event=333(或裸 /scramble/solver
// = 默认 333)。其余 event 是普通文档。跨这条边界(进/出 333)必须硬导航换文档头。
const is333Href = (href: string) => {
  if (href !== SOLVE_BASE && !href.startsWith(`${SOLVE_BASE}?`)) return false;
  const q = href.split('?')[1];
  if (!q) return true; // 裸 /scramble/solver = 默认 333
  const ev = new URLSearchParams(q).get('event');
  return ev === null || ev === '333';
};

export default function SolveTabs({ puzzle, mode, sub }: SolveTabsProps) {
  const params = useParams();
  const lang = params?.lang;
  const prefix = lang === 'zh' ? '/zh' : '';
  const t = useT();

  // 当前是不是 COEP 的 3×3 最优解文档
  const currentIsSolver = mode === 'solve' && puzzle === '3x3' && sub === 'optimal';

  // 「求解」功能标签的目标:当前项目的求解页(项目无在线求解器时退回 3×3 最优解),带 ?event=。
  const solveHref = puzzle ? solveHrefFor(puzzle) : '/scramble/solver?event=333';

  // 跨 solver 边界 → 硬导航(原生 a),否则软导航(AppLink)
  const tab = (key: string, href: string, active: boolean, content: React.ReactNode, extraClass = '') => {
    const cls = `solve-tab${active ? ' is-active' : ''}${extraClass ? ` ${extraClass}` : ''}`;
    const hard = currentIsSolver !== is333Href(href);
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

  return (
    <nav className="solve-tabs" aria-label={t('求解中心导航', 'Solve center navigation')}>
      {/* 第一行(仅求解):项目选择 — 复用全站 WcaEventSelector(同一图标选择器),只放出
          有在线求解器的 5 个项目(3×3 / 2×2×2 / 金字塔 / 斜转 / SQ1)。分布模式不出此行:分布页
          自带 WcaEventSelector 是唯一项目/事件选择器,避免「上面有项目、下面又有项目」。 */}
      {mode === 'solve' && (
        <div className="solve-tab-evrow">
          <WcaEventSelector
            availableEvents={WCA_SOLVE_EVENTS}
            onlyAvailable
            selectedEvent={puzzle ? EVENT_ID[puzzle] : undefined}
            isZh={lang === 'zh'}
            linkFor={(id) => {
              const p = PUZZLE_BY_EVENT[id];
              if (!p) return null;
              const href = solveHrefFor(p);
              return { href, hard: currentIsSolver !== is333Href(href) };
            }}
          />
          {/* 非 WCA 求解项目(ivy 等)分组下拉:塞不进图标行,数据驱动按家族分组。 */}
          <NonWcaPuzzlePicker
            isZh={lang === 'zh'}
            availableEvents={CSTIMER_SOLVABLE_IDS}
            selectedEvent={puzzle ? EVENT_ID[puzzle] : undefined}
            linkFor={(id) => {
              const p = PUZZLE_BY_EVENT[id];
              if (!p) return null;
              const href = solveHrefFor(p);
              return { href, hard: currentIsSolver !== is333Href(href) };
            }}
          />
        </div>
      )}

      {/* 第二行:功能(求解 / 分布)— 两个模式共用 */}
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
