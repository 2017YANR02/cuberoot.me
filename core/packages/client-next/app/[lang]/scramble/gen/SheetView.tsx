'use client';

/**
 * Shared sheet renderer for /scramble/gen. Used by both TNoodle (generate from
 * cubing/scramble) and Import (load from WCA `/scrambles` endpoint) modes —
 * once we have a `RoundSheet`, the on-screen presentation is identical.
 *
 * Rows are click-to-copy: clicking anywhere on a scramble row writes that
 * scramble to the clipboard and flashes `.is-copied` for ~1.2s.
 */
import { useRef, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { EventIcon } from '@/components/EventIcon';
import { eventDisplayName } from '@/lib/wca-events';
import { ScramblePreview2D, eventHasScramblePreview } from '@/components/ScramblePreview2D';
import { visualcubeApiHref } from '@/lib/visualcube-link';
import { solveCross, isHtmScramble } from '@/lib/cross-solver';
import type { WcaFormat } from './_wca-round';
import ScrambleLines from './ScrambleLines';

// CSS colour class per BADGE_ORDER slot (White Yellow Red Orange Blue Green).
const BADGE_CLASS = ['cx-w', 'cx-y', 'cx-r', 'cx-o', 'cx-b', 'cx-g'];

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
  /** 333 family (333/oh/ft/fm/bf) — scramble → optimal 6-colour cross lengths
   *  (BADGE_ORDER). When present, each row shows the "C: 567766" badge; the
   *  white-cross reveal appears only for HTM-parseable scrambles (bf carries
   *  wide-move orientation, so its badge comes from precomputed data but the
   *  live solver can't produce its solution). */
  crossMap?: Map<string, number[]>;
}

export default function SheetView({ sheet, isZh, t, clockColors, sq1Colors, megaColors, showPreview = true, crossMap }: SheetViewProps) {
  const { event, roundIdx, groupIdx, attemptNumber, attempts, totalGroups } = sheet;
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
  const showCross = !!crossMap;
  const [openSol, setOpenSol] = useState<Set<number>>(new Set());
  const solCacheRef = useRef<Map<string, string>>(new Map());
  const toggleSol = (idx: number) => {
    setOpenSol((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };
  const whiteCrossMoves = (scramble: string): string => {
    const cached = solCacheRef.current.get(scramble);
    if (cached !== undefined) return cached;
    const sol = solveCross(scramble, 'White');
    const text = sol ? (sol.moves.join(' ') || t('已是白十字', 'cross already solved')) : '—';
    solCacheRef.current.set(scramble, text);
    return text;
  };
  const copyAttempt = async (idx: number, scramble: string) => {
    if (!scramble) return;
    try {
      await navigator.clipboard.writeText(scramble);
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx((cur) => (cur === idx ? null : cur)), 1200);
    } catch { /* swallow */ }
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
    rows.push(
      <tr
        key={i}
        className={rowCls}
        onClick={() => copyAttempt(i, a.scramble)}
        title={t('点击复制', 'Click to copy')}
        style={{ cursor: a.scramble ? 'pointer' : 'default' }}
      >
        <td className="gen-tn-attempt-num">{a.label}</td>
        <td className="gen-tn-attempt-scramble">
          <div className="gen-tn-scr-line">
            <ScrambleLines scramble={a.scramble} className="gen-tn-attempt-line" />
            {(() => {
              const digits = showCross && a.scramble ? crossMap!.get(a.scramble) : undefined;
              if (!digits) return null;
              return (
                <span
                  className="gen-tn-cross-badge"
                  title={t('白十字最少步 黄红橙蓝绿同列', 'Optimal cross HTM — White Yellow Red Orange Blue Green')}
                >
                  <span className="gen-tn-cross-c">C</span>
                  {digits.map((d, ci) => (
                    <b key={ci} className={`gen-tn-cx ${BADGE_CLASS[ci]}`}>{d}</b>
                  ))}
                </span>
              );
            })()}
          </div>
          {showCross && a.scramble && crossMap!.has(a.scramble) && isHtmScramble(a.scramble) && (
            <div className="gen-tn-cross-sol">
              <button
                type="button"
                className="gen-tn-cross-sol-btn"
                onClick={(e) => { e.stopPropagation(); toggleSol(i); }}
                aria-expanded={openSol.has(i)}
              >
                {openSol.has(i) ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                {t('查看白底解法', 'White cross solution')}
              </button>
              {openSol.has(i) && (
                <code className="gen-tn-cross-sol-moves">{whiteCrossMoves(a.scramble)}</code>
              )}
            </div>
          )}
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
