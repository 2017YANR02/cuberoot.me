/**
 * Sim settings — 类型、持久化、世界 apply,以及独立的 KeymapModal。
 * 老 drawer 已搬进 PlayerControls 的 PuzzleSettings 面板。
 */
'use client';

import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { CUBE_FILL } from '@/lib/cube-colors';
import World from './cuber/world';
import CubeGroup from './cuber/group';
import Cubelet from './cuber/cubelet';
import { applyDebugStructureColors } from './cuber/debugColors';
import { KEYMAP_GROUPS, KEYBOARD_ROWS, keyLabel, displayMove, type KeyMove } from './keymap';
import './setting-drawer.css';
import i18n from '@/i18n/i18n-client';
import { useT } from "@/hooks/useT";
import { tr } from '@/i18n/tr';

export interface SimSettings {
  sensitivity: number;
  scale: number;
  perspective: number;
  /** 左右 (yaw) — scene.rotation.y。50=正前方,0=左侧 90°,100=右侧 90°。默认 30 (跟 upstream cuber 一致) */
  viewAngle: number;
  /** 上下 (pitch) — scene.rotation.x。50=平视,0=俯视 90°,100=仰视 90°。默认 33 (跟 upstream cuber 一致) */
  viewGradient: number;
  speed: number;
  thickness: boolean;
  hollow: boolean;
  arrow: boolean;
  hint: boolean;
  /** 点打乱按钮:false=instant 应用,true=慢动画逐 move 播放 */
  animateScramble: boolean;
  /** 画布背景:false=纯色 (var --background),true=透明棋盘格 (twizzle 风格) */
  checkeredBg: boolean;
  /** 锁定大小+位置:禁滚轮/捏合缩放 + 中右键/双指平移;旋转视角和转动仍可用 */
  lockView: boolean;
  /** 背面视图小窗:右上角第二个相机从背后看魔方。NxN/SQ1 走自有第二渲染器,
   *  twisty (金字塔/斜转/五魔) 走 cubing.js 原生 backView。 */
  backView: boolean;
  /** NxN 主视图形态:'cube' = 立体 3D(默认);'net' = 2D 平面展开图(可拖动转层)。
   *  仅 NxN 生效,SQ1 / twisty 忽略。 */
  viewMode: 'cube' | 'net';
  /** 解法回放模式:
   *  - 'moves'     = 默认。cube 起点 = setup,alg 向前播,看 alg 把魔方拧成什么。
   *  - 'algorithm' = cube 终点 = setup(setup 为空 → 还原态),起点 = setup·alg⁻¹,
   *                  看 alg 把打乱"解开"。等价 cubing.js setupAnchor='end'。 */
  playbackMode: 'moves' | 'algorithm';
  /** 拖魔方背景空白:
   *  - 'orbit'  = 自由切视角,跨 ±π/2 时自动 commit y/y'/x/x' 进 move list (NxN);
   *  - 'rotate' = 整体转 (NxN 记 x/y/z 进 move list,松手 snap 90°);
   *  - 'view'   = 纯切视角,不 commit 任何 move,绿面是 F 就一直是 F。 */
  dragEmpty: 'orbit' | 'rotate' | 'view';
  /** 开发者调试(任意魔方):开启后拖拽转动实时跟手,松手即冻结在当前部分角度,
   *  不补完也不弹回(逐帧看中间态用)。再次拖拽 / 关掉此项 / 复位都会清掉冻结态。 */
  holdPartialTurn: boolean;
  /** 开发者调试(任意魔方):内部结构着色 —— 把每片的 body(壳 / 块 / frame)染青、
   *  核心(球核 / 内填充箱)染品红,色贴片不动。转动开口时一眼看清露出的是实体结构
   *  还是 void/bug。见 cuber/debugColors.ts。 */
  debugStructureColor: boolean;
  /** 开发者调试(枫叶):挖角 —— 隐藏 R 对应的角块(3 片花瓣 + 壳体),露出球核与
   *  相邻 3 个中心的内壁,像把真枫叶拆掉一个角,用来检查内部结构。见 IvyCube.setCarveCorner。 */
  debugCarveCorner: boolean;
  /** 内核色 (frame + 内层 slice 填充板的颜色) */
  coreColor: string;
  /** 6 面色 (WCA 默认) */
  faceColors: { U: string; D: string; L: string; R: string; F: string; B: string };
}

/** WCA 标准 6 面色 — 取自全站单一来源 lib/cube-colors */
export const DEFAULT_FACE_COLORS: { U: string; D: string; L: string; R: string; F: string; B: string } = {
  U: CUBE_FILL.U,
  D: CUBE_FILL.D,
  L: CUBE_FILL.L,
  R: CUBE_FILL.R,
  F: CUBE_FILL.F,
  B: CUBE_FILL.B,
};

export const DEFAULT_SETTINGS: SimSettings = {
  sensitivity: 50,
  scale: 50,
  perspective: 50,
  viewAngle: 30,
  viewGradient: 33,
  speed: 50,
  thickness: true,
  hollow: false,
  arrow: false,
  hint: false,
  animateScramble: false,
  checkeredBg: false,
  lockView: false,
  backView: false,
  viewMode: 'cube',
  playbackMode: 'moves',
  dragEmpty: 'view',
  holdPartialTurn: false,
  debugStructureColor: false,
  debugCarveCorner: false,
  coreColor: '#202020',
  faceColors: { ...DEFAULT_FACE_COLORS },
};

const STORAGE_KEY = 'sim.settings';

export function loadSettings(): SimSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<SimSettings>) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(s: SimSettings): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // ignore
  }
}

// 把 0~100 → 实际数值。scale 50 = 1.0 (upstream 默认), 范围 0.5 ~ 1.5。
function mapSensitivity(v: number): number { return 0.05 + (v / 100) * 0.7; }   // 0.05 ~ 0.75 (整体 -50%)
/** 拖空白 orbit 用的 radians-per-pixel。v=50 → 0.01 (历史硬编码默认),v∈[0,100] → [0.00125, 0.01875]。
 *  NxN/SQ1 共享。Twisty 由 cubing.js 自管不接入。 */
export function mapOrbitK(v: number): number { return mapSensitivity(v) / 40; }
/** SQ1 turn-drag 角速度缩放。v=100 → 4.0,v=50 → ~2.13,v=0 → ~0.27。整体放大 4×
 *  让 turn 跟得上手指 — 原 1:1 polar atan2 实际拖完一格需要大段位移,放大后更跟手。
 *  贴片不再严格跟手指,符合"灵敏度低 = 转得慢"的 slider 语义。 */
export function mapTurnDragFactor(v: number): number { return mapSensitivity(v) / 0.75 * 4; }
function mapScale(v: number): number { return 0.5 + v / 100; }                  // 0.5 ~ 1.5
function mapPerspective(v: number): number { return 2 + (v / 100) * 8; }        // 2 ~ 10
// upstream cuber 的镜头映射:50 居中,两端到 ±π/2
function mapYaw(v: number): number { return ((v / 50 - 1) * Math.PI) / 2; }     // scene.rotation.y
function mapPitch(v: number): number { return ((1 - v / 50) * Math.PI) / 2; }   // scene.rotation.x
// speed: 0=慢 100=快 → CubeGroup.frames (帧数,越小越快)。默认 50 = 30 帧 (现状)
function mapFrames(v: number): number { return Math.max(3, Math.round(60 - (v / 100) * 55)); }

export function applySettings(world: World, s: SimSettings, prev?: SimSettings): void {
  world.controller.sensitivity = mapSensitivity(s.sensitivity);
  world.controller.dragEmpty = s.dragEmpty;
  world.controller.holdPartial = s.holdPartialTurn;
  // scale 由滚轮直接改 world.scale + 防抖反算 settings (round 损失 ≤0.005),
  // 这里如果差距在 round 误差内就别回写,避免滚动途中突跳
  const targetScale = mapScale(s.scale);
  if (Math.abs(world.scale - targetScale) > 0.006) {
    world.scale = targetScale;
  }
  world.perspective = mapPerspective(s.perspective);
  // 视角:只在用户实际改 slider 时同步,否则保留 drag-orbit 累积出来的姿态。
  // 首次 apply (prev undefined) 也同步,作为初始姿态。
  if (!prev || prev.viewAngle !== s.viewAngle) {
    world.scene.rotation.y = mapYaw(s.viewAngle);
  }
  if (!prev || prev.viewGradient !== s.viewGradient) {
    world.scene.rotation.x = mapPitch(s.viewGradient);
  }
  world.scene.updateMatrix();
  // face hints (拖动时浮现的 U/D/L/R/F/B 色板) 跟主 face colors 走。
  world.faceHints.setFaceColors(s.faceColors);
  CubeGroup.frames = mapFrames(s.speed);
  // NxN-only options skipped for SQ1 / Ivy / Dino (sticker thickness / hollow / hint /
  // face colors are baked at construction time for their non-NxN geometry).
  if (world.puzzleKind !== 'sq1' && world.puzzleKind !== 'ivy' && world.puzzleKind !== 'dino') {
    const cube = world.cube as import('./cuber/cube').default;
    cube.arrow = s.arrow;
    cube.instancedRenderer.thickness = s.thickness;
    cube.instancedRenderer.hollow = s.hollow;
    cube.instancedRenderer.hint = s.hint;
    if (typeof window !== 'undefined') {
      const bg = getComputedStyle(document.documentElement).getPropertyValue('--background').trim();
      if (bg) cube.instancedRenderer.setHintBackdrop(bg);
    }
    // 内核色: frame (CORE + CORE_BASIC,前者 Phong 后者 Basic) + 内层 slice 填充板共享
    Cubelet.CORE.color.set(s.coreColor);
    Cubelet.CORE_BASIC.color.set(s.coreColor);
    Cubelet._PANEL_MAT.color.set(s.coreColor);
    cube.instancedRenderer.setFaceColors(s.faceColors);
  }
  // Developer "structure coloring" overlay (any puzzle). MUST run after the NxN
  // block above — that block re-sets frame/inner materials every call (the
  // `hollow` setter writes unconditionally), so applying here lets the overlay
  // capture the fresh base + restore it correctly. No-op when off.
  applyDebugStructureColors(world.cube, s.debugStructureColor);
  // Carve out (hide) one corner's moving group to inspect the core + neighbors'
  // inner walls — corner-turning puzzles only (Ivy / Dino).
  if (world.puzzleKind === 'ivy') {
    (world.cube as import('./cuber/ivy/IvyCube').default).setCarveCorner(s.debugCarveCorner);
  } else if (world.puzzleKind === 'dino') {
    (world.cube as import('./cuber/dino/DinoCube').default).setCarveCorner(s.debugCarveCorner);
  }
  world.dirty = true;
  world.cube.dirty = true;
  world.resize();
}

export function Slider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const [draft, setDraft] = useState<string>(String(value));
  useEffect(() => { setDraft(String(value)); }, [value]);
  const commit = () => {
    const n = Number(draft);
    if (!Number.isFinite(n)) { setDraft(String(value)); return; }
    const clamped = Math.max(0, Math.min(100, Math.round(n)));
    setDraft(String(clamped));
    if (clamped !== value) onChange(clamped);
  };
  return (
    <label className="sim-slider">
      <div className="sim-slider-row">
        <span>{label}</span>
        <input
          type="number"
          className="sim-slider-val"
          min={0}
          max={100}
          step={1}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            else if (e.key === 'Escape') { setDraft(String(value)); (e.target as HTMLInputElement).blur(); }
          }}
        />
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
    <label className="sim-toggle">
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
  const t = useT();
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
    <div className="sim-keymap-modal-backdrop" onClick={onClose}>
      <div className="sim-keymap-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={t('键盘快捷键', 'Keyboard shortcuts')}>
        <header className="sim-keymap-modal-head">
          <h2>{t('键盘 / 鼠标快捷键', 'Keyboard / mouse shortcuts')}</h2>
          <button onClick={onClose} title={t('关闭', 'Close')}><X size={16} /></button>
        </header>
        <div className="sim-keymap-modal-body">
          <div className="sim-keymap-hint">
            {editingCode
              ? t(`为 ${keyLabel(editingCode)} 键选择动作 (ESC 取消)`, `Choose move for ${keyLabel(editingCode)} (ESC to cancel)`)
              : t('点击键盘格修改对应快捷键', 'Click a key to rebind')}
          </div>

          <div className="sim-keyboard">
            {KEYBOARD_ROWS.map((row, ri) => (
              <div key={ri} className="sim-keyboard-row">
                {row.map((code) => {
                  const m = keymap[code];
                  const editing = editingCode === code;
                  return (
                    <button
                      key={code}
                      type="button"
                      className={'sim-key' + (editing ? ' editing' : '') + (!m ? ' empty' : '')}
                      onClick={() => setEditingCode(editing ? null : code)}
                    >
                      <span className="sim-key-label">{keyLabel(code)}</span>
                      <span className="sim-key-move">{m ? displayMove(m) : '·'}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          {editingCode && (
            <div className="sim-keymap-picker">
              {KEYMAP_GROUPS.map((g) => (
                <div key={g.zh} className="sim-keymap-picker-group">
                  <div className="sim-keymap-title">{tr(g)}</div>
                  <div className="sim-keymap-picker-row">
                    {g.moves.map((m) => (
                      <button
                        key={displayMove(m)}
                        type="button"
                        className="sim-keymap-picker-btn"
                        onClick={() => {
                          onKeymapChange({ ...keymap, [editingCode]: m });
                          setEditingCode(null);
                        }}
                      >{displayMove(m)}</button>
                    ))}
                  </div>
                </div>
              ))}
              <div className="sim-keymap-picker-actions">
                <button
                  type="button"
                  className="sim-keymap-picker-clear"
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
                  className="sim-keymap-picker-cancel"
                  onClick={() => setEditingCode(null)}
                >{t('取消', 'Cancel')}</button>
              </div>
            </div>
          )}

          <div className="sim-keymap-misc">
            <span>{t('其它 (固定):', 'Misc (fixed):')}</span>
            <span>{t('撤销', 'Undo')} <kbd>Ctrl</kbd>+<kbd>Z</kbd> <kbd>⌫</kbd></span>
            <span>{t('重做', 'Redo')} <kbd>Ctrl</kbd>+<kbd>Y</kbd></span>
          </div>

          <div className="sim-keymap-title" style={{ marginTop: 12 }}>{t('鼠标', 'Mouse')}</div>
          <div className="sim-mouse-help">
            <div>
              <span className="sim-mouse-op">{t('单击 sticker', 'Click a sticker')}</span>
              <span className="sim-mouse-act">{t('转该 sticker 所在切片', 'Rotate the slice through it')}</span>
            </div>
            <div>
              <span className="sim-mouse-op">&nbsp;&nbsp;{t('— U 面 → z 切片', '— U face → z slice')}</span>
              <span className="sim-mouse-act">{t('点最前一行 = F,中央 = S,最后 = B', 'front row = F, middle = S, back = B\'')}</span>
            </div>
            <div>
              <span className="sim-mouse-op">&nbsp;&nbsp;{t('— F / R 面 → y 切片', '— F / R face → y slice')}</span>
              <span className="sim-mouse-act">{t('点最上 = U,中央 = E,最下 = D', 'top = U, middle = E, bottom = D\'')}</span>
            </div>
            <div>
              <span className="sim-mouse-op"><kbd>Shift</kbd> {t('+ 单击 / 右键单击', '+ click / right click')}</span>
              <span className="sim-mouse-act">{t('逆时针', 'Counter-clockwise')}</span>
            </div>
            <div>
              <span className="sim-mouse-op"><kbd>Alt</kbd> {t('+ 单击 / 拖动', '+ click / drag')}</span>
              <span className="sim-mouse-act">{t('宽层转动 (深度=宽度):内层 → Rw/3Lw/...,中线 → x/y/z', 'Wide turn (depth = width): inner → Rw/3Lw/..., center → x/y/z')}</span>
            </div>
            <div>
              <span className="sim-mouse-op">{t('拖动 sticker', 'Drag sticker')}</span>
              <span className="sim-mouse-act">{t('沿手势方向转该层', 'Rotate slice along drag direction')}</span>
            </div>
            <div>
              <span className="sim-mouse-op">{t('拖动空白', 'Drag empty area')}</span>
              <span className="sim-mouse-act">{t('整体旋转视角', 'Rotate whole cube')}</span>
            </div>
            <div>
              <span className="sim-mouse-op">{t('滚轮', 'Wheel')}</span>
              <span className="sim-mouse-act">{t('缩放', 'Zoom')}</span>
            </div>
          </div>

          <button type="button" className="sim-keymap-reset" onClick={onResetKeymap}>
            {t('恢复默认快捷键', 'Reset shortcuts to defaults')}
          </button>
        </div>
      </div>
    </div>
  );
}

