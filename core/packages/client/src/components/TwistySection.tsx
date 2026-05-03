import { useState, useRef, useEffect, type MutableRefObject } from 'react';
import './TwistySection.css';

/** Twisty 播放器区域——动态导入 cubing 库，用构造函数 API 创建（对齐 legacy） */
export default function TwistySection({
  puzzle, scramble, alg, playerRef, fillPane = false,
}: {
  puzzle: string;
  scramble: string;
  alg: string;
  /** 撑满父容器（左栏分栏模式），否则走原 inline 固定宽模式 */
  fillPane?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  playerRef?: MutableRefObject<any>;
}) {
  // NOTE: 用 state 而非 ref 存构造函数——确保 import 完成后触发重渲染
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [Ctor, setCtor] = useState<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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

  // NOTE: 构造函数就绪后，用 new TwistyPlayer({...}) 创建（与 legacy 一致）
  useEffect(() => {
    if (!Ctor || !containerRef.current) return;
    const container = containerRef.current;
    container.innerHTML = '';
    const player = new Ctor({
      puzzle,
      experimentalSetupAlg: scramble,
      alg,
      controlPanel: 'bottom-row',
    });
    // NOTE: light colorScheme 让 scrubber 轨道右侧渲染为白色（对齐 legacy 图2样式）
    player.style.colorScheme = 'light';

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
      };
    } else {
      player.style.width = '100%';
      player.style.maxWidth = '400px';
      player.style.margin = '12px 0';
      container.appendChild(player);
      if (playerRef) playerRef.current = player;
      return () => {
        if (playerRef) playerRef.current = null;
      };
    }
  }, [Ctor, puzzle, scramble, alg, playerRef, fillPane]);

  return (
    <div className={`twisty-section${fillPane ? ' twisty-section--fill' : ''}`}>
      <div ref={containerRef} className="twisty-container" />
    </div>
  );
}
