'use client';

/**
 * Shared sheet renderer for /scramble/gen. Used by both TNoodle (generate from
 * cubing/scramble) and Import (load from WCA `/scrambles` endpoint) modes —
 * once we have a `RoundSheet`, the on-screen presentation is identical.
 *
 * Clicking the scramble opens it in /scramble/analyzer with `stage` set to the
 * row's current step (per-row badge); the badge ("C 767665") is independently
 * click-to-cycle through Cross → XC → XXC → XXXC → XXXXC; the index cell copies.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { Copy, ExternalLink } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { EventIcon } from '@/components/EventIcon';
import { eventDisplayName } from '@/lib/wca-events';
import { ScramblePreview2D, eventHasScramblePreview } from '@/components/ScramblePreview2D';
import { isAnalysableScramble } from '@/lib/cross-solver';
import type { Method } from '@/components/StageSolver';
import { isBlockVariant } from '@/lib/scramble-variants';
import type { WcaFormat } from './_wca-round';
import type { Metric } from './CompCrossAnalysis';
import ScrambleLines from './ScrambleLines';
import { CUBE_FILL, BADGE_FACE_ORDER } from '@/lib/cube-colors';
import i18n from "@/i18n/i18n-client";

// StageSolver 拉 ~27MB WASM 表 + TwistyPlayer 3D,首屏没必要打进 gen 包;
// 行内展开第一次点开时才按需加载(ssr:false,纯 client 组件)。
const StageSolver = dynamic(() => import('@/components/StageSolver'), { ssr: false });

// gen 变体 key 与 StageSolver Method 对应(块族数据变体 123/123x2/222/223 都归聚合方法 block)。
const NON_BLOCK_METHODS = new Set<string>(['std', 'eo', 'pair', 'pseudo', 'pseudo_pair', 'f2leo', 'pseudo_f2leo', 'eoline', 'dr']);
const variantToMethod = (v: string): Method =>
  isBlockVariant(v) || v === 'block' ? 'block' : NON_BLOCK_METHODS.has(v) ? (v as Method) : 'std';
// metric → StageSolver initialStage 索引(cross=0 / xc=1 / …;块族走方法 block 的
// 阶段序 [122, 123, 222, 223, F2B];beo/beoline=方法 eoline 的阶段 0/1,bdr=方法 dr 的阶段 0)。
const METRIC_STAGE_IDX: Record<Metric, number> = {
  cross: 0, xc: 1, xxc: 2, xxxc: 3, xxxxc: 4,
  b122: 0, b123: 1, b222: 2, b223: 3, bf2b: 4, beo: 0, beoline: 1, bdr: 0,
};

// 逐行徽标点击循环顺序;块族变体只在自家阶段集内循环。label: cross='C',块类=尺寸数字,其它=大写指标名。
const METRIC_CYCLE: Metric[] = ['cross', 'xc', 'xxc', 'xxxc', 'xxxxc'];
const BLOCK_CYCLE: Record<string, Metric[]> = {
  '123': ['b122', 'b123'], '222': ['b222'], '223': ['b223'],
  '123x2': ['bf2b'], eoline: ['beo', 'beoline'], dr: ['bdr'],
};
const cycleOf = (v?: string): Metric[] => (v && BLOCK_CYCLE[v]) || METRIC_CYCLE;
const metricBadgeLabel = (m: Metric): string =>
  m === 'cross' ? 'C'
    : m === 'bf2b' ? 'F2B'
      : m === 'beo' ? 'EO'
        : m === 'beoline' ? 'EOLine'
          : m === 'bdr' ? 'DR'
            : m.startsWith('b') ? m.slice(1) : m.toUpperCase();
// metric → analyzer `stage` 查询值(analyzer 当前支持 cross/xcross/xxcross/xxxcross;
// xxxxcross 先带上,等 analyzer 支持即生效,暂不支持时它会回落到 cross)。
// 块族指标无 stage 查询值(空串即不带),深链只保留 scramble。
const METRIC_STAGE: Record<Metric, string> = {
  cross: 'cross', xc: 'xcross', xxc: 'xxcross', xxxc: 'xxxcross', xxxxc: 'xxxxcross',
  b122: '', b123: '', b222: '', b223: '', bf2b: '', beo: '', beoline: '', bdr: '',
};

export interface AttemptScramble {
  /** Display label, e.g. "1", "2", "E1", "E2". For MBLD this is the cube number. */
  label: string;
  /** Single scramble move sequence (one row in the PDF). */
  scramble: string;
  /** Whether this is an extra-scramble (E1/E2 …); always false for MBLD. */
  isExtra: boolean;
}

export interface RoundSheet {
  event: string;
  roundIdx: number;     // 0-based
  groupIdx: number;     // 0-based (for scrambleSets > 1)
  format: WcaFormat;
  /** MBLD/FMC — 0-based attempt index. Adds "Attempt N+1" / "Scramble X of Y" to the title. */
  attemptNumber?: number;
  attempts: AttemptScramble[];
  /** FMC only — locales for which to emit a translated solution sheet. */
  locales?: import('./_tnoodle-translate').TnoodleLocale[];
  /** Print copies — same scrambles repeated N times in the PDF (per round.copies). */
  copies?: number;
  /** scrambleSets count for this round; used to render "Group A/B/..." only when >1. */
  totalGroups?: number;
}

interface SheetViewProps {
  sheet: RoundSheet;
  isZh: boolean;
  t: (zh: string, en: string) => string;
  clockColors?: Record<string, string>;
  sq1Colors?: Record<string, string>;
  megaColors?: Record<string, string>;
  /** Hide per-row preview thumbnail when false. Controls only the on-screen
   *  sheet — PDF visibility is decided by `generateTnoodlePdf` opts.showPreview. */
  showPreview?: boolean;
  /** 333 family (333/oh/ft/fm/bf) — 取某打乱在某指标下的 6 底色最优步数(BADGE_ORDER),
   *  无数据返回 undefined。存在时每行显示可点击循环的 "C 767665" 徽标。 */
  rowDigits?: (scramble: string, metric: Metric) => number[] | undefined;
  /** 顶部指标 tab 选中的指标,作为每行徽标的默认值(逐行点击可覆盖)。 */
  metric?: Metric;
  /** 顶部变体下拉(std/eo/pair/...);跳分析器时作为 `variant` 查询带过去。 */
  variant?: string;
  /** 深链/点击选中的某一把(attempt label);非 null 时该行持续高亮,挂载/变更时滚动入视。
   *  仅当本 sheet 的 groupIdx 命中选中分组时由父级传非 null。 */
  selectedLabel?: string | null;
  /** 点击某行选中 / 取消(label=null 表示取消)。整行均触发,含 SQ1 等不可分析事件。 */
  onSelectScramble?: (label: string | null) => void;
  /** 是否允许行内展开解法分析器(跟随顶部「分析」开关)。false 时可分析打乱点击无任何反应
   *  —— 没开「分析」就完全不出分析器画面。SQ1 等不可分析事件不受影响(本就只选中)。 */
  analyzable?: boolean;
}

export default function SheetView({ sheet, isZh, t, clockColors, sq1Colors, megaColors, showPreview = true, rowDigits, metric = 'cross', variant = 'std', selectedLabel = null, onSelectScramble, analyzable = true }: SheetViewProps) {
  const { event, roundIdx, groupIdx, attemptNumber, attempts, totalGroups } = sheet;
  const router = useRouter();
  const params = useParams();
  const langPrefix = params?.lang === 'zh' || params?.lang === 'en' ? `/${params.lang}` : (isZh ? '/zh' : '/en');
  const groupSuffix = (totalGroups ?? 1) > 1
    ? (i18n.language === 'zh-Hant' ? (` ${String.fromCharCode(65 + groupIdx)} 組`) : (isZh
            ? ` ${String.fromCharCode(65 + groupIdx)} 组`
            : ` Group ${String.fromCharCode(65 + groupIdx)}`))
    : '';
  const attemptSuffix = attemptNumber !== undefined
    ? ` ${t('第', 'Attempt')} ${attemptNumber + 1}${t('次', '')}`
    : '';
  // WCA round_type_id 'f'/'h' (final/combined final) 都映射到 roundIdx=3,
  // 与轮数无关 —— 2 轮赛的 final 也是 idx=3,不能写"第 4 轮"。
  const roundLabel = roundIdx === 3
    ? t('决赛', 'Final')
    : `${t('第', 'Round')} ${roundIdx + 1}${t('轮', '')}`;
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  // 行内展开:一次只展开一条(手风琴),按 scramble 字符串记忆(过滤/重排都稳)。
  const [expanded, setExpanded] = useState<string | null>(null);
  // 顶部「分析」关掉时收起已展开的解法器,别留残面板。
  useEffect(() => { if (!analyzable) setExpanded(null); }, [analyzable]);
  const showCross = !!rowDigits;
  // 逐行徽标指标覆盖(按 scramble 字符串 key,过滤/重排都稳)。顶部 tab 变 → 全部回落到全局指标。
  const [rowMetric, setRowMetric] = useState<Map<string, Metric>>(new Map());
  useEffect(() => { setRowMetric(new Map()); }, [metric]);
  // 选中行 ref:深链(?group=A&attempt=2)落地或点击切换时,把命中行滚到可视区。
  // block:'nearest' 已可见就不动,避免每次点击都强行重新居中。
  const selectedRowRef = useRef<HTMLTableRowElement | null>(null);
  useEffect(() => {
    if (selectedLabel != null && selectedRowRef.current) {
      selectedRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [selectedLabel]);
  const effMetric = (scr: string): Metric => rowMetric.get(scr) ?? metric;
  const cycleMetric = (scr: string) => {
    setRowMetric((prev) => {
      const cycle = cycleOf(variant);
      const cur = prev.get(scr) ?? metric;
      const next = cycle[(cycle.indexOf(cur) + 1) % cycle.length];
      const m = new Map(prev);
      m.set(scr, next);
      return m;
    });
  };
  const copyAttempt = async (idx: number, scramble: string) => {
    if (!scramble) return;
    try {
      await navigator.clipboard.writeText(scramble);
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx((cur) => (cur === idx ? null : cur)), 1200);
    } catch { /* swallow */ }
  };
  // 单击打乱:永远选中该行(父级写 URL group+attempt + 高亮 + 滚动),与「分析」开关无关 ——
  // 选中/深链定位不算「分析」。仅当「分析」开 + 该打乱可解析时,额外就地展开 StageSolver。
  // 选中文字时不触发,避免误触。手风琴:再点同一条收起/取消,点别条切换。
  const onRowClick = (a: AttemptScramble) => {
    if (typeof window !== 'undefined' && window.getSelection()?.toString()) return;
    if (!a.scramble) return;
    if (analyzable && isAnalysableScramble(a.scramble)) {
      // 分析开 + 可解析:展开解法器,选中态跟随展开。
      const next = expanded === a.scramble ? null : a.scramble;
      setExpanded(next);
      onSelectScramble?.(next ? a.label : null);
    } else {
      // 分析关 或 不可解析(SQ1/clock/...):只切换选中(写 URL + 高亮),不展开解法器。
      onSelectScramble?.(selectedLabel === a.label ? null : a.label);
    }
  };
  // 在分析器中打开(深链):保留原 URL 契约(空格替下划线 + stage + variant),
  // 让用户仍能跳到完整分析器页面。用真 <a href> 让中键/Ctrl+点新开页。
  const analyzerHref = (scramble: string, m: Metric) => {
    const q = new URLSearchParams({ scramble: scramble.trim().replace(/ /g, '_') });
    const stage = METRIC_STAGE[m];
    if (stage && stage !== 'cross') q.set('stage', stage);
    if (variant && variant !== 'std') q.set('variant', variant);
    return `${langPrefix}/scramble/analyzer?${q.toString()}`;
  };
  const colSpan = showPreview ? 3 : 2;
  const rows: ReactNode[] = [];
  attempts.forEach((a, i) => {
    const showExtraDivider = a.isExtra && (i === 0 || !attempts[i - 1].isExtra);
    if (showExtraDivider) {
      rows.push(
        <tr key={`div-${i}`} className="gen-tn-extras-divider">
          <td colSpan={colSpan}>{t('备用打乱', 'Extra Scrambles')}</td>
        </tr>,
      );
    }
    const isExpanded = expanded === a.scramble;
    const isSelected = selectedLabel != null && selectedLabel === a.label;
    const rowCls = [
      a.isExtra ? 'is-extra' : '',
      copiedIdx === i ? 'is-copied' : '',
      isExpanded ? 'is-expanded' : '',
      isSelected ? 'is-selected' : '',
    ].filter(Boolean).join(' ');
    const parseable = !!a.scramble && isAnalysableScramble(a.scramble);
    const canAnalyze = analyzable && parseable;
    // 有打乱就可点:点击永远选中(写深链 + 高亮);canAnalyze 时额外展开解法器。
    const rowInteractive = !!a.scramble;
    rows.push(
      <tr
        key={i}
        ref={isSelected ? selectedRowRef : undefined}
        className={rowCls}
        onClick={rowInteractive ? () => onRowClick(a) : undefined}
        title={rowInteractive ? (canAnalyze ? t('点击展开解法', 'Click to expand solutions') : t('点击选中(链接定位)', 'Click to select (deep link)')) : undefined}
        style={{ cursor: rowInteractive ? 'pointer' : 'default' }}
      >
        <td
          className="gen-tn-attempt-num"
          onClick={a.scramble ? (e) => { e.stopPropagation(); copyAttempt(i, a.scramble); } : undefined}
          title={a.scramble ? t('复制打乱', 'Copy scramble') : undefined}
          style={{ cursor: a.scramble ? 'pointer' : undefined }}
        >
          <span className="gen-tn-attempt-label">{a.label}</span>
          {a.scramble && (
            <button
              type="button"
              className="gen-tn-copy-btn"
              onClick={(e) => { e.stopPropagation(); copyAttempt(i, a.scramble); }}
              title={t('复制打乱', 'Copy scramble')}
              aria-label={t('复制打乱', 'Copy scramble')}
            >
              <Copy size={13} />
            </button>
          )}
        </td>
        <td className="gen-tn-attempt-scramble">
          <div className="gen-tn-scr-line">
            <ScrambleLines
              scramble={a.scramble}
              className="gen-tn-attempt-line"
              trailing={(() => {
                // cross 数据存在 = 可分析的 333 行 → 显示徽标(可点击循环指标)。
                // 作为 <code> 末尾子节点 float:right —— 贴打乱最后一行右缘,而非
                // 作为兄弟节点对齐整块多行底部(那样会显得掉到单独一行)。
                if (!showCross || !a.scramble || !rowDigits!(a.scramble, 'cross')) return null;
                const em = effMetric(a.scramble);
                const digits = rowDigits!(a.scramble, em);
                return (
                  <span
                    className="gen-tn-cross-badge is-clickable"
                    title={t('点击切换 十字/XC/XXC/XXXC/XXXXC', 'Click to cycle Cross / XC / XXC / XXXC / XXXXC')}
                    onClick={(e) => { e.stopPropagation(); cycleMetric(a.scramble); }}
                  >
                    {/* 该行指标与顶部「阶段」一致时不重复显示标签;被逐行切到不同指标才标出来 */}
                    {em !== metric && <span className="gen-tn-cross-c">{metricBadgeLabel(em)}</span>}
                    {digits
                      ? digits.map((d, ci) => (
                          <b key={ci} className="gen-tn-cx" style={{ color: CUBE_FILL[BADGE_FACE_ORDER[ci]] }}>{d}</b>
                        ))
                      : <b className="gen-tn-cx-na">–</b>}
                  </span>
                );
              })()}
            />
          </div>
          {copiedIdx === i && (
            <span className="gen-tn-copy-toast" aria-live="polite">{t('已复制', 'Copied')}</span>
          )}
        </td>
        {showPreview && (
          <td className="gen-tn-attempt-preview">
            {eventHasScramblePreview(event) && a.scramble && (() => {
              // sq1 是 portrait 1:2,普通 48 会被压成很小;给它更大基准让 SVG 撑得开。
              const previewSize = event === 'sq1' ? 56 : 48;
              return (
                <ScramblePreview2D
                  event={event}
                  scramble={a.scramble}
                  size={previewSize}
                  clockColors={clockColors}
                  sq1Colors={sq1Colors}
                  megaColors={megaColors}
                  fullSizeLink
                  linkTitle={t('打开大图', 'Open full-size image')}
                />
              );
            })()}
          </td>
        )}
      </tr>,
    );
    // 行内解法面板:点开后整行(跨所有列)展开 StageSolver,就地看具体解法 + 动画。
    if (isExpanded && canAnalyze) {
      const em = effMetric(a.scramble);
      rows.push(
        <tr key={`exp-${i}`} className="gen-tn-solver-row">
          {/* colSpan 行内面板:去掉 td 默认 padding/border,让 StageSolver 占满整行宽。 */}
          <td colSpan={colSpan} style={{ padding: 0, borderTop: 'none' }}>
            <div
              style={{ width: '100%', margin: '4px 0 8px', display: 'flex', flexDirection: 'column', gap: 6 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <a
                  href={analyzerHref(a.scramble, em)}
                  onClick={(e) => {
                    // 普通左键走 client 导航;中键/Ctrl/Cmd/Shift 保留浏览器新开页默认行为
                    if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
                    e.preventDefault();
                    router.push(analyzerHref(a.scramble, em));
                  }}
                  title={t('在分析器中打开', 'Open in analyzer')}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    textDecoration: 'none', cursor: 'pointer', padding: '2px 4px',
                    font: 'inherit', fontSize: '0.78rem', color: 'var(--gen-accent)',
                  }}
                >
                  <ExternalLink size={13} />
                  <span>{t('分析器', 'Analyzer')}</span>
                </a>
              </div>
              <StageSolver
                scramble={a.scramble}
                lang={isZh ? 'zh' : 'en'}
                initialMethod={variantToMethod(variant)}
                initialStage={METRIC_STAGE_IDX[em]}
                compact
              />
            </div>
          </td>
        </tr>,
      );
    }
  });
  return (
    <div className="gen-tn-sheet">
      <div className="gen-tn-sheet-header">
        <EventIcon event={event} />
        <span>{eventDisplayName(event, isZh)} {roundLabel}{groupSuffix}{attemptSuffix}</span>
      </div>
      <table className="gen-tn-sheet-table"><tbody>{rows}</tbody></table>
    </div>
  );
}
