/**
 * TrainerSubsetModal — case picker for the OLL / PLL trainer.
 *
 * Lets the user restrict the trainer pool to a chosen subset of cases (e.g.
 * only the T / Y / E PLLs, or one OLL group). An empty subset means "all".
 */

import { useEffect, useMemo, useState } from 'react';
import { OLL_CASES } from '../scramble/algs/oll_cases';
import { PLL_CASES } from '../scramble/algs/pll_cases';
import { getSettings, updateSettings } from '../settings';

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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

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
      <div className="timer-modal trainer-subset-modal" onClick={(e) => e.stopPropagation()}>
        <h2>
          {kind === 'oll'
            ? (isZh ? 'OLL 子集' : 'OLL subset')
            : (isZh ? 'PLL 子集' : 'PLL subset')}
          <span className="trainer-subset-count"> ({count}/{total})</span>
        </h2>

        <div className="trainer-subset-toolbar">
          <button type="button" onClick={selectAll}>{isZh ? '全选' : 'Select all'}</button>
          <button type="button" onClick={selectNone}>{isZh ? '全不选' : 'Clear'}</button>
          <button type="button" onClick={disableSubset}>
            {isZh ? '关闭子集（随机所有）' : 'Disable subset (random all)'}
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
          <button type="button" onClick={onClose}>{isZh ? '取消' : 'Cancel'}</button>
          <button type="button" className="primary" onClick={save}>{isZh ? '保存' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
}
