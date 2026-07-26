'use client';

/**
 * 金字塔的 2D 展开图画板 —— 与斜转那块(`_InteractiveSkewbNet`)同一套交互与结构,只是几何取自
 * `pyraNetGeometry()`(与预览图 / tnoodle PDF 同源:四个三角面,F 朝上、D/L/R 朝下)。
 *
 * 两块画板没合成一个「通用展开图画板」是因为它们只共享了「遍历 cells 画 path」这十几行,
 * 而各自的 cells 来源、色板面集、提示文案都不同;真正会重复的逻辑(同块规则、色板、动作条)
 * 已经在 _paint-shared / _PaintToolbar 里共用了。
 */

import { useTranslation } from 'react-i18next';
import { pyraNetGeometry } from '@/app/[lang]/scramble/gen/_svg/pyraminx_svg';
import { useT } from '@/hooks/useT';
import { PYRA_FACES } from '@/lib/pyraminx-solver';
import { EMPTY_COLOR_HEX, usePainter, type FaceLetter, type PaintColor, type PaintSpec } from './_paint-shared';
import { PYRA_COLOR_HEX, PYRA_PAINT, PYRA_PALETTE_FACES } from './_paint-spec-pyra';
import { PaintActions, PaintPalette } from './_PaintToolbar';

const GEOM = pyraNetGeometry();

export interface InteractivePyraNetProps {
  facelet: string;
  spec?: PaintSpec;
  onChange: (next: string) => void;
  activeColor: PaintColor;
  onActiveColorChange: (c: PaintColor) => void;
  pixelSize: number;
  onSolve?: (facelet: string) => void;
  solveLabel?: { zh: string; en: string };
  solveTitle?: { zh: string; en: string };
  hideSolve?: boolean;
  plainSolve?: boolean;
}

export default function InteractivePyraNet({
  facelet, spec = PYRA_PAINT, onChange, activeColor, onActiveColorChange, pixelSize,
  onSolve, solveLabel, solveTitle, hideSolve, plainSolve,
}: InteractivePyraNetProps) {
  const t = useT();
  const { i18n } = useTranslation();
  const isZh = i18n.language === 'zh';

  const { paint, rejectMsg } = usePainter({ facelet, onChange, activeColor, isZh, spec });

  const width = pixelSize;
  const height = Math.round((pixelSize * GEOM.height) / GEOM.width);
  const eraseHint = t('(右键置灰)', ' (right-click to erase)');

  return (
    <div className="pyra-net-paint">
      <style>{INLINE_CSS}</style>
      <div className="pyra-net-body">
        <svg
          className="pyra-net-canvas"
          width={width}
          height={height}
          viewBox={`0 0 ${GEOM.width.toFixed(2)} ${GEOM.height.toFixed(2)}`}
          preserveAspectRatio="xMidYMid meet"
        >
          {GEOM.cells.map((cell) => {
            const ch = facelet[cell.index] as PaintColor;
            const fill = ch === 'X' ? EMPTY_COLOR_HEX : (PYRA_COLOR_HEX[ch as FaceLetter] ?? '#404040');
            return (
              <path
                key={cell.index}
                className="pyra-net-sticker"
                d={`M${cell.points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' L')} Z`}
                fill={fill}
                onPointerDown={(e) => {
                  if (e.button === 0) paint(cell.index);
                  else if (e.button === 2 || e.button === 1) paint(cell.index, 'X');
                }}
                onContextMenu={(e) => e.preventDefault()}
              >
                <title>{`${PYRA_FACES[cell.face]}${cell.slot}${eraseHint}`}</title>
              </path>
            );
          })}
        </svg>

        <PaintPalette
          activeColor={activeColor}
          onActiveColorChange={onActiveColorChange}
          colors={PYRA_COLOR_HEX}
          faces={PYRA_PALETTE_FACES}
        />
      </div>

      <PaintActions
        facelet={facelet}
        spec={spec}
        onChange={onChange}
        onSolve={onSolve}
        solveLabel={solveLabel}
        solveTitle={solveTitle}
        rejectMsg={rejectMsg}
        hideSolve={hideSolve}
        plainSolve={plainSolve}
      />
    </div>
  );
}

const INLINE_CSS = `
.pyra-net-paint { display: flex; flex-direction: column; align-items: center; gap: 0.75rem; }
.pyra-net-body { display: flex; flex-direction: column; align-items: center; gap: 0.75rem; }
.pyra-net-canvas { max-width: 100%; height: auto; touch-action: manipulation; }
.pyra-net-sticker {
  stroke: color-mix(in srgb, var(--foreground) 55%, transparent);
  stroke-width: 1;
  stroke-linejoin: round;
  cursor: crosshair;
}
.pyra-net-sticker:hover { stroke: var(--foreground); stroke-width: 2; }
`;
