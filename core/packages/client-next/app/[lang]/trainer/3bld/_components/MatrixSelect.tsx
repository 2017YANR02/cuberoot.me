'use client';

// 24-letter checkbox matrix popup for picking 2C2C / 2E2E target codes.
// Letters come from the engine globalState (corner slice 0..23 / edge slice 24..47,
// uppercased) so the option set stays faithful to upstream (no U/V; corner order
// has W after L, edge order is alphabetical A..T then W..Z).

import { useEffect, useMemo, type JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCheck, Eraser } from 'lucide-react';
import { globalState } from '../_lib/lettering';
import { tr } from '@/i18n/tr';

interface MatrixSelectProps {
  pieceType: 'corner' | 'edge';
  value: string[];
  onChange: (next: string[]) => void;
}

// Corner codes = the 24 uppercase corner-sticker letters (globalState[0..23]).
// Edge codes = the 24 edge-sticker letters uppercased (globalState[24..47]).
function lettersFor(pieceType: 'corner' | 'edge'): string[] {
  const raw = pieceType === 'corner' ? globalState.slice(0, 24) : globalState.slice(24, 48);
  return raw.toUpperCase().split('');
}

export function MatrixSelect({ pieceType, value, onChange }: MatrixSelectProps): JSX.Element {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');

  const letters = useMemo(() => lettersFor(pieceType), [pieceType]);
  const selected = useMemo(() => new Set(value), [value]);

  // Drop any stale selections that aren't valid for the current piece type.
  useEffect(() => {
    const valid = value.filter((l) => letters.includes(l));
    if (valid.length !== value.length) onChange(valid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pieceType]);

  const toggle = (letter: string) => {
    const next = new Set(selected);
    if (next.has(letter)) next.delete(letter);
    else next.add(letter);
    // keep emitted order aligned to the matrix order
    onChange(letters.filter((l) => next.has(l)));
  };

  const selectAll = () => onChange([...letters]);
  const clearAll = () => onChange([]);

  // corner = 3 cols x 8 rows; edge = 4 cols x 6 rows (mirrors upstream grids).
  const cols = pieceType === 'corner' ? 3 : 4;

  return (
    <div className="bld-matrix">
      <div className="bld-matrix-actions">
        <button type="button" className="bld-btn bld-btn-ghost" onClick={selectAll}>
          <CheckCheck size={15} />
          {tr({ zh: '全选', en: 'Select all'
        })}
        </button>
        <button type="button" className="bld-btn bld-btn-ghost" onClick={clearAll}>
          <Eraser size={15} />
          {tr({ zh: '清空', en: 'Clear' })}
        </button>
      </div>
      <div className="bld-matrix-grid" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {letters.map((letter) => {
          const on = selected.has(letter);
          return (
            <label key={letter} className={`bld-matrix-cell${on ? ' is-on' : ''}`}>
              <input
                type="checkbox"
                checked={on}
                onChange={() => toggle(letter)}
              />
              <span>{letter}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
