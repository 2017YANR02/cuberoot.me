'use client';

import { useState, useRef, useEffect, type MutableRefObject } from 'react';
import FaceOverlay, { type FaceTable } from './FaceOverlay';
import './TwistySection.css';

// Pyraminx 4 vertex 方向。screenSlot mode:字母 (U/L/R/B) 不绑定具体 vertex,
// 改成按屏幕方位自动分配 — visible vertex 屏幕 y 最小拿 U,剩下按 x asc 拿 L/R,
// invisible(背面)拿 B。用户拖动让 cube 翻面时,字母无缝跟着屏幕方位走。
// vertex 几何:regular tetrahedron 单位 vertex,1 个 +Y 顶 + 3 个 y=-1/3 azimuth 60/180/300。
const PYRA_FACES: FaceTable = [
  { letter: 'U', normal: [0, 1, 0] },
  { letter: 'L', normal: [-Math.sqrt(6) / 3, -1 / 3, Math.sqrt(2) / 3] },
  { letter: 'R', normal: [Math.sqrt(6) / 3, -1 / 3, Math.sqrt(2) / 3] },
  { letter: 'B', normal: [0, -1 / 3, -2 * Math.sqrt(2) / 3] },
];

// Skewb = cube 几何,轴对齐 normal。
// 顺序 [U, F, R, ...] 是 screenSlot mode 的 slotLetters 约定:
//   slot 0 = 屏幕顶 (U),slot 1 = 屏幕左 (F),slot 2 = 屏幕右 (R)。
// 整体转 (y/x) 后 letter 仍 U/F/R 钉在屏幕方位,不跟 piece 走。
const SKEWB_FACES: FaceTable = [
  { letter: 'U', normal: [0, 1, 0] },
  { letter: 'F', normal: [0, 0, 1] },
  { letter: 'R', normal: [1, 0, 0] },
  { letter: 'L', normal: [-1, 0, 0] },
  { letter: 'B', normal: [0, 0, -1] },
  { letter: 'D', normal: [0, -1, 0] },
];

// Megaminx 12 面 — 顶环 U/F/R/BR/BL/L 顺时针;底环 D/BF/DBR/DR/DL/DBL 对称。
// 标签命名跟 normal 的真实映射需 playwright 校准。
// 几何:dodecahedron 的面中心在 +Y 顶面 + 5 个 polar≈63.435° (= atan(2))、azimuth 0/72/144/216/288;底环 negate。
const MEGA_PHI = Math.atan(2); // polar angle from +Y axis to top-ring face
const MEGA_SIN = Math.sin(MEGA_PHI), MEGA_COS = Math.cos(MEGA_PHI);
function megaTop(deg: number): [number, number, number] {
  const t = deg * Math.PI / 180;
  return [MEGA_SIN * Math.sin(t), MEGA_COS, MEGA_SIN * Math.cos(t)];
}
function neg(v: [number, number, number]): [number, number, number] { return [-v[0], -v[1], -v[2]]; }
const MEGA_U_N: [number, number, number] = [0, 1, 0];
const MEGA_F_N = megaTop(0);
const MEGA_R_N = megaTop(72);
const MEGA_BR_N = megaTop(144);
const MEGA_BL_N = megaTop(216);
const MEGA_L_N = megaTop(288);
const MEGA_FACES: FaceTable = [
  { letter: 'U', normal: MEGA_U_N },
  { letter: 'F', normal: MEGA_F_N },
  { letter: 'R', normal: MEGA_R_N },
  { letter: 'BR', normal: MEGA_BR_N },
  { letter: 'BL', normal: MEGA_BL_N },
  { letter: 'L', normal: MEGA_L_N },
  { letter: 'D', normal: neg(MEGA_U_N) },
  { letter: 'BF', normal: neg(MEGA_F_N) },
  // dodecahedron 12 face 两两 dual:R↔DBL, L↔DBR, BR↔DL, BL↔DR
  // (playwright 校准: alg="DL" 让屏幕左下蓝色面动, alg="DR" 让右下米色面动)
  { letter: 'DBL', normal: neg(MEGA_R_N) },
  { letter: 'DL', normal: neg(MEGA_BR_N) },
  { letter: 'DR', normal: neg(MEGA_BL_N) },
  { letter: 'DBR', normal: neg(MEGA_L_N) },
];

const FACE_TABLES: Record<string, FaceTable | undefined> = {
  skewb: SKEWB_FACES,
  pyraminx: PYRA_FACES,
  megaminx: MEGA_FACES,
  '3x3x3': SKEWB_FACES,
};

/** sim PuzzleSettings 透传过来,只用其中跟 TwistyPlayer 能映射的字段。
 *  字段说明:
 *  - scale 0..100 → cameraDistance (反向):upstream cuber 50=1.0,这里映 [3, 9]
 *  - viewAngle 0..100 → cameraLongitude:0/100 = ±180°,50 = 0
 *  - viewGradient 0..100 → cameraLatitude:0/100 = ±90°,50 = 0
 *    (跟 SettingDrawer mapYaw/mapPitch 同方向)
 *  - speed 0..100 → tempoScale:[0.2, 4]
 *  - hint → hintFacelets 'floating' / 'none'
 */
export interface TwistySettings {
  scale: number;
  viewAngle: number;
  viewGradient: number;
  speed: number;
  hint: boolean;
  /** 'orbit' = 自由 orbit (默认 cubing.js 行为);'rotate' = pointerup 后 snap cameraLat/Long 到 90° 整数倍 */
  dragEmpty?: 'orbit' | 'rotate' | 'view';
  /** 背面视图小窗 → cubing.js 原生 backView 'top-right' / 'none' */
  backView?: boolean;
  /** 'moves' (默认) = cubing.js setupAnchor 'start';'algorithm' = 'end' (从 setup·alg⁻¹ 播到 setup) */
  playbackMode?: 'moves' | 'algorithm';
}

/** Twisty 播放器区域——动态导入 cubing 库，用构造函数 API 创建（对齐 legacy） */
export default function TwistySection({
  puzzle, scramble, alg, playerRef, fillPane = false, twistOnClick = false, onUserMove, settings, backView,
}: {
  puzzle: string;
  scramble: string;
  alg: string;
  /** 撑满父容器（左栏分栏模式），否则走原 inline 固定宽模式 */
  fillPane?: boolean;
  /** 强制 cubing.js 原生 backView ('top-right' / 'none')，独立于 settings。
   *  undefined = 不接管(走 settings.backView,如 /sim);true/false = 强制开关(recon)。 */
  backView?: boolean;
  /** 启用 tap-to-twist:cubing.js 默认 movePressInput="auto" 实际关闭点击转面;
   *  传 true 改成 "basic",DragTracker → raycastMove → experimentalAddMove 链路接通。
   *  对齐 alpha.twizzle.net/explore 行为。 */
  twistOnClick?: boolean;
  /** 用户在 player 上 tap/拖动产生 move 时回调。包装了 model.experimentalAddMove,
   *  press handler 走 raycast → addMove → 我们这里截到 move 文本。
   *  程序化设 alg/setup 走 model.alg.set 不经 addMove,不会误触发。 */
  onUserMove?: (moveText: string) => void;
  /** sim 的 PuzzleSettings 子集:scale / yaw / pitch / speed / hint。
   *  其它 NxN-only 项 (thickness / hollow / arrow / coreColor / faceColors) 不传。 */
  settings?: TwistySettings;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  playerRef?: MutableRefObject<any>;
}) {
  // NOTE: 用 state 而非 ref 存构造函数——确保 import 完成后触发重渲染
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [Ctor, setCtor] = useState<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const playerInstRef = useRef<any>(null);
  // player 重建 nonce — 每次构造新 player +1,settings effect 依赖它就能在 player
  // 刚生成时立刻把 settings 同步过去(否则 settings 引用没变 effect 不重跑)
  const [playerNonce, setPlayerNonce] = useState(0);
  const onUserMoveRef = useRef(onUserMove);
  useEffect(() => { onUserMoveRef.current = onUserMove; }, [onUserMove]);

  // NOTE: 自动加载 cubing 库——import 完成后 setCtor 触发重渲染
  useEffect(() => {
    if (!Ctor) {
      import('cubing/twisty').then((mod) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const C = (mod as any).TwistyPlayer || (mod as any).default;
        setCtor(() => C); // NOTE: 用函数式 setState，避免 React 尝试调用构造函数
      }).catch(err => console.warn('Failed to load cubing library:', err));
    }
  }, [Ctor]);

  // 创建 player——只在 ctor / puzzle / twistOnClick / fillPane 变化时重建,
  // 不依赖 scramble/alg,避免每次 alg 变就 rebuild 闪烁。
  useEffect(() => {
    if (!Ctor || !containerRef.current) return;
    const container = containerRef.current;
    container.innerHTML = '';
    const playerInit: Record<string, unknown> = {
      puzzle,
      experimentalSetupAlg: scramble,
      alg,
      controlPanel: 'bottom-row',
    };
    if (twistOnClick) playerInit.experimentalMovePressInput = 'basic';
    const player = new Ctor(playerInit);
    playerInstRef.current = player;
    setPlayerNonce((n) => n + 1);
    // NOTE: light colorScheme 让 scrubber 轨道右侧渲染为白色（对齐 legacy 图2样式）
    player.style.colorScheme = 'light';


    // onUserMove hook: 包 model.experimentalAddMove。cubing.js 的 press handler
    // (Twisty3DPuzzleWrapper.raycastMove) 是唯一会调到 model.experimentalAddMove
    // 的入口;我们设 alg/setup 走 model.alg.set 不经 addMove。
    // 用 onUserMoveRef 避免每次 prop 变都重新 wrap。
    // 修饰键 → cubing.js 内置:shift = 2nd slice (wide/layer), ctrl = rotation, right-click = invert。
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const model = (player as any).experimentalModel;
    if (model && typeof model.experimentalAddMove === 'function') {
      const orig = model.experimentalAddMove.bind(model);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      model.experimentalAddMove = (mv: any, opts?: unknown) => {
        const text = typeof mv === 'string' ? mv : (mv?.toString?.() ?? String(mv));
        try { onUserMoveRef.current?.(text); } catch { /* swallow */ }
        return orig(mv, opts);
      };
    }

    // Pyraminx tip 支持:cubing.js stickerDat.axis 里只有 face 轴 (F/D/L/R 内部) +
    // 4 个 corner-axis (内部大写 FRL/DRF/DFL/DLR,通过 spinmatch 映回外部 u/l/r/b LAYER move),
    // 没有 tip 轴。raycast 点贴近 tip 时它返回的是 layer 小写,而我们想要 tip 大写。
    // wrap getClosestMoveToAxis:hit point 距某 tip vertex 足够近 (<阈值) 时,把 layer
    // 升级为 tip;外部 family 大小写映射:u↔U / l↔L / r↔R / b↔B。
    //
    // 三段式触控:面中心 → F (big corner / 3-layer);近角 → u/l/r/b (layer / 2-layer);
    // 贴顶点 → U/L/R/B (tip / 1-layer)。
    if (puzzle === 'pyraminx') {
      // Pyraminx tip 三段判定:
      //   - F-center 朝外距 ≈ 0.39 (world after PG_SCALE=0.5)
      //   - 大边 mid 距 ≈ 0.7-0.9
      //   - 顶点 (corner vertex) ≈ 1.0+
      // cubing.js stickerDat 没有 tip 轴,但有 4 face 轴 + 4 corner 轴 (内部 FRL/DRF/DFL/DLR
      // → notationToExternal 通过 layer map 项 u→FRL/l→FLD/r→FDR/b→DLR 返回小写 layer)。
      // 默认 click:hit 越接近顶点 → corner 轴胜 → 返回小写 u/l/r/b (layer)。
      // 这里 wrap:小写 layer + hit |point| 大 (世界半径 > TIP_THRESHOLD) = 用户点 tip
      // 区域 → 升 family 为大写 U/L/R/B,在 pyraminxFamilyMap 映为内部 tip frl/fld/...
      // depth=secondSlice (shift) 走 wide ≠ tip,depth=rotation (ctrl) 走 Uv 等。两者直透。
      const LAYER_TO_TIP: Record<string, string> = { u: 'U', l: 'L', r: 'R', b: 'B' };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (async () => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const obj: any = await player.experimentalCurrentThreeJSPuzzleObject();
          if (!obj || playerInstRef.current !== player) return;
          const origClosest = obj.getClosestMoveToAxis?.bind(obj);
          if (typeof origClosest !== 'function') return;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          obj.getClosestMoveToAxis = (point: any, transformations: { invert: boolean; depth?: string }) => {
            const ret = origClosest(point, transformations);
            if (!ret) return ret;
            if (transformations.depth != null && transformations.depth !== 'none') return ret;
            const family: string = ret.move?.family ?? ret.move?.quantum?.family;
            if (!LAYER_TO_TIP[family]) return ret;
            // hit point 距原点 (世界坐标)。Pyraminx 渲染下 PG_SCALE=0.5,顶点 world 距
            // 约 1.0-1.2。 阈值 0.95 = 命中点贴顶点附近 (内 1/4 高度) → tip。
            const d2 = point.x * point.x + point.y * point.y + point.z * point.z;
            if (d2 < 0.90) return ret;
            const tipFam = LAYER_TO_TIP[family];
            try {
              const tipMv = ret.move.modified({ family: tipFam });
              return { move: tipMv, order: ret.order };
            } catch { return ret; }
          };
        } catch { /* dispose / 切 puzzle: 静默回退 */ }
      })();
    }

    if (fillPane) {
      // NOTE: fillPane 模式——ResizeObserver 把像素尺寸直接写入 player，
      // 避免 TwistyPlayer WebGL canvas 在 zoom/resize 时错位（百分比 height 不触发内部 repaint）
      const syncSize = () => {
        const w = container.offsetWidth;
        const h = container.offsetHeight;
        if (w > 0 && h > 0) {
          player.style.width = `${w}px`;
          player.style.height = `${h}px`;
        }
      };
      syncSize();
      const ro = new ResizeObserver(syncSize);
      ro.observe(container);
      container.appendChild(player);
      if (playerRef) playerRef.current = player;
      return () => {
        ro.disconnect();
        if (playerRef) playerRef.current = null;
        playerInstRef.current = null;
      };
    } else {
      player.style.width = '100%';
      player.style.maxWidth = '400px';
      player.style.margin = '12px 0';
      container.appendChild(player);
      if (playerRef) playerRef.current = player;
      return () => {
        if (playerRef) playerRef.current = null;
        playerInstRef.current = null;
      };
    }
    // 故意只在结构性 prop 变 (puzzle / Ctor / fillPane / twistOnClick) 时重建。
    // scramble/alg 走下面的 setter 路径,不触发重建。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Ctor, puzzle, fillPane, twistOnClick]);

  // backView prop 强制接管 cubing.js 原生背面视图(recon 用)。undefined 时不碰,
  // 让 settings.backView 那条路径(/sim)负责。
  useEffect(() => {
    if (backView === undefined) return;
    const player = playerInstRef.current;
    if (!player) return;
    try { player.backView = backView ? 'top-right' : 'none'; } catch { /* */ }
  }, [backView, playerNonce]);

  // alg 同步 — player.alg 是 attribute setter,内部 model.alg.set 对相同输入
  // 做对比 (Alg.toString === current.toString) 不会重 trigger,所以这里直接赋值即可。
  // user tap → wrap → 父级 onAlgChange → prop alg 回流后这里 set,parser 等价
  // → cubing.js no-op,不会拨回 timeline。
  useEffect(() => {
    const player = playerInstRef.current;
    if (!player) return;
    try { player.alg = alg; } catch { /* parser 拒绝就忽略 */ }
  }, [alg]);

  // setup 同步 — 同上但走 experimentalSetupAlg。
  useEffect(() => {
    const player = playerInstRef.current;
    if (!player) return;
    try { player.experimentalSetupAlg = scramble; } catch { /* ignore */ }
  }, [scramble]);

  // settings 同步:把 yaw/pitch/scale/speed/hint 映到 TwistyPlayer 属性。
  // 跟 SettingDrawer 里 NxN 的 applySettings 行为一致 — 滑条 0..100 同一坐标系。
  // viewAngle/viewGradient 只在 slider 真变化或 player 重建时同步,
  // 否则保留 cubing.js drag 累积出来的姿态 (跟 NxN orbit 同款)。
  // megaminx 默认 WCA 朝向(白顶绿前)= lat 26.565 lon=0 — 首次挂载时强制,
  // 不让 sim 全局 yaw/pitch 默认 (30/33 → lon=-72/lat=30.6) 覆盖。
  // 用户主动调 slider 后照常同步。
  const prevYawRef = useRef<number | null>(null);
  const prevPitchRef = useRef<number | null>(null);
  const prevNonceRef = useRef<number>(-1);
  useEffect(() => {
    const player = playerInstRef.current;
    if (!player || !settings) return;
    const yawDeg = ((settings.viewAngle - 50) / 50) * 180;
    const pitchDeg = ((50 - settings.viewGradient) / 50) * 90;
    const dist = 9 - (settings.scale / 100) * 6;
    const tempo = settings.speed <= 50
      ? 0.2 + (settings.speed / 50) * 0.8
      : 1 + ((settings.speed - 50) / 50) * 3;
    const isNewPlayer = prevNonceRef.current !== playerNonce;
    // pyraminx / megaminx / skewb 默认走 alpha.twizzle.net 朝向 (lat=26.565° lon=0)。
    // pyraminx 绿前黄下;megaminx 白顶绿前;skewb 白顶绿前。
    const wcaDefault = (puzzle === 'megaminx' || puzzle === 'pyraminx' || puzzle === 'skewb')
      ? { lat: 26.565, lon: 0 } : null;
    if (isNewPlayer && wcaDefault) {
      try { player.cameraLongitude = wcaDefault.lon; } catch { /* */ }
      try { player.cameraLatitude = wcaDefault.lat; } catch { /* */ }
    } else {
      if (isNewPlayer || prevYawRef.current !== settings.viewAngle) {
        try { player.cameraLongitude = yawDeg; } catch { /* */ }
      }
      if (isNewPlayer || prevPitchRef.current !== settings.viewGradient) {
        try { player.cameraLatitude = pitchDeg; } catch { /* */ }
      }
    }
    try { player.cameraDistance = dist; } catch { /* */ }
    try { player.tempoScale = tempo; } catch { /* */ }
    try { player.hintFacelets = settings.hint ? 'floating' : 'none'; } catch { /* */ }
    try { player.backView = settings.backView ? 'top-right' : 'none'; } catch { /* */ }
    // playbackMode → cubing.js setupAnchor (start = 'moves' / end = 'algorithm')。
    // end 模式下 cube 终点 = setup,起点 = setup·alg⁻¹。
    try { player.experimentalSetupAnchor = settings.playbackMode === 'algorithm' ? 'end' : 'start'; } catch { /* */ }
    prevYawRef.current = settings.viewAngle;
    prevPitchRef.current = settings.viewGradient;
    prevNonceRef.current = playerNonce;
  }, [settings?.viewAngle, settings?.viewGradient, settings?.scale, settings?.speed, settings?.hint, settings?.backView, settings?.playbackMode, settings, playerNonce]);

  // 实时整体转 commit:user 拖动 cube,累积旋转 ≥ 对称阈值时自动 commit alg + camera reset。
  // 视觉无缝要求:commit 瞬间 cube state + camera 同步切换,绕过 cubing.js 的
  // experimentalAddMove(它 set catchUpMove → 触发 backwards 动画导致回弹)。
  // 改成:直接 `player.alg = newAlg` + `timestampRequest.set('end')` + sync camera reset,
  // 三件事同一 paint frame。
  //
  // axis 取自该 puzzle 顶点 / 面中心的单位向量,每帧投影 camera 旋转到这根轴累积。
  //
  // 现状(2026-05-19):cubing.js camera 是 2-DOF orbit(yaw + pitch,无 roll),只能
  // 表达绕 +Y 轴的整体转。pyraminx 非 +Y 顶点(L/R/B)对应的转动需 roll,任何 (lat,lon)
  // 拖动产生的瞬时旋转轴在 L/R/B 上的投影都接近 0(几何上正交),accumulator 永远积不起来。
  // 所以这里 pyraminx 只接 U-vertex(+Y);Lv/Rv/Bv 要支持需自己接管 input + 用
  // experimentalSetupTransformation 把朝向塞进 cube state,绕开 cubing.js camera 限制。
  type AxisCfg = { name: string; axis: [number, number, number]; moveCW: string; moveCCW: string };
  type RotateCfg = { thresholdDeg: number; axes: AxisCfg[] };
  const ROTATE_CONFIG: Record<string, RotateCfg> = {
    // U-vertex / +Y;校准 (.tmp/png/pyra_lon-119_v2 vs pyra_lon0_alg-RLUUvi):Uv' = R_y(+120°)
    pyraminx: { thresholdDeg: 120, axes: [{ name: 'U', axis: [0, 1, 0], moveCW: 'Uv', moveCCW: "Uv'" }] },
    // 校准 (.tmp/png/mega_lon-71_alg-RU vs mega_lon0_alg-RUUvi)
    megaminx: { thresholdDeg: 72, axes: [{ name: 'U', axis: [0, 1, 0], moveCW: 'Uv', moveCCW: "Uv'" }] },
    // skewb 走自己的 pixel-based effect (横/纵两轴 80px = 1 commit),不在这里配。
    // (this entry kept empty 以让 ROTATE_CONFIG['skewb'] 仍存在供 algToOrientation 等用)
    skewb: { thresholdDeg: 90, axes: [] },
  };
  const currentAlgRef = useRef(alg);
  useEffect(() => { currentAlgRef.current = alg; }, [alg]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const faceOverlayRef = useRef<any>(null);
  function quatMulRaw(a: number[], b: number[]): [number, number, number, number] {
    return [
      a[0] * b[0] - a[1] * b[1] - a[2] * b[2] - a[3] * b[3],
      a[0] * b[1] + a[1] * b[0] + a[2] * b[3] - a[3] * b[2],
      a[0] * b[2] - a[1] * b[3] + a[2] * b[0] + a[3] * b[1],
      a[0] * b[3] + a[1] * b[2] - a[2] * b[1] + a[3] * b[0],
    ];
  }
  function quatAxisAngleRaw(a: [number, number, number], rad: number): [number, number, number, number] {
    const h = rad / 2, s = Math.sin(h);
    return [Math.cos(h), a[0] * s, a[1] * s, a[2] * s];
  }
  // 扫 alg token → 累积 cube state quat。moveCW (`y`) = R_axis(-thr),moveCCW (`y'`) = R_axis(+thr)
  // (sign 校准:y' 让 +Z piece 走到 +X,= R_y(+90°);y 反向。)
  function algToOrientation(algStr: string, cfg: { thresholdDeg: number; axes: { axis: [number, number, number]; moveCW: string; moveCCW: string }[] }): [number, number, number, number] {
    let orient: [number, number, number, number] = [1, 0, 0, 0];
    const tokens = algStr.trim().split(/\s+/).filter(Boolean);
    const D2R = Math.PI / 180;
    for (const tok of tokens) {
      for (const ax of cfg.axes) {
        const thr = cfg.thresholdDeg * D2R;
        let angle = 0;
        if (tok === ax.moveCW) angle = -thr;
        else if (tok === ax.moveCCW) angle = thr;
        else if (tok === ax.moveCW + '2' || tok === ax.moveCCW + '2') angle = 2 * thr;
        else continue;
        const q = quatAxisAngleRaw(ax.axis, angle);
        orient = quatMulRaw(q, orient);
        break;
      }
    }
    return orient;
  }
  // 任何 alg 变化 → 重算 orient → 推 overlay。URL load / commit / 手输都过这条 path。
  useEffect(() => {
    const cfg = ROTATE_CONFIG[puzzle];
    if (!cfg) return;
    const orient = algToOrientation(alg, cfg);
    try { faceOverlayRef.current?.setCubeOrientation(orient); } catch { /* */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alg, puzzle, playerNonce]);
  useEffect(() => {
    const player = playerInstRef.current;
    const cfg = ROTATE_CONFIG[puzzle];
    if (!player || !cfg) return;
    // skewb 走自己的 pixel-based pointer overlay (无限 x/y chain),跳过 orbit-commit。
    if (puzzle === 'skewb') return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const m = (player as any).experimentalModel;
    const sceneModel = m?.twistySceneModel;
    if (!sceneModel?.orbitCoordinates || !m?.alg || !m?.timestampRequest) return;

    // 当有 +Y 之外的 vertex 轴时,纵向拖动要能跨阈值 → 抬 latitudeLimit
    // (cubing.js 默认 35°,卡死任何 90° lat 累积)。
    // pyraminx/megaminx axes 只 +Y,纵拖不 commit,不抬避免相机翻过头。
    const hasNonUAxis = cfg.axes.some((ax) => Math.abs(ax.axis[1]) < 0.99);
    if (hasNonUAxis) {
      try { (player as any).cameraLatitudeLimit = 180; } catch { /* */ }
    }

    // camera 在 (lat, lon) 的姿态 = R_y(lon) * R_x(-lat),用 quaternion 表示。
    // 把 (lat, lon) 转 quat,然后 deltaQ = curQ * inv(prevQ) 是这帧 camera 转了多少。
    // axis-angle 拆出来,投到每条 vertex 轴,累加进 accum,某根超过 threshold 就 commit。
    const D2R = Math.PI / 180;
    function quatFromAxisAngle(a: [number, number, number], rad: number): [number, number, number, number] {
      const h = rad / 2, s = Math.sin(h);
      return [Math.cos(h), a[0] * s, a[1] * s, a[2] * s];
    }
    function quatMul(a: number[], b: number[]): [number, number, number, number] {
      return [
        a[0] * b[0] - a[1] * b[1] - a[2] * b[2] - a[3] * b[3],
        a[0] * b[1] + a[1] * b[0] + a[2] * b[3] - a[3] * b[2],
        a[0] * b[2] - a[1] * b[3] + a[2] * b[0] + a[3] * b[1],
        a[0] * b[3] + a[1] * b[2] - a[2] * b[1] + a[3] * b[0],
      ];
    }
    function quatInv(q: number[]): [number, number, number, number] {
      return [q[0], -q[1], -q[2], -q[3]];
    }
    function quatRotate(q: number[], v: [number, number, number]): [number, number, number] {
      // v 当纯虚 quat 处理:result = q * (0,v) * inv(q)
      const vq: [number, number, number, number] = [0, v[0], v[1], v[2]];
      const r = quatMul(quatMul(q, vq), quatInv(q));
      return [r[1], r[2], r[3]];
    }
    function cameraQuat(latDeg: number, lonDeg: number) {
      const qY = quatFromAxisAngle([0, 1, 0], lonDeg * D2R);
      const qX = quatFromAxisAngle([1, 0, 0], -latDeg * D2R);
      return quatMul(qY, qX);
    }
    function quatToAxisAngle(q: number[]): { axis: [number, number, number]; angle: number } {
      // q[0] = cos(θ/2), |q.xyz| = sin(θ/2)
      let w = q[0]; let x = q[1], y = q[2], z = q[3];
      if (w < 0) { w = -w; x = -x; y = -y; z = -z; } // canonical: θ ∈ [0, π]
      const sinHalf = Math.hypot(x, y, z);
      const angle = 2 * Math.atan2(sinHalf, w);
      if (sinHalf < 1e-8) return { axis: [1, 0, 0], angle: 0 };
      return { axis: [x / sinHalf, y / sinHalf, z / sinHalf], angle };
    }
    function quatToOrbit(q: number[]): { lat: number; lon: number } {
      // camera eye direction = q * (0,0,1)
      const e = quatRotate(q as [number, number, number, number], [0, 0, 1]);
      const lat = Math.asin(Math.max(-1, Math.min(1, e[1]))) / D2R;
      const lon = Math.atan2(e[0], e[2]) / D2R;
      return { lat, lon };
    }

    let prevLat: number | null = null;
    let prevLon: number | null = null;
    const accum: number[] = cfg.axes.map(() => 0);  // 每根 vertex 轴的有效转角(rad)
    let cooldownUntil = 0;
    const COOLDOWN_MS = 400;
    const thresholdRad = cfg.thresholdDeg * D2R;

    const onOrbit = (o: { latitude: number; longitude: number }) => {
      const now = performance.now();
      // cooldown 期间:同步 prev,zero accum,不 commit。
      if (now < cooldownUntil) {
        prevLat = o.latitude; prevLon = o.longitude;
        for (let i = 0; i < accum.length; i++) accum[i] = 0;
        return;
      }
      if (prevLat === null || prevLon === null) {
        prevLat = o.latitude; prevLon = o.longitude;
        return;
      }
      // 这帧 camera 转了多少
      const prevQ = cameraQuat(prevLat, prevLon);
      const curQ = cameraQuat(o.latitude, o.longitude);
      const deltaQ = quatMul(curQ, quatInv(prevQ));
      const { axis: rotAxis, angle: rotAngle } = quatToAxisAngle(deltaQ);
      prevLat = o.latitude;
      prevLon = o.longitude;
      if (rotAngle < 1e-6) return;
      // 投影到每根 vertex 轴
      for (let i = 0; i < cfg.axes.length; i++) {
        const V = cfg.axes[i].axis;
        const dot = rotAxis[0] * V[0] + rotAxis[1] * V[1] + rotAxis[2] * V[2];
        accum[i] += dot * rotAngle;
      }
      // 检查超 threshold
      for (let i = 0; i < cfg.axes.length; i++) {
        if (Math.abs(accum[i]) < thresholdRad) continue;
        const ax = cfg.axes[i];
        // 推导:visual_pre = render(state, camera_curQ) = project(curQ^-1 * state)。
        //       visual_post = render(T(M) * state, camera_targetQ) = project(targetQ^-1 * T(M) * state)。
        // 视觉相等 ⇒ targetQ = T(M) * curQ。
        // playwright 校准 (Uv 那条):drag 右 (curQ = R_y(-Δ),accum_U<0) → commit Uv',
        // 而 Uv' = R_y(+120°)(CCW 绕 +Y)。所以 accum<0 → moveCCW;moveQ 方向跟 accum 反号:
        //   accum>0(camera CCW 绕 +V)→ commit moveCW(= R_V(-120°),把 camera 转回去 -120°)
        //   accum<0(camera CW 绕 +V)→ commit moveCCW(= R_V(+120°))
        const move = accum[i] > 0 ? ax.moveCW : ax.moveCCW;
        // targetQ = T(M) * curQ(seamless),所以 moveQ ≡ T(M) ≡ alg 给 cube state 的世界旋转
        const moveQ = quatFromAxisAngle(ax.axis as [number, number, number], -Math.sign(accum[i]) * thresholdRad);
        const targetQ = quatMul(moveQ, curQ);
        const { lat: targetLat, lon: targetLon } = quatToOrbit(targetQ);
        try {
          const curAlg = currentAlgRef.current.trim();
          const newAlg = curAlg ? `${curAlg} ${move}` : move;
          currentAlgRef.current = newAlg;
          player.alg = newAlg;
          m.timestampRequest.set('end');
          player.cameraLatitude = targetLat;
          player.cameraLongitude = targetLon;
          // commit 当帧同步推 overlay orientation;prop alg round-trip 异步,不推这一次 label 跳 1 frame
          const newOrient = algToOrientation(newAlg, cfg);
          faceOverlayRef.current?.setCubeOrientation(newOrient);
          onUserMoveRef.current?.(move);
        } catch { /* */ }
        cooldownUntil = now + COOLDOWN_MS;
        for (let j = 0; j < accum.length; j++) accum[j] = 0;
        prevLat = targetLat; prevLon = targetLon;
        return;
      }
    };
    sceneModel.orbitCoordinates.addFreshListener(onOrbit);
    return () => {
      try { sceneModel.orbitCoordinates.removeFreshListener(onOrbit); } catch { /* */ }
    };
  // ROTATE_CONFIG 是组件内 const 不变,不入 deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerNonce, puzzle]);

  // rotate 模式:player 容器上 pointerup 时,把 cameraLat/Long snap 到 puzzle 旋转对称角度。
  //   pyraminx (四面体): 120° (3 重对称 — 顶点轴)
  //   skewb (立方体): 90°
  //   megaminx (十二面体): 72° (5 重对称 — 面轴)
  // cubing.js 自带 orbit 我们不拦截,只在松手后修正。
  const dragEmptyRef = useRef<'orbit' | 'rotate' | 'view'>('orbit');
  useEffect(() => { dragEmptyRef.current = settings?.dragEmpty ?? 'orbit'; }, [settings?.dragEmpty]);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const Q_DEG = puzzle === 'pyraminx' ? 120 : puzzle === 'megaminx' ? 72 : 90;
    const onUp = () => {
      if (dragEmptyRef.current !== 'rotate') return;
      const player = playerInstRef.current;
      if (!player) return;
      try {
        const lat = Number(player.cameraLatitude);
        const lon = Number(player.cameraLongitude);
        if (Number.isFinite(lat)) player.cameraLatitude = Math.round(lat / Q_DEG) * Q_DEG;
        if (Number.isFinite(lon)) player.cameraLongitude = Math.round(lon / Q_DEG) * Q_DEG;
      } catch { /* ignore */ }
    };
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    return () => {
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
    };
  }, [playerNonce, puzzle]);

  // Face hints (字母指示):TwistyPlayer 用 closed shadow DOM,renderer 拿不到,
  // 改用 HTML overlay。订阅 orbitCoordinates → 自家投影 3D→2D → 绝对定位 span。
  // sticker drag 不改 orbit,所以 lat/lon 没变 = 不点亮(跟 sim NxN 同语义)。
  useEffect(() => {
    const player = playerInstRef.current;
    const host = containerRef.current;
    const table = FACE_TABLES[puzzle];
    if (!player || !host || !table) return;
    const model = player.experimentalModel?.twistySceneModel?.orbitCoordinates;
    if (!model || typeof model.addFreshListener !== 'function') return;

    const overlay = new FaceOverlay(host, table, {
      // skewb 用 screenSlot mode,3 个 visible slot = U/F/R(屏幕方位钉死,不跟 piece)
      // pyraminx 也 screenSlot(4 vertex 3 visible)。megaminx 仍 piece-follow。
      screenSlot: puzzle === 'pyraminx' || puzzle === 'skewb',
      visibleSlotCount: puzzle === 'skewb' ? 3 : undefined,
    });
    overlay.setCubeOrientation(algToOrientation(currentAlgRef.current, ROTATE_CONFIG[puzzle] ?? { thresholdDeg: 0, axes: [] }));
    faceOverlayRef.current = overlay;
    // cubing.js 的 drag-to-orbit 在 closed shadow DOM 内捕获 pointer event,
    // host 监听不到。改用 orbitCoordinates listener 间接判断:
    // - 第一次 fresh 值不算"变化"
    // - 后续每次 lat/lon 变 → show(),并启 idle 计时
    // - idle 500ms 不变 → hide()
    let lastLat: number | null = null;
    let lastLon: number | null = null;
    let hideTimer: number | null = null;
    const HIDE_AFTER_MS = 500;
    const onOrbit = (o: { latitude: number; longitude: number; distance: number }) => {
      overlay.setOrbit(o);
      if (lastLat === null) {
        lastLat = o.latitude;
        lastLon = o.longitude;
        return;
      }
      if (o.latitude !== lastLat || o.longitude !== lastLon) {
        lastLat = o.latitude;
        lastLon = o.longitude;
        overlay.show();
        if (hideTimer != null) window.clearTimeout(hideTimer);
        hideTimer = window.setTimeout(() => { overlay.hide(); hideTimer = null; }, HIDE_AFTER_MS);
      }
    };
    model.addFreshListener(onOrbit);

    let raf = 0;
    let last = performance.now();
    const tick = () => {
      const now = performance.now();
      overlay.tick(now - last);
      last = now;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      if (hideTimer != null) window.clearTimeout(hideTimer);
      try { model.removeFreshListener(onOrbit); } catch { /* ignore */ }
      overlay.dispose();
      if (faceOverlayRef.current === overlay) faceOverlayRef.current = null;
    };
  }, [playerNonce, puzzle]);

  // skewb 拖动直接 commit x/y:横拖 80px/y/y'、纵拖 80px/x/x'。
  // cubing.js 同时收到 pointer events (overlay 默认 pointer-events:none) → 想改 lat/lon。
  // orbit fresh listener 把 cubing.js 拖出的 lat/lon 偏移 reset 回 lockedLat/lockedLon
  // → camera 视觉不动,只有 cube alg state 跟着 y/x 累计转,无限 chain。
  // pointerup 后延迟 600ms 解锁让 cubing.js inertia 平息。
  useEffect(() => {
    if (puzzle !== 'skewb') return;
    const section = containerRef.current?.parentElement;
    const player = playerInstRef.current;
    if (!section || !player) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const m = (player as any).experimentalModel;
    const sceneModel = m?.twistySceneModel;
    if (!sceneModel?.orbitCoordinates || !sceneModel?.orbitCoordinatesRequest) return;

    const PIXELS_PER_COMMIT = 80;
    const UNLOCK_DELAY_MS = 600;
    let active = false;
    let locking = false;
    let activePid = -1;
    let downX = 0, downY = 0;
    let committedX = 0, committedY = 0;
    let lockedLat: number | null = null;
    let lockedLon: number | null = null;
    let resetting = false;
    let unlockTimer: number | null = null;
    let latestLat: number | null = null;
    let latestLon: number | null = null;

    const commit = (move: string) => {
      try { player.experimentalAddMove(move); } catch { /* */ }
    };

    const onOrbit = (o: { latitude: number; longitude: number; distance: number }) => {
      latestLat = o.latitude;
      latestLon = o.longitude;
      if (!locking || resetting) return;
      if (lockedLat === null) lockedLat = o.latitude;
      if (lockedLon === null) lockedLon = o.longitude;
      const dLat = Math.abs(o.latitude - lockedLat);
      const dLon = Math.abs(o.longitude - lockedLon);
      if (dLat < 1e-3 && dLon < 1e-3) return;
      resetting = true;
      try {
        sceneModel.orbitCoordinatesRequest.set({
          latitude: lockedLat,
          longitude: lockedLon,
          distance: o.distance,
        });
      } catch { /* */ }
      resetting = false;
    };

    const sectionDown = (e: PointerEvent) => {
      if (active) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      active = true;
      locking = true;
      activePid = e.pointerId;
      downX = e.clientX;
      downY = e.clientY;
      committedX = 0;
      committedY = 0;
      if (unlockTimer != null) { window.clearTimeout(unlockTimer); unlockTimer = null; }
      if (lockedLat === null) lockedLat = latestLat;
      if (lockedLon === null) lockedLon = latestLon;
    };
    const sectionMove = (e: PointerEvent) => {
      if (!active || e.pointerId !== activePid) return;
      const dx = e.clientX - downX;
      const dy = e.clientY - downY;
      // 横轴 commit y/y':dx > 0 (向右拖) → y',dx < 0 (向左拖) → y
      // 校准约定:cubing.js camera lon drag 右 → cube 视觉相对左转 (CCW 从上看) ≡ y',
      //          所以横拖 → 对应 cube state alg 加 y'。
      const tx = Math.trunc(dx / PIXELS_PER_COMMIT);
      const deltaX = tx - committedX;
      if (deltaX !== 0) {
        const move = deltaX > 0 ? "y'" : 'y';
        const n = Math.abs(deltaX);
        for (let i = 0; i < n; i++) commit(move);
        committedX = tx;
      }
      // 纵轴 commit x/x':dy > 0 (向下拖) → x',dy < 0 (向上拖) → x
      const ty = Math.trunc(dy / PIXELS_PER_COMMIT);
      const deltaY = ty - committedY;
      if (deltaY !== 0) {
        const move = deltaY > 0 ? "x'" : 'x';
        const n = Math.abs(deltaY);
        for (let i = 0; i < n; i++) commit(move);
        committedY = ty;
      }
    };
    const sectionUp = (e: PointerEvent) => {
      if (e.pointerId !== activePid) return;
      active = false;
      activePid = -1;
      committedX = 0;
      committedY = 0;
      if (unlockTimer != null) window.clearTimeout(unlockTimer);
      unlockTimer = window.setTimeout(() => {
        unlockTimer = null;
        if (!active) {
          locking = false;
          lockedLat = null;
          lockedLon = null;
        }
      }, UNLOCK_DELAY_MS);
    };

    sceneModel.orbitCoordinates.get().then((o: { latitude: number; longitude: number }) => {
      if (typeof o?.latitude === 'number' && latestLat === null) latestLat = o.latitude;
      if (typeof o?.longitude === 'number' && latestLon === null) latestLon = o.longitude;
    }).catch(() => { /* */ });
    sceneModel.orbitCoordinates.addFreshListener(onOrbit);
    section.addEventListener('pointerdown', sectionDown, true);
    section.addEventListener('pointermove', sectionMove, true);
    section.addEventListener('pointerup', sectionUp, true);
    section.addEventListener('pointercancel', sectionUp, true);
    return () => {
      if (unlockTimer != null) window.clearTimeout(unlockTimer);
      try { sceneModel.orbitCoordinates.removeFreshListener(onOrbit); } catch { /* */ }
      section.removeEventListener('pointerdown', sectionDown, true);
      section.removeEventListener('pointermove', sectionMove, true);
      section.removeEventListener('pointerup', sectionUp, true);
      section.removeEventListener('pointercancel', sectionUp, true);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puzzle, playerNonce]);

  return (
    <div className={`twisty-section${fillPane ? ' twisty-section--fill' : ''}`}>
      <div ref={containerRef} className="twisty-container" />
    </div>
  );
}
