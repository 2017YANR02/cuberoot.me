import { useState, useRef, useEffect, type MutableRefObject } from 'react';
import './TwistySection.css';

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
}

/** Twisty 播放器区域——动态导入 cubing 库，用构造函数 API 创建（对齐 legacy） */
export default function TwistySection({
  puzzle, scramble, alg, playerRef, fillPane = false, twistOnClick = false, onUserMove, settings,
}: {
  puzzle: string;
  scramble: string;
  alg: string;
  /** 撑满父容器（左栏分栏模式），否则走原 inline 固定宽模式 */
  fillPane?: boolean;
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
  useEffect(() => {
    const player = playerInstRef.current;
    if (!player || !settings) return;
    // yaw 0..100 → -180..180 度 (cuber SettingDrawer 是 -π/2..π/2 弧度;TwistyPlayer
    //   接受度数,这里把范围放宽到 -180..180 让"反面"也能转到)
    const yawDeg = ((settings.viewAngle - 50) / 50) * 180;
    // pitch 0..100 → 90..-90 (上下) — cuber 是 0=俯视90 / 100=仰视-90
    const pitchDeg = ((50 - settings.viewGradient) / 50) * 90;
    // scale 0..100 → cameraDistance [9, 3]:近端 (slider=100) ≈ 3,远端 (slider=0) ≈ 9。
    //   默认 50 → 6,跟 cubing.js TwistyPlayer 默认 cameraDistance 同量级。
    const dist = 9 - (settings.scale / 100) * 6;
    // speed 0..100 → tempoScale [0.2, 4],默认 50 → 1
    const tempo = settings.speed <= 50
      ? 0.2 + (settings.speed / 50) * 0.8
      : 1 + ((settings.speed - 50) / 50) * 3;
    try { player.cameraLongitude = yawDeg; } catch { /* */ }
    try { player.cameraLatitude = pitchDeg; } catch { /* */ }
    try { player.cameraDistance = dist; } catch { /* */ }
    try { player.tempoScale = tempo; } catch { /* */ }
    try { player.hintFacelets = settings.hint ? 'floating' : 'none'; } catch { /* */ }
  }, [settings?.viewAngle, settings?.viewGradient, settings?.scale, settings?.speed, settings?.hint, settings, playerNonce]);

  return (
    <div className={`twisty-section${fillPane ? ' twisty-section--fill' : ''}`}>
      <div ref={containerRef} className="twisty-container" />
    </div>
  );
}
