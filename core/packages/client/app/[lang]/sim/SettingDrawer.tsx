/**
 * Sim settings — 类型、持久化、世界 apply,以及独立的 KeymapModal。
 * 老 drawer 已搬进 PlayerControls 的 PuzzleSettings 面板。
 */
'use client';

import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { CUBE_FILL } from '@/lib/cube-colors';
import PillToggle from '@/components/PillToggle/PillToggle';
import World from './engine/world';
import { puzzleCaps } from './simCaps';
import { timing } from './engine/tweenTiming';
import Cubelet from './engine/nxn/cubelet';
import { applyDebugStructureColors, applyEngineBodyOverlay } from './engine/debugColors';
import { applyStickerThickness } from './engine/stickerThickness';
import { applyHintFacelets } from './engine/hintFacelets';
import { loadLogoTexture, SITE_LOGO_SRC } from './engine/nxn/logo';
import { KEYMAP_GROUPS, KEYBOARD_ROWS, keyLabel, displayMove, type KeyMove } from './keymap';
import './setting-drawer.css';
import { useT } from "@/hooks/useT";
import { tr } from '@/i18n/tr';

/** Canvas background. 'auto' = solid, follows the page theme (var --background);
 *  'white'/'dark' = fixed solid; 'checkerDark'/'checkerLight' = fixed transparent
 *  checkerboard (twizzle style). */
export type SimBoardBg = 'auto' | 'white' | 'dark' | 'checkerDark' | 'checkerLight';

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
  /** 播放解法时是否逐步转动动画:true=每步平滑转动(默认),false=瞬切到下一步(无转动动画)。
   *  仅影响连续「播放」;单步前进/后退/光标定位本就瞬切。 */
  animatePlayback: boolean;
  /** 是否常显方位字母(NxN/SQ1 为 U/D/L/R/F/B 六面;角/棱/面转拼图显对应角/棱/面标签):
   *  true=一直显示(等同拖动视角时浮现的方位标签,但常驻),false=仅拖动时浮现(默认)。 */
  faceLabels: boolean;
  /** 画布背景。见 SimBoardBg。 */
  boardBg: SimBoardBg;
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
  /** 开发者调试(所有魔方):挖块 —— 隐藏一次转动的会动块组,露出核心与相邻块内壁。
   *  统一的三选一(挖角/挖面/挖棱)选择器,每个魔方都显示。引擎目前只实现各魔方的"原生"
   *  转动元素(`setCarve(on)` 布尔),所以选了非原生元素时是占位空操作,等引擎补上按元素挖块;
   *  NxN/SQ1 无可掀起的转动块组 → 任何选项都空操作。 */
  debugCarve: 'off' | 'corner' | 'face' | 'edge';
  /** 内核色 (frame + 内层 slice 填充板的颜色) */
  coreColor: string;
  /** 6 面色 (WCA 默认) */
  faceColors: { U: string; D: string; L: string; R: string; F: string; B: string };
  /** 原核 (raw / stickerless body):
   *  - 'normal' = 默认。黑色内核 + 平面贴片。
   *  - 'raw'    = 整块实色,去黑核 —— 每块塑料本身即颜色,棱块沿对角线劈成双色、
   *               角块三色(取每个 fragment 最近可见面的颜色),还原真实无贴纸魔方。
   *  仅 NxN 实现(用户指定先做 NxN);其他魔方为占位空操作,以后按需扩展。 */
  coreStyle: 'normal' | 'raw';
  /** Mirror Cube colour mode: 'single' (raw body, one colour — solve by shape) or
   *  'six' (standard sticker scheme). Mirror-only; ignored by other puzzles. */
  mirrorColorMode?: 'single' | 'six';
  /** Mirror Cube single colour (used when mirrorColorMode==='single'). */
  mirrorColor?: string;
  /** 顶面 U 中心 logo:
   *  - 'none'   = 无(默认)
   *  - 'site'   = 本站 logo(public/favicon.svg)
   *  - 'custom' = 用户上传(见 customLogo)
   *  仅 NxN 奇数阶有正中心块时显示;偶数阶 / 非 NxN 无中心 → 不显示。 */
  logo: 'none' | 'site' | 'custom';
  /** logo='custom' 时用户上传图的 data URL(已降采样压缩,空串=未上传)。 */
  customLogo: string;
  /** 实时消步:手势 / 键盘转动追加到解法框时,自动 fold/抵消重复转动
   *  (做了 R 再做 R' → 框里 R 出现后又消失)。默认开。 */
  liveReduce: boolean;
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

/** Mirror Cube default single colour (classic gold — you solve by shape, not colour). */
export const MIRROR_DEFAULT_COLOR = '#E3B23C';
function mirrorFaces(c: string): { U: string; D: string; L: string; R: string; F: string; B: string } {
  return { U: c, D: c, L: c, R: c, F: c, B: c };
}

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
  animatePlayback: true,
  faceLabels: true,
  boardBg: 'auto',
  lockView: false,
  backView: false,
  viewMode: 'cube',
  playbackMode: 'moves',
  dragEmpty: 'rotate',
  holdPartialTurn: false,
  debugStructureColor: false,
  debugCarve: 'off',
  coreColor: '#202020',
  faceColors: { ...DEFAULT_FACE_COLORS },
  coreStyle: 'normal',
  mirrorColorMode: 'single',
  mirrorColor: MIRROR_DEFAULT_COLOR,
  logo: 'none',
  customLogo: '',
  liveReduce: true,
};

const STORAGE_KEY = 'sim.settings';

export function loadSettings(): SimSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<SimSettings> & { checkeredBg?: boolean };
    const merged = { ...DEFAULT_SETTINGS, ...parsed };
    // Migrate the old boolean checkeredBg → boardBg (true = the dark twizzle grid;
    // false stays the theme-following solid, i.e. 'auto').
    if (!('boardBg' in parsed) && parsed.checkeredBg) merged.boardBg = 'checkerDark';
    delete (merged as { checkeredBg?: boolean }).checkeredBg;
    // debugCarve was a boolean (carve the puzzle's native element on/off); it's now a
    // 3-way element pick. Old boolean values → reset to 'off'.
    if (typeof merged.debugCarve !== 'string') merged.debugCarve = 'off';
    // 原核 / logo: 旧版本无此键 → spread 已给默认值;非法值兜回默认。
    if (merged.coreStyle !== 'raw' && merged.coreStyle !== 'normal') merged.coreStyle = 'normal';
    if (merged.logo !== 'site' && merged.logo !== 'custom' && merged.logo !== 'none') merged.logo = 'none';
    if (typeof merged.customLogo !== 'string') merged.customLogo = '';
    return merged;
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

/** The in-house Three.js engine puzzles (everything that is NOT an order-N NxN cube).
 *  Their geometry is baked at construction with no InstancedRenderer, so style toggles
 *  (立体贴片 / 镂空 / structure colors) are applied generically off userData tags. */
const ENGINE_BODY_PUZZLES = new Set<string>(['sq1', 'ivy', 'dino', 'redi', 'rex', 'heli', 'skewb', 'pyraminx', 'megaminx', 'fto']);

export function applySettings(world: World, s: SimSettings, prev?: SimSettings): void {
  world.controller.sensitivity = mapSensitivity(s.sensitivity);
  world.controller.dragEmpty = s.dragEmpty;
  world.controller.holdPartial = s.holdPartialTurn;
  // 「动画」关 → 手动拖层瞬间吸附(无中间角度);见 Controller.instantTurns。
  world.controller.instantTurns = !s.animatePlayback;
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
  timing.frames = mapFrames(s.speed);
  // Hint-facelet backdrop color (CSS --background) — shared by the NxN renderer and
  // the generic engine hint so ghosts fade into the page background in both themes.
  const hintBg = typeof window !== 'undefined'
    ? getComputedStyle(document.documentElement).getPropertyValue('--background').trim()
    : '';
  if (!ENGINE_BODY_PUZZLES.has(world.puzzleKind as string)) {
    // NxN: sticker thickness / hollow / hint / face colors live on the InstancedRenderer.
    const cube = world.cube as import('./engine/nxn/cube').default;
    cube.arrow = s.arrow;
    // 「动画」关 → 撤销/重做也瞬切(手动转/拖/单击各自路径已 fast)。
    cube.twister.instantTurns = !s.animatePlayback;
    cube.instancedRenderer.thickness = s.thickness;
    cube.instancedRenderer.hollow = s.hollow;
    cube.instancedRenderer.hint = s.hint;
    if (hintBg) cube.instancedRenderer.setHintBackdrop(hintBg);
    // 内核色: frame (CORE + CORE_BASIC,前者 Phong 后者 Basic) + 内层 slice 填充板共享
    Cubelet.CORE.color.set(s.coreColor);
    Cubelet.CORE_BASIC.color.set(s.coreColor);
    Cubelet._PANEL_MAT.color.set(s.coreColor);
    // Mirror Cube colours: 'single' = one raw-body colour (solve by shape), 'six' =
    // standard sticker scheme. Kept separate from the NxN coreStyle/faceColors so
    // switching back to a normal cube restores the user's NxN scheme.
    const mirrorSingle = cube.isMirror && (s.mirrorColorMode ?? 'single') === 'single';
    const faces = mirrorSingle ? mirrorFaces(s.mirrorColor ?? MIRROR_DEFAULT_COLOR) : s.faceColors;
    cube.instancedRenderer.setFaceColors(faces);
    // Structure-coloring overlay (NxN path). MUST run after the block above — it
    // re-sets frame/inner materials every call (the `hollow` setter writes
    // unconditionally), so applying here captures the fresh base + restores it
    // correctly. No-op when off.
    applyDebugStructureColors(world.cube, s.debugStructureColor);
    // 原核 (raw/stickerless body). Applied LAST so it overrides the frame/inner material
    // that hollow + structure-color just set (raw wins when on). Off-state restores the
    // hollow-appropriate material. Super-order cubes no-op inside setRawCore.
    //
    // Mirror cube grooves are gated by coreStyle:
    //  - 普通: raw gold/colour body + independent 内核色 grooves (border=1, gold + dark gaps).
    //  - 原核: grooves follow the body colour (border=0, seamless) — 内核色跟随镜面配色;
    //          the faceless centre cubie falls back to the mirror colour too.
    // Single mode is always raw; 原核 also switches six-colour mode to a seamless raw body.
    const mirrorRaw = cube.isMirror && s.coreStyle === 'raw';
    const rawOn = cube.isMirror ? (mirrorSingle || s.coreStyle === 'raw') : (s.coreStyle === 'raw');
    const rawBorder = cube.isMirror && s.coreStyle === 'normal';
    const rawCoreColor = mirrorRaw ? (s.mirrorColor ?? MIRROR_DEFAULT_COLOR) : s.coreColor;
    cube.instancedRenderer.setRawCore(rawOn, faces, rawCoreColor, rawBorder);
    // 顶面 U 中心 logo(仅 NxN 奇数阶有正中心块;偶数阶在 setLogo 内部隐藏)。
    const logoTex = s.logo === 'site'
      ? loadLogoTexture(SITE_LOGO_SRC, () => { world.dirty = true; })
      : (s.logo === 'custom' && s.customLogo)
        ? loadLogoTexture(s.customLogo, () => { world.dirty = true; })
        : null;
    cube.setLogo(logoTex);
  } else {
    // In-house engine puzzles (SQ1 / Ivy / Dino / Redi / Rex / Heli / Skewb): their
    // sticker thickness + body materials are baked at construction (no InstancedRenderer),
    // so 立体贴片 / 镂空 / structure-colors are applied generically off userData tags.
    applyStickerThickness(world.cube, s.thickness);
    // 原核 (raw/stickerless body): generic across the in-house engines — paints each
    // body from its sibling stickers' colors + hides the tiles. Raw > debug > hollow.
    applyEngineBodyOverlay(world.cube, s.hollow, s.debugStructureColor, s.coreStyle === 'raw');
    applyHintFacelets(world.cube, s.hint, hintBg);
  }
  // Carve: hide one move's moving group to inspect the core + neighbours' inner walls.
  // The UI offers a uniform 挖角/挖面/挖棱 pick on every puzzle, but the engine carves
  // only the puzzle's NATIVE turning element today (setCarve is a boolean; the element
  // is intrinsic). So we carve iff the picked element matches the native one — a
  // non-native pick is a placeholder until per-element carving lands. NxN / SQ1 declare
  // no carve element → always off. Native element is the single source in simCaps.
  const nativeCarve = puzzleCaps(world.puzzleKind).carve ?? null;
  (world.cube as { setCarve?: (on: boolean) => void })
    .setCarve?.(s.debugCarve !== 'off' && s.debugCarve === nativeCarve);
  world.dirty = true;
  world.cube.dirty = true;
  world.resize();
}

/** 把视角姿态(整体朝向 / 平移 / 缩放 / 透视)硬复位到 `s` 对应值,无视 applySettings 的
 *  prev-diff 保留逻辑。「恢复默认」要连用户拖出来的朝向 / 平移 / 缩放一起清掉 —— 这些
 *  直接写在 world.scene.rotation / panX/Y / scale 上(不进 settings),光把 settings 重置
 *  成默认值时若 viewAngle/viewGradient 已等于默认,applySettings 会跳过、留住旧姿态。 */
export function resetWorldView(world: World, s: SimSettings): void {
  world.scene.rotation.set(mapPitch(s.viewGradient), mapYaw(s.viewAngle), 0);
  world.scene.updateMatrix();
  world.panX = 0;
  world.panY = 0;
  world.scale = mapScale(s.scale);
  world.perspective = mapPerspective(s.perspective);
  world.dirty = true;
  world.resize();
}

export function Slider({ label, value, onChange, disabled, title }: { label: string; value: number; onChange: (v: number) => void; disabled?: boolean; title?: string }) {
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
    <label className={'sim-slider' + (disabled ? ' sim-slider--disabled' : '')} aria-disabled={disabled || undefined} title={title}>
      <div className="sim-slider-row">
        <span>{label}</span>
        <input
          type="number"
          className="sim-slider-val"
          min={0}
          max={100}
          step={1}
          value={draft}
          disabled={disabled}
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
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

export function Toggle({ label, value, onChange, disabled, title }: { label: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean; title?: string }) {
  // 复用全站 PillToggle(iOS 风滑钮开关),取代原生复选框 —— 开 / 关一眼可辨。
  // disabled = 该拼图暂不支持此功能 → 变灰 + 不可点(滑钮自身 :disabled 已置灰,这里只灰标签)。
  return (
    <span className={'sim-toggle' + (disabled ? ' sim-toggle--disabled' : '')} title={title}>
      <span>{label}</span>
      <PillToggle value={value} onChange={onChange} ariaLabel={label} disabled={disabled} />
    </span>
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

