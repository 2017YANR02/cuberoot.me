/**
 * Stack settings — 类型、持久化、世界 apply,以及独立的 KeymapModal。
 * 老 drawer 已搬进 PlayerControls 的 PuzzleSettings 面板。
 */
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import World from './cuber/world';
import CubeGroup from './cuber/group';
import Cubelet from './cuber/cubelet';
import { KEYMAP_GROUPS, KEYBOARD_ROWS, keyLabel, displayMove, type KeyMove } from './keymap';
import './setting-drawer.css';

export interface StackSettings {
  sensitivity: number;
  scale: number;
  perspective: number;
  speed: number;
  thickness: boolean;
  hollow: boolean;
  arrow: boolean;
  hint: boolean;
  /** 点打乱按钮:false=instant 应用,true=慢动画逐 move 播放 */
  animateScramble: boolean;
  /** 画布背景:false=纯色 (var --background),true=透明棋盘格 (twizzle 风格) */
  checkeredBg: boolean;
  /** 内核色 (frame + 内层 slice 填充板的颜色) */
  coreColor: string;
}

export const DEFAULT_SETTINGS: StackSettings = {
  sensitivity: 50,
  scale: 50,
  perspective: 50,
  speed: 50,
  thickness: true,
  hollow: false,
  arrow: false,
  hint: false,
  animateScramble: false,
  checkeredBg: false,
  coreColor: '#202020',
};

const STORAGE_KEY = 'stack.settings';

export function loadSettings(): StackSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<StackSettings>) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(s: StackSettings): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // ignore
  }
}

// 把 0~100 → 实际数值。scale 50 = 1.0 (upstream 默认), 范围 0.5 ~ 1.5。
function mapSensitivity(v: number): number { return 0.1 + (v / 100) * 1.4; }   // 0.1 ~ 1.5
function mapScale(v: number): number { return 0.5 + v / 100; }                  // 0.5 ~ 1.5
function mapPerspective(v: number): number { return 2 + (v / 100) * 8; }        // 2 ~ 10
// speed: 0=慢 100=快 → CubeGroup.frames (帧数,越小越快)。默认 50 = 30 帧 (现状)
function mapFrames(v: number): number { return Math.max(3, Math.round(60 - (v / 100) * 55)); }

export function applySettings(world: World, s: StackSettings): void {
  world.controller.sensitivity = mapSensitivity(s.sensitivity);
  // scale 由滚轮直接改 world.scale + 防抖反算 settings (round 损失 ≤0.005),
  // 这里如果差距在 round 误差内就别回写,避免滚动途中突跳
  const targetScale = mapScale(s.scale);
  if (Math.abs(world.scale - targetScale) > 0.006) {
    world.scale = targetScale;
  }
  world.perspective = mapPerspective(s.perspective);
  CubeGroup.frames = mapFrames(s.speed);
  world.cube.arrow = s.arrow;
  world.cube.instancedRenderer.thickness = s.thickness;
  world.cube.instancedRenderer.hollow = s.hollow;
  world.cube.instancedRenderer.hint = s.hint;
  // 内核色: frame (CORE + CORE_BASIC,前者 Phong 后者 Basic) + 内层 slice 填充板共享
  Cubelet.CORE.color.set(s.coreColor);
  Cubelet.CORE_BASIC.color.set(s.coreColor);
  Cubelet._PANEL_MAT.color.set(s.coreColor);
  world.dirty = true;
  world.cube.dirty = true;
  world.resize();
}

export function Slider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="stack-slider">
      <div className="stack-slider-row">
        <span>{label}</span>
        <span className="stack-slider-val">{value}</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

export function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="stack-toggle">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}

interface KeymapModalProps {
  open: boolean;
  onClose: () => void;
  keymap: Record<string, KeyMove>;
  onKeymapChange: (km: Record<string, KeyMove>) => void;
  onResetKeymap: () => void;
}

export function KeymapModal({ open, onClose, keymap, onKeymapChange, onResetKeymap }: KeymapModalProps) {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const t = (zh: string, en: string) => (isZh ? zh : en);
  const [editingCode, setEditingCode] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (editingCode) setEditingCode(null);
        else onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, editingCode]);

  if (!open) return null;

  return (
    <div className="stack-keymap-modal-backdrop" onClick={onClose}>
      <div className="stack-keymap-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={t('键盘快捷键', 'Keyboard shortcuts')}>
        <header className="stack-keymap-modal-head">
          <h2>{t('键盘 / 鼠标快捷键', 'Keyboard / mouse shortcuts')}</h2>
          <button onClick={onClose} title={t('关闭', 'Close')}><X size={16} /></button>
        </header>
        <div className="stack-keymap-modal-body">
          <div className="stack-keymap-hint">
            {editingCode
              ? t(`为 ${keyLabel(editingCode)} 键选择动作 (ESC 取消)`, `Choose move for ${keyLabel(editingCode)} (ESC to cancel)`)
              : t('点击键盘格修改对应快捷键', 'Click a key to rebind')}
          </div>

          <div className="stack-keyboard">
            {KEYBOARD_ROWS.map((row, ri) => (
              <div key={ri} className="stack-keyboard-row">
                {row.map((code) => {
                  const m = keymap[code];
                  const editing = editingCode === code;
                  return (
                    <button
                      key={code}
                      type="button"
                      className={'stack-key' + (editing ? ' editing' : '') + (!m ? ' empty' : '')}
                      onClick={() => setEditingCode(editing ? null : code)}
                    >
                      <span className="stack-key-label">{keyLabel(code)}</span>
                      <span className="stack-key-move">{m ? displayMove(m) : '·'}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          {editingCode && (
            <div className="stack-keymap-picker">
              {KEYMAP_GROUPS.map((g) => (
                <div key={g.zh} className="stack-keymap-picker-group">
                  <div className="stack-keymap-title">{isZh ? g.zh : g.en}</div>
                  <div className="stack-keymap-picker-row">
                    {g.moves.map((m) => (
                      <button
                        key={displayMove(m)}
                        type="button"
                        className="stack-keymap-picker-btn"
                        onClick={() => {
                          onKeymapChange({ ...keymap, [editingCode]: m });
                          setEditingCode(null);
                        }}
                      >{displayMove(m)}</button>
                    ))}
                  </div>
                </div>
              ))}
              <div className="stack-keymap-picker-actions">
                <button
                  type="button"
                  className="stack-keymap-picker-clear"
                  disabled={!keymap[editingCode]}
                  onClick={() => {
                    const next = { ...keymap };
                    delete next[editingCode];
                    onKeymapChange(next);
                    setEditingCode(null);
                  }}
                >{t('清除该键', 'Clear this key')}</button>
                <button
                  type="button"
                  className="stack-keymap-picker-cancel"
                  onClick={() => setEditingCode(null)}
                >{t('取消', 'Cancel')}</button>
              </div>
            </div>
          )}

          <div className="stack-keymap-misc">
            <span>{t('其它 (固定):', 'Misc (fixed):')}</span>
            <span>{t('撤销', 'Undo')} <kbd>Ctrl</kbd>+<kbd>Z</kbd> <kbd>⌫</kbd></span>
            <span>{t('重做', 'Redo')} <kbd>Ctrl</kbd>+<kbd>Y</kbd></span>
          </div>

          <div className="stack-keymap-title" style={{ marginTop: 12 }}>{t('鼠标', 'Mouse')}</div>
          <div className="stack-mouse-help">
            <div>
              <span className="stack-mouse-op">{t('单击 sticker', 'Click a sticker')}</span>
              <span className="stack-mouse-act">{t('转该 sticker 所在切片', 'Rotate the slice through it')}</span>
            </div>
            <div>
              <span className="stack-mouse-op">&nbsp;&nbsp;{t('— U 面 → z 切片', '— U face → z slice')}</span>
              <span className="stack-mouse-act">{t('点最前一行 = F,中央 = S,最后 = B', 'front row = F, middle = S, back = B\'')}</span>
            </div>
            <div>
              <span className="stack-mouse-op">&nbsp;&nbsp;{t('— F / R 面 → y 切片', '— F / R face → y slice')}</span>
              <span className="stack-mouse-act">{t('点最上 = U,中央 = E,最下 = D', 'top = U, middle = E, bottom = D\'')}</span>
            </div>
            <div>
              <span className="stack-mouse-op"><kbd>Shift</kbd> {t('+ 单击 / 右键单击', '+ click / right click')}</span>
              <span className="stack-mouse-act">{t('逆时针', 'Counter-clockwise')}</span>
            </div>
            <div>
              <span className="stack-mouse-op">{t('拖动 sticker', 'Drag sticker')}</span>
              <span className="stack-mouse-act">{t('沿手势方向转该层', 'Rotate slice along drag direction')}</span>
            </div>
            <div>
              <span className="stack-mouse-op">{t('拖动空白', 'Drag empty area')}</span>
              <span className="stack-mouse-act">{t('整体旋转视角', 'Rotate whole cube')}</span>
            </div>
            <div>
              <span className="stack-mouse-op">{t('滚轮', 'Wheel')}</span>
              <span className="stack-mouse-act">{t('缩放', 'Zoom')}</span>
            </div>
          </div>

          <button type="button" className="stack-keymap-reset" onClick={onResetKeymap}>
            {t('恢复默认快捷键', 'Reset shortcuts to defaults')}
          </button>
        </div>
      </div>
    </div>
  );
}

