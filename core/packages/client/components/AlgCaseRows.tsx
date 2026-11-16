'use client';

import { Shuffle, AlertTriangle } from '@app-foundation/icons/lucide';
import type { AlgEntry, AlgPuzzle } from '@cuberoot/shared/alg';
import { formatScrambleForEvent } from '@cuberoot/shared/sq1-notation';
import { AlgFormulaReadRow } from '@/components/AlgFormulaRow';
import AlgMirrorPanel, { supportsAlgMirrorPreview } from '@/components/AlgMirrorPanel';
import { MoreTogglePanel } from '@/components/MoreToggle';
import { caseAlgIssue } from '@/lib/alg_case_alignment';
import { caseViewAlg, displayCaseAlg, displayCaseAlgHtml, type CaseViewAngle } from '@/lib/alg_display';
import { consistentAlgEntry, sanitizeAlgHtml } from '@/lib/alg_html';
import { sq1NotationText, type Sq1NotationMode } from '@/lib/sq1-pbl-notation';
import { tr } from '@/i18n/tr';

/** 打乱行(和列表卡片同款,sq1 之类会重排格式)。 */
export function AlgCaseSetupRow({ puzzle, setup, sq1NotationMode = 'compact', selected, onPlay, note, issue }: {
  puzzle: string;
  setup: string;
  sq1NotationMode?: Sq1NotationMode;
  selected?: boolean;
  onPlay?: () => void;
  note?: string;
  issue?: string;
}) {
  const activate = () => { onPlay?.(); };
  const sq1Text = puzzle === 'sq1' ? sq1NotationText(setup, sq1NotationMode) : null;
  const text = sq1Text ? tr(sq1Text) : formatScrambleForEvent(puzzle, setup);
  return (
    <div className="alg-case-standard alg-case-standard-detail"
      role={onPlay ? 'button' : undefined} tabIndex={onPlay ? 0 : undefined}
      aria-pressed={onPlay ? selected : undefined}
      aria-label={onPlay ? tr({ zh: `播放打乱：${text}`, en: `Play scramble: ${text}` }) : undefined}
      onClick={onPlay ? activate : undefined}
      onKeyDown={onPlay ? event => {
        if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          activate();
        }
      } : undefined}>
      <Shuffle size={13} className="alg-case-icon" aria-label={tr({ zh: '打乱', en: 'Setup' })} />
      <code>{text}</code>
      {(issue || note) && <span className="alg-alg-note">{issue || note}</span>}
    </div>
  );
}

/** 可播放的公式行:切换同一朝向旁边的共享播放器。 */
export function AlgCaseReadRow({ entry, puzzle, set, mirror, ori = 0, viewAngle = 'default', sq1NotationMode = 'compact', sourceKarnaukh, invalid, selected = false, actionsVisible = false, onSelect }: {
  entry: AlgEntry; puzzle: AlgPuzzle;
  set: string;
  /** 复用情况关系的目标；有链接则跳页，嵌入场景沿用宿主的切换回调。 */
  mirror?: { partner: string | null; self: string; partnerHref?: string; selfHref?: string; onPartnerSelect?: () => void; onSelfSelect?: () => void };
  /** 这条公式在第几个视角(0=FR),镜像面板要拿它算落点 */
  ori?: number;
  viewAngle?: CaseViewAngle;
  sq1NotationMode?: Sq1NotationMode;
  /** PBL 的 note 是原表卡脑壳记号；其他套系的 note 仍是普通说明。 */
  sourceKarnaukh?: boolean;
  invalid?: string;
  selected?: boolean;
  actionsVisible?: boolean;
  onSelect?: () => void;
}) {
  entry = consistentAlgEntry(entry);
  const angledAlg = displayCaseAlg(puzzle, set, caseViewAlg(entry.alg, viewAngle));
  const issue = caseAlgIssue(entry);
  const invalidReason = invalid ?? issue;
  const shown = formatScrambleForEvent(puzzle, angledAlg);
  const sq1Notation = puzzle === 'sq1'
    ? sq1NotationText(angledAlg, sq1NotationMode, sourceKarnaukh ? entry.note : undefined)
    : null;
  const shownText = sq1Notation ? tr(sq1Notation) : shown;
  const isKarnaukh = puzzle === 'sq1' && sq1NotationMode === 'karnaukh';
  return (
    <>
      <AlgFormulaReadRow tags={entry.tags} selected={selected}
        role={onSelect ? 'button' : undefined}
        tabIndex={onSelect ? 0 : undefined}
        className={`alg-alg-row${selected ? ' is-expanded' : ''}${invalidReason ? ' is-invalid' : ''}`}
        style={onSelect ? undefined : { cursor: 'default' }}
        title={invalidReason}
        aria-disabled={!!issue}
        aria-pressed={onSelect ? selected : undefined}
        aria-expanded={onSelect && supportsAlgMirrorPreview(puzzle) && !issue ? actionsVisible : undefined}
        onClick={onSelect ? () => { if (!issue) onSelect(); } : undefined}
        onKeyDown={onSelect ? (e) => { if (e.target === e.currentTarget && !issue && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onSelect(); } } : undefined}
      >
        {invalidReason && <AlertTriangle size={13} className="alg-alg-invalid-icon" aria-label={invalidReason} />}
        <span className={isKarnaukh ? 'is-karnaukh' : undefined}>
          {sq1Notation
            ? shownText
            : entry.algHtml && viewAngle === 'default' && puzzle !== 'sq1'
            ? <span dangerouslySetInnerHTML={{ __html: sanitizeAlgHtml(displayCaseAlgHtml(puzzle, set, entry.algHtml)) }} />
            : shown}
          {!sourceKarnaukh && entry.note && <span className="alg-alg-note">({tr(entry.note)})</span>}
          {issue && <span className="alg-alg-note">{tr({ zh: '（原公式与本图不匹配）', en: '(Source algorithm does not match this case)' })}</span>}
        </span>
      </AlgFormulaReadRow>
      {onSelect && supportsAlgMirrorPreview(puzzle) && !issue && (
        <MoreTogglePanel expanded={actionsVisible}>
          <AlgMirrorPanel alg={caseViewAlg(entry.alg, viewAngle)} algHtml={viewAngle === 'default' ? entry.algHtml : undefined} puzzle={puzzle} set={set} mirrorName={mirror?.partner} selfName={mirror?.self} ori={ori} mirrorHref={mirror?.partnerHref} selfHref={mirror?.selfHref} onMirrorSelect={mirror?.onPartnerSelect} onSelfSelect={mirror?.onSelfSelect} />
        </MoreTogglePanel>
      )}
    </>
  );
}
