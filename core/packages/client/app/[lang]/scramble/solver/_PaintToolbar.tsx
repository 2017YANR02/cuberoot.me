'use client';

/**
 * Shared paint controls for the 3×3 state painters (2D net + 3D cube).
 * Split in two so callers can place the color palette beside the canvas and
 * the action buttons (Empty/Clean/Random/Solve) below, spanning both:
 *   - PaintPalette: color swatches, stacked one per row.
 *   - PaintActions: Empty/Clean/Random/Solve + the validity error / reject flash.
 */

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Eraser, RotateCcw, Shuffle, Sparkles } from 'lucide-react';
import { tr } from '@/i18n/tr';
import { validateFacelet } from './facelet';
import {
  COLOR_HEX, EMPTY_COLOR_HEX, EMPTY_FACELET, SOLVED_FACELET,
  friendlyValidErr, randomLegalFacelet, type PaintColor, type FaceLetter,
} from './_paint-shared';

// Palette display order (top→bottom): gray, white, yellow, green, blue, red, orange.
const PALETTE_ORDER: FaceLetter[] = ['U', 'D', 'F', 'B', 'R', 'L'];

export interface PaintPaletteProps {
  activeColor: PaintColor;
  onActiveColorChange: (c: PaintColor) => void;
}

export function PaintPalette({ activeColor, onActiveColorChange }: PaintPaletteProps) {
  const { i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
  const t = (zh: string, en: string) => (isZh ? zh : en);

  return (
    <div className="vc-paint-palette">
      <style>{PALETTE_CSS}</style>
      <button
        key="X"
        type="button"
        className={`vc-paint-swatch vc-paint-swatch-empty${activeColor === 'X' ? ' is-active' : ''}`}
        style={{ background: EMPTY_COLOR_HEX }}
        onClick={() => onActiveColorChange('X')}
        title={t('空缺(灰)', 'Empty (gray)')}
        aria-label="empty"
      />
      {PALETTE_ORDER.map((f) => (
        <button
          key={f}
          type="button"
          className={`vc-paint-swatch${activeColor === f ? ' is-active' : ''}`}
          style={{ background: COLOR_HEX[f] }}
          onClick={() => onActiveColorChange(f)}
          title={f}
          aria-label={`color ${f}`}
        />
      ))}
    </div>
  );
}

export interface PaintActionsProps {
  facelet: string;
  onChange: (next: string) => void;
  onSolve?: (facelet: string) => void;
  solveLabel?: { zh: string; en: string };
  /** Transient per-piece reject message (from usePainter), shown as a flash. */
  rejectMsg?: string | null;
  /** Hide the Solve button — the host renders its own (e.g. next to the solver's Solve). */
  hideSolve?: boolean;
}

export function PaintActions({
  facelet, onChange, onSolve, solveLabel, rejectMsg, hideSolve,
}: PaintActionsProps) {
  const { i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
  const t = (zh: string, en: string) => (isZh ? zh : en);
  const router = useRouter();

  const hasEmpty = useMemo(() => facelet.includes('X'), [facelet]);
  const validErr = useMemo(() => {
    if (hasEmpty) return null;
    const raw = validateFacelet(facelet);
    return raw ? friendlyValidErr(raw, isZh) : null;
  }, [facelet, hasEmpty, isZh]);
  const solveBlocked = hasEmpty || !!validErr;

  const goSolve = () => {
    if (solveBlocked) return;
    if (onSolve) onSolve(facelet);
    else router.push(`/scramble/solver?state=${facelet}`);
  };

  return (
    <div className="vc-paint-controls">
      <style>{ACTIONS_CSS}</style>
      <div className="vc-paint-actions">
        <button type="button" className="vc-paint-btn" onClick={() => onChange(EMPTY_FACELET)} title={t('全部置灰(保留中心)', 'Clear all stickers (centers preserved)')}>
          <Eraser size={14} />
          <span>{t('清空', 'Empty')}</span>
        </button>
        <button type="button" className="vc-paint-btn" onClick={() => onChange(SOLVED_FACELET)} title={t('还原到 solved', 'Reset to solved')}>
          <RotateCcw size={14} />
          <span>{t('还原', 'Clean')}</span>
        </button>
        <button type="button" className="vc-paint-btn" onClick={() => onChange(randomLegalFacelet())} title={t('随机合法状态(25 步随机 HTM)', 'Random legal state (25 random HTM moves)')}>
          <Shuffle size={14} />
          <span>{t('随机', 'Random')}</span>
        </button>
        {!hideSolve && (
          <button
            type="button"
            className="vc-paint-btn vc-paint-btn-primary"
            disabled={solveBlocked || facelet === SOLVED_FACELET}
            onClick={goSolve}
            title={validErr
              ?? (hasEmpty ? t('还有空缺颜色未填', 'Some stickers are still empty') : t('用 cubeopt 求最优解', 'Solve optimally with cubeopt'))}
          >
            <Sparkles size={14} />
            <span>{solveLabel ? tr(solveLabel) : t('求最优解', 'Solve')}</span>
          </button>
        )}
      </div>

      {rejectMsg && (
        <div className="vc-paint-err vc-paint-err-flash">{rejectMsg}</div>
      )}
      {validErr && !rejectMsg && (
        <div className="vc-paint-err">
          {t('当前状态非法:', 'Invalid state: ')}{validErr}
        </div>
      )}
    </div>
  );
}

const PALETTE_CSS = `
.vc-paint-palette {
  display: flex; flex-direction: column; align-items: center; gap: 0.35rem;
}
.vc-paint-swatch {
  width: 30px; height: 30px;
  border: 2px solid rgba(255,255,255,0.2);
  border-radius: 5px; padding: 0;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: border-color 0.12s ease, transform 0.08s ease;
}
.vc-paint-swatch:hover { transform: scale(1.08); }
.vc-paint-swatch.is-active {
  border-color: var(--accent, #ff8800);
  box-shadow: 0 0 0 2px rgba(255,136,0,0.3);
}
`;

const ACTIONS_CSS = `
.vc-paint-controls {
  display: flex; flex-direction: column; align-items: center; gap: 0.6rem;
  width: 100%;
}
.vc-paint-actions {
  display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 0.4rem;
}
.vc-paint-btn {
  display: inline-flex; align-items: center; gap: 0.3rem;
  background: var(--panel-sub, #2a2a2a);
  border: 1px solid var(--border, #444);
  color: var(--text); padding: 0.35rem 0.6rem;
  border-radius: 5px; font-size: 0.8rem; cursor: pointer;
}
.vc-paint-btn:hover:not(:disabled) { border-color: var(--accent, #ff8800); }
.vc-paint-btn:disabled { opacity: 0.45; cursor: not-allowed; }
.vc-paint-btn-primary {
  background: var(--accent, #ff8800); color: #000;
  border-color: var(--accent, #ff8800); font-weight: 600;
}
.vc-paint-err {
  font-size: 0.85rem; color: #ff8866;
  text-align: center; max-width: 28rem; line-height: 1.4;
}
.vc-paint-err-flash {
  background: rgba(255,80,80,0.12);
  border: 1px solid rgba(255,120,80,0.45);
  color: #ffb38a;
  padding: 0.35rem 0.7rem;
  border-radius: 5px;
  animation: vcPaintFlash 0.18s ease-out;
}
@keyframes vcPaintFlash {
  from { transform: scale(0.96); opacity: 0; }
  to   { transform: scale(1); opacity: 1; }
}
`;
