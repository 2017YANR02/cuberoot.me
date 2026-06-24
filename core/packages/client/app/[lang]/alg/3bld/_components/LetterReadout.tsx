'use client';

// Renders LetterCell[] inline, grouped every 2 letters (BLD pair spacing).
// role 'start' -> blue, 'end' -> green (css classes; theme-friendly tokens).

import type { JSX } from 'react';
import type { LetterCell } from '../_lib/types';
import { tr } from '@/i18n/tr';

interface LetterReadoutProps {
  cells: LetterCell[];
  label?: string;
}

function cellClass(role: LetterCell['role']): string {
  if (role === 'start') return 'bld-cell bld-cell-start';
  if (role === 'end') return 'bld-cell bld-cell-end';
  return 'bld-cell';
}

export function LetterReadout({ cells, label }: LetterReadoutProps): JSX.Element {
  // Group letters in pairs so each <span> can stay together (white-space:nowrap).
  const pairs: LetterCell[][] = [];
  for (let i = 0; i < cells.length; i += 2) {
    pairs.push(cells.slice(i, i + 2));
  }

  return (
    <div className="bld-readout">
      {label !== undefined && <span className="bld-readout-label">{label}</span>}
      {cells.length === 0 ? (
        <span className="bld-readout-empty">{tr({ zh: '无', en: 'none'
        })}</span>
      ) : (
        <span className="bld-readout-cells">
          {pairs.map((pair, pi) => (
            <span key={pi} className="bld-readout-pair">
              {pair.map((c, ci) => (
                <span key={ci} className={cellClass(c.role)}>{c.letter}</span>
              ))}
              {pi < pairs.length - 1 ? ' ' : ''}
            </span>
          ))}
        </span>
      )}
    </div>
  );
}
