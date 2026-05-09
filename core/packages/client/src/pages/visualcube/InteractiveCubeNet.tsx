/**
 * 可交互填色 3x3 net — VisualCube editor 在 view=net 模式下用。
 *
 * 数据约定:54-char URFDLB facelet 字符串,U/R/F/D/L/B 为面色,'X' 为空缺(灰)。
 *
 * 行为:
 *   - 点击 sticker → 上色为当前 active 颜色(可为面色或灰)
 *   - 6 色 + 灰 swatch 选当前色
 *   - Empty / Clean / Random 三个预设;Random 走随机 HTM 序列保证合法
 *   - "Solve this state" 按钮 — 把状态发到 /scramble/solver?state=…(状态含灰则禁用)
 *
 * v1 只支持 3x3。其他 size/puzzle 由 caller 走原 CubingPreview。
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Eraser, RotateCcw, Shuffle, Sparkles } from 'lucide-react';
import { SOLVED_FACELET, STICKER_SIBLINGS, validateFacelet, cubieToFacelet } from '../scramble/solver/facelet';
import { applySequence, solvedCubie } from '../timer/scramble/kociemba/cube';

export type FaceLetter = 'U' | 'R' | 'F' | 'D' | 'L' | 'B';
/** 涂色色号:6 个面 + 'X' 表示"空缺"(灰)。 */
export type PaintColor = FaceLetter | 'X';

const FACES: FaceLetter[] = ['U', 'R', 'F', 'D', 'L', 'B'];

// cubing.js 默认 3x3 配色(白顶绿前) — 与 TwistyPlayer 渲染完全一致
// 源:cubing/puzzle-geometry/index.js defaultPlatonicColorSchemes()[6]
const COLOR_HEX: Record<FaceLetter, string> = {
  U: '#ffffff', // White
  F: '#44ee00', // Green
  R: '#ff0000', // Red
  D: '#f4f400', // Yellow
  B: '#2266ff', // Blue
  L: '#ff8000', // Orange
};
const EMPTY_COLOR_HEX = '#5a5a5a';

const OPPOSITE_FACE: Record<FaceLetter, FaceLetter> = {
  U: 'D', D: 'U',
  R: 'L', L: 'R',
  F: 'B', B: 'F',
};

/** 全空状态:6 个中心保留(决定面身份),其余 48 格 'X'。 */
export const EMPTY_FACELET = (() => {
  const arr = new Array<string>(54).fill('X');
  FACES.forEach((c, i) => { arr[i * 9 + 4] = c; });
  return arr.join('');
})();

/** 随机合法状态 — 25 步 HTM 随机序列应用到 solved cube,保证三大不变量。 */
function randomLegalFacelet(): string {
  const idxs: number[] = [];
  for (let i = 0; i < 25; i++) {
    const m = Math.floor(Math.random() * 18);
    // 不重复同面;前两步同轴时第三步不再同轴第一面
    if (idxs.length > 0 && Math.floor(m / 3) === Math.floor(idxs[idxs.length - 1] / 3)) {
      i--; continue;
    }
    if (idxs.length > 1
      && Math.floor(m / 3) % 3 === Math.floor(idxs[idxs.length - 1] / 3) % 3
      && Math.floor(m / 3) === Math.floor(idxs[idxs.length - 2] / 3)) {
      i--; continue;
    }
    idxs.push(m);
  }
  return cubieToFacelet(applySequence(solvedCubie(), idxs));
}

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
  facelet: string;             // 54 字符,'X' 表示空缺
  onChange: (next: string) => void;
  activeColor: PaintColor;
  onActiveColorChange: (c: PaintColor) => void;
  pixelSize: number;           // 整图宽度(像素),用于自适应 sticker 大小
  /** 自定义 "Solve" 行为。默认导航到 /scramble/solver?state=... */
  onSolve?: (facelet: string) => void;
  /** 自定义 Solve 按钮文案。 */
  solveLabel?: { zh: string; en: string };
}

export default function InteractiveCubeNet({
  facelet, onChange, activeColor, onActiveColorChange, pixelSize, onSolve, solveLabel,
}: InteractiveCubeNetProps) {
  const { i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
  const t = (zh: string, en: string) => (isZh ? zh : en);
  const navigate = useNavigate();

  // 含 'X' 的状态不送 kociemba(faceletToCubie 会抛);只在全部填满后才校验合法性。
  const hasEmpty = useMemo(() => facelet.includes('X'), [facelet]);
  const rawValidErr = useMemo(
    () => hasEmpty ? null : validateFacelet(facelet),
    [facelet, hasEmpty],
  );
  const validErr = useMemo(
    () => rawValidErr ? friendlyValidErr(rawValidErr, isZh) : null,
    [rawValidErr, isZh],
  );
  const solveBlocked = hasEmpty || !!validErr;

  // 同块违规临时提示(2.5s 自动消失)
  const [rejectMsg, setRejectMsg] = useState<string | null>(null);
  const rejectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (rejectTimerRef.current) clearTimeout(rejectTimerRef.current); }, []);
  const flashReject = (msg: string) => {
    setRejectMsg(msg);
    if (rejectTimerRef.current) clearTimeout(rejectTimerRef.current);
    rejectTimerRef.current = setTimeout(() => setRejectMsg(null), 2500);
  };

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
    // 涂灰(擦除)无条件允许;否则查同块伙伴 sticker 颜色:
    //   - 同色 → 一个角/棱不可能两个面相同
    //   - 相对面色(U/D, R/L, F/B)→ 物理上不存在这种角/棱片
    if (activeColor !== 'X') {
      for (const sib of STICKER_SIBLINGS[idx]) {
        const sibColor = facelet[sib] as PaintColor;
        if (sibColor === 'X') continue;
        if (sibColor === activeColor) {
          flashReject(t(
            '一个角/棱块上不能有重复颜色',
            'A piece cannot have two stickers of the same color',
          ));
          return;
        }
        if (OPPOSITE_FACE[sibColor] === activeColor) {
          flashReject(t(
            `一个角/棱块上不能同时含相对面颜色(${sibColor} 与 ${activeColor})`,
            `A piece cannot have opposite-face colors (${sibColor} and ${activeColor})`,
          ));
          return;
        }
      }
    }
    setRejectMsg(null);
    const arr = facelet.split('');
    arr[idx] = activeColor;
    onChange(arr.join(''));
  };

  const setClean = () => onChange(SOLVED_FACELET);
  const setEmpty = () => onChange(EMPTY_FACELET);
  const setRandom = () => onChange(randomLegalFacelet());

  const goSolver = () => {
    if (solveBlocked) return;
    if (onSolve) onSolve(facelet);
    else navigate(`/scramble/solver?state=${facelet}`);
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
          const ch = facelet[idx] as PaintColor;
          const color = ch === 'X' ? EMPTY_COLOR_HEX : (COLOR_HEX[ch] ?? '#404040');
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
        <button
          key="X"
          type="button"
          className={`vc-net-swatch vc-net-swatch-empty${activeColor === 'X' ? ' is-active' : ''}`}
          style={{ background: EMPTY_COLOR_HEX }}
          onClick={() => onActiveColorChange('X')}
          title={t('空缺(灰)', 'Empty (gray)')}
          aria-label="empty"
        >
          <span className="vc-net-swatch-letter vc-net-swatch-letter-empty">?</span>
        </button>
        <button type="button" className="vc-net-btn" onClick={setEmpty} title={t('全部置灰(保留中心)', 'Clear all stickers (centers preserved)')}>
          <Eraser size={14} />
          <span>{t('清空', 'Empty')}</span>
        </button>
        <button type="button" className="vc-net-btn" onClick={setClean} title={t('还原到 solved', 'Reset to solved')}>
          <RotateCcw size={14} />
          <span>{t('还原', 'Clean')}</span>
        </button>
        <button type="button" className="vc-net-btn" onClick={setRandom} title={t('随机合法状态(25 步随机 HTM)', 'Random legal state (25 random HTM moves)')}>
          <Shuffle size={14} />
          <span>{t('随机', 'Random')}</span>
        </button>
        <button
          type="button"
          className="vc-net-btn vc-net-btn-primary"
          disabled={solveBlocked || facelet === SOLVED_FACELET}
          onClick={goSolver}
          title={validErr
            ?? (hasEmpty ? t('还有空缺颜色未填', 'Some stickers are still empty') : t('用 cubeopt 求最优解', 'Solve optimally with cubeopt'))}
        >
          <Sparkles size={14} />
          <span>{solveLabel ? (isZh ? solveLabel.zh : solveLabel.en) : t('求最优解', 'Solve')}</span>
        </button>
      </div>

      {rejectMsg && (
        <div className="vc-net-err vc-net-err-flash">{rejectMsg}</div>
      )}
      {validErr && !rejectMsg && (
        <div className="vc-net-err">
          {t('当前状态非法:', 'Invalid state: ')}{validErr}
        </div>
      )}
    </div>
  );
}

/**
 * 把 validateFacelet 的英文技术错误转成对终端用户友好的双语短句。
 * 触发时机:用户已填满 54 格,但角朝向/棱翻转/排列奇偶等不变量不成立。
 */
function friendlyValidErr(msg: string, isZh: boolean): string {
  const zh = (s: string) => s;
  const en = (s: string) => s;
  const t = (z: string, e: string) => isZh ? zh(z) : en(e);
  if (msg.includes('color counts != 9')) return t('每种颜色必须正好 9 格', 'Each color must appear exactly 9 times');
  if (msg.includes('not in centers')) return t('出现了非中心色字符', 'Sticker color does not match any center');
  if (msg.includes('corner permutation not bijective')) return t('某个角块出现两次(或缺失)', 'Some corner piece appears twice or is missing');
  if (msg.includes('edge permutation not bijective')) return t('某个棱块出现两次(或缺失)', 'Some edge piece appears twice or is missing');
  if (msg.includes('corner orientation sum')) return t('单个角块被扭了 ±120°(角朝向之和必须是 3 的倍数)', 'A single corner is twisted (corner orientation invariant)');
  if (msg.includes('edge orientation sum')) return t('单个棱块被翻了(棱翻转之和必须是偶数)', 'A single edge is flipped (edge orientation invariant)');
  if (msg.includes('parity mismatch')) return t('角棱排列奇偶不一致(只有两个块对调是不可能的)', 'Corner/edge permutation parity mismatch — single 2-cycle swap is impossible');
  if (msg.includes('no matching piece') && msg.includes('corner')) return t('某个角的颜色组合不存在(角必须由相邻 3 个面组成)', 'A corner has colors that cannot belong to any real cubelet');
  if (msg.includes('no matching piece') && msg.includes('edge')) return t('某个棱的颜色组合不存在(棱必须由相邻 2 个面组成)', 'An edge has colors that cannot belong to any real cubelet');
  if (msg.includes('no U/D sticker')) return t('某个角没有 U/D 面颜色(每个角必须含 U 或 D)', 'A corner has no U/D sticker (every corner must include U or D)');
  return msg;
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
  color: rgba(0,0,0,0.85);
  pointer-events: none;
}
.vc-net-swatch-letter-empty {
  color: rgba(255,255,255,0.85);
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
.vc-net-err-flash {
  background: rgba(255,80,80,0.12);
  border: 1px solid rgba(255,120,80,0.45);
  color: #ffb38a;
  padding: 0.35rem 0.7rem;
  border-radius: 5px;
  animation: vcNetFlash 0.18s ease-out;
}
@keyframes vcNetFlash {
  from { transform: scale(0.96); opacity: 0; }
  to   { transform: scale(1); opacity: 1; }
}
`;
