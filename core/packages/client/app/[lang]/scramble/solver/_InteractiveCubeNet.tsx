'use client';

/**
 * 2D net state painter — the unfolded URFDLB cross, order 3 (default) or 2
 * (`spec={CUBE2_PAINT}`).
 *
 * Ported from packages/client-vite/src/pages/visualcube/InteractiveCubeNet.tsx.
 * Constants, sibling-rule paint logic, and the toolbar are now shared with the
 * 3D rotatable painter (_Interactive3DCube) via _paint-shared + _PaintToolbar;
 * this file owns only the flat-net canvas. Public exports (default, EMPTY_FACELET,
 * PaintColor) are kept stable for /visualcube + _Cube3Solver.
 */

import { useTranslation } from 'react-i18next';
import {
  FACES, COLOR_HEX, CUBE3_PAINT, EMPTY_COLOR_HEX, faceletIdx, usePainter,
  type FaceLetter, type PaintColor, type PaintSpec,
} from './_paint-shared';
import { PaintPalette, PaintActions } from './_PaintToolbar';

// Re-exported for back-compat with existing importers.
export { EMPTY_FACELET } from './_paint-shared';
export type { PaintColor, FaceLetter } from './_paint-shared';

// Net layout: [row, col] of each face's top-left cell in the 4×3 cross grid
// (measured in faces — multiply by the cube order for sticker coordinates).
const FACE_BASE: Record<FaceLetter, [number, number]> = {
  U: [0, 1],
  L: [1, 0],
  F: [1, 1],
  R: [1, 2],
  B: [1, 3],
  D: [2, 1],
};

export interface InteractiveCubeNetProps {
  facelet: string;
  /** Cube order + legality model. Defaults to 3×3. */
  spec?: PaintSpec;
  onChange: (next: string) => void;
  activeColor: PaintColor;
  onActiveColorChange: (c: PaintColor) => void;
  pixelSize: number;
  onSolve?: (facelet: string) => void;
  solveLabel?: { zh: string; en: string };
  solveTitle?: { zh: string; en: string };
  onSecondaryAction?: (facelet: string) => void;
  secondaryActionLabel?: { zh: string; en: string };
  secondaryActionTitle?: { zh: string; en: string };
  secondaryBusy?: boolean;
  optimalToggle?: { value: boolean; onChange: (v: boolean) => void };
  hideSolve?: boolean;
  plainSolve?: boolean;
}

export default function InteractiveCubeNet({
  facelet, spec = CUBE3_PAINT, onChange, activeColor, onActiveColorChange, pixelSize, onSolve, solveLabel, solveTitle,
  onSecondaryAction, secondaryActionLabel, secondaryActionTitle, secondaryBusy, optimalToggle, hideSolve, plainSolve,
}: InteractiveCubeNetProps) {
  const { i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
  const t = (zh: string, en: string) => (isZh ? zh : en);

  const { paint, rejectMsg } = usePainter({ facelet, onChange, activeColor, isZh, spec });

  const n = spec.n;
  // The cross is 4n wide and 3n tall; +1 keeps a sticker's worth of breathing room
  // (the 3×3 case is the historical pixelSize/13).
  const ss = Math.max(10, Math.floor(pixelSize / (4 * n + 1)));
  const totalW = ss * 4 * n + 16;
  const totalH = ss * 3 * n + 16;

  const stickers: { idx: number; face: FaceLetter; r: number; c: number }[] = [];
  for (const f of FACES) {
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        stickers.push({ idx: faceletIdx(f, r, c, n), face: f, r, c });
      }
    }
  }

  return (
    <div className="vc-net-paint">
      <style>{INLINE_CSS}</style>
      <div className="vc-net-body">
        <div className="vc-net-canvas" style={{ width: totalW, height: totalH }}>
          {stickers.map(({ idx, face, r, c }) => {
            const [baseR, baseC] = FACE_BASE[face];
            const px = 8 + (baseC * n + c) * ss;
            const py = 8 + (baseR * n + r) * ss;
            const ch = facelet[idx] as PaintColor;
            const color = ch === 'X' ? EMPTY_COLOR_HEX : (COLOR_HEX[ch as FaceLetter] ?? '#404040');
            const isCenter = spec.fixedCenters && r === (n - 1) / 2 && c === (n - 1) / 2;
            return (
              <button
                key={idx}
                type="button"
                className={`vc-net-sticker${isCenter ? ' is-center' : ''}`}
                style={{
                  left: px, top: py, width: ss - 1, height: ss - 1,
                  background: color,
                }}
                onClick={() => (isCenter ? onActiveColorChange(face) : paint(idx))}
                onContextMenu={(e) => {
                  e.preventDefault();
                  if (!isCenter) paint(idx, 'X');
                }}
                title={isCenter ? t('点击取色', 'Pick this color') : `${face}${r * n + c + 1}${t('(右键置灰)', ' (right-click to erase)')}`}
                aria-label={isCenter ? `Pick color ${face}` : `Sticker ${face}${r * n + c + 1} = ${ch}`}
              />
            );
          })}
        </div>

        <PaintPalette activeColor={activeColor} onActiveColorChange={onActiveColorChange} />
      </div>

      <PaintActions
        facelet={facelet}
        spec={spec}
        onChange={onChange}
        onSolve={onSolve}
        solveLabel={solveLabel}
        solveTitle={solveTitle}
        onSecondaryAction={onSecondaryAction}
        secondaryActionLabel={secondaryActionLabel}
        secondaryActionTitle={secondaryActionTitle}
        secondaryBusy={secondaryBusy}
        optimalToggle={optimalToggle}
        rejectMsg={rejectMsg}
        hideSolve={hideSolve}
        plainSolve={plainSolve}
      />
    </div>
  );
}

const INLINE_CSS = `
.vc-net-paint {
  display: flex; flex-direction: column; align-items: center; gap: 0.75rem;
}
.vc-net-body {
  display: flex; flex-direction: column; align-items: center;
  gap: 0.75rem;
}
.vc-net-canvas {
  position: relative;
  background: rgba(255,255,255,0.04);
  border-radius: 6px;
}
.vc-net-sticker {
  position: absolute;
  border: 1px solid rgba(0,0,0,0.5);
  border-radius: 2px;
  padding: 0;
  cursor: crosshair;
  transition: transform 0.08s ease, border-color 0.08s ease;
}
.vc-net-sticker:hover:not(:disabled) {
  transform: scale(1.08);
  border-color: #fff;
  z-index: 1;
}
.vc-net-sticker.is-center {
  cursor: pointer;
  border-color: rgba(0,0,0,0.7);
}
`;
