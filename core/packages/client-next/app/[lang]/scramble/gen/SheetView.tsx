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
import { useEffect, useState, type ReactNode } from 'react';
import { Copy } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { EventIcon } from '@/components/EventIcon';
import { eventDisplayName } from '@/lib/wca-events';
import { ScramblePreview2D, eventHasScramblePreview } from '@/components/ScramblePreview2D';
import { visualcubeApiHref } from '@/lib/visualcube-link';
import { isAnalysableScramble } from '@/lib/cross-solver';
import type { WcaFormat } from './_wca-round';
import type { Metric } from './CompCrossAnalysis';
import ScrambleLines from './ScrambleLines';

// CSS colour class per BADGE_ORDER slot (White Yellow Red Orange Blue Green).
const BADGE_CLASS = ['cx-w', 'cx-y', 'cx-r', 'cx-o', 'cx-b', 'cx-g'];
// 逐行徽标点击循环顺序;label: cross='C',其它=大写指标名。
const METRIC_CYCLE: Metric[] = ['cross', 'xc', 'xxc', 'xxxc', 'xxxxc'];
const metricBadgeLabel = (m: Metric): string => (m === 'cross' ? 'C' : m.toUpperCase());
// metric → analyzer `stage` 查询值(analyzer 当前支持 cross/xcross/xxcross/xxxcross;
// xxxxcross 先带上,等 analyzer 支持即生效,暂不支持时它会回落到 cross)。
const METRIC_STAGE: Record<Metric, string> = { cross: 'cross', xc: 'xcross', xxc: 'xxcross', xxxc: 'xxxcross', xxxxc: 'xxxxcross' };

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
}

export default function SheetView({ sheet, isZh, t, clockColors, sq1Colors, megaColors, showPreview = true, rowDigits, metric = 'cross', variant = 'std' }: SheetViewProps) {
  const { event, roundIdx, groupIdx, attemptNumber, attempts, totalGroups } = sheet;
  const router = useRouter();
  const params = useParams();
  const langPrefix = params?.lang === 'zh' || params?.lang === 'en' ? `/${params.lang}` : (isZh ? '/zh' : '/en');
  const groupSuffix = (totalGroups ?? 1) > 1
    ? (isZh
      ? ` ${String.fromCharCode(65 + groupIdx)} 组`
      : ` Group ${String.fromCharCode(65 + groupIdx)}`)
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
  const showCross = !!rowDigits;
  // 逐行徽标指标覆盖(按 scramble 字符串 key,过滤/重排都稳)。顶部 tab 变 → 全部回落到全局指标。
  const [rowMetric, setRowMetric] = useState<Map<string, Metric>>(new Map());
  useEffect(() => { setRowMetric(new Map()); }, [metric]);
  const effMetric = (scr: string): Metric => rowMetric.get(scr) ?? metric;
  const cycleMetric = (scr: string) => {
    setRowMetric((prev) => {
      const cur = prev.get(scr) ?? metric;
      const next = METRIC_CYCLE[(METRIC_CYCLE.indexOf(cur) + 1) % METRIC_CYCLE.length];
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
  // 单击打乱 → 跳分析器(仅纯 HTM 三阶打乱可分析;非 3x3 / 含 wide-move 的打乱不跳)。
  // 选中文字时不跳,避免误触。analyzer 用 `_` 分隔,空格替成下划线再交给 URLSearchParams 编码。
  // 阶段跟随该行徽标当前指标,变体跟随顶部下拉,这样跳过去直接看到对应解法。
  const openAnalyzer = (scramble: string, m: Metric) => {
    if (typeof window !== 'undefined' && window.getSelection()?.toString()) return;
    const q = new URLSearchParams({ scramble: scramble.trim().replace(/ /g, '_') });
    const stage = METRIC_STAGE[m];
    if (stage && stage !== 'cross') q.set('stage', stage);
    if (variant && variant !== 'std') q.set('variant', variant);
    router.push(`${langPrefix}/scramble/analyzer?${q.toString()}`);
  };
  const colSpan = showPreview ? 3 : 2;
  const rows: ReactNode[] = [];
  attempts.forEach((a, i) => {
    const showExtraDivider = a.isExtra && (i === 0 || !attempts[i - 1].isExtra);
    if (showExtraDivider) {
      rows.push(
        <tr key={`div-${i}`} className="gen-tn-extras-divider">
          <td colSpan={colSpan}>{t('Extra Scrambles', 'Extra Scrambles')}</td>
        </tr>,
      );
    }
    const rowCls = [
      a.isExtra ? 'is-extra' : '',
      copiedIdx === i ? 'is-copied' : '',
    ].filter(Boolean).join(' ');
    const canAnalyze = !!a.scramble && isAnalysableScramble(a.scramble);
    rows.push(
      <tr
        key={i}
        className={rowCls}
        onClick={canAnalyze ? () => openAnalyzer(a.scramble, effMetric(a.scramble)) : undefined}
        title={canAnalyze ? t('点击用分析器分析这条打乱', 'Click to open in analyzer') : undefined}
        style={{ cursor: canAnalyze ? 'pointer' : 'default' }}
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
            <ScrambleLines scramble={a.scramble} className="gen-tn-attempt-line" />
            {(() => {
              // cross 数据存在 = 可分析的 333 行 → 显示徽标(可点击循环指标)。
              if (!showCross || !a.scramble || !rowDigits!(a.scramble, 'cross')) return null;
              const em = effMetric(a.scramble);
              const digits = rowDigits!(a.scramble, em);
              return (
                <span
                  className="gen-tn-cross-badge is-clickable"
                  title={t('点击切换 十字/XC/XXC/XXXC/XXXXC', 'Click to cycle Cross / XC / XXC / XXXC / XXXXC')}
                  onClick={(e) => { e.stopPropagation(); cycleMetric(a.scramble); }}
                >
                  <span className="gen-tn-cross-c">{metricBadgeLabel(em)}</span>
                  {digits
                    ? digits.map((d, ci) => (
                        <b key={ci} className={`gen-tn-cx ${BADGE_CLASS[ci]}`}>{d}</b>
                      ))
                    : <b className="gen-tn-cx-na">–</b>}
                </span>
              );
            })()}
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
              const preview = <ScramblePreview2D event={event} scramble={a.scramble} size={previewSize} clockColors={clockColors} sq1Colors={sq1Colors} megaColors={megaColors} />;
              const href = visualcubeApiHref(event, a.scramble);
              return href ? (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}  /* 否则会触发整行 click-to-copy */
                  title={t('打开大图', 'Open full-size image')}
                >{preview}</a>
              ) : preview;
            })()}
          </td>
        )}
      </tr>,
    );
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
