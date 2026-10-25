'use client';
import '@cuberoot/timer-ui/compact-select.css';

// Landing "近期打乱" (Recent Scrambles). An event picker on top:
//  - 333 → the rich variant(std/eo/pseudo/...) × metric(cross/xc/...) × bottom-color × move
//    widget, fed by stats/scramble/recent_scrambles.json (Recent333Body). Its variant dropdown
//    also carries a "打乱长度" pseudo-variant (LENGTH_VARIANT) that buckets the batch by raw
//    scramble length (3x3 scrambles vary, 12–23 moves) off the events JSON below.
//  - every other event → simplest scrambles of the latest batch, bucketed by scramble length;
//    222 / pyraminx / skewb also offer a difficulty (whole-solve optimal step) mode. Fed by
//    stats/scramble/recent_scrambles_events.json (RecentEventBody).
//    222 / skewb have a fixed WCA scramble length, so they only get the difficulty view;
//    单手 / 脚拧 / 最少步 / 三盲 (333oh/333ft/333fm/333bf) also get a difficulty view (whole-solve
//    optimal HTM); its cards show the 最优等态打乱, same source as 333 above. Length still varies so
//    they keep the length toggle too.
//    4x4–7x7 / megaminx / clock are fixed-length with no difficulty data → not listed at all.
// 显示的打乱一律是**最优等态打乱**(同 /timer 真题的「最优打乱」,无 toggle):与该场原打乱同一魔方态、
// 步数最短。同态 ⇒ 各阶段步数 / 难度值不变。仅「打乱长度」视图例外(那按的就是原打乱长度)。
import { useRetainedState } from '@/hooks/useRetainedState';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import AppLink from '@/components/AppLink';
import { buildReconSubmitQuery } from '@/lib/sim-recon-link';
import { ScramblePreview2D } from '@/components/ScramblePreview2D';
import { EventIcon } from '@/components/EventIcon/EventIcon';
import PuzzlePicker, { type PuzzlePickerGroup } from '@/components/PuzzlePicker/PuzzlePicker';
import { Flag } from '@/components/Flag';
import { SubsetColorPicker, SubsetSwatch, useSubsetSelection, COLOR_LETTERS, COLOR_NAME, type ColorLetter, type ColorMode, type SubsetSelection } from '@/components/SubsetColorPicker/SubsetColorPicker';
import { localizeCompName } from '@/lib/comp-localize';
import { loadFlagData, flagDataVersion, compFlagIso2 } from '@/lib/country-flags';
import { compSourceLine } from '@/lib/comp-schedule';
import { statsUrl } from '@/lib/stats-base';
import { VARIANT_ORDER, stageLabel, variantLabel, BLOCK_DATA_VARIANTS, BLOCK_STAGE_VARIANT, EO_DATA_VARIANTS, EO_STAGE_VARIANT, LBL_STAGE_VARIANT, VARIANT_STAGES, LENGTH_VARIANT, RECENT_METRIC_ORDER, uiVariantOf, uiVariantOptions, dataVariantOfStage, uiStagesOf, variantDataRef } from '@/lib/scramble-variants';
import { MethodStagePicker } from '@cuberoot/timer-ui/puzzle-picker';
import { fetchRecentScramblesEvents, type RecentScramblesEventsJson, type RecentScrMeta } from '@/lib/recent-scrambles-events';
import { formatDateRangeIso } from '@/lib/wca-date';
import { eventDisplayName, wcaToReconEvent } from '@/lib/wca-events';
import './recent_scrambles.css';
import './scroll_panel.css';
import { tr } from '@/i18n/tr';

interface Props { lang: 'zh' | 'en' }

interface ScrMeta { ci: string; cn: string; cd: string; r: string; g: string; n: number; e: string; x?: 0 | 1 }
interface RecentScramblesJson {
  export_date: string;
  new_count: number;
  scr: Record<string, string>;
  // id -> 最优等态打乱(invert 整解最优解:与原打乱同一魔方态、步数最短)。同态 ⇒ rank 里各阶段步数不变,
  // 故这里强制显示最优那份(同 /timer 真题的「最优打乱」)。缺的(未解 / 盲拧)回退原打乱。
  opt?: Record<string, string>;
  meta: Record<string, ScrMeta>;
  // variant -> metric -> subsetKey -> step(字符串) -> [id, 取最少步的底色字母][]（每桶 ≤12 条）
  // 例外:'333'(整解)与底色无关 -> 只有一个子集键 'ALL', 颜色字母为空串。
  rank: Record<string, Record<string, Record<string, Record<string, [string, ColorLetter | ''][]>>>>;
}

// 整解变体:难度 = 整个 3x3 的最优 HTM, 没有「底色」这一维 -> 固定子集键(同 distribution.json)。
const WHOLE_SOLVE = '333';
const WHOLE_SOLVE_SUBSET = 'ALL';

// 概率提示数据源 = /scramble/stats 的 distribution.json('wca' 合并池:全部 WCA 三阶打乱)。
interface DistHist { counts: Record<string, number> }
interface DistributionJson {
  sets: Record<string, { variants: Record<string, { data: Record<string, Record<string, DistHist>> }> }>;
}

// 难度模式的项目(整解最优步数);其余项目只按打乱长度。
// 222/金字塔/斜转走 puzzle 管道;单手/脚拧/最少步/三盲走 333opt(难度视图显示最优等态打乱,同 333 富控件)。
const DIFFICULTY_EVENTS = new Set(['222', 'pyram', 'skewb', '333oh', '333ft', '333fm', '333bf']);
// WCA 官方打乱是固定长度(非随机态变长),打乱长度分布无意义 → 不给长度切换,只留难度。
const FIXED_LENGTH_NO_TOGGLE = new Set(['222', 'skewb']);
// 打乱长度固定且无难度数据(4/5/6/7 阶、五魔、魔表)→ 整个项目在本栏不展示。
const HIDDEN_FIXED_LENGTH_EVENTS = new Set(['444', '555', '666', '777', 'minx', 'clock']);

// meta.cd 是比赛起讫日的紧凑串(2026-06-20 / 2026-06-20~21 / 2026-06-20~07-05),
// 还原出结束日的完整 ISO,用于跨全批求最晚日期。
function cdEndIso(cd: string): string {
  const start = cd.slice(0, 10);
  const i = cd.indexOf('~');
  if (i < 0) return start;
  const tail = cd.slice(i + 1);
  const [sy, sm] = start.split('-');
  if (/^\d{4}-\d{2}-\d{2}$/.test(tail)) return tail;
  if (/^\d{2}-\d{2}$/.test(tail)) return `${sy}-${tail}`;
  if (/^\d{2}$/.test(tail)) return `${sy}-${sm}-${tail}`;
  return start;
}

// 本批全部打乱来源比赛的日期跨度:最早开始日 ~ 最晚结束日(跨 333 与其它项目两份 meta)。
// 本栏标题紧挨着,年份是噪音 -> 掐掉打头的 "YYYY-"(跨年才会剩下结束日的年份,不去,消歧义)。
function batchDateRange(
  data: RecentScramblesJson | null,
  eventsJson: RecentScramblesEventsJson | null,
): string | null {
  let minStart = '';
  let maxEnd = '';
  const consider = (cd?: string) => {
    if (!cd) return;
    const start = cd.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) return;
    if (!minStart || start < minStart) minStart = start;
    const end = cdEndIso(cd);
    if (!maxEnd || end > maxEnd) maxEnd = end;
  };
  if (data?.meta) for (const k in data.meta) consider(data.meta[k].cd);
  if (eventsJson?.meta) for (const k in eventsJson.meta) consider(eventsJson.meta[k].cd);
  if (!minStart) return null;
  return formatDateRangeIso(minStart, maxEnd).replace(/^\d{4}-/, '');
}

// 紧凑数字(960000→960k)。
function compactNum(n: number): string {
  if (n >= 1e6) { const m = n / 1e6; return `${m >= 10 ? Math.round(m) : m.toFixed(1).replace(/\.0$/, '')}M`; }
  if (n >= 1e3) { const k = n / 1e3; return `${k >= 100 ? Math.round(k) : k.toFixed(1).replace(/\.0$/, '')}k`; }
  return n.toLocaleString();
}
function formatProb(p: number): string | null {
  if (!(p > 0)) return null;
  if (p < 0.01) {
    const n = 1 / p;
    const mag = Math.pow(10, Math.max(0, Math.floor(Math.log10(n)) - 1));
    return `1/${compactNum(Math.round(n / mag) * mag)}`;
  }
  return `${(p * 100).toFixed(1)}%`;
}

// 全局最稀有:在本批 rank 的所有 (变体 × 类型 × 底色 × 步数) 桶里,挑 distribution 概率最低的那一格,
// 作为 333 hero 的默认选择(首屏一次性定位,用户手动改过即不再覆盖)。返回 UI 层的 variant/metric。
function findRarestSelection(
  data: RecentScramblesJson,
  dist: DistributionJson,
): { variant: string; metric: string; subsetKey: string; step: number } | null {
  const wcaVars = dist.sets?.wca?.variants;
  if (!wcaVars || !data.rank) return null;
  let best: { variant: string; metric: string; subsetKey: string; step: number; p: number } | null = null;
  for (const dataVariant in data.rank) {
    const distVar = wcaVars[dataVariant];
    if (!distVar) continue;
    const byMetric = data.rank[dataVariant];
    for (const metric in byMetric) {
      const target = stageLabel(metric, false);
      const distStageKey = Object.keys(distVar.data).find((s) => stageLabel(s, false) === target);
      if (!distStageKey) continue;
      const stageData = distVar.data[distStageKey];
      const bySubset = byMetric[metric];
      for (const subsetKey in bySubset) {
        const counts = stageData?.[subsetKey]?.counts;
        if (!counts) continue;
        let total = 0;
        for (const k in counts) total += counts[k];
        if (total <= 0) continue;
        const byStep = bySubset[subsetKey];
        for (const stepStr in byStep) {
          if (!byStep[stepStr]?.length) continue;   // 该步数必须本批真有样例
          const c = counts[stepStr] ?? 0;
          if (c <= 0) continue;
          const p = c / total;
          if (best === null || p < best.p) {
            best = { variant: uiVariantOf(dataVariant), metric, subsetKey, step: Number(stepStr), p };
          }
        }
      }
    }
  }
  return best ? { variant: best.variant, metric: best.metric, subsetKey: best.subsetKey, step: best.step } : null;
}

const RARE_CAP = 60; // 渲染上限(每张卡含 SVG 预览 + ObjectURL,过多伤性能);超出给提示

interface RareEntry { id: string; uiVariant: string; metric: string; step: number; color: ColorLetter | ''; subsetKey: string; p: number }

// 在**选定的底色中性档**(subsetKey,如 'WY' 双色)下横扫本批 rank 的每个 (变体 × 类型 × 步数) 桶,
// 用 distribution 的**同档**分布算概率,收集 p < threshold 的样例。整解('333' 的 'ALL' 档,与底色无关)
// 恒纳入。刻意不跨中性档取 min:单色 1/12k ≠ 六色 1/12k(苹果比橘子),且好运尾里单色数值天然最小、
// 会永远压过六/双/四色 —— 只在同一档内比较,六/双/四色才有机会上榜。
// subsetKey === null = 「综合」:合并全部 13 档,不设过滤,按 id 取跨档最稀有那次(数值上单色偏多,
// 是用户显式选择的「任一中性视角下最稀有」口径)。同一打乱(id)按 id 去重保留最稀有那次,
// 按概率升序返回。UI 层 variant(块族归并为 'block')。
function collectRareScrambles(
  data: RecentScramblesJson, dist: DistributionJson, threshold: number, subsetKey: string | null,
): RareEntry[] {
  const wcaVars = dist.sets?.wca?.variants;
  if (!wcaVars || !data.rank) return [];
  const best = new Map<string, RareEntry>();
  for (const dataVariant in data.rank) {
    const distVar = wcaVars[dataVariant];
    if (!distVar) continue;
    const uiVariant = uiVariantOf(dataVariant);
    const byMetric = data.rank[dataVariant];
    for (const metric in byMetric) {
      const target = stageLabel(metric, false);
      const distStageKey = Object.keys(distVar.data).find((s) => stageLabel(s, false) === target);
      if (!distStageKey) continue;
      const stageData = distVar.data[distStageKey];
      const bySubset = byMetric[metric];
      for (const sk in bySubset) {
        // 综合(null)= 收全部档;否则只看选中档 + 整解 ALL(色无关,恒纳入)。
        if (subsetKey !== null && sk !== subsetKey && sk !== WHOLE_SOLVE_SUBSET) continue;
        const byStep = bySubset[sk];
        if (!byStep) continue;
        const counts = stageData?.[sk]?.counts;
        if (!counts) continue;
        let total = 0;
        for (const k in counts) total += counts[k];
        if (total <= 0) continue;
        for (const stepStr in byStep) {
          const entries = byStep[stepStr];
          if (!entries?.length) continue;
          const c = counts[stepStr] ?? 0;
          if (c <= 0) continue;
          const p = c / total;
          if (p >= threshold) continue;
          const step = Number(stepStr);
          for (const [id, color] of entries) {
            const prev = best.get(id);
            if (!prev || p < prev.p) best.set(id, { id, uiVariant, metric, step, color, subsetKey: sk, p });
          }
        }
      }
    }
  }
  return [...best.values()].sort((a, b) => a.p - b.p);
}

// 「综合」卡专用:把胜出档 subsetKey('WY'/'BGORWY'/'Y'/'ALL' …)拆成色字母。整解 'ALL' 无底色维度
// → 空数组(不画点)。给卡片左上角画的是**整档色块**(多色档 = 扇形拼色),而非单个胜出色 —— 否则
// 多色档也只显示一个色点,会被误读成单色底。
const COLOR_SET = new Set<ColorLetter>(COLOR_LETTERS);
const subsetColorsOf = (key: string): ColorLetter[] =>
  key.split('').filter((c): c is ColorLetter => COLOR_SET.has(c as ColorLetter));
// 档色块的可读标题(hover / a11y):单/双/四/六色 +(≤四色列具体色名)+ 多色档标出实际胜出的底色。
// 走 tr() 避免内联 isZh 文案三元。
function subsetDotTitle(colors: ColorLetter[], winner?: ColorLetter): string {
  const tier = colors.length >= 6 ? tr({ zh: '六色', en: 'CN' })
    : colors.length === 1 ? tr({ zh: '单色', en: 'Single' })
      : colors.length === 2 ? tr({ zh: '双色', en: 'Dual' })
        : tr({ zh: '四色', en: 'Quad' });
  const base = colors.length <= 4 ? `${tier} ${colors.map((c) => tr(COLOR_NAME[c])).join(' ')}` : tier;
  return (winner && colors.length > 1)
    ? `${base} ${tr({ zh: '底', en: 'base' })} ${tr(COLOR_NAME[winner])}`
    : base;
}

// 稀有卡顶标签:变体 + 类型(相同则合一)+ 步数,与下钻视图两个下拉口径一致。
function rarityTag(uiVariant: string, metric: string, step: number, isZh: boolean): string {
  const vl = variantLabel(uiVariant, isZh);
  const sl = stageLabel(metric, isZh);
  const head = vl === sl ? vl : `${vl} ${sl}`;
  return `${head} ${tr({ zh: `${step}步`, en: `${step}f` })}`;
}

// 步数下拉选项标签(zh「N 步」/ en「N」)。tr 包住避免内联 isZh 文案三元。
const stepOptionLabel = (n: number) => tr({ zh: `${n} 步`, en: String(n) });

// 伪变体「打乱」(按原打乱长度分桶)的键与标签在 lib/scramble-variants 单源(/timer 真题难度筛
// 也用同一个)。本页的数据同其它项目走 eventsJson;放在变体下拉而非视图下拉,因为它和
// 「整体 / 标准 / DR」一样是「按什么分桶」的选择。

// Pattern B: English is bare; only Chinese is /zh-prefixed.
const langPrefix = (lang: 'zh' | 'en') => (lang === 'zh' ? '/zh' : '');
// 比赛来源 → 该场比赛页的「打乱」视图,深链定位到这条打乱的 项目/轮次/组别/序号。
//  - round 传 WCA round_type_id(m.r);比赛页 ?round= 认字母 id,会自动规范化成第几轮的数字。
//  - attempt 传打乱 label:备打为 E 前缀(与 compSourceLine 同口径),否则就是序号。
const compScrambleHref = (lp: string, m: RecentScrMeta | ScrMeta): string => {
  const p = new URLSearchParams({ view: 'scramble' });
  if (m.e) p.set('event', m.e);
  if (m.r) p.set('round', m.r);
  if (m.g) p.set('group', m.g);
  if (m.n) p.set('attempt', m.x ? `E${m.n}` : String(m.n));
  return `${lp}/wca/comp/${encodeURIComponent(m.ci)}?${p.toString()}`;
};
// (变体, 类型) → analyzer StageSolver 的 method + 阶段索引(深链直达「砖 / F2B」这类视图)。
// 333(整解)无 StageSolver 方法 → null,不附加参数。metric 短键(xc)与阶段全名(xcross)经
// stageLabel 归一后按位匹配。
// EO 是 UI 聚合方法,但 StageSolver 那边 EOLine 仍是独立引擎方法 → EO/EOLine 两个阶段回落到 'eoline'。
function stageSolverTarget(uiVariant: string, metric: string): { method: string; stage: number } | null {
  if (uiVariant === '333') return null;
  const method = uiVariant === 'lbl' ? (LBL_STAGE_VARIANT[metric] ?? 'daisy')
    : uiVariant === 'eo' ? (EO_STAGE_VARIANT[metric] ?? 'eo') : uiVariant;
  const stages = VARIANT_STAGES[method as keyof typeof VARIANT_STAGES];
  if (!stages) return null;
  const target = stageLabel(metric, false);
  const stage = stages.findIndex((s) => stageLabel(s, false) === target);
  return stage >= 0 ? { method, stage } : null;
}
// 底色字母 → StageSolver 6 视角(FACES=[D,U,L,R,F,B])索引。标准配色 U=白 D=黄 F=绿 B=蓝 R=红 L=橙
// (lib/cube-colors),故 Y→0(D) W→1(U) O→2(L) R→3(R) G→4(F) B→5(B)。锁定底色对应的视角用。
const COLOR_FACE_INDEX: Record<ColorLetter, number> = { Y: 0, W: 1, O: 2, R: 3, G: 4, B: 5 };
const analyzerHref = (
  lp: string,
  scramble: string,
  target?: { method: string; stage: number } | null,
  color?: ColorLetter,
  competition?: { ci: string; cn: string },
  optimal?: boolean,
  reconQuery?: string,
) => {
  const p = new URLSearchParams({ scramble: scramble.trim().replace(/ /g, '_') });
  if (reconQuery) {
    const source = new URLSearchParams(reconQuery);
    for (const key of ['event', 'round', 'groupId', 'solveNum', 'sourceEn', 'sourceZh', 'sourceColors']) {
      const value = source.get(key);
      if (value) p.set(key, value);
    }
  }
  if (competition) {
    p.set('compWcaId', competition.ci);
    p.set('comp', competition.cn);
  }
  if (optimal) p.set('optimal', '1');
  if (target) {
    if (target.method !== 'std') p.set('method', target.method); // std 是默认 method,省略
    if (target.stage !== 0) p.set('mstage', String(target.stage)); // 0 是默认阶段,省略
    if (color) p.set('face', String(COLOR_FACE_INDEX[color])); // 锁定该底色对应视角(精确展示这条的稀有步数)
  }
  return `${lp}/scramble/analyzer?${p.toString()}`;
};

// 比赛来源行(hero / list 行尾):国旗 + 比赛名 + 项目图标 + 轮次/组别。
function CompSource({ m, lp, isZh, row }: { m: RecentScrMeta | ScrMeta; lp: string; isZh: boolean; row?: boolean }) {
  const iso2 = compFlagIso2(m.ci);
  return (
    <Link href={compScrambleHref(lp, m)} prefetch={false} className={row ? 'rs-row-comp' : 'rs-hero-src'}>
      {iso2 && <Flag iso2={iso2} spanClassName="country-flag" imgClassName="country-flag-ct" />}
      <span className={row ? 'rs-row-name' : 'rs-src-comp'}>{localizeCompName(m.ci, m.cn, isZh)}</span>
      <EventIcon event={m.e} className="rs-evt" />
      <span className={row ? 'rs-row-sub' : 'rs-src-meta'}>{compSourceLine(m.r, m.g, m.n, isZh, !!m.x)}</span>
    </Link>
  );
}

// 统一打乱小卡(2 列网格单元):魔方图 + 打乱记号 + 比赛来源,可选左上角底色点。
// 整卡非单一 <a>(内部「大图 / analyzer / gen」三个并列链接,禁嵌套),与原 hero 同结构。
function ScrambleCard({ event, scramble, m, lp, isZh, ssTarget, color, dotColors, dotTitle, rarity, optimal, analysis }: {
  event: string;
  scramble: string;
  m?: RecentScrMeta | ScrMeta;
  lp: string;
  isZh: boolean;
  ssTarget?: { method: string; stage: number } | null;
  color?: ColorLetter;                 // analyzer 深链锁定的视角(胜出色);缺省不锁
  // 左上角底色点显示的色集。缺省 = [color](单个胜出色)。「综合」视图传整个胜出档的色集
  // (多色档 → 扇形拼色),避免多色档被误读成单色底;dotTitle 为该档可读名(hover / a11y)。
  dotColors?: ColorLetter[];
  dotTitle?: string;
  // 稀有汇总卡专用:顶部「变体 类型 步数」标签 + 概率徽章(下钻视图不传,概率在头部统一显示)。
  rarity?: { tag: string; prob: string };
  // 显示的是最优等态打乱(非该场原打乱的记号)→ 悬停说明,免得被当成比赛原打乱。
  optimal?: boolean;
  analysis?: { variant: string; metric: string; step: number | null; prob?: string };
}) {
  const dotList = dotColors ?? (color ? [color] : []);
  const describeSource = (lang: 'zh' | 'en') => {
    const condition = [
      m?.x ? `E${m.n}` : '',
      analysis?.variant && variantLabel(analysis.variant, lang === 'zh'),
      analysis?.metric && stageLabel(analysis.metric, lang === 'zh'),
      analysis?.step != null ? `${analysis.step} ${{ zh: '步', en: 'moves' }[lang]}` : '',
    ].filter(Boolean).join(' ');
    return condition + (analysis?.prob ? ` · ${analysis.prob}` : '');
  };
  const reconParams = buildReconSubmitQuery(wcaToReconEvent(m?.e || event), scramble, '', {
    practice: true, optimal, competition: m, sourceColors: dotList.join(''), sourceEn: describeSource('en'), sourceZh: describeSource('zh'),
  });
  return (
    <div className="rs-scard">
      <div className="rs-scard-cube">
        <div className="rs-scard-actions">
        {dotList.length > 0 && (
          <span className="rs-scard-dot" title={dotTitle} aria-label={dotTitle} aria-hidden={dotTitle ? undefined : true}>
            <SubsetSwatch colors={dotList} highlight={dotList.length > 1 ? color : undefined} />
          </span>
        )}
        {scramble.trim() && (
          <AppLink href={`/recon/submit?${reconParams}`} prefetch={false} className="rs-recon-link">
            {tr({ zh: '复盘', en: 'Reconstruct' })}
          </AppLink>
        )}
        </div>
        <ScramblePreview2D event={event} scramble={scramble} size={58} fullSizeLink linkTitle={tr({ zh: '查看大图', en: 'View full size' })} />
      </div>
      <div className="rs-scard-body">
        {rarity && (
          <div className="rs-scard-rarity">
            <span className="rs-scard-rtag">{rarity.tag}</span>
            <span className="rs-scard-rprob">{rarity.prob}</span>
          </div>
        )}
        <Link
          href={analyzerHref(lp, scramble, ssTarget, color, m, optimal, reconParams)}
          prefetch={false}
          className="rs-scard-scramble"
          title={optimal ? tr({ zh: '最优等态打乱:与该场原打乱同一魔方态,步数最短', en: 'Optimal equivalent scramble — same cube state as the original, fewest moves' }) : undefined}
        >{scramble}</Link>
        {m && <CompSource m={m} lp={lp} isZh={isZh} row />}
      </div>
    </div>
  );
}

export default function RecentScrambles({ lang }: Props) {
  const isZh = lang === 'zh';
  const lp = langPrefix(lang);
  const [data, setData] = useRetainedState<RecentScramblesJson | null | undefined>('home:scrambles', undefined);
  const [dist, setDist] = useRetainedState<DistributionJson | null | undefined>('home:scrambleDistribution', undefined);
  const [eventsJson, setEventsJson] = useRetainedState<RecentScramblesEventsJson | null>('home:scrambleEvents', null);
  const [event, setEvent] = useState('333');
  const aliveRef = useRef(true);
  const extrasStartedRef = useRef(false);

  useEffect(() => {
    aliveRef.current = true;
    return () => { aliveRef.current = false; };
  }, []);

  // 异步加载 comp-country 索引,完成后 bump version 触发重渲染拿比赛国旗 + 中文名
  const [flagVer, setFlagVer] = useState(() => flagDataVersion());
  useEffect(() => {
    void loadFlagData({ persons: false }).then((v) => { if (v !== flagVer) setFlagVer(v); });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetch(statsUrl('/stats/scramble/recent_scrambles.json'), { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: RecentScramblesJson | null) => { if (aliveRef.current) setData(previous => j ?? previous ?? null); })
      .catch(() => { if (aliveRef.current) setData(previous => previous ?? null); });
  }, [setData]);

  // The default rarest view needs both the scrambles and their probabilities.
  // Fetch them together and retain the skeleton until both have settled.
  useEffect(() => {
    void fetch(statsUrl('/stats/scramble/distribution.json') + '?v=20260614opt')
      .then((r) => (r.ok ? r.json() : null))
      .then((j: DistributionJson | null) => { if (aliveRef.current) setDist(j); })
      .catch(() => { if (aliveRef.current) setDist(previous => previous ?? null); });
  }, [setDist]);

  // 项目全集等首批内容画完后再补。
  // 用户开始触碰控件时立即预热，保证功能完整，同时避免三个大 JSON 同时下载、解析。
  const loadExtras = useCallback(() => {
    if (extrasStartedRef.current) return;
    extrasStartedRef.current = true;

    void fetchRecentScramblesEvents()
      .then((j) => { if (aliveRef.current) setEventsJson(j); });
  }, [setEventsJson]);

  useEffect(() => {
    if (!data) return;
    let idleId: number | undefined;
    const timerId = window.setTimeout(() => {
      if ('requestIdleCallback' in window) {
        idleId = window.requestIdleCallback(loadExtras, { timeout: 2000 });
      } else {
        loadExtras();
      }
    }, 1200);
    return () => {
      window.clearTimeout(timerId);
      if (idleId !== undefined && 'cancelIdleCallback' in window) window.cancelIdleCallback(idleId);
    };
  }, [data, loadExtras]);

  // 333 是否有数据(本批含可展示的变体)。
  const has333 = useMemo(() => {
    if (!data || data.new_count === 0) return false;
    return VARIANT_ORDER.some((v) => {
      if (v === '333') return true; // 占位恒列
      const vars: readonly string[] = v === 'block' ? BLOCK_DATA_VARIANTS : v === 'eo' ? EO_DATA_VARIANTS : [v];
      return vars.some((dv) => {
        const r = data.rank?.[dv];
        return r && Object.values(r).some((byColor) => Object.values(byColor).some((byStep) => Object.keys(byStep).length > 0));
      });
    });
  }, [data]);

  // 可选项目 = 有数据的非 333 项目 ∪ (333 有数据则含 333)。
  const availableEvents = useMemo(() => {
    const s = new Set<string>();
    if (has333) s.add('333');
    if (eventsJson) for (const [ev, b] of Object.entries(eventsJson.events)) {
      if (HIDDEN_FIXED_LENGTH_EVENTS.has(ev)) continue;
      if (Object.keys(b.length).length > 0 || (b.difficulty && Object.keys(b.difficulty.byStep).length > 0)) s.add(ev);
    }
    return s;
  }, [has333, eventsJson]);

  const dateRange = batchDateRange(data ?? null, eventsJson);

  // 主数据到达前保留与成品区块一致的几何尺寸，避免动态 chunk 已到、JSON 未到时先塌陷。
  if (data === undefined || dist === undefined) return <div className="recent-scrambles recent-scrambles--loading" data-tour="recent-scrambles" aria-hidden="true" />;
  if (availableEvents.size === 0) return <p className="landing-slot-message">{tr({ zh: '暂无近期打乱', en: 'No recent scrambles available' })}</p>;

  const curEvent = availableEvents.has(event) ? event : (availableEvents.has('333') ? '333' : [...availableEvents][0]);
  const pickerGroups: readonly PuzzlePickerGroup[] = [{
    id: 'wca',
    label: tr({ zh: 'WCA 项目', en: 'WCA events' }),
    items: [...availableEvents].map((id) => ({
      id,
      label: eventDisplayName(id, isZh),
      iconClass: `event-${id}`,
    })),
  }];

  return (
    <div
      className="recent-scrambles"
      data-tour="recent-scrambles"
      onPointerEnter={loadExtras}
      onFocusCapture={loadExtras}
      onTouchStart={loadExtras}
    >
      <div className="rs-topbar">
        <span className="rs-title" title={dateRange || undefined}>{tr({ zh: '打乱', en: 'Scrambles' })}</span>
        <PuzzlePicker showArrow={false} isZh={isZh} selectedEvent={curEvent} groups={pickerGroups} onSelect={setEvent} />
      </div>
      {curEvent === '333'
        ? <Recent333Body data={data} dist={dist} eventsJson={eventsJson} isZh={isZh} lp={lp} />
        : <RecentEventBody event={curEvent} json={eventsJson} isZh={isZh} lp={lp} />}
    </div>
  );
}

// ============================ 333:富控件(变体 × 类型 × 底色 × 步数)============================
function Recent333Body({ data, dist, eventsJson, isZh, lp }: {
  data: RecentScramblesJson | null;
  dist: DistributionJson | null;
  eventsJson: RecentScramblesEventsJson | null;
  isZh: boolean;
  lp: string;
}) {
  const [variant, setVariant] = useState('std');
  const [metric, setMetric] = useState('cross');
  const [step, setStep] = useState<number | null>(null);
  const sel = useSubsetSelection('dual');
  // 最稀有固定展示全批最低概率结果；自选保留独立的筛选条件。
  const [mode, setMode] = useState<'type' | 'rare'>(dist ? 'rare' : 'type');

  // 首屏一次性把默认选择定位到本批全局概率最低(最稀有)的那一格;用户手动改过任一选择器即不再覆盖。
  const pickedRef = useRef(false);
  const touchedRef = useRef(false);
  useEffect(() => {
    if (pickedRef.current || touchedRef.current || !data || !dist) return;
    const best = findRarestSelection(data, dist);
    if (!best) return;
    pickedRef.current = true;
    setVariant(best.variant);
    setMetric(best.metric);
    setStep(best.step);
    sel.selectByKey(best.subsetKey);
  }, [data, dist, sel]);

  // 包一层选择器,记录用户是否手动交互过(防 auto-pick 在数据迟到时覆盖用户已改的选择)。
  const markTouched = () => { touchedRef.current = true; };
  const pickerSel: SubsetSelection = {
    ...sel,
    setColorMode: (m: ColorMode) => { markTouched(); sel.setColorMode(m); },
    selectOption: (id: string) => { markTouched(); sel.selectOption(id); },
    // 菜单里点色块走这条(一次定模式 + 子集);auto-pick 用的是未包装的 sel,不会误标 touched。
    selectByKey: (key: string) => { markTouched(); sel.selectByKey(key); },
  };

  const hasData = (v: string) => {
    const r = data?.rank?.[v];
    if (!r) return false;
    return Object.values(r).some((byColor) => Object.values(byColor).some((byStep) => Object.keys(byStep).length > 0));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const variants = useMemo(() => uiVariantOptions(hasData), [data]);

  // 长度桶在 eventsJson(同其它项目);本批没有长度数据就不在变体下拉里给这一项。
  const hasLength = Object.keys(eventsJson?.events?.['333']?.length ?? {}).length > 0;
  const variantOptions = useMemo(
    () => (hasLength ? [...variants, LENGTH_VARIANT] : [...variants]),
    [variants, hasLength],
  );
  const curVariant = variantOptions.includes(variant) ? variant : (variants[0] ?? 'std');
  const isLength = curVariant === LENGTH_VARIANT;
  // 聚合方法(lbl / block / eo)的指标散在多个数据变体里 -> 按映射逐个指标回查。
  const metricsForVariant = useCallback((selectedVariant: string) => {
    if (selectedVariant === 'lbl') {
      return uiStagesOf(selectedVariant).filter((m) => {
        const ref = variantDataRef(selectedVariant, m);
        return ref.recentMetric in (data?.rank?.[ref.variant] ?? {});
      });
    }
    const stageVariantMap = selectedVariant === 'block' ? BLOCK_STAGE_VARIANT : selectedVariant === 'eo' ? EO_STAGE_VARIANT : null;
    if (stageVariantMap) {
      return RECENT_METRIC_ORDER.filter((m) => {
        const dv = stageVariantMap[m];
        return dv !== undefined && m in (data?.rank?.[dv] ?? {});
      });
    }
    const rank = data?.rank?.[selectedVariant];
    return rank ? RECENT_METRIC_ORDER.filter((m) => m in rank) : [];
  }, [data]);
  const metrics = useMemo(() => metricsForVariant(curVariant), [curVariant, metricsForVariant]);
  const curMetric = metrics.includes(metric) ? metric : (metrics[0] ?? 'cross');
  const aliasRef = variantDataRef(curVariant, curMetric);
  const dataVariant = aliasRef.variant;
  const dataMetric = aliasRef.recentMetric;
  const isWhole = curVariant === WHOLE_SOLVE;                                  // 整解: 无底色维度
  const subsetKey = isWhole ? WHOLE_SOLVE_SUBSET : sel.subsetKey;
  const byStep = data?.rank?.[dataVariant]?.[dataMetric]?.[subsetKey];
  const steps = useMemo(() => Object.keys(byStep ?? {}).map(Number).sort((a, b) => a - b), [byStep]);
  const curStep = (step != null && steps.includes(step)) ? step : (steps[0] ?? null);
  const entries = (curStep != null ? byStep?.[String(curStep)] : undefined) ?? [];
  // 当前桶的所有条目同属一个 (变体, 类型),共享同一个 StageSolver 深链目标。
  const ssTarget = stageSolverTarget(curVariant, curMetric);

  const distVar = dist?.sets?.wca?.variants?.[dataVariant];
  const distStageKey = useMemo(() => {
    if (!distVar) return null;
    const target = stageLabel(curMetric, false);
    return Object.keys(distVar.data).find((s) => stageLabel(s, false) === target) ?? null;
  }, [distVar, curMetric, curVariant, aliasRef.stage]);
  const prob = useMemo(() => {
    if (curStep == null || !distVar || !distStageKey) return null;
    const counts = distVar.data[distStageKey]?.[subsetKey]?.counts;
    if (!counts) return null;
    let total = 0;
    for (const k in counts) total += counts[k];
    const c = counts[String(curStep)] ?? 0;
    if (total <= 0 || c <= 0) return null;
    const text = formatProb(c / total);
    return text ? { text, stageKey: distStageKey } : null;
  }, [curStep, distVar, distStageKey, subsetKey]);

  const probHref = useMemo(() => {
    if (!prob) return null;
    const p = new URLSearchParams();
    const linkVariant = dataVariantOfStage(curVariant, curMetric);
    const linkStage = prob.stageKey;
    if (linkVariant !== 'std') p.set('variant', linkVariant);
    if (linkStage !== 'cross') p.set('stage', linkStage);
    if (!isWhole && subsetKey !== 'BGORWY') p.set('colors', subsetKey);  // 整解无底色维度
    const qs = p.toString();
    return `${lp}/scramble/stats${qs ? `?${qs}` : ''}`;
  }, [prob, curVariant, curMetric, isWhole, subsetKey, lp]);

  // 跨所有底色和类型比较，保留最低概率的结果（含并列），不受自选条件影响。
  const rare = useMemo(() => {
    if (mode !== 'rare' || !data || !dist) return [];
    const candidates = collectRareScrambles(data, dist, Infinity, null);
    return candidates.filter(r => r.p === candidates[0]?.p);
  }, [mode, data, dist]);

  const modePill = (
    <select
      value={String(mode === 'rare')}
      onChange={event => { const v = event.currentTarget.value === 'true'; setMode(v ? 'rare' : 'type'); }}
      aria-label={tr({ zh: '视图', en: 'View' })}
      className="rs-select"
    >
      <option value="true">{tr({ zh: '最稀有', en: 'Rarest' })}</option>
      <option value="false">{tr({ zh: '自选', en: 'Custom' })}</option>
    </select>
  );
  const variantSelect = (
    <MethodStagePicker
      isZh={isZh} method={curVariant} stage={curMetric} methods={variantOptions}
      stagesOf={v => v === LENGTH_VARIANT ? [] : metricsForVariant(v)}
      onSelect={(v, m) => { markTouched(); setVariant(v); if (m) setMetric(m); }}
    />
  );

  // 「打乱长度」变体:按原打乱长度分桶,整体复用其它项目那套(桶 + 卡片)。不依赖 rank(难度)数据,
  // 故放在 rank 空守卫之前;头部只留视图 + 变体两个下拉(底色 / 类型 / 步数对长度无意义)。
  if (mode === 'type' && isLength) {
    return (
      <RecentEventBody
        event="333" json={eventsJson} isZh={isZh} lp={lp}
        headExtra={<>{modePill}{variantSelect}</>}
      />
    );
  }

  if (!data || variants.length === 0) return null;

  return (
    <div className="rs-body">
      <div className="rs-head">
        {modePill}
        {mode === 'type' && (<>
        {!isWhole && <SubsetColorPicker sel={pickerSel} isZh={isZh} />}
        {variantSelect}
        {steps.length > 0 && (
          <select className="rs-select" value={curStep ?? ''} onChange={(e) => { markTouched(); setStep(Number(e.target.value)); }} aria-label={tr({ zh: '步数', en: 'Moves' })}>
            {steps.map((s) => (<option key={s} value={s}>{stepOptionLabel(s)}</option>))}
          </select>
        )}
        {prob && probHref && (
          <Link href={probHref} prefetch={false} className="rs-prob" title={tr({ zh: '随机打乱出现此难度的概率,点查看完整分布', en: 'How often a random scramble is this easy — click for the full distribution' })}>
            {prob.text}
          </Link>
        )}
        </>)}
      </div>

      {mode === 'rare' ? (
        rare.length > 0 ? (
          <>
            <div className="rs-cards scroll-panel scroll-panel--hover-lift">
              {rare.slice(0, RARE_CAP).map((r) => {
                // 标明最低概率对应的底色档。
                const aggColors = subsetColorsOf(r.subsetKey);
                return (
                  <ScrambleCard
                    key={r.id}
                    event="333"
                    scramble={data.opt?.[r.id] ?? data.scr[r.id] ?? ''}
                    optimal={!!data.opt?.[r.id]}
                    m={data.meta[r.id]}
                    lp={lp}
                    isZh={isZh}
                    ssTarget={stageSolverTarget(r.uiVariant, r.metric)}
                    color={r.color || undefined}
                    dotColors={aggColors.length > 0 ? aggColors : undefined}
                    dotTitle={aggColors.length > 0 ? subsetDotTitle(aggColors, r.color || undefined) : undefined}
                    rarity={{ tag: rarityTag(r.uiVariant, r.metric, r.step, isZh), prob: formatProb(r.p) ?? '' }}
                    analysis={{ variant: r.uiVariant, metric: r.metric, step: r.step, prob: formatProb(r.p) ?? '' }}
                  />
                );
              })}
            </div>
            {rare.length > RARE_CAP && (
              <div className="rs-rare-more">{tr({ zh: `仅显示最稀有的 ${RARE_CAP} 条(共 ${rare.length} 条)`, en: `Showing the ${RARE_CAP} rarest of ${rare.length}` })}</div>
            )}
          </>
        ) : null
      ) : entries.length > 0 ? (
        <div className="rs-cards scroll-panel scroll-panel--hover-lift">
          {entries.slice(0, 12).map(([id, color]) => (
            <ScrambleCard key={id} event="333" scramble={data.opt?.[id] ?? data.scr[id] ?? ''} optimal={!!data.opt?.[id]} m={data.meta[id]} lp={lp} isZh={isZh} ssTarget={ssTarget} color={color || undefined} analysis={{ variant: curVariant, metric: curMetric, step: curStep, prob: prob?.text }} />
          ))}
        </div>
      ) : (
        <div className="rs-empty">{tr({ zh: '该组合本批暂无数据', en: 'No data for this combination' })}</div>
      )}
    </div>
  );
}

// ============================ 其他项目:长度(全项目)+ 难度(222/金字塔/斜转)============================
// headExtra:插在控件行最前的额外控件。3x3 的长度视图复用本组件,把它的「视图」下拉塞在这里。
function RecentEventBody({ event, json, isZh, lp, headExtra }: {
  event: string; json: RecentScramblesEventsJson | null; isZh: boolean; lp: string; headExtra?: ReactNode;
}) {
  const buckets = json?.events?.[event];
  const hasDifficulty = !!(buckets?.difficulty && DIFFICULTY_EVENTS.has(event) && Object.keys(buckets.difficulty.byStep).length > 0);
  const showLengthToggle = hasDifficulty && !FIXED_LENGTH_NO_TOGGLE.has(event);
  const [mode, setMode] = useState<'difficulty' | 'length'>('difficulty');
  const [value, setValue] = useState<number | null>(null);

  const curMode: 'difficulty' | 'length' = hasDifficulty ? (showLengthToggle ? mode : 'difficulty') : 'length';
  const bucketMap = curMode === 'difficulty' ? (buckets?.difficulty?.byStep ?? {}) : (buckets?.length ?? {});
  const values = useMemo(() => Object.keys(bucketMap).map(Number).sort((a, b) => a - b), [bucketMap]);
  const curValue = (value != null && values.includes(value)) ? value : (values[0] ?? null);
  const ids = (curValue != null ? bucketMap[String(curValue)] : undefined) ?? [];

  if (!buckets || values.length === 0) {
    return (
      <>
        {headExtra && <div className="rs-head">{headExtra}</div>}
        <div className="rs-empty">{tr({ zh: '该项目本批暂无数据', en: 'No recent scrambles for this event' })}</div>
      </>
    );
  }

  // 难度视图强制显示最优等态打乱(同态,其步数 = 该桶的难度值);长度视图按的是原打乱长度,必须显示原打乱。
  const optOf = (id: string) => (curMode === 'difficulty' ? json?.opt?.[id] : undefined);
  const scrOf = (id: string) => optOf(id) ?? json?.scr?.[id] ?? '';
  const metaOf = (id: string) => json?.meta?.[id];

  return (
    <div className="rs-body">
      <div className="rs-head">
        {headExtra}
        {showLengthToggle && (
          <select
            value={String(curMode === 'length')}
            onChange={event => { const v = event.currentTarget.value === 'true'; setMode(v ? 'length' : 'difficulty'); setValue(null); }}
            aria-label={tr({ zh: '维度', en: 'Dimension' })}
            className="native-select"
          >
            <option value="true">{tr({ zh: '打乱长度', en: 'Length' })}</option>
            <option value="false">{tr({ zh: '难度', en: 'Difficulty' })}</option>
          </select>
        )}
        <select className="rs-select" value={curValue ?? ''} onChange={(e) => setValue(Number(e.target.value))} aria-label={curMode === 'difficulty' ? tr({ zh: '难度', en: 'Difficulty' }) : tr({ zh: '长度', en: 'Length' })}>
          {values.map((v) => (<option key={v} value={v}>{stepOptionLabel(v)}</option>))}
        </select>
      </div>

      {ids.length > 0 ? (
        <div className="rs-cards scroll-panel scroll-panel--hover-lift">
          {ids.slice(0, 12).map((id) => (
            <ScrambleCard key={id} event={event} scramble={scrOf(id)} optimal={!!optOf(id)} m={metaOf(id)} lp={lp} isZh={isZh} analysis={{ variant: '', metric: '', step: curValue }} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
