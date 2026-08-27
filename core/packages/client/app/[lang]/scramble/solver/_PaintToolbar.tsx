'use client';

/**
 * Shared paint controls for the state painters (2D net + 3D cube, order 3 or 2).
 * Split in two so callers can stack the color palette under the canvas and
 * the action buttons (Empty/Clean/Random/Solve) below that:
 *   - PaintPalette: color swatches in a single horizontal row (wraps if narrow).
 *   - PaintActions: Empty/Clean/Random/Solve + the validity error / reject flash.
 */

import { useMemo, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import BoolToggle from '@/components/BoolToggle';
import { useT } from '@/hooks/useT';
import { tr } from '@/i18n/tr';
import {
  COLOR_HEX, CUBE3_PAINT, EMPTY_COLOR_HEX,
  type PaintColor, type FaceLetter, type PaintSpec,
} from './_paint-shared';

// Palette display order (left→right): white, yellow, green, blue, red, orange —
// then the gray "erase" swatch, which sits next to its 右键置灰 hint.
const PALETTE_ORDER: FaceLetter[] = ['U', 'D', 'F', 'B', 'R', 'L'];

export interface PaintPaletteProps {
  activeColor: PaintColor;
  onActiveColorChange: (c: PaintColor) => void;
  /** 每面色值;缺省 = 三阶那套 WCA 配色。斜转 / 金字塔走 tnoodle 自己的配色(与预览图一致)。 */
  colors?: Readonly<Record<FaceLetter, string>>;
  /** 哪几个面上色板;缺省 = 立方体 6 面。金字塔只有 F D L R 四面。 */
  faces?: readonly FaceLetter[];
}

export function PaintPalette({
  activeColor, onActiveColorChange, colors = COLOR_HEX, faces = PALETTE_ORDER,
}: PaintPaletteProps) {
  const t = useT();

  return (
    <div className="vc-paint-palette">
      <style>{PALETTE_CSS}</style>
      {faces.map((f) => (
        <button
          key={f}
          type="button"
          className={`vc-paint-swatch${activeColor === f ? ' is-active' : ''}`}
          style={{ background: colors[f] }}
          onClick={() => onActiveColorChange(f)}
          title={f}
          aria-label={`color ${f}`}
        />
      ))}
      <button
        key="X"
        type="button"
        className={`vc-paint-swatch vc-paint-swatch-empty${activeColor === 'X' ? ' is-active' : ''}`}
        style={{ background: EMPTY_COLOR_HEX }}
        onClick={() => onActiveColorChange('X')}
        title={t('空缺(灰)', 'Empty (gray)')}
        aria-label="empty"
      />
      <span className="vc-paint-empty-hint">{t('右键置灰', 'Right-click to erase')}</span>
    </div>
  );
}

export interface PaintActionsProps {
  facelet: string;
  /** Cube order + legality model. Defaults to 3×3. */
  spec?: PaintSpec;
  onChange: (next: string) => void;
  onSolve?: (facelet: string) => void;
  solveLabel?: { zh: string; en: string };
  /** Tooltip for the Solve button (defaults to the 3×3 cubeopt wording). */
  solveTitle?: { zh: string; en: string };
  /** A second action button after Solve, e.g. "derive solution" alongside "derive scramble". */
  onSecondaryAction?: (facelet: string) => void;
  secondaryActionLabel?: { zh: string; en: string };
  secondaryActionTitle?: { zh: string; en: string };
  /** Whether the secondary action is currently running (disables its button). */
  secondaryBusy?: boolean;
  /** Optional "optimal?" switch, plus a control that must stay directly after it. */
  optimalToggle?: { value: boolean; onChange: (v: boolean) => void; trailing?: ReactNode };
  /** Content placed directly after the final action button. */
  actionsTrailing?: ReactNode;
  /** Transient per-piece reject message (from usePainter), shown as a flash. */
  rejectMsg?: string | null;
  /** Hide the Solve button — the host renders its own (e.g. next to the solver's Solve). */
  hideSolve?: boolean;
  /** Render the Solve button as a plain button (no orange primary emphasis). */
  plainSolve?: boolean;
}

export function PaintActions({
  facelet, spec = CUBE3_PAINT, onChange, onSolve, solveLabel, solveTitle, onSecondaryAction, secondaryActionLabel, secondaryActionTitle,
  secondaryBusy, optimalToggle, actionsTrailing, rejectMsg, hideSolve, plainSolve,
}: PaintActionsProps) {
  const { i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
  const t = (zh: string, en: string) => (isZh ? zh : en);
  const router = useRouter();

  const hasEmpty = useMemo(() => facelet.includes('X'), [facelet]);
  const validErr = useMemo(() => {
    if (hasEmpty) return null;
    const raw = spec.validate(facelet);
    return raw ? spec.friendlyErr(raw, isZh) : null;
  }, [facelet, hasEmpty, isZh, spec]);
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
        <button
          type="button"
          className="vc-paint-btn"
          onClick={() => onChange(spec.empty)}
          title={spec.fixedCenters
            ? t('全部置灰(保留中心)', 'Clear all stickers (centers preserved)')
            : t('全部置灰', 'Clear all stickers')}
        >
          <span>{t('清空', 'Empty')}</span>
        </button>
        <button type="button" className="vc-paint-btn" onClick={() => onChange(spec.solved)} title={t('还原到 solved', 'Reset to solved')}>
          <span>{t('还原', 'Clean')}</span>
        </button>
        <button type="button" className="vc-paint-btn" onClick={() => onChange(spec.randomLegal())} title={t('随机合法状态', 'Random legal state')}>
          <span>{t('随机', 'Random')}</span>
        </button>
        {optimalToggle && (<>
          <BoolToggle
            value={optimalToggle.value}
            onChange={optimalToggle.onChange}
            label={t('最优', 'Optimal')}
          />
          {optimalToggle.trailing}
        </>)}
        {!hideSolve && (
          <button
            type="button"
            className={`vc-paint-btn${plainSolve ? '' : ' vc-paint-btn-primary'}`}
            disabled={solveBlocked || facelet === spec.solved}
            onClick={goSolve}
            title={validErr
              ?? (hasEmpty ? t('还有空缺颜色未填', 'Some stickers are still empty')
                : (solveTitle ? tr(solveTitle) : t('用 cubeopt 求最优解', 'Solve optimally with cubeopt')))}
          >
            <span>{solveLabel ? tr(solveLabel) : t('求最优解', 'Solve')}</span>
          </button>
        )}
        {onSecondaryAction && (
          <button
            type="button"
            className="vc-paint-btn"
            disabled={solveBlocked || secondaryBusy}
            onClick={() => onSecondaryAction(facelet)}
            title={validErr
              ?? (hasEmpty ? t('还有空缺颜色未填', 'Some stickers are still empty')
                : (secondaryActionTitle ? tr(secondaryActionTitle) : undefined))}
          >
            <span>{secondaryActionLabel ? tr(secondaryActionLabel) : t('求解法', 'Derive solution')}</span>
          </button>
        )}
        {actionsTrailing}
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
  display: flex; flex-flow: row wrap; align-items: center; justify-content: center;
  gap: 0.35rem 0.4rem;
}
/* Separate the "erase" swatch (last, next to its hint) from the six real colors. */
.vc-paint-swatch-empty { margin-left: 0.35rem; }
.vc-paint-swatch {
  width: 30px; height: 30px;
  border: 2px solid color-mix(in srgb, var(--foreground) 25%, transparent);
  border-radius: 5px; padding: 0;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: border-color 0.12s ease, transform 0.08s ease;
}
.vc-paint-swatch:hover { transform: scale(1.08); }
.vc-paint-swatch.is-active {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 30%, transparent);
}
.vc-paint-empty-hint {
  font-size: 0.72rem; color: var(--muted-foreground);
  white-space: nowrap; margin-left: 0.2rem;
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
/* 色值全走 globals.css 的 token(原来写的 --panel-sub / --border / --text 是不存在的 legacy
   token,浅色主题下落到深色 fallback、配上浅色 --text ≈ 黑字压深灰底,几乎看不见)。 */
.vc-paint-btn {
  display: inline-flex; align-items: center; gap: 0.3rem;
  background: var(--muted);
  border: 1px solid var(--border-default);
  color: var(--foreground); padding: 0.35rem 0.6rem;
  border-radius: 5px; font-size: 0.8rem; cursor: pointer;
}
.vc-paint-btn:hover:not(:disabled) { border-color: var(--accent); }
.vc-paint-btn:disabled { opacity: 0.45; cursor: not-allowed; }
.vc-paint-btn-primary {
  background: var(--accent); color: var(--accent-foreground);
  border-color: var(--accent); font-weight: 600;
}
.vc-paint-err {
  font-size: 0.85rem; color: var(--destructive);
  text-align: center; max-width: 28rem; line-height: 1.4;
}
.vc-paint-err-flash {
  background: color-mix(in srgb, var(--destructive) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--destructive) 45%, transparent);
  padding: 0.35rem 0.7rem;
  border-radius: 5px;
  animation: vcPaintFlash 0.18s ease-out;
}
.vc-paint-actions .bool-toggle-label {
  font-size: 0.8rem;
  color: var(--foreground);
}
@keyframes vcPaintFlash {
  from { transform: scale(0.96); opacity: 0; }
  to   { transform: scale(1); opacity: 1; }
}
`;
