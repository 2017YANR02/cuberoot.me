'use client';

import { SlidersHorizontal } from '@app-foundation/icons/lucide';
import CollapsibleSection from './CollapsibleSection';
import SimAppearancePresets from './SimAppearancePresets';
import PictureCubeEditor, { PictureFaceMiniNet } from './PictureCubeEditor';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type World from './engine/world';
import { GHOST_DEFAULT_FACE_COLORS } from '@cuberoot/puzzle-render-core/engine/ghost/ghostGeometry';
import { Slider, ValueField, OrbitPad, Toggle, resetWorldView, DEFAULT_FACE_COLORS, MIRROR_DEFAULT_COLOR, persistPictureFaces, saveSettings, cuberLightingActive, type SimSettings, type SimBoardBg, type SliderUnit } from './SettingDrawer';
import { CUBER_APPEARANCE } from './engine/define';
import { useRequireMembership } from '@/hooks/useRequireMembership';
import { useAuthStore } from '@/lib/auth-store';
import { defaultPlatonicColorSchemes } from '@/lib/puzzle-geometry/colors';
import { fileToLogoDataUrl } from './engine/nxn/logo';
import { countPictureFaces, fileToPictureFaceDataUrl, type PictureFaces } from './engine/nxn/pictureCube';
import { resolveCaps } from './simCaps';
import SwatchCell, { SwatchPopup } from './SwatchCell';
import { ROOM_THEMES, normalizeRoomTheme, roomCubeActive } from './room-themes';
import type { SimPuzzle } from './puzzleOptions';
import { LoadingIndicator } from '@/components/LoadingIndicator';

// 五魔方 12 面色 —— 复用 vendored puzzle-geometry 的十二面体配色(单一源,不另造)。
const MEGAMINX_COLORS = Object.values(defaultPlatonicColorSchemes()[12]) as string[];
/** 按小写去重,保序;让各调色板拼接预设 + 12 色时不出现重复格。 */
function dedupeColors(cs: string[]): string[] {
  const seen = new Set<string>();
  return cs.filter((c) => { const k = c.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
}

const CORE_COLOR_PRESETS: string[] = dedupeColors([
  '#202020', '#EE0000', '#FFA100', '#FFFFFF', '#FEFE00', '#00D800', '#0000F2',
  ...MEGAMINX_COLORS,
]);

// Mirror Cube single-colour presets — classic gold / silver first, then tints + the 12 Megaminx colours.
const MIRROR_COLOR_PRESETS: string[] = dedupeColors([
  '#E3B23C', '#C0C0C0', '#EE0000', '#00A0E0', '#00C060', '#B060E0',
  ...MEGAMINX_COLORS,
]);

// Face-colour presets — the WCA 6 then the 12 Megaminx colours, for a rich per-face palette.
const FACE_COLOR_PRESETS: string[] = dedupeColors([
  DEFAULT_FACE_COLORS.U, DEFAULT_FACE_COLORS.L, DEFAULT_FACE_COLORS.F,
  DEFAULT_FACE_COLORS.R, DEFAULT_FACE_COLORS.B, DEFAULT_FACE_COLORS.D,
  ...MEGAMINX_COLORS,
]);

const CUBER_FACE_COLORS = CUBER_APPEARANCE.faces;

// 甲油预设(经典美甲色系:正红 / 酒红 / 粉 / 裸 / 白 / 黑 / 蓝 / 薄荷 / 丁香 / 金;
// 物理甲油色,非主题灰阶)。底色与渐变第二色共用同一板。
const NAIL_COLOR_PRESETS: string[] = dedupeColors([
  '#C21807', '#7B1F3A', '#F48FB1', '#E8C4B0', '#F5F0EA', '#212121',
  '#1565C0', '#7FD8C4', '#B39DDB', '#D4AF37',
]);
/** 从自然甲切到自定义时 trigger 色块的兜底显示色(未选前);选色即覆盖。 */
const NAIL_DEFAULT_COLOR = '#C21807';

const FACE_ORDER = ['U', 'L', 'F', 'R', 'B', 'D'] as const;
const FACE_LABELS_ZH: Record<typeof FACE_ORDER[number], string> = {
  U: '顶', D: '底', L: '左', R: '右', F: '前', B: '后',
};

/** 模式 + 取色合并下拉:把一个「特殊模式」(镜面六色 / 内核原核)与单色取色收进一个菜单。
 *  trigger 普通态显当前色块、特殊态显特殊图标格;面板顶部一个特殊项 + 自定义取色 + 预设色板。
 *  选色 = 退出特殊模式并用该色;选特殊项 = 进特殊模式。 */
function ModeColorSelect({
  special = false, color, presets, specialTitle, specialSwatchClass,
  onPickColor, onPickSpecial, title, t,
}: {
  /** 特殊模式(镜面六色 / 内核原核)。不传 special 系列即退化成普通取色下拉(面色用)。 */
  special?: boolean;
  color: string;
  presets: string[];
  specialTitle?: string;
  specialSwatchClass?: string;
  onPickColor: (c: string) => void;
  onPickSpecial?: () => void;
  title: string;
  t: (zh: string, en: string) => string;
}) {
  const specialSwatch = specialSwatchClass ? <span className={'sim-swatch-box ' + specialSwatchClass} /> : null;
  return (
    <SwatchPopup
      title={title}
      trigger={special && specialSwatch ? specialSwatch : <span className="sim-swatch-box" style={{ background: color }} />}
    >
      {(close) => (
        <>
          {onPickSpecial && specialSwatch && (
            <button
              type="button"
              className={'sim-swatch' + (special ? ' active' : '')}
              title={specialTitle}
              onClick={() => { onPickSpecial(); close(); }}
            >
              {specialSwatch}
            </button>
          )}
          <SwatchCell
            color={color}
            title={t('自定义', 'Custom')}
            custom
            onPick={onPickColor}
          />
          {presets.map((c) => (
            <SwatchCell
              key={c}
              color={c}
              title={c}
              active={!special && c.toLowerCase() === color.toLowerCase()}
              onClick={() => { onPickColor(c); close(); }}
            />
          ))}
        </>
      )}
    </SwatchPopup>
  );
}

function ColorRow({
  label, children, action, trailing, disabled, title,
}: {
  label: string;
  children: ReactNode;
  action?: { label: string; title?: string; onClick: () => void };
  /** 色块右侧附加控件(如内核色行的「原核」开关)。 */
  trailing?: ReactNode;
  /** 该拼图暂不支持此配色 → 变灰 + 不可点(pointer-events:none 兜住所有色块按钮)。 */
  disabled?: boolean;
  title?: string;
}) {
  return (
    <div className={'sim-color-row' + (disabled ? ' sim-color-row--disabled' : '')} aria-disabled={disabled || undefined} title={title}>
      <span className="sim-color-row-label">{label}</span>
      {/* trailing(如「原核」开关)紧贴标签右侧,再到色块 */}
      {trailing}
      {action && (
        <button type="button" className="sim-face-color-reset" onClick={action.onClick} title={action.title}>
          {action.label}
        </button>
      )}
      <div className="sim-swatch-list">{children}</div>
    </div>
  );
}

/** 外观区的百分比滑条(内核不透明度 / 贴纸不透明度 / 黑边)。行式与 ColorRow 一致
 *  —— 标签、控件、右侧读数,不支持该拼图时整行灰化 + 滑条 disabled。
 *  读数是可打字的数字框(与上方 Slider 同一个 ValueField):拖不准的值直接输入。 */
function PercentRow({
  label, value, onChange, min = 0, max = 100, step = 1, disabled, title,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <div className={'sim-color-row sim-percent-row' + (disabled ? ' sim-color-row--disabled' : '')} aria-disabled={disabled || undefined} title={title}>
      <span className="sim-color-row-label">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <ValueField
        display={value}
        // 显示位数跟着步长走:整步 → 整数(100),半步 → 一位小数(黑边 12.5)。
        decimals={Number.isInteger(step) ? 0 : 1}
        min={min}
        max={max}
        step={step}
        suffix="%"
        disabled={disabled}
        commit={(n) => {
          const q = Math.min(max, Math.max(min, Math.round(n / step) * step));
          if (q !== value) onChange(q);
          return q;
        }}
      />
    </div>
  );
}

/** 滑条数字框的真实单位(内部仍存 0..100,见 SliderUnit):
 *  - 缩放 → 倍率:引擎 world.scale = 0.5 + v/100;cubing.js 用 cameraDistance [9,3] 逼近同档感受。
 *  - 左右/上下 → 旋转角度(度):引擎 scene.rotation ±90°;cubing.js 经度全程 ±180°(纬度同 ±90°),
 *    所以左右按渲染路径二选一。上下正值 = 俯视(相机在上)。 */
// 灵敏度 → 相对默认(滑杆 50)的倍率。它同时驱动三种手感 —— 拖贴纸转层的角速度
// (controller.sensitivity)、拖空白转视角的 rad/px(mapOrbitK)、SQ1 / SQ2 / SQ4 拖拽(mapTurnDragFactor)
// —— 三者都是 mapSensitivity(v) 的常数倍,所以只有"相对默认几倍"对三条路径同时精确;
// 标成 °/px 之类的物理量只有转视角那条对得上,拖贴纸会对不上(它还受透视/缩放影响)。
// mapSensitivity 是几何映射(每 25 格 ×2),倍率 = 2^((v-50)/25),0.25×~4×。
const UNIT_SENS: SliderUnit = { to: (v) => Math.pow(2, (v - 50) / 25), from: (m) => 50 + 25 * Math.log2(m), min: 0.25, max: 4, step: 0.05, decimals: 2, suffix: '×' };
const UNIT_SCALE: SliderUnit = { to: (v) => 0.5 + v / 100, from: (m) => (m - 0.5) * 100, min: 0.5, max: 1.5, step: 0.05, decimals: 2, suffix: '×' };
// 透视 → 35mm 等效焦距:引擎是 dolly-zoom(distance = 取景半径×p,p = 2 + v×0.08,FOV 反向
// 补偿定画幅),竖直 FOV = 2·atan(1/p) ⇔ 全画幅(半高 12mm)焦距 f = 12p = 24 + 0.96v mm。
// 24mm 广角畸变强 → 120mm 长焦近正交。仅引擎路径(cubing.js 拼图此滑条本就禁用)。
const UNIT_FOCAL: SliderUnit = { to: (v) => 24 + v * 0.96, from: (f) => (f - 24) / 0.96, min: 24, max: 120, step: 1, decimals: 0, suffix: 'mm' };
// 视角盘的度数框:约定「右 = 正(看右面)」→ 显示符号相对内部值翻转(默认 viewAngle=30
// 从旧 −36° 变 +36°)。内部 0..100 与引擎 mapYaw / twisty cameraLongitude 全不变,纯显示层。
// pad·90(引擎)/ pad·180(twisty)= (50−v)·1.8 / (50−v)·3.6,与 padX=(50−v)/50 同号。
const UNIT_YAW_ENGINE: SliderUnit = { to: (v) => (50 - v) * 1.8, from: (d) => 50 - d / 1.8, min: -90, max: 90, step: 1, decimals: 0, suffix: '°' };
const UNIT_YAW_TWISTY: SliderUnit = { to: (v) => (50 - v) * 3.6, from: (d) => 50 - d / 3.6, min: -180, max: 180, step: 1, decimals: 0, suffix: '°' };
// 上下(pitch):(50−v)·1.8 本就「上 = 正 = 俯视」,默认 33 → +31°,符号无需翻。
const UNIT_PITCH: SliderUnit = { to: (v) => (50 - v) * 1.8, from: (d) => 50 - d / 1.8, min: -90, max: 90, step: 1, decimals: 0, suffix: '°' };

export default function SimAppearancePanel({
  open = true, onToggle,
  world,
  order, puzzleKind,
  renderer, onRendererChange,
  settings, onSettingsChange, transCore, bgSlot, t,
  canUseCustomLogo,
}: {
  open?: boolean;
  onToggle?: () => void;
  world: World | null;
  order: number;
  puzzleKind: SimPuzzle;
  renderer: 'cubing' | 'engine' | 'group';
  onRendererChange?: (r: 'cubing' | 'engine' | 'group') => void;
  settings: SimSettings;
  onSettingsChange: (s: SimSettings) => void;
  canUseCustomLogo: boolean;
  /** 非 null = trans 视图接管了内核色 / 内核不透明度(见 Props.transCore)。 */
  transCore?: { coreColor: string; coreOpacity: number } | null;
  /** 画布左下角浮层槽(SimPage 的 .sim-bg-overlay);背景选择器 portal 到这里,
   *  贴在大图上而非埋在设置面板的开关行里。 */
  bgSlot?: HTMLElement | null;
  t: (zh: string, en: string) => string;
}) {
  // Both workspaces share this panel. simCaps decides which controls are supported
  // by the current puzzle and renderer; unsupported controls stay out of the UI.
  const caps = resolveCaps(puzzleKind, renderer);
  const roomsActive = roomCubeActive(puzzleKind, settings.roomTheme) && caps.engineActive;
  // Rooms replace only the visible surface; keep the user's ordinary cube settings.
  if (roomsActive) Object.assign(caps.supports, {
    thickness: false, hollow: false, hint: false, logo: false, structureColor: false,
    coreColor: false, coreOpacity: false, coreFinish: false, faceColors: false,
  });
  const isMirror = puzzleKind === 'mirror' || puzzleKind === 'mirror2';
  const faceColorsKey = puzzleKind === 'ghost' ? 'ghostFaceColors' : 'faceColors';
  const faceColors = settings[faceColorsKey] ?? GHOST_DEFAULT_FACE_COLORS;
  const matchesPalette = (palette: typeof DEFAULT_FACE_COLORS) => Object.entries(palette)
    .every(([face, color]) => faceColors[face as keyof typeof faceColors]?.toLowerCase() === color.toLowerCase());
  const facePreset = matchesPalette(DEFAULT_FACE_COLORS) ? 'wca' : matchesPalette(CUBER_FACE_COLORS) ? 'cuber' : 'custom';
  // Explain disabled controls using the same renderer labels as the selector below.
  const switchEnables = !caps.engineActive && resolveCaps(puzzleKind, 'engine').engineActive;
  const naHint = roomsActive
    ? t('立体房间使用独立布景，切回普通色块后可调整', '3D rooms use their own artwork. Switch to classic colors to adjust this.')
    : switchEnables
    ? t('该拼图暂不支持此功能(切到「本站引擎」渲染可启用)', 'Not available for this puzzle (switch the renderer to "CubeRoot engine" to enable)')
    : t('该拼图暂不支持此功能', 'Not available for this puzzle');
  const hint = (ok: boolean) => (ok ? undefined : naHint);
  // trans(X 光)是接管内核外观的预设,不是单纯换张伴图:选中时内核色 / 内核不透明度
  // 由它定值(3D 与伴图同吃),这两行随之锁死 —— hover 说明是谁锁的、怎么解锁。
  const transHint = transCore
    ? t(`已被图像面板的 trans(X 光)视图接管:银色内核 + ${transCore.coreOpacity}% 不透明。换成别的视图即可解锁`,
      `Taken over by the image panel's trans (x-ray) view: silver core at ${transCore.coreOpacity}% opacity. Switch to another view to unlock`)
    : undefined;

  const set = <K extends keyof SimSettings>(key: K, value: SimSettings[K]) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  const [pictureEditorOpen, setPictureEditorOpen] = useState(false);
  const pictureFaceCount = countPictureFaces(settings.pictureFaces);
  const pictureCubeActive = caps.supports.pictureCube
    && settings.pictureCube
    && pictureFaceCount > 0;
  const closePictureEditor = useCallback(() => setPictureEditorOpen(false), []);
  const autoSavePictureFaces = useCallback((faces: PictureFaces) => {
    if (!persistPictureFaces(faces)) return false;
    onSettingsChange({
      ...settings,
      pictureFaces: faces,
      pictureCube: countPictureFaces(faces) > 0,
      roomTheme: 'off',
    });
    return true;
  }, [onSettingsChange, settings]);
  const autoSavePictureBaseColors = useCallback((pictureBaseColors: boolean) => {
    onSettingsChange({ ...settings, pictureBaseColors });
  }, [onSettingsChange, settings]);

  // 人物头像在本地保存，照片贴图的位置与缩放可对照正脸调整。
  const avatarFileRef = useRef<HTMLInputElement>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState(false);
  useEffect(() => {
    if (!world || !avatarPreview) return;
    if (!settings.hands || !settings.fullBody || !caps.supports.hands) {
      setAvatarPreview(false);
      resetWorldView(world, settings);
      return;
    }
    let frame = 0;
    const focus = () => {
      const target = world.camera.position.clone(), direction = target.clone();
      world.scene.updateMatrixWorld(true);
      if (!world.hands?.getHeadView?.(target, direction)) {
        frame = requestAnimationFrame(focus);
        return;
      }
      world.camera.position.copy(target).addScaledVector(direction, 3200);
      world.camera.fov = 35;
      world.camera.near = 1;
      world.camera.far = 30000;
      world.camera.lookAt(target);
      world.camera.updateProjectionMatrix();
      world.dirty = true;
    };
    frame = requestAnimationFrame(focus);
    window.addEventListener('resize', focus);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('resize', focus); };
  }, [avatarPreview, world, settings, caps.supports.hands]);
  const [avatarError, setAvatarError] = useState('');
  const avatarVersion = useRef(0);
  const latestSettings = useRef({ settings, onSettingsChange });
  latestSettings.current = { settings, onSettingsChange };
  useEffect(() => () => { avatarVersion.current++; }, []);
  const handleAvatarFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const version = ++avatarVersion.current;
    setAvatarError('');
    if (!/^image\/(png|jpeg|webp)$/.test(file.type) || file.size > 10 * 1024 * 1024) {
      setAvatarError(t('请选择不超过 10 MB 的 JPG、PNG 或 WebP 图片', 'Choose a JPG, PNG or WebP image up to 10 MB'));
      return;
    }
    setAvatarBusy(true);
    try {
      const bodyAvatar = await fileToPictureFaceDataUrl(file, 384);
      if (version !== avatarVersion.current) return;
      const current = latestSettings.current;
      const next = { ...current.settings, bodyAvatar, bodyAvatarX: 50, bodyAvatarY: 50, bodyAvatarZoom: 50 };
      if (!saveSettings(next)) {
        setAvatarError(t('浏览器存储空间不足，头像未保存', 'Browser storage is full. The face was not saved.'));
        return;
      }
      current.onSettingsChange(next);
      setAvatarPreview(true);
    } catch {
      if (version === avatarVersion.current) setAvatarError(t('无法读取图片，请重新选择', 'Could not read the image. Please choose another.'));
    } finally {
      if (version === avatarVersion.current) setAvatarBusy(false);
    }
  };

  const authUser = useAuthStore(state => state.user);
  const requireMembership = useRequireMembership(canUseCustomLogo);
  const logoFileRef = useRef<HTMLInputElement>(null);
  const [logoBusy, setLogoBusy] = useState(false);
  const [logoError, setLogoError] = useState('');
  const logoVersion = useRef(0);
  const logoAccess = useRef(canUseCustomLogo);
  logoAccess.current = canUseCustomLogo;
  useEffect(() => {
    logoVersion.current++;
    setLogoBusy(false);
    setLogoError('');
    return () => { logoVersion.current++; };
  }, [canUseCustomLogo, authUser?.uid]);
  const handleLogoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // 允许再次选同一文件
    if (!file || !canUseCustomLogo) return;
    const version = ++logoVersion.current;
    setLogoError('');
    if (!file.type.startsWith('image/') || file.size > 10 * 1024 * 1024) {
      setLogoError(t('请选择不超过 10 MB 的图片', 'Choose an image up to 10 MB'));
      return;
    }
    setLogoBusy(true);
    try {
      const url = await fileToLogoDataUrl(file);
      if (version !== logoVersion.current || !logoAccess.current) return;
      const current = latestSettings.current;
      const next = { ...current.settings, customLogo: url, logo: 'custom' as const };
      if (!saveSettings(next)) {
        setLogoError(t('浏览器存储空间不足，logo 未保存', 'Browser storage is full. The logo was not saved.'));
        return;
      }
      current.onSettingsChange(next);
    } catch {
      if (version === logoVersion.current) setLogoError(t('无法读取图片，请重新选择', 'Could not read the image. Please choose another.'));
    } finally {
      if (version === logoVersion.current) setLogoBusy(false);
    }
  };

  // 背景(BG)选择器:复用内核色那套弹出色块选择器(SwatchPopup),trigger 显当前
  // 背景,点开弹 5 档可视色块。原先埋在设置面板开关行,现 portal 到画布左下角浮层
  // (.sim-bg-overlay),贴着大图 —— 背景是画布属性,控件搬到画布上更直觉。
  // 只留色块,不带文字标签 —— 色块本身就说明是什么(title 兜 a11y / 悬停提示)。
  const bgSelector = (
    <>
      <SwatchPopup
        title={t('背景', 'Background')}
        trigger={<span className={`sim-swatch-box sim-bg-box--${settings.boardBg}`} />}
      >
        {(close) =>
          ([
            ['auto', t('跟随主题', 'Theme')],
            ['white', t('纯白', 'White')],
            ['dark', t('深灰', 'Dark')],
            ['checkerDark', t('深色棋盘', 'Dark grid')],
            ['checkerLight', t('浅色棋盘', 'Light grid')],
          ] as [SimBoardBg, string][]).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={'sim-swatch' + (settings.boardBg === value ? ' active' : '')}
              title={label}
              aria-label={label}
              aria-pressed={settings.boardBg === value}
              onClick={() => { set('boardBg', value); close(); }}
            >
              <span className={`sim-swatch-box sim-bg-box--${value}`} />
            </button>
          ))
        }
      </SwatchPopup>
    </>
  );

  return (
    <CollapsibleSection className="sim-settings-section" open={open} onToggle={onToggle} icon={SlidersHorizontal} label={t('外观与操作', 'Appearance & interaction')} keepMounted>
      <section className="sim-puzzle">
      {/* 背景选择器浮层 —— portal 到画布左下角(SimPage 的 .sim-bg-overlay)。slot 未
          挂载(SimPage 恒提供)前不渲染。 */}
      {bgSlot && createPortal(<div className="sim-bg-overlay-inner">{bgSelector}</div>, bgSlot)}
        <div className="sim-puzzle-body">
          <div className="sim-puzzle-row">
            {/* The legacy 'group' value selects our engine. Research panels are
                controlled independently from this renderer selector. */}
            {caps.hasRendererChoice && onRendererChange && (
              <div className="sim-renderer-row">
                <div className="sim-puzzle-section-title">{t('渲染', 'Renderer')}</div>
                <select
                  className="sim-puzzle-select"
                  value={renderer === 'cubing' ? 'cubing' : 'group'}
                  onChange={(e) => onRendererChange(e.target.value as 'cubing' | 'engine' | 'group')}
                  aria-label={t('渲染引擎', 'Rendering engine')}
                >
                  <option value="group">{t('本站引擎', 'CubeRoot engine')}</option>
                  <option value="cubing">cubing.js</option>
                </select>
              </div>
            )}

          </div>

          <div className="sim-view-settings">
          <div className="sim-puzzle-sliders">
            {caps.supports.sensitivity && (<Slider label={t('灵敏度', 'Sensitivity')} value={settings.sensitivity} onChange={(v) => set('sensitivity', v)} disabled={!caps.supports.sensitivity} unit={UNIT_SENS}
              title={hint(caps.supports.sensitivity) ?? (settings.pointerTurns === false
                // 手拧关 → 拖层/SQ1 两条路径不再产生 move,只剩转视角,单位含义随之收窄(仍然可调)。
                ? t('跟手倍率(相对默认):手拧已关,当前只作用于拖动转视角', 'Responsiveness relative to the default — with drag-turn off it only scales view rotation')
                : t('跟手倍率(相对默认):同时作用于拖层转动、拖空白转视角、SQ1 / SQ2 / SQ4 拖拽', 'Responsiveness relative to the default — scales layer drags, view drags and SQ1 / SQ2 / SQ4 drags alike'))} />)}
            {caps.supports.scale && (<Slider label={t('缩放', 'Scale')} value={settings.scale} onChange={(v) => set('scale', v)} disabled={!caps.supports.scale} unit={UNIT_SCALE} title={hint(caps.supports.scale) ?? t('缩放倍率', 'Zoom factor')} />)}
            {caps.supports.perspective && (<Slider label={t('透视', 'Perspective')} value={settings.perspective} onChange={(v) => set('perspective', v)} disabled={!caps.supports.perspective} unit={UNIT_FOCAL} title={hint(caps.supports.perspective) ?? t('35mm 等效焦距(小 = 广角畸变强,大 = 接近正交)', '35mm-equivalent focal length (low = wide-angle distortion, high = near-orthographic)')} />)}
          </div>
          {/* 视角盘:「左右 / 上下」两条滑条合成一个平面直角坐标系 —— 可拖圆点 + 两个精确度数框
              (打 30 正好 30)。右 = 正(看右面)、上 = 正(俯视),纯显示层符号,不改底层 3D 旋转。
              twisty 渲染下左右量程 ±180°(cameraLongitude 全程),引擎 ±90°。 */}
          {!caps.flat && (<OrbitPad
            xValue={settings.viewAngle}
            yValue={settings.viewGradient}
            onChange={(x, y) => onSettingsChange({ ...settings, viewAngle: x, viewGradient: y })}
            xLabel={t('左右', 'Yaw')}
            yLabel={t('上下', 'Pitch')}
            xUnit={caps.engineActive ? UNIT_YAW_ENGINE : UNIT_YAW_TWISTY}
            yUnit={UNIT_PITCH}
            xTitle={t('左右旋转角度(右 = 正,看右面)', 'Horizontal view angle (right = positive, toward the right face)')}
            yTitle={t('上下旋转角度(上 = 正,俯视)', "Vertical view angle (up = positive, bird's-eye)")}
          />)}
          </div>
          <div className="sim-puzzle-toggles">
            {/* 手拧:关 = 鼠标 / 手势不能拧动拼图(点贴纸、拖贴纸都只转视角,不记步);
                视角旋转 / 缩放 / 平移 / 键盘 / 播放不受影响。三条路径都接:NxN controller、
                SQ1 / Ivy / 角转系 gesture、cubing.js addMove。 */}
            <Toggle
              label={t('手拧', 'Drag turn')}
              value={settings.pointerTurns !== false}
              onChange={(v) => set('pointerTurns', v)}
              title={t('关闭后鼠标 / 手势只能转视角,不能拧动拼图(键盘和播放不受影响)', 'Off: mouse / touch only rotates the view — it cannot turn the puzzle (keyboard and playback still work)')}
            />
            {/* 「消步」开关已移到播放器工具行(逆 旁),此处不再重复。 */}
            {caps.supports.dragEmpty && (<label className={`sim-toggle${caps.supports.dragEmpty ? '' : ' sim-toggle--disabled'}`} title={hint(caps.supports.dragEmpty)}>
              <span>{t('拖空白', 'Drag empty')}</span>
              <select
                value={settings.dragEmpty}
                disabled={!caps.supports.dragEmpty}
                onChange={(e) => set('dragEmpty', e.target.value as 'orbit' | 'rotate' | 'view')}
              >
                <option value="rotate">{t('整步转体', 'Snap rotate')}</option>
                <option value="view">{t('视角', 'View')}</option>
                <option value="orbit">{t('自动转体', 'Auto rotate')}</option>
              </select>
            </label>)}
            {/* 播放动画开关:关 → 「播放」时瞬切每一步(不逐格转动);单步前进/后退本就瞬切。 */}
            {/* 方位字母常显:U/D/L/R/F/B(角/棱/面转拼图显对应标签),等同拖视角时浮现的标签但常驻。 */}
            {caps.supports.faceLabels && (<Toggle
              label={t('字母', 'Letters')}
              value={settings.faceLabels === true}
              onChange={(v) => set('faceLabels', v)}
              disabled={!caps.supports.faceLabels || pictureCubeActive || roomsActive}
              title={pictureCubeActive || roomsActive
                ? t('使用图案时暂时隐藏字母', 'Letters are hidden while artwork is active')
                : hint(caps.supports.faceLabels) ?? (puzzleKind === 'sphere'
                  ? t('三阶逻辑面的辅助方位提示', 'Auxiliary labels for the logical 3×3 faces') : undefined)}
            />)}
            {/* 背景(BG)选择器已移到画布左下角浮层(见本组件顶部 bgSelector + SimPage
                的 .sim-bg-overlay),不再占开关行。 */}
            {/* 顶面 U 中心 logo:无 / 网站 / 自定义上传。仅 NxN 奇数阶有正中心块时实际显示
                (偶数阶 / 非 NxN 引擎里 setLogo 自动隐藏)。选「自定义」开文件选择器。 */}
            {caps.supports.logo && (<div className="sim-logo-setting">
              <label className={'sim-toggle' + (caps.supports.logo ? '' : ' sim-toggle--disabled')} title={hint(caps.supports.logo)}>
                <span>logo</span>
                <select
                  value={settings.logo === 'custom' && !canUseCustomLogo ? 'none' : settings.logo}
                  disabled={!caps.supports.logo || logoBusy}
                  onChange={(e) => {
                    const v = e.target.value as SimSettings['logo'];
                    setLogoError('');
                    if (v === 'custom') {
                      if (!requireMembership()) return;
                      if (settings.customLogo) set('logo', 'custom');
                      else logoFileRef.current?.click();
                      return;
                    }
                    set('logo', v);
                  }}
                >
                  <option value="none">{t('无', 'None')}</option>
                  <option value="site">{t('魔方根', 'CubeRoot')}</option>
                  <option value="custom">
                    {canUseCustomLogo ? t('自定义', 'Custom') : t('自定义（会员）', 'Custom (members)')}
                  </option>
                </select>
                <input
                  ref={logoFileRef}
                  type="file"
                  accept="image/*"
                  disabled={!canUseCustomLogo}
                  style={{ display: 'none' }}
                  onChange={handleLogoFile}
                />
              </label>
              {canUseCustomLogo && settings.logo === 'custom' && (
                <button type="button" className="sim-logo-action" disabled={logoBusy} onClick={() => { setLogoError(''); logoFileRef.current?.click(); }}>
                  {t('更换图片', 'Change image')}
                </button>
              )}
              {logoBusy && <span className="sim-logo-member-prompt" role="status">{t('正在处理图片…', 'Processing image…')}</span>}
              {logoError && <span className="sim-logo-member-prompt" role="alert">{logoError}</span>}
            </div>)}
            {/* 锁定大小位置 锁的是引擎滚轮/捏合缩放,cubing.js 拼图自管缩放 → 引擎未驱动时灰掉。 */}
            {caps.supports.lockView && (<Toggle label={t('锁定大小位置', 'Lock size & position')} value={settings.lockView} onChange={(v) => set('lockView', v)} disabled={!caps.supports.lockView} title={hint(caps.supports.lockView)} />)}
            {/* 小窗(背面视图)的开关不在这里:小窗自己右上角有 ×,关掉后播放条最右出现
                找回按钮 —— 同一个 settings.backView 已经有两个入口,再放一个是第三份。 */}
            {/* 立体贴片 / 镂空 是本站引擎特性,cubing.js 渲染的拼图上无此能力 → 引擎未驱动时灰掉
                (面板形状仍保持每拼图一致:控件常显,只是不可点)。 */}
            {caps.supports.thickness && (<Toggle label={t('立体贴片', 'Sticker thickness')} value={settings.thickness} onChange={(v) => set('thickness', v)} disabled={!caps.supports.thickness} title={hint(caps.supports.thickness)} />)}
            {caps.supports.hollow && (<Toggle label={t('镂空', 'Hollow')} value={settings.hollow} onChange={(v) => set('hollow', v)} disabled={!caps.supports.hollow} title={hint(caps.supports.hollow)} />)}
            {/* 提示贴片(hint)两条路径都支持(引擎 hint / cubing.js hintFacelets)→ 不灰。 */}
            {caps.supports.hint && (<Toggle label={t('提示贴片', 'Hint facelets')} value={settings.hint} onChange={(v) => set('hint', v)} disabled={!caps.supports.hint} title={hint(caps.supports.hint)} />)}
            {/* 手指(指法演示):双手握持,转层时腕转/弹指跟动画。仅 3x3(simCaps.hands)。 */}
            {caps.supports.hands && (<Toggle label={t('手指', 'Hands')} value={settings.hands === true} onChange={(v) => set('hands', v)} disabled={!caps.supports.hands} title={settings.hands ? undefined : t('请先开启手指', 'Enable hands first')} />)}
            {/* 全身人物:SMPL-X 完整人随手出场(躯干静态 + 双臂 IK 追手;拉远 Scale 看全身)。
                依赖手指开启;资产逐机转换,缺失时静默降级。 */}
            {caps.supports.hands && (<Toggle label={t('全身人物', 'Full body')} value={settings.fullBody === true} onChange={(v) => set('fullBody', v)} disabled={!caps.supports.hands || settings.hands !== true} title={hint(caps.supports.hands)} />)}
            {/* 箭头贴片仅 NxN 引擎生效(cube.arrow),非 NxN 拼图无此属性 → 仅 NxN 显示。
                用户指定的唯一例外。 */}
            {caps.supports.arrow && (
              <Toggle label={t('箭头', 'Arrows')} value={settings.arrow} onChange={(v) => set('arrow', v)} disabled={roomsActive} title={hint(!roomsActive)} />
            )}
          </div>
          {caps.supports.hands && settings.hands && settings.fullBody && (
            <div className="sim-person-avatar">
              <span>{t('人物头像', 'Character face')}</span>
              {settings.bodyAvatar && <img src={settings.bodyAvatar} alt={t('当前人物头像', 'Current character face')} width={40} height={40} />}
              <button type="button" disabled={avatarBusy} onClick={() => avatarFileRef.current?.click()}>
                {avatarBusy ? <LoadingIndicator>{t('读取中…', 'Loading…')}</LoadingIndicator> : t('上传头像', 'Upload face')}
              </button>
              {settings.bodyAvatar && <button type="button" onClick={() => {
                avatarVersion.current++; setAvatarBusy(false); setAvatarError('');
                const next = { ...settings, bodyAvatar: '', bodyAvatarX: 50, bodyAvatarY: 50, bodyAvatarZoom: 50 };
                if (saveSettings(next)) onSettingsChange(next);
                else setAvatarError(t('浏览器存储不可用，无法保存更改', 'Browser storage is unavailable. Could not save changes.'));
              }}>{t('恢复默认头像', 'Reset face')}</button>}
              <button type="button" aria-pressed={avatarPreview} onClick={() => {
                if (avatarPreview && world) resetWorldView(world, settings);
                setAvatarPreview(!avatarPreview);
              }}>{avatarPreview ? t('结束正脸预览', 'Close face preview') : t('查看正脸', 'Preview face')}</button>
              <input ref={avatarFileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden aria-label={t('上传人物头像', 'Upload character face')} onChange={handleAvatarFile} />
              <small>{t('选择脸部居中的正面照片，自动居中裁剪，仅保存在当前浏览器', 'Choose a centered, front-facing photo. Center-cropped and saved only in this browser.')}</small>
              {settings.bodyAvatar && <div className="sim-person-avatar-adjust">
                <Slider label={t('头像左右', 'Face horizontal')} value={settings.bodyAvatarX} onChange={v => { setAvatarPreview(true); set('bodyAvatarX', v); }} />
                <Slider label={t('头像上下', 'Face vertical')} value={settings.bodyAvatarY} onChange={v => { setAvatarPreview(true); set('bodyAvatarY', v); }} />
                <Slider label={t('头像缩放', 'Face zoom')} value={settings.bodyAvatarZoom} onChange={v => { setAvatarPreview(true); set('bodyAvatarZoom', v); }} />
                <small>{t('对照正脸预览，调整照片五官与人物眼睛、嘴的位置', 'Use the face preview to align the photo with the character’s eyes and mouth.')}</small>
              </div>}
              {avatarError && <small role="alert">{avatarError}</small>}
            </div>
          )}
          {/* 调试控件单独成行(用户要求):半转停 / 结构着色 / 骨架线条 / 挖块。组前缀「调试」标一次,
              各控件去掉重复的「调试:」前缀。半转停 / 结构着色 为本站引擎特性,在 cubing.js 渲染的拼图上
              为 no-op(仅存设置);骨架线条为手部 MediaPipe 风格叠加线,仅 3x3 手指开启时有效;
              挖块为统一三选一占位(见 applySettings)。 */}
          <details className="sim-puzzle-debug">
            <summary>{t('结构与调试', 'Structure & diagnostics')}</summary>
            <div className="sim-puzzle-debug-toggles">
              {caps.supports.holdPartialTurn && (<Toggle label={t('半转停', 'Hold partial turn')} value={settings.holdPartialTurn} onChange={(v) => set('holdPartialTurn', v)} disabled={!caps.supports.holdPartialTurn} title={hint(caps.supports.holdPartialTurn)} />)}
              {caps.supports.structureColor && (<Toggle label={t('结构着色', 'Structure colors')} value={settings.debugStructureColor} onChange={(v) => set('debugStructureColor', v)} disabled={!caps.supports.structureColor} title={hint(caps.supports.structureColor)} />)}
              {/* 骨架线条:MediaPipe 风格关键点叠加,仅手指(hands)开启的拼图上可用(同 caps.supports.hands)。 */}
              {caps.supports.handsSkeleton && (<Toggle label={t('骨架线条', 'Skeleton overlay')} value={settings.handsSkeleton} onChange={(v) => set('handsSkeleton', v)} disabled={!caps.supports.handsSkeleton} title={hint(caps.supports.handsSkeleton)} />)}
              {/* 指甲:立体甲片显隐(mesh.visible,不拆几何),门控同骨架线条(手指相关调试)。 */}
              {caps.supports.handsSkeleton && (<Toggle label={t('指甲', 'Nails')} value={settings.showNails} onChange={(v) => set('showNails', v)} disabled={!caps.supports.handsSkeleton} title={hint(caps.supports.handsSkeleton)} />)}
              {/* SMPL-X 全身:藏拼图与手,只看原版 SMPL-X neutral T-pose 人体(手/臂比例上游真值)。
                  资产逐机转换(convert-mano.py),缺失时开了也无效果 —— 不灰,调试自担。
                  平面拼图是唯一的例外:它根本没有 3D 场景可以站人,那不是"资产可能缺",是没地方放。 */}
              {!caps.flat && (<Toggle label={t('SMPL-X 全身', 'SMPL-X body')} value={settings.showSmplxBody === true} onChange={(v) => set('showSmplxBody', v)} disabled={caps.flat} title={hint(!caps.flat)} />)}
              {/* 挖块:仅当该拼图有「原生转动元素」(角/面/棱)可掀起时可选;NxN/SQ1 无单一会动块组,
                  cubing.js 拼图引擎未驱动 → 灰掉。 */}
              {caps.supports.carve && (<label className={'sim-toggle' + (caps.supports.carve ? '' : ' sim-toggle--disabled')} title={hint(caps.supports.carve)}>
                <span>{t('挖块', 'Carve')}</span>
                <select
                  value={settings.debugCarve}
                  disabled={!caps.supports.carve}
                  onChange={(e) => set('debugCarve', e.target.value as SimSettings['debugCarve'])}
                >
                  <option value="off">{t('关', 'Off')}</option>
                  <option value="corner">{t('挖角', 'Corner')}</option>
                  <option value="face">{t('挖面', 'Face')}</option>
                  <option value="edge">{t('挖棱', 'Edge')}</option>
                </select>
              </label>)}
              {/* 隔离:只保留某类块、挖掉其余(挖块的反操作)。选项由 simCaps 各魔方声明的
                  isolate 列表驱动(目前仅齿轮:角/棱/中心 —— 中心块含核心骨架),未声明置灰。
                  选了某类后旁边出「编号」下拉:全部 / 第 1…count 个(用户要单独看一个块)。 */}
              {caps.supports.isolate && (<label className={'sim-toggle' + (caps.supports.isolate ? '' : ' sim-toggle--disabled')} title={hint(caps.supports.isolate)}>
                <span>{t('隔离', 'Isolate')}</span>
                <select
                  value={settings.debugIsolate}
                  disabled={!caps.supports.isolate}
                  onChange={(e) => onSettingsChange({
                    ...settings,
                    debugIsolate: e.target.value as SimSettings['debugIsolate'],
                    debugIsolateIndex: -1, // 换类别复位到「全部」,免旧编号越界
                  })}
                >
                  <option value="off">{t('关', 'Off')}</option>
                  {caps.isolate.some((x) => x.kind === 'corner') && <option value="corner">{t('角块', 'Corner')}</option>}
                  {caps.isolate.some((x) => x.kind === 'edge') && <option value="edge">{t('棱块', 'Edge')}</option>}
                  {caps.isolate.some((x) => x.kind === 'center') && <option value="center">{t('中心块', 'Center')}</option>}
                  {caps.isolate.some((x) => x.kind === 'core') && <option value="core">{t('骨架', 'Frame')}</option>}
                </select>
              </label>)}
              {(() => {
                const spec = caps.isolate.find((x) => x.kind === settings.debugIsolate);
                if (!caps.supports.isolate || !spec) return null;
                return (
                  <label className="sim-toggle">
                    <span>{t('编号', 'Piece')}</span>
                    <select
                      value={String(settings.debugIsolateIndex)}
                      onChange={(e) => set('debugIsolateIndex', Number(e.target.value))}
                    >
                      <option value="-1">{t('全部', 'All')}</option>
                      {Array.from({ length: spec.count }, (_, i) => (
                        <option key={i} value={String(i)}>{i + 1}</option>
                      ))}
                    </select>
                  </label>
                );
              })()}
            </div>
          </details>
          {/* 内核色的三个同族旋钮 —— 都作用在「贴纸之外那层」上,3D 与示意伴图共用同一份值
              (伴图导出器的 bodyOpacity / stickerOpacity / inset)。原来只挂在图像面板里、
              只改图不改动画,现在并到内核色下面一起管。 */}
          <div className="sim-material-sliders">
          {caps.supports.coreOpacity && (<PercentRow
            label={puzzleKind === 'sphere' ? t('球体不透明度', 'Sphere opacity') : t('内核不透明度', 'Core opacity')}
            value={transCore ? transCore.coreOpacity : settings.coreOpacity}
            onChange={(v) => set('coreOpacity', v)}
            disabled={!caps.supports.coreOpacity || !!transCore}
            title={transHint ?? hint(caps.supports.coreOpacity) ?? (puzzleKind === 'sphere'
              ? t('调整整体彩色球块的不透明度', 'Opacity of the whole coloured sphere') : undefined)}
          />)}
          {caps.supports.coreFinish && (<PercentRow
            label={t('贴纸不透明度', 'Sticker opacity')}
            value={settings.stickerOpacity}
            onChange={(v) => set('stickerOpacity', v)}
            disabled={!caps.supports.coreFinish}
            title={hint(caps.supports.coreFinish)}
          />)}
          {caps.supports.coreFinish && (<PercentRow
            label={t('贴纸自发光', 'Sticker emission')}
            value={settings.stickerEmission}
            onChange={(v) => set('stickerEmission', v)}
            disabled={!caps.supports.coreFinish || !cuberLightingActive(puzzleKind, settings.coreStyle)}
            title={hint(caps.supports.coreFinish && cuberLightingActive(puzzleKind, settings.coreStyle))
              ?? t('按贴纸原色增加自发光，上游默认强度为 50%', 'Add emission in each sticker’s own color; upstream defaults to 50%')}
          />)}
          {caps.supports.coreFinish && (<PercentRow
            label={t('黑边', 'Gap')}
            value={settings.stickerGap}
            min={0}
            max={30}
            step={0.5}
            onChange={(v) => set('stickerGap', v)}
            disabled={!caps.supports.coreFinish}
            title={hint(caps.supports.coreFinish)
              ?? t('贴纸之间那条缝有多宽(占小面的百分比)', 'Width of the gap between stickers, as a % of one facelet')}
          />)}
          </div>
          <div className="sim-color-settings">
          {isMirror && (
            <ColorRow label={t('镜面配色', 'Mirror colour')}>
              <ModeColorSelect
                special={(settings.mirrorColorMode ?? 'single') === 'six'}
                color={settings.mirrorColor ?? MIRROR_DEFAULT_COLOR}
                presets={MIRROR_COLOR_PRESETS}
                specialTitle={t('六色', 'Six colours')}
                specialSwatchClass="sim-swatch-six-box"
                onPickColor={(c) => onSettingsChange({ ...settings, mirrorColorMode: 'single', mirrorColor: c })}
                onPickSpecial={() => set('mirrorColorMode', 'six')}
                title={t('镜面配色', 'Mirror colour')}
                t={t}
              />
            </ColorRow>
          )}
          {caps.supports.coreColor && (<ColorRow
            label={t('内核色', 'Core color')}
            disabled={!caps.supports.coreColor || !!transCore}
            title={transHint ?? hint(caps.supports.coreColor)}
          >
            <ModeColorSelect
              special={!transCore && settings.coreStyle === 'raw'}
              color={transCore ? transCore.coreColor : settings.coreColor}
              presets={CORE_COLOR_PRESETS}
              specialTitle={t('原核', 'Raw body')}
              specialSwatchClass="sim-swatch-raw-box"
              onPickColor={(c) => onSettingsChange({ ...settings, coreStyle: 'normal', coreColor: c })}
              onPickSpecial={() => set('coreStyle', 'raw')}
              title={t('内核色', 'Core color')}
              t={t}
            />
          </ColorRow>)}
          {caps.supports.faceColors && (<label className="sim-toggle">
            <span>{t('配色预设', 'Color preset')}</span>
            <select
              aria-label={t('配色预设', 'Color preset')}
              disabled={!caps.supports.faceColors}
              value={facePreset}
              onChange={(event) => {
                if (event.target.value === 'custom') return;
                set(faceColorsKey, { ...(event.target.value === 'cuber' ? CUBER_FACE_COLORS : DEFAULT_FACE_COLORS) });
              }}
            >
              <option value="wca">WCA</option>
              <option value="cuber">{t('柔和', 'Soft')}</option>
              <option value="custom" disabled>{t('自定义', 'Custom')}</option>
            </select>
          </label>)}
          {caps.supports.faceColors && (<ColorRow
            label={t('面色', 'Face colors')}
            disabled={!caps.supports.faceColors}
            title={hint(caps.supports.faceColors)}
            action={{
              label: 'WCA',
              title: t('恢复 WCA 默认', 'Reset to WCA defaults'),
              onClick: () => set(faceColorsKey, { ...DEFAULT_FACE_COLORS }),
            }}
          >
            {FACE_ORDER.map((f) => (
              <span key={f} className="sim-face-pick">
                <span className="sim-swatch-label">{f}</span>
                <ModeColorSelect
                  color={faceColors[f]}
                  presets={FACE_COLOR_PRESETS}
                  onPickColor={(c) => set(faceColorsKey, { ...faceColors, [f]: c })}
                  title={t(FACE_LABELS_ZH[f], f)}
                  t={t}
                />
              </span>
            ))}
          </ColorRow>)}
          {caps.supports.pictureCube && (<div
            className={'sim-picture-setting' + (caps.supports.pictureCube ? '' : ' sim-picture-setting--disabled')}
            title={hint(caps.supports.pictureCube)}
          >
            <label className="sim-toggle">
              <span>{t('图案魔方', 'Picture cube')}</span>
              <select
                aria-label={t('图案魔方主题', 'Picture cube theme')}
                value={roomsActive ? settings.roomTheme : settings.pictureCube ? 'pictures' : 'off'}
                disabled={!caps.supports.pictureCube}
                onChange={(event) => {
                  const value = event.target.value;
                  if (value === 'pictures' && pictureFaceCount === 0) {
                    setPictureEditorOpen(true);
                    return;
                  }
                  const roomTheme = normalizeRoomTheme(value);
                  onSettingsChange({ ...settings, roomTheme, pictureCube: value === 'pictures',
                    ...(roomTheme !== 'off' ? { viewMode: 'cube' as const } : {}) });
                }}
              >
                <option value="off">{t('普通色块', 'Classic colors')}</option>
                <optgroup label={t('立体房间（二至七阶）', '3D rooms (2–7 layers)')}>
                  {ROOM_THEMES.map((theme) => <option key={theme.id} value={theme.id}
                    disabled={!caps.supports.roomCube}>{t(theme.zh, theme.en)}</option>)}
                </optgroup>
                <option value="pictures">{t('自选图片', 'Your pictures')}</option>
              </select>
            </label>
            {settings.pictureCube && <button
              type="button"
              className="sim-picture-open"
              disabled={!caps.supports.pictureCube}
              onClick={() => setPictureEditorOpen(true)}
            >
              <PictureFaceMiniNet faces={settings.pictureFaces} />
              <span>{pictureFaceCount > 0
                ? t('编辑', 'Edit')
                : t('选择六面图片', 'Choose face images')}</span>
            </button>}
            {(pictureCubeActive || roomsActive) && (
              <span className="sim-picture-setting-note">
                {roomsActive
                  ? t('每个小块都是立体房间，随转动一起移动', 'Every cubie is a 3D room that moves with your turns')
                  : t('使用图案时暂时隐藏 logo、字母和箭头', 'Logo, letters and arrows are hidden while pictures are in use')}
              </span>
            )}
          </div>)}
          <PictureCubeEditor
            open={pictureEditorOpen}
            initialFaces={settings.pictureFaces}
            initialBaseColors={settings.pictureBaseColors}
            order={order}
            onClose={closePictureEditor}
            onFacesChange={autoSavePictureFaces}
            onBaseColorsChange={autoSavePictureBaseColors}
            t={t}
          />
          {/* 指甲配色(甲油):自然甲 special + 甲油底色;选了底色后追加「渐变」第二色
              (甲根→游离缘)与「深浅」滑杆(50 = 原色,低淡高深)。重涂手部立体甲片
              顶点色(engine/hands paintNailPolish);门控同全身人物(需手指开启)。 */}
          {caps.supports.hands && (<ColorRow
            label={t('指甲配色', 'Nail colour')}
            disabled={!caps.supports.hands || settings.hands !== true}
            title={hint(caps.supports.hands)}
          >
            <ModeColorSelect
              special={!settings.nailColor}
              color={settings.nailColor || NAIL_DEFAULT_COLOR}
              presets={NAIL_COLOR_PRESETS}
              specialTitle={t('自然甲', 'Natural')}
              specialSwatchClass="sim-swatch-nail-box"
              onPickColor={(c) => set('nailColor', c)}
              onPickSpecial={() => set('nailColor', '')}
              title={t('指甲配色', 'Nail colour')}
              t={t}
            />
            {settings.nailColor !== '' && (
              <>
                <span className="sim-face-pick">
                  <span className="sim-swatch-label">{t('渐变', 'Tip')}</span>
                  <ModeColorSelect
                    special={!settings.nailColorTip}
                    color={settings.nailColorTip || settings.nailColor}
                    presets={NAIL_COLOR_PRESETS}
                    specialTitle={t('无渐变', 'No gradient')}
                    specialSwatchClass="sim-swatch-nail-off-box"
                    onPickColor={(c) => set('nailColorTip', c)}
                    onPickSpecial={() => set('nailColorTip', '')}
                    title={t('渐变第二色(甲根 → 指尖)', 'Gradient tip colour (root → tip)')}
                    t={t}
                  />
                </span>
                <label className="sim-nail-shade" title={t('深浅:左淡右深,中间原色', 'Depth: light ↔ dark, centre = as picked')}>
                  <span className="sim-swatch-label">{t('深浅', 'Depth')}</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={settings.nailShade}
                    onChange={(e) => set('nailShade', Number(e.target.value))}
                  />
                </label>
              </>
            )}
          </ColorRow>)}
          </div>
        </div>
      </section>
      <SimAppearancePresets settings={settings} onChange={onSettingsChange} />
    </CollapsibleSection>
  );
}
