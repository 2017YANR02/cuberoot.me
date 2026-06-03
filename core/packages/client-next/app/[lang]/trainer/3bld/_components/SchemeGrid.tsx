'use client';

// Read-only display of the active lettering scheme (sticker -> letter).
// Editing is a later phase; this only renders the preset's 48 letters.
//
// Scheme strings are 48 chars over upstream setcode.js `idOrder` = 6 faces, each
// 8 perimeter stickers in row-major order (center skipped). Faces follow the
// upstream a1x..a6x id grouping: U, R, F, D, L, B.

import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { SCHEME_PRESETS, type SchemeId } from '../_lib/scheme-presets';

interface SchemeGridProps {
  scheme: SchemeId;
}

// Face order matching idOrder a1x..a6x.
const FACE_LABELS: { id: string; zh: string }[] = [
  { id: 'U', zh: '顶' },
  { id: 'R', zh: '右' },
  { id: 'F', zh: '前' },
  { id: 'D', zh: '底' },
  { id: 'L', zh: '左' },
  { id: 'B', zh: '后' },
];

// 3x3 cell indices in render order; index 4 is the center (no letter).
// Perimeter cells consume the 8 letters per face row-major: 0 1 2 / 3 _ 5 / 6 7 8.
const PERIMETER = [0, 1, 2, 3, 5, 6, 7, 8];

export function SchemeGrid({ scheme }: SchemeGridProps): JSX.Element {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const str = SCHEME_PRESETS[scheme];

  return (
    <div className="bld-scheme-grid">
      <div className="bld-scheme-faces">
        {FACE_LABELS.map((face, fi) => {
          // 8 perimeter letters for this face.
          const letters = str.slice(fi * 8, fi * 8 + 8).split('');
          const byCell: Record<number, string> = {};
          PERIMETER.forEach((cell, k) => { byCell[cell] = letters[k] ?? ''; });
          return (
            <div key={face.id} className="bld-scheme-face">
              <span className="bld-scheme-face-label">
                {face.id}{isZh ? ` (${face.zh})` : ''}
              </span>
              <div className="bld-scheme-face-cells">
                {Array.from({ length: 9 }, (_, cell) => (
                  <div
                    key={cell}
                    className={`bld-scheme-cell${cell === 4 ? ' is-center' : ''}`}
                  >
                    {cell === 4 ? face.id : byCell[cell]}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
