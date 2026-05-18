import { useState, useRef, useEffect, type MutableRefObject } from 'react';
import './TwistySection.css';

/** Twisty 播放器区域——动态导入 cubing 库，用构造函数 API 创建（对齐 legacy） */
export default function TwistySection({
  puzzle, scramble, alg, playerRef, fillPane = false, twistOnClick = false, onUserMove,
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  playerRef?: MutableRefObject<any>;
}) {
  // NOTE: 用 state 而非 ref 存构造函数——确保 import 完成后触发重渲染
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [Ctor, setCtor] = useState<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const playerInstRef = useRef<any>(null);
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
    // NOTE: light colorScheme 让 scrubber 轨道右侧渲染为白色（对齐 legacy 图2样式）
    player.style.colorScheme = 'light';

    // onUserMove hook: 包 model.experimentalAddMove。cubing.js 的 press handler
    // (Twisty3DPuzzleWrapper.raycastMove) 是唯一会调到 model.experimentalAddMove
    // 的入口;我们设 alg/setup 走 model.alg.set 不经 addMove。
    // 用 onUserMoveRef 避免每次 prop 变都重新 wrap。
    // 修饰键 → cubing.js 内置:shift = 2nd slice (wide/layer), ctrl = rotation, right-click = invert。
    // 金字塔 tip (小角) 走点击 puzzle 后 alt 改 family lowercase 的路 不可行 (pyraminx 用 U/L/R/B
    // 当 tip 命名,而 raycast 给的 family 是 F/D/BL/BR — 改 lowercase 得到的 f/d/bl/br 在 pyraminx
    // 不合法 → "Bad move"。 完整 tip 支持得靠 positional raycast,在后续 iter 加。
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

  return (
    <div className={`twisty-section${fillPane ? ' twisty-section--fill' : ''}`}>
      <div ref={containerRef} className="twisty-container" />
    </div>
  );
}
