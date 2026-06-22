'use client';

/**
 * 统一「求解」中心的标签导航(/scramble 各魔方求解 + 子工具入口)。
 *
 * 「求解 / 分布」顶层切换已废除(2026-06-21):求解与分布合并到同一滚动页(求解在上、
 * 分布在下,分布懒挂载),不再分两个 tab。本组件现在只剩**项目行 + 3×3 子标签行**。
 *
 * 项目行直接复用全站 WcaEventSelector(同一图标选择器,只放出有在线求解器的 5 个项目:
 * 3×3 / 2×2×2 / 金字塔 / 斜转 / SQ1)+ 右侧非 WCA 分组下拉(ivy 等);项目=3×3 时再出
 * 一行子标签(最优解 / 阶段 / CFOP / DR)。
 *
 * 关键:5 个项目共用一个路由 /scramble/solver?event=<id>(按 event 分发求解器),但只有
 * 3×3(event=333,cubeopt 要 SharedArrayBuffer)是发 COOP/COEP 的文档;其余 event 是普通
 * 文档(rust-cross worker/跨域表在 COEP 下会被拦死,绝不能套)。Next 软导航不换响应头,
 * 所以**只有跨 333 边界**(进/出 event=333)才用原生 <a> 硬导航,非 333 之间一律 AppLink
 * 软导航(秒切、不刷新)。两者都带真实 href,中键/Ctrl 新开正常。
 *
 * active 状态完全由各页以 props 传入(本组件不读 useSearchParams,避免 Suspense/SSG
 * 退化、秒渲染)。
 *
 * `mode` prop 保留只为兼容大量调用方(各 _*Solver 仍传 mode="solve");求解/分布合页后
 * 它不再影响渲染(项目行恒显示)。
 */

import AppLink from '@/components/AppLink';
import { useParams } from 'next/navigation';
import WcaEventSelector from '@/components/WcaEventSelector';
import NonWcaPuzzlePicker from '@/components/NonWcaPuzzlePicker/NonWcaPuzzlePicker';
import { CSTIMER_SOLVABLE_IDS } from '@/lib/cstimer-scramble';
import { useT } from '@/hooks/useT';
import './solve_tabs.css';

export type SolvePuzzle = '3x3' | '2x2x2' | 'pyraminx' | 'skewb' | 'sq1' | 'sq2' | 'ssq1' | 'bsq' | 'ivy' | '133' | '223' | '233' | '334' | '335' | '336' | '337' | '8p' | '15p' | 'sfl' | 'ufo' | 'cm2' | 'cm3' | 'dmd' | 'gear' | 'mpyrso' | 'dino' | 'crz3a' | 'bic';
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
  sq2: 'sq2',
  ssq1: 'ssq1',
  bsq: 'bsq',
  ivy: 'ivy',
  '133': '133',
  '223': '223',
  '233': '233',
  '334': '334',
  '335': '335',
  '336': '336',
  '337': '337',
  '8p': '8p',
  '15p': '15p',
  sfl: 'sfl',
  ufo: 'ufo',
  cm2: 'cm2',
  cm3: 'cm3',
  dmd: 'dmd',
  gear: 'gear',
  mpyrso: 'mpyrso',
  dino: 'dino',
  crz3a: 'crz3a',
  bic: 'bic',
};
// 求解中心项目行复用全站 WcaEventSelector(同一图标选择器),仅放出有在线求解器的 WCA 项目
//(5 个图标)。非 WCA 求解项目(ivy 等)塞不进图标行,改走 NonWcaPuzzlePicker 分组下拉
//(数据驱动:lib/cstimer-scramble 标 solvable 的 puzzle 自动出现),后续 puzzle 免改本组件。
const PUZZLE_BY_EVENT: Record<string, SolvePuzzle> = {
  '333': '3x3', '222': '2x2x2', pyram: 'pyraminx', skewb: 'skewb', sq1: 'sq1', sq2: 'sq2', ssq1: 'ssq1', bsq: 'bsq', ivy: 'ivy', '133': '133', '223': '223', '233': '233', '334': '334', '335': '335', '336': '336', '337': '337', '8p': '8p', '15p': '15p', sfl: 'sfl', ufo: 'ufo', cm2: 'cm2', cm3: 'cm3', dmd: 'dmd', gear: 'gear', mpyrso: 'mpyrso', dino: 'dino', crz3a: 'crz3a', bic: 'bic',
};
// 图标行只放 WCA 求解项目(非 WCA 走分组下拉)。
const WCA_SOLVE_EVENTS = new Set(['333', '222', 'pyram', 'skewb', 'sq1']);

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

  // 当前是不是 COEP 的 3×3 最优解文档(mode 仅在此参与硬/软导航判定,不再 gate 渲染)
  const currentIsSolver = mode === 'solve' && puzzle === '3x3' && sub === 'optimal';

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
      {/* 项目行:复用全站 WcaEventSelector(同一图标选择器),只放出有在线求解器的 5 个项目
          (3×3 / 2×2×2 / 金字塔 / 斜转 / SQ1)+ 右侧非 WCA 分组下拉(ivy 等)。求解/分布合页后
          这是页面顶部唯一的项目选择器(分布区不再自带选择器,跟随这里的 ?event)。 */}
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

      {/* 子标签(仅 3×3):最优解 / 阶段 / CFOP / DR */}
      {puzzle === '3x3' && (
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
