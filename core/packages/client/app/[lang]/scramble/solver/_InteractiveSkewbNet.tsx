'use client';

/**
 * 斜转的 2D 展开图画板 —— 点一格涂一色,和三阶 / 二阶画板同一套交互(左键涂、右键置灰、色板取色、
 * 同块规则实时拦截)。
 *
 * 几何**不在这里**:30 块多边形取自 `skewbNetGeometry()`,与预览图 / tnoodle PDF 同一份 —— 所以
 * 画板和预览图永远是同一个魔方的同一张展开图(斜转那六个菱形面各有各的朝向,两边各画一份必歪)。
 * 这里只负责把每块变成可点的 `<path>` 并接上共享的 `usePainter` / 色板 / 动作条。
 */

import { useTranslation } from 'react-i18next';
import { skewbNetGeometry } from '@/app/[lang]/scramble/gen/_svg/skewb_svg';
import { useT } from '@/hooks/useT';
import { SKEWB_FACES } from '@/lib/skewb-solver';
import { EMPTY_COLOR_HEX, usePainter, type FaceLetter, type PaintColor, type PaintSpec } from './_paint-shared';
import { SKEWB_COLOR_HEX, SKEWB_PAINT } from './_paint-spec-skewb';
import { PaintActions, PaintPalette } from './_PaintToolbar';

const GEOM = skewbNetGeometry();

export interface InteractiveSkewbNetProps {
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

export default function InteractiveSkewbNet({
  facelet, spec = SKEWB_PAINT, onChange, activeColor, onActiveColorChange, pixelSize,
  onSolve, solveLabel, solveTitle, hideSolve, plainSolve,
}: InteractiveSkewbNetProps) {
  const t = useT();
  const { i18n } = useTranslation();
  const isZh = i18n.language === 'zh';

  const { paint, rejectMsg } = usePainter({ facelet, onChange, activeColor, isZh, spec });

  // 展开图比 1:1 略宽 —— 按宽度贴合给定像素,高度随比例走。
  const width = pixelSize;
  const height = Math.round((pixelSize * GEOM.height) / GEOM.width);
  const eraseHint = t('(右键置灰)', ' (right-click to erase)');

  return (
    <div className="skewb-net-paint">
      <style>{INLINE_CSS}</style>
      <div className="skewb-net-body">
        <svg
          className="skewb-net-canvas"
          width={width}
          height={height}
          viewBox={`0 0 ${GEOM.width} ${GEOM.height}`}
          preserveAspectRatio="xMidYMid meet"
        >
          {GEOM.cells.map((cell) => {
            const ch = facelet[cell.index] as PaintColor;
            const fill = ch === 'X' ? EMPTY_COLOR_HEX : (SKEWB_COLOR_HEX[ch as FaceLetter] ?? '#404040');
            return (
              <path
                key={cell.index}
                className="skewb-net-sticker"
                d={`M${cell.points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' L')} Z`}
                fill={fill}
                onPointerDown={(e) => {
                  // 右键 / 中键都当擦除;左键涂色。
                  if (e.button === 0) paint(cell.index);
                  else if (e.button === 2 || e.button === 1) paint(cell.index, 'X');
                }}
                onContextMenu={(e) => e.preventDefault()}
              >
                <title>{`${SKEWB_FACES[cell.face]}${cell.slot}${eraseHint}`}</title>
              </path>
            );
          })}
        </svg>

        <PaintPalette activeColor={activeColor} onActiveColorChange={onActiveColorChange} colors={SKEWB_COLOR_HEX} />
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
.skewb-net-paint { display: flex; flex-direction: column; align-items: center; gap: 0.75rem; }
.skewb-net-body { display: flex; flex-direction: column; align-items: center; gap: 0.75rem; }
.skewb-net-canvas { max-width: 100%; height: auto; touch-action: manipulation; }
.skewb-net-sticker {
  stroke: color-mix(in srgb, var(--foreground) 55%, transparent);
  stroke-width: 1;
  stroke-linejoin: round;
  cursor: crosshair;
}
.skewb-net-sticker:hover { stroke: var(--foreground); stroke-width: 2; }
`;
