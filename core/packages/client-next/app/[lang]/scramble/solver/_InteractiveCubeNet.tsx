'use client';

/**
 * Ported from packages/client/src/pages/visualcube/InteractiveCubeNet.tsx.
 * Adapted to client-next: react-router useNavigate → next/navigation useRouter.
 * Imports kociemba helpers from the local _kociemba/ copy.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Eraser, RotateCcw, Shuffle, Sparkles } from 'lucide-react';
import { SOLVED_FACELET, STICKER_SIBLINGS, validateFacelet, cubieToFacelet } from './facelet';
import { applySequence, solvedCubie } from './_kociemba/cube';
import i18n from '@/i18n/i18n-client';

export type FaceLetter = 'U' | 'R' | 'F' | 'D' | 'L' | 'B';
export type PaintColor = FaceLetter | 'X';

const FACES: FaceLetter[] = ['U', 'R', 'F', 'D', 'L', 'B'];

const COLOR_HEX: Record<FaceLetter, string> = {
  U: '#ffffff',
  F: '#44ee00',
  R: '#ff0000',
  D: '#f4f400',
  B: '#2266ff',
  L: '#ff8000',
};
const EMPTY_COLOR_HEX = '#5a5a5a';

const OPPOSITE_FACE: Record<FaceLetter, FaceLetter> = {
  U: 'D', D: 'U',
  R: 'L', L: 'R',
  F: 'B', B: 'F',
};

export const EMPTY_FACELET = (() => {
  const arr = new Array<string>(54).fill('X');
  FACES.forEach((c, i) => { arr[i * 9 + 4] = c; });
  return arr.join('');
})();

function randomLegalFacelet(): string {
  const idxs: number[] = [];
  for (let i = 0; i < 25; i++) {
    const m = Math.floor(Math.random() * 18);
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
  facelet: string;
  onChange: (next: string) => void;
  activeColor: PaintColor;
  onActiveColorChange: (c: PaintColor) => void;
  pixelSize: number;
  onSolve?: (facelet: string) => void;
  solveLabel?: { zh: string; en: string
    zhHant?: string;
 };
}

function friendlyValidErr(msg: string, isZh: boolean): string {
  const t = (z: string, e: string, zhHant?: string) => i18n.language === 'zh-Hant' ? (zhHant ?? z) : (isZh ? z : e);
  if (msg.includes('color counts != 9')) return t('每种颜色必须正好 9 格', 'Each color must appear exactly 9 times', "每種顏色必須正好 9 格");
  if (msg.includes('not in centers')) return t('出现了非中心色字符', 'Sticker color does not match any center', "出現了非中心色字元");
  if (msg.includes('corner permutation not bijective')) return t('某个角块出现两次(或缺失)', 'Some corner piece appears twice or is missing', "某個角塊出現兩次(或缺失)");
  if (msg.includes('edge permutation not bijective')) return t('某个棱块出现两次(或缺失)', 'Some edge piece appears twice or is missing', "某個稜塊出現兩次(或缺失)");
  if (msg.includes('corner orientation sum')) return t('单个角块被扭了 ±120°(角朝向之和必须是 3 的倍数)', 'A single corner is twisted (corner orientation invariant)', "單個角塊被扭了 ±120°(角朝向之和必須是 3 的倍數)");
  if (msg.includes('edge orientation sum')) return t('单个棱块被翻了(棱翻转之和必须是偶数)', 'A single edge is flipped (edge orientation invariant)', "單個稜塊被翻了(稜翻轉之和必須是偶數)");
  if (msg.includes('parity mismatch')) return t('角棱排列奇偶不一致(只有两个块对调是不可能的)', 'Corner/edge permutation parity mismatch — single 2-cycle swap is impossible', "角稜排列奇偶不一致(只有兩個塊對調是不可能的)");
  if (msg.includes('no matching piece') && msg.includes('corner')) return t('某个角的颜色组合不存在(角必须由相邻 3 个面组成)', 'A corner has colors that cannot belong to any real cubelet', "某個角的顏色組合不存在(角必須由相鄰 3 個面組成)");
  if (msg.includes('no matching piece') && msg.includes('edge')) return t('某个棱的颜色组合不存在(棱必须由相邻 2 个面组成)', 'An edge has colors that cannot belong to any real cubelet', "某個稜的顏色組合不存在(稜必須由相鄰 2 個面組成)");
  if (msg.includes('no U/D sticker')) return t('某个角没有 U/D 面颜色(每个角必须含 U 或 D)', 'A corner has no U/D sticker (every corner must include U or D)', "某個角沒有 U/D 面顏色(每個角必須含 U 或 D)");
  return msg;
}

export default function InteractiveCubeNet({
  facelet, onChange, activeColor, onActiveColorChange, pixelSize, onSolve, solveLabel,
}: InteractiveCubeNetProps) {
  const { i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
  const t = (zh: string, en: string, zhHant?: string) => i18n.language === 'zh-Hant' ? (zhHant ?? zh) : (isZh ? zh : en);
  const router = useRouter();

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

  const [rejectMsg, setRejectMsg] = useState<string | null>(null);
  const rejectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (rejectTimerRef.current) clearTimeout(rejectTimerRef.current); }, []);
  const flashReject = (msg: string) => {
    setRejectMsg(msg);
    if (rejectTimerRef.current) clearTimeout(rejectTimerRef.current);
    rejectTimerRef.current = setTimeout(() => setRejectMsg(null), 2500);
  };

  const ss = Math.max(10, Math.floor(pixelSize / 13));
  const totalW = ss * 12 + 16;
  const totalH = ss * 9 + 16;

  const stickers: { idx: number; face: FaceLetter; r: number; c: number }[] = [];
  for (const f of FACES) {
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        stickers.push({ idx: faceletIdx(f, r, c), face: f, r, c });
      }
    }
  }

  const handlePaint = (idx: number) => {
    if (activeColor !== 'X') {
      for (const sib of STICKER_SIBLINGS[idx]) {
        const sibColor = facelet[sib] as PaintColor;
        if (sibColor === 'X') continue;
        if (sibColor === activeColor) {
          flashReject(t(
            '一个角/棱块上不能有重复颜色',
            'A piece cannot have two stickers of the same color', "一個角/稜塊上不能有重複顏色"
          ));
          return;
        }
        if (OPPOSITE_FACE[sibColor] === activeColor) {
          flashReject(t(
            `一个角/棱块上不能同时含相对面颜色(${sibColor} 与 ${activeColor})`,
            `A piece cannot have opposite-face colors (${sibColor} and ${activeColor})`, `一個角/稜塊上不能同時含相對面顏色(${sibColor} 與 ${activeColor})`
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
    else router.push(`/scramble/solver?state=${facelet}`);
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
        <span className="vc-net-toolbar-label">{t('涂色', 'Paint', "塗色")}:</span>
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
        <button type="button" className="vc-net-btn" onClick={setClean} title={t('还原到 solved', 'Reset to solved', "還原到 solved")}>
          <RotateCcw size={14} />
          <span>{t('还原', 'Clean', "還原")}</span>
        </button>
        <button type="button" className="vc-net-btn" onClick={setRandom} title={t('随机合法状态(25 步随机 HTM)', 'Random legal state (25 random HTM moves)', "隨機合法狀態(25 步隨機 HTM)")}>
          <Shuffle size={14} />
          <span>{t('随机', 'Random', "隨機")}</span>
        </button>
        <button
          type="button"
          className="vc-net-btn vc-net-btn-primary"
          disabled={solveBlocked || facelet === SOLVED_FACELET}
          onClick={goSolver}
          title={validErr
            ?? (hasEmpty ? t('还有空缺颜色未填', 'Some stickers are still empty', "還有空缺顏色未填") : t('用 cubeopt 求最优解', 'Solve optimally with cubeopt', "用 cubeopt 求最優解"))}
        >
          <Sparkles size={14} />
          <span>{solveLabel ? ((i18n.language === 'zh-Hant' ? (solveLabel.zhHant ?? solveLabel.zh) : (i18n.language.startsWith('zh') ? solveLabel.zh : solveLabel.en))) : t('求最优解', 'Solve', "求最優解")}</span>
        </button>
      </div>

      {rejectMsg && (
        <div className="vc-net-err vc-net-err-flash">{rejectMsg}</div>
      )}
      {validErr && !rejectMsg && (
        <div className="vc-net-err">
          {t('当前状态非法:', 'Invalid state: ', "當前狀態非法:")}{validErr}
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
