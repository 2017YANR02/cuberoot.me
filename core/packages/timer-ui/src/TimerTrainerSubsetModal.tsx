'use client';

/**
 * TrainerSubsetModal — case picker for the OLL / PLL trainer.
 *
 * Lets the user restrict the trainer pool to a chosen subset of cases (e.g.
 * only the T / Y / E PLLs, or one OLL group). An empty subset means "all".
 */

import { useMemo, useState } from 'react';
import { TimerRoomDialog } from './TimerRoomDialog';
import './timer-trainer-subset.css';
import { OLL_CASES, PLL_CASES } from '@cuberoot/shared/timer';


interface Props {
  kind: 'oll' | 'pll';
  language: 'en' | 'zh';
  value?: readonly string[];
  onSave(value: string[] | undefined): void;
  onClose: () => void;
}

export function TimerTrainerSubsetModal({ kind, onClose, language, value, onSave }: Props) {
  const tr = <T,>(text: { en: T; zh: T }) => text[language];
  const all = kind === 'oll' ? OLL_CASES : PLL_CASES;
  const allIds = useMemo(() => all.map(c => c.id), [all]);

  const [selected, setSelected] = useState<Set<string>>(() => {
    const cur = value;
    if (cur && cur.length > 0) return new Set(cur);
    return new Set(allIds);
  });

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
    onSave(isAll || arr.length === 0 ? undefined : arr);
    onClose();
  };

  const disableSubset = () => {
    onSave(undefined);
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


  return (
    <TimerRoomDialog className="trainer-subset-modal" title={tr({ en: kind.toUpperCase() + ' subset', zh: kind.toUpperCase() + ' 子集' })} language={language} onClose={onClose}>
        <div className="trainer-subset-toolbar">
          <button className="trainer-subset-toolbar-btn" type="button" onClick={selectAll}>{tr({ zh: '全选', en: 'Select all'
        })}</button>
          <button className="trainer-subset-toolbar-btn" type="button" onClick={selectNone}>{tr({ zh: '全不选', en: 'Clear'
        })}</button>
          <button className="trainer-subset-toolbar-btn" type="button" onClick={disableSubset}>
            {tr({ zh: '关闭子集（随机所有）', en: 'Disable subset (random all)'
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
                      {/* allow-checkbox: 公式 case 多选 chip 网格 */}
                      <input
                        className="trainer-case-chip-input"
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
          <button className="modal-action-btn" type="button" onClick={onClose}>{tr({ zh: '取消', en: 'Cancel' })}</button>
          <button type="button" className="primary modal-action-btn" onClick={save}>{tr({ zh: '保存', en: 'Save'
        })}</button>
        </div>
    </TimerRoomDialog>
  );
}
