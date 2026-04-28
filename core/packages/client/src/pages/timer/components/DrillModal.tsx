/**
 * DrillModal — pick a single OLL or PLL case to drill repeatedly.
 *
 * Reuses the trainer-subset-modal CSS so the chips/grid/group layout matches
 * the existing TrainerSubsetModal. Selecting a case fires `onPick(type, id)`
 * and closes; the parent then locks the timer's scramble generator to that
 * case until drill mode is exited.
 */

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { OLL_CASES } from '../scramble/algs/oll_cases';
import { PLL_CASES } from '../scramble/algs/pll_cases';
import type { DrillType } from '../scramble/drill';

interface Props {
  isZh: boolean;
  initialType?: DrillType;
  activeCase?: { type: DrillType; id: string } | null;
  onPick: (type: DrillType, caseId: string) => void;
  onExit: () => void;
  onClose: () => void;
}

export default function DrillModal({
  isZh,
  initialType,
  activeCase,
  onPick,
  onExit,
  onClose,
}: Props) {
  const [type, setType] = useState<DrillType>(initialType ?? activeCase?.type ?? 'oll');
  const titleId = useId();
  const firstButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    firstButtonRef.current?.focus();
  }, []);

  // OLL: group by `group`; PLL: flat.
  const groups = useMemo(() => {
    if (type === 'pll') {
      return [{ name: '', cases: PLL_CASES as readonly { id: string; name: string }[] }];
    }
    const map = new Map<string, { id: string; name: string; group: string }[]>();
    for (const c of OLL_CASES) {
      if (!map.has(c.group)) map.set(c.group, []);
      map.get(c.group)!.push(c);
    }
    return Array.from(map.entries()).map(([name, cases]) => ({ name, cases }));
  }, [type]);

  const total = type === 'oll' ? OLL_CASES.length : PLL_CASES.length;
  const activeId = activeCase && activeCase.type === type ? activeCase.id : null;

  return (
    <div className="timer-modal-overlay" onClick={onClose}>
      <div
        className="timer-modal trainer-subset-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId}>
          {isZh ? '专项练习' : 'Drill mode'}
          <span className="trainer-subset-count"> ({total})</span>
        </h2>

        <div className="trainer-subset-toolbar">
          <button
            ref={firstButtonRef}
            type="button"
            className={type === 'oll' ? 'primary' : ''}
            onClick={() => setType('oll')}
          >
            OLL
          </button>
          <button
            type="button"
            className={type === 'pll' ? 'primary' : ''}
            onClick={() => setType('pll')}
          >
            PLL
          </button>
          {activeCase && (
            <button type="button" onClick={() => { onExit(); onClose(); }}>
              {isZh ? `退出专项 (${activeCase.id})` : `Exit drill (${activeCase.id})`}
            </button>
          )}
        </div>

        <div className="trainer-subset-body">
          {groups.map((g, gi) => (
            <div key={gi} className="trainer-case-group">
              {g.name && <h3 className="trainer-case-group-title">{g.name}</h3>}
              <div className="trainer-case-grid">
                {g.cases.map(c => {
                  const checked = activeId === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      className={`trainer-case-chip ${checked ? 'checked' : ''}`}
                      onClick={() => { onPick(type, c.id); onClose(); }}
                      title={c.id}
                    >
                      <span className="trainer-case-chip-label">
                        {type === 'oll' ? c.id.replace(/^OLL /, '') : c.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="modal-actions">
          <button type="button" onClick={onClose}>{isZh ? '关闭' : 'Close'}</button>
        </div>
      </div>
    </div>
  );
}
