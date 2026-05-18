/**
 * Shared sheet renderer for /scramble/gen. Used by both TNoodle (generate from
 * cubing/scramble) and Import (load from WCA `/scrambles` endpoint) modes —
 * once we have a `RoundSheet`, the on-screen presentation is identical.
 *
 * Rows are click-to-copy: clicking anywhere on a scramble row writes that
 * scramble to the clipboard and flashes `.is-copied` for ~1.2s.
 */
import { useState, type ReactNode } from 'react';
import { EventIcon } from '../../components/EventIcon';
import { eventDisplayName } from '../../utils/wca_events';
import { ScramblePreview2D, eventHasScramblePreview } from '../../components/ScramblePreview2D';
import type { WcaFormat } from './wca_round';
import ScrambleLines from './ScrambleLines';

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
  locales?: import('./tnoodle_translate').TnoodleLocale[];
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
}

export default function SheetView({ sheet, isZh, t, clockColors, sq1Colors, megaColors, showPreview = true }: SheetViewProps) {
  const { event, roundIdx, groupIdx, attemptNumber, attempts, totalGroups } = sheet;
  const groupSuffix = (totalGroups ?? 1) > 1
    ? ` ${t('组', 'Group')} ${String.fromCharCode(65 + groupIdx)}`
    : '';
  const attemptSuffix = attemptNumber !== undefined
    ? ` ${t('第', 'Attempt')} ${attemptNumber + 1}${t('次', '')}`
    : '';
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
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
          <ScrambleLines scramble={a.scramble} className="gen-tn-attempt-line" />
        </td>
        {showPreview && (
          <td className="gen-tn-attempt-preview">
            {eventHasScramblePreview(event) && a.scramble && (
              <ScramblePreview2D event={event} scramble={a.scramble} size={48} clockColors={clockColors} sq1Colors={sq1Colors} megaColors={megaColors} />
            )}
          </td>
        )}
      </tr>,
    );
  });
  return (
    <div className="gen-tn-sheet">
      <div className="gen-tn-sheet-header">
        <EventIcon event={event} />
        <span>{eventDisplayName(event, isZh)} {t('第', 'Round')} {roundIdx + 1}{t('轮', '')}{groupSuffix}{attemptSuffix}</span>
      </div>
      <table className="gen-tn-sheet-table"><tbody>{rows}</tbody></table>
    </div>
  );
}
