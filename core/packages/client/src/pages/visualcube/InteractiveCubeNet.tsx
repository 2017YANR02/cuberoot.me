/**
 * 可交互填色 3x3 net — VisualCube editor 在 view=net 模式下用。
 *
 * 数据约定:54-char URFDLB facelet 字符串(U/R/F/D/L/B)。
 *
 * 行为:
 *   - 点击 sticker → 上色为当前 active 颜色
 *   - 6 色 swatch 选当前色;Reset 按钮回到默认配色
 *   - "Solve this state" 按钮 — 把状态发到 /scramble/solver?state=…
 *
 * v1 只支持 3x3。其他 size/puzzle 由 caller 走原 CubingPreview。
 */
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { RotateCcw, Sparkles } from 'lucide-react';
import { SOLVED_FACELET, validateFacelet } from '../scramble/solver/facelet';

export type FaceLetter = 'U' | 'R' | 'F' | 'D' | 'L' | 'B';
const FACES: FaceLetter[] = ['U', 'R', 'F', 'D', 'L', 'B'];

const COLOR_HEX: Record<FaceLetter, string> = {
  U: '#FEFE00',
  R: '#00D800',
  F: '#EE0000',
  D: '#FFFFFF',
  L: '#0000F2',
  B: '#FFA100',
};

// face 起始格子 (row, col) — 4 列 × 3 行 net 布局,每格是 3x3 stickers
const FACE_BASE: Record<FaceLetter, [number, number]> = {
  U: [0, 1],
  L: [1, 0],
  F: [1, 1],
  R: [1, 2],
  B: [1, 3],
  D: [2, 1],
};

function faceletIdx(face: FaceLetter, row: number, col: number): number {
  return FACES.indexOf(face) * 9 + row * 3 + col;
}

export interface InteractiveCubeNetProps {
  facelet: string;             // 54 字符
  onChange: (next: string) => void;
  activeColor: FaceLetter;
  onActiveColorChange: (c: FaceLetter) => void;
  pixelSize: number;           // 整图宽度(像素),用于自适应 sticker 大小
}

export default function InteractiveCubeNet({
  facelet, onChange, activeColor, onActiveColorChange, pixelSize,
}: InteractiveCubeNetProps) {
  const { i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
  const t = (zh: string, en: string) => (isZh ? zh : en);
  const navigate = useNavigate();

  const validErr = useMemo(() => validateFacelet(facelet), [facelet]);

  // sticker 尺寸:net 是 12 columns 宽(每 face 3 columns,4 个 face 横排)= 12 stickers
  // gap 1px,padding 4px,留点边距 → 单 sticker 约 pixelSize / 13
  const ss = Math.max(10, Math.floor(pixelSize / 13));
  const totalW = ss * 12 + 16;
  const totalH = ss * 9 + 16;

  // 渲染 net — 用绝对定位,简单直接
  const stickers: { idx: number; face: FaceLetter; r: number; c: number }[] = [];
  for (const f of FACES) {
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        stickers.push({ idx: faceletIdx(f, r, c), face: f, r, c });
      }
    }
  }

  const handlePaint = (idx: number) => {
    const arr = facelet.split('');
    arr[idx] = activeColor;
    onChange(arr.join(''));
  };

  const reset = () => onChange(SOLVED_FACELET);

  const goSolver = () => {
    if (validErr) return;
    navigate(`/scramble/solver?state=${facelet}`);
  };

  return (
    <div className="vc-net-paint">
      <style>{INLINE_CSS}</style>
      <div
        className="vc-net-canvas"
        style={{ width: totalW, height: totalH }}
      >
        {stickers.map(({ idx, face, r, c }) => {
          const [baseR, baseC] = FACE_BASE[face];
          const px = 8 + (baseC * 3 + c) * ss;
          const py = 8 + (baseR * 3 + r) * ss;
          const ch = facelet[idx] as FaceLetter;
          const color = COLOR_HEX[ch] ?? '#404040';
          const isCenter = r === 1 && c === 1;
          return (
            <button
              key={idx}
              type="button"
              className={`vc-net-sticker${isCenter ? ' is-center' : ''}`}
              style={{
                left: px, top: py, width: ss - 1, height: ss - 1,
                background: color,
              }}
              onClick={() => !isCenter && handlePaint(idx)}
              disabled={isCenter}
              title={`${face}${r * 3 + c + 1}`}
              aria-label={`Sticker ${face}${r * 3 + c + 1} = ${ch}`}
            />
          );
        })}
      </div>

      <div className="vc-net-toolbar">
        <span className="vc-net-toolbar-label">{t('涂色', 'Paint')}:</span>
        {FACES.map(f => (
          <button
            key={f}
            type="button"
            className={`vc-net-swatch${activeColor === f ? ' is-active' : ''}`}
            style={{ background: COLOR_HEX[f] }}
            onClick={() => onActiveColorChange(f)}
            title={f}
            aria-label={`color ${f}`}
          >
            <span className="vc-net-swatch-letter">{f}</span>
          </button>
        ))}
        <button type="button" className="vc-net-btn" onClick={reset} title={t('重置为还原态', 'Reset to solved')}>
          <RotateCcw size={14} />
          <span>{t('重置', 'Reset')}</span>
        </button>
        <button
          type="button"
          className="vc-net-btn vc-net-btn-primary"
          disabled={!!validErr || facelet === SOLVED_FACELET}
          onClick={goSolver}
          title={validErr ?? t('用 cubeopt 求最优解', 'Solve optimally with cubeopt')}
        >
          <Sparkles size={14} />
          <span>{t('求最优解', 'Solve')}</span>
        </button>
      </div>

      {validErr && (
        <div className="vc-net-err">
          {t('当前状态非法:', 'Invalid state: ')}{validErr}
        </div>
      )}
    </div>
  );
}

const INLINE_CSS = `
.vc-net-paint {
  display: flex; flex-direction: column; align-items: center; gap: 0.75rem;
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
  cursor: default;
  border-color: rgba(0,0,0,0.7);
}
.vc-net-toolbar {
  display: flex; flex-wrap: wrap; align-items: center; gap: 0.4rem;
}
.vc-net-toolbar-label {
  font-size: 0.85rem; color: var(--text-muted, #aaa);
}
.vc-net-swatch {
  width: 30px; height: 30px;
  border: 2px solid rgba(255,255,255,0.2);
  border-radius: 5px; padding: 0;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: border-color 0.12s ease, transform 0.08s ease;
}
.vc-net-swatch:hover { transform: scale(1.08); }
.vc-net-swatch.is-active {
  border-color: var(--accent, #ff8800);
  box-shadow: 0 0 0 2px rgba(255,136,0,0.3);
}
.vc-net-swatch-letter {
  font-size: 0.75rem; font-weight: 700;
  text-shadow: 0 0 2px rgba(0,0,0,0.6), 0 0 2px rgba(0,0,0,0.6);
  color: rgba(0,0,0,0.85);
  pointer-events: none;
}
.vc-net-btn {
  display: inline-flex; align-items: center; gap: 0.3rem;
  background: var(--panel-sub, #2a2a2a);
  border: 1px solid var(--border, #444);
  color: var(--text); padding: 0.35rem 0.6rem;
  border-radius: 5px; font-size: 0.8rem; cursor: pointer;
}
.vc-net-btn:hover:not(:disabled) { border-color: var(--accent, #ff8800); }
.vc-net-btn:disabled { opacity: 0.45; cursor: not-allowed; }
.vc-net-btn-primary {
  background: var(--accent, #ff8800); color: #000;
  border-color: var(--accent, #ff8800); font-weight: 600;
}
.vc-net-err {
  font-size: 0.85rem; color: #ff8866;
  text-align: center; max-width: 28rem; line-height: 1.4;
}
`;
