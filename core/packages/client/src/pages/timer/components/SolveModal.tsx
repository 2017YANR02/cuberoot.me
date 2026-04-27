import { useEffect, useState } from 'react';
import type { Solve, Penalty } from '../types';
import { effectiveMs } from '../types';
import { formatMs } from '../stats';
import { CubePreview } from '../cube';

function StageSplits({ stages, isZh, totalMs }: { stages: NonNullable<Solve['stages']>; isZh: boolean; totalMs: number }) {
  const cross = stages.cross;
  const f2l = stages.f2l;
  const oll = stages.oll;
  const pll = stages.pll;
  // Per-step durations: each is `(this stage time) - (previous stage time)`.
  const crossDur = cross !== undefined ? cross : null;
  const f2lDur = (f2l !== undefined && cross !== undefined) ? f2l - cross : (f2l !== undefined ? f2l : null);
  const ollDur = (oll !== undefined && f2l !== undefined) ? oll - f2l : (oll !== undefined && cross !== undefined ? oll - cross : (oll !== undefined ? oll : null));
  const pllDur = oll !== undefined ? pll - oll : (f2l !== undefined ? pll - f2l : (cross !== undefined ? pll - cross : pll));

  const rows: Array<{ name: string; cum: number | undefined; dur: number | null }> = [
    { name: isZh ? '十字' : 'Cross', cum: cross, dur: crossDur },
    { name: 'F2L',                    cum: f2l,   dur: f2lDur },
    { name: 'OLL',                    cum: oll,   dur: ollDur },
    { name: 'PLL',                    cum: pll,   dur: pllDur },
  ];
  return (
    <div className="stage-splits-table">
      {rows.map(r => (
        <div className="stage-row" key={r.name}>
          <span className="stage-name">{r.name}</span>
          <span className="stage-dur">{r.dur !== null ? formatMs(r.dur) : '—'}</span>
          <span className="stage-cum">{r.cum !== undefined ? formatMs(r.cum) : '—'}</span>
        </div>
      ))}
      <div className="stage-row stage-total">
        <span className="stage-name">{isZh ? '总计' : 'Total'}</span>
        <span className="stage-dur"></span>
        <span className="stage-cum">{formatMs(totalMs)}</span>
      </div>
    </div>
  );
}

interface Props {
  solve: Solve;
  index: number;
  isZh: boolean;
  onClose: () => void;
  onChangePenalty: (p: Penalty) => void;
  onChangeComment: (text: string) => void;
  onDelete: () => void;
}

export default function SolveModal({ solve, index, isZh, onClose, onChangePenalty, onChangeComment, onDelete }: Props) {
  // Comment state is initialized once per modal-mount; the parent passes
  // `key={solve.id}` so a different solve remounts (and re-initializes) us.
  const [comment, setComment] = useState(solve.comment ?? '');
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (editing) return; // don't close if user is in textarea
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editing, onClose]);

  const eff = effectiveMs(solve);
  const dt = new Date(solve.ts);
  return (
    <div className="timer-modal-overlay" onClick={onClose}>
      <div className="timer-modal" onClick={(e) => e.stopPropagation()}>
        <h2>
          #{index + 1} · {formatMs(eff)}
          {solve.penalty === '+2' && ' (+2)'}
          {solve.penalty === 'DNF' && ' DNF'}
        </h2>
        <div className="modal-section">
          <div>{isZh ? '原始时间' : 'Raw time'}: {formatMs(solve.timeMs)}</div>
          <div>{isZh ? '日期' : 'Date'}: {dt.toLocaleString()}</div>
        </div>
        <div className="modal-section">
          <div>{isZh ? '打乱' : 'Scramble'}:</div>
          <div className="scramble-text">{solve.scramble}</div>
        </div>
        <div className="modal-section modal-cube-row">
          <CubePreview event={solve.event} scramble={solve.scramble} size={14} />
        </div>
        {solve.stages && (
          <div className="modal-section">
            <h3 className="settings-h3">{isZh ? '分阶段成绩' : 'Stage splits'}</h3>
            <StageSplits stages={solve.stages} isZh={isZh} totalMs={solve.timeMs} />
          </div>
        )}
        <div className="modal-section">
          <label>
            {isZh ? '注释' : 'Comment'}
            <textarea
              className="comment-textarea"
              value={comment}
              rows={3}
              onChange={(e) => setComment(e.target.value)}
              onFocus={() => setEditing(true)}
              onBlur={() => {
                setEditing(false);
                if (comment !== (solve.comment ?? '')) onChangeComment(comment);
              }}
              placeholder={isZh ? '记录此次成绩的备注…' : 'Notes for this solve…'}
            />
          </label>
        </div>
        <div className="modal-actions">
          <button
            className={solve.penalty === 'ok' ? 'primary' : ''}
            onClick={() => onChangePenalty('ok')}
          >
            OK
          </button>
          <button
            className={solve.penalty === '+2' ? 'primary' : ''}
            onClick={() => onChangePenalty('+2')}
          >
            +2
          </button>
          <button
            className={solve.penalty === 'DNF' ? 'primary' : ''}
            onClick={() => onChangePenalty('DNF')}
          >
            DNF
          </button>
          <button className="danger" onClick={onDelete}>
            {isZh ? '删除' : 'Delete'}
          </button>
          <button onClick={onClose}>{isZh ? '关闭' : 'Close'}</button>
        </div>
      </div>
    </div>
  );
}
