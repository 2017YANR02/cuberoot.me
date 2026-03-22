import { useEffect, useRef } from 'react';

interface CubeViewProps {
  /** 打乱公式（用于渲染 case 状态） */
  scramble: string;
  /** 魔方类型，默认 3x3x3 */
  puzzle?: string;
  /** 显示尺寸（像素） */
  size?: number;
}

/**
 * cubing.js twisty-player 的 React 封装
 *
 * NOTE: twisty-player 是 Web Component（Custom Element），不是 React 组件，
 * 因此用 ref 直接操作 DOM 来创建和更新。
 *
 * PLL 训练器使用 2D 顶面视图（visualization="2D"），
 * 通过 experimentalSetupAlg 传入打乱以显示 case 的最后一层状态。
 */
export function CubeView({
  scramble,
  puzzle = '3x3x3',
  size = 200,
}: CubeViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<HTMLElement | null>(null);
  // 记录是否已加载 cubing 模块
  const loadedRef = useRef(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 动态 import cubing/twisty（避免 SSR 问题 + 懒加载）
    const initPlayer = async () => {
      if (!loadedRef.current) {
        await import('cubing/twisty');
        loadedRef.current = true;
      }

      // 移除旧 player
      if (playerRef.current) {
        playerRef.current.remove();
        playerRef.current = null;
      }

      // 创建新 twisty-player 元素
      const player = document.createElement('twisty-player');
      player.setAttribute('puzzle', puzzle);
      player.setAttribute('visualization', 'experimental-2D-LL');
      player.setAttribute('experimental-setup-alg', scramble);
      player.setAttribute('alg', '');
      player.setAttribute('background', 'none');
      player.setAttribute('control-panel', 'none');
      player.setAttribute('experimental-stickering', 'PLL');
      player.style.width = `${size}px`;
      player.style.height = `${size}px`;

      container.appendChild(player);
      playerRef.current = player;
    };

    initPlayer();

    return () => {
      if (playerRef.current) {
        playerRef.current.remove();
        playerRef.current = null;
      }
    };
  }, [scramble, puzzle, size]);

  return (
    <div
      ref={containerRef}
      className="cube-view"
      style={{
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    />
  );
}
