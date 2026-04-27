import { useEffect } from 'react';
import type { Solve, Penalty } from '../types';
import { effectiveMs } from '../types';
import { formatMs } from '../stats';

interface Props {
  solve: Solve;
  index: number;
  isZh: boolean;
  onClose: () => void;
  onChangePenalty: (p: Penalty) => void;
  onDelete: () => void;
}

export default function SolveModal({ solve, index, isZh, onClose, onChangePenalty, onDelete }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

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
