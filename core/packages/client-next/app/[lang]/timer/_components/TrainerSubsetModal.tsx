'use client';

/**
 * TrainerSubsetModal — case picker for the OLL / PLL trainer.
 *
 * Lets the user restrict the trainer pool to a chosen subset of cases (e.g.
 * only the T / Y / E PLLs, or one OLL group). An empty subset means "all".
 */

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { OLL_CASES } from '../_lib/scramble/algs/oll_cases';
import { PLL_CASES } from '../_lib/scramble/algs/pll_cases';
import { getSettings, updateSettings } from '../_lib/settings';
import { tr } from '@/i18n/tr';

interface Props {
  kind: 'oll' | 'pll';
  isZh: boolean;
  onClose: () => void;
}

export default function TrainerSubsetModal({ kind, isZh, onClose }: Props) {
  const all = kind === 'oll' ? OLL_CASES : PLL_CASES;
  const allIds = useMemo(() => all.map(c => c.id), [all]);

  const [selected, setSelected] = useState<Set<string>>(() => {
    const cur = kind === 'oll' ? getSettings().ollSubset : getSettings().pllSubset;
    if (cur && cur.length > 0) return new Set(cur);
    return new Set(allIds);
  });

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

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(allIds));
  const selectNone = () => setSelected(new Set());

  const save = () => {
    const arr = Array.from(selected);
    const isAll = arr.length === allIds.length;
    if (kind === 'oll') {
      updateSettings({ ollSubset: isAll || arr.length === 0 ? undefined : arr });
    } else {
      updateSettings({ pllSubset: isAll || arr.length === 0 ? undefined : arr });
    }
    onClose();
  };

  const disableSubset = () => {
    if (kind === 'oll') updateSettings({ ollSubset: undefined });
    else updateSettings({ pllSubset: undefined });
    onClose();
  };

  // OLL: group by `group`; PLL: flat.
  const groups: { name: string; cases: typeof all }[] = useMemo(() => {
    if (kind === 'pll') return [{ name: '', cases: all }];
    const map = new Map<string, typeof all[number][]>();
    for (const c of OLL_CASES) {
      const g = c.group;
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(c);
    }
    return Array.from(map.entries()).map(([name, cases]) => ({ name, cases }));
  }, [kind, all]);

  const total = allIds.length;
  const count = selected.size;

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
          {kind === 'oll'
            ? (tr({ zh: 'OLL 子集', en: 'OLL subset' }))
            : (tr({ zh: 'PLL 子集', en: 'PLL subset' }))}
          <span className="trainer-subset-count"> ({count}/{total})</span>
        </h2>

        <div className="trainer-subset-toolbar">
          <button ref={firstButtonRef} type="button" onClick={selectAll}>{tr({ zh: '全选', en: 'Select all',
              zhHant: "全選"
        })}</button>
          <button type="button" onClick={selectNone}>{tr({ zh: '全不选', en: 'Clear',
              zhHant: "全不選"
        })}</button>
          <button type="button" onClick={disableSubset}>
            {tr({ zh: '关闭子集（随机所有）', en: 'Disable subset (random all)',
                zhHant: "關閉子集（隨機所有）"
            })}
          </button>
        </div>

        <div className="trainer-subset-body">
          {groups.map((g, gi) => (
            <div key={gi} className="trainer-case-group">
              {g.name && <h3 className="trainer-case-group-title">{g.name}</h3>}
              <div className="trainer-case-grid">
                {g.cases.map(c => {
                  const checked = selected.has(c.id);
                  return (
                    <label
                      key={c.id}
                      className={`trainer-case-chip ${checked ? 'checked' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(c.id)}
                      />
                      <span className="trainer-case-chip-label">
                        {kind === 'oll' ? c.id.replace(/^OLL /, '') : c.name}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="modal-actions">
          <button type="button" onClick={onClose}>{tr({ zh: '取消', en: 'Cancel' })}</button>
          <button type="button" className="primary" onClick={save}>{tr({ zh: '保存', en: 'Save',
              zhHant: "儲存"
        })}</button>
        </div>
      </div>
    </div>
  );
}
