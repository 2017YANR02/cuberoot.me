/**
 * CubeView — 从 pll_recognition_trainer/src/components/PllPic.vue 原版移植
 *
 * 使用 sr-puzzlegen-pll 库渲染 SVG 魔方视图
 * 支持视图类型：cube（3D透视遮盖）、cube-pll（3D透视显示PLL）、plan（顶面俯视）
 */
import { useEffect, useRef, useCallback } from 'react';
import { SVG } from 'sr-puzzlegen-pll';

// NOTE: sr-puzzlegen 的默认朝向是黄顶蓝前
const DEFAULT_COLOR_SCHEME = {
  U: { value: '#FFFF00', name: 'YELLOW' },
  R: { value: '#FF0000', name: 'RED' },
  F: { value: '#0000FF', name: 'BLUE' },
  D: { value: '#FFFFFF', name: 'WHITE' },
  L: { value: '#FFA500', name: 'ORANGE' },
  B: { value: '#32CD32', name: 'LIGHT_GREEN' },
};

// NOTE: 和原版 PllPic.vue 相同的默认视角（Right view）
const DEFAULT_ROTATIONS = [{ x: 35, y: 50, z: 29 }];

// 隐藏整个魔方的遮罩（paused 时用）
const NO_CUBE_MASK = {
  U: [0, 1, 2, 3, 4, 5, 6, 7, 8],
  F: [0, 1, 2, 3, 4, 5, 6, 7, 8],
  B: [0, 1, 2, 3, 4, 5, 6, 7, 8],
  R: [0, 1, 2, 3, 4, 5, 6, 7, 8],
  L: [0, 1, 2, 3, 4, 5, 6, 7, 8],
  D: [0, 1, 2, 3, 4, 5, 6, 7, 8],
};

interface CubeViewProps {
  /** 打乱序列（moves string） */
  scramble: string;
  /**
   * 视图类型：
   * - "cube": 3D 透视，训练时遮盖 PLL 信息
   * - "cube-pll": 3D 透视，显示 PLL 颜色（答错后显示正确答案）
   * - "plan": 顶面俯视（选择页缩略图用）
   */
  viewType: string;
  /** SVG 尺寸（px） */
  size?: number;
  /** 是否可点击 */
  onClick?: () => void;
}

export default function CubeView({ scramble, viewType, size = 200, onClick }: CubeViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const insertSvg = useCallback(() => {
    if (!containerRef.current) return;
    containerRef.current.innerHTML = '';

    const opts = {
      puzzle: {
        alg: scramble,
        scheme: DEFAULT_COLOR_SCHEME,
      } as Record<string, unknown>,
      width: size,
      height: size,
      strokeWidth: 0.01,
    };

    // cube 和 cube-pll 视图需要旋转角度
    if (viewType === 'cube' || viewType === 'cube-pll') {
      (opts.puzzle as Record<string, unknown>).rotations = DEFAULT_ROTATIONS;
    }

    // 没有打乱时显示空白
    if (!scramble) {
      (opts.puzzle as Record<string, unknown>).mask = NO_CUBE_MASK;
    }

    // NOTE: sr-puzzlegen-pll 没有 TypeScript 类型定义，需要 as any
    SVG(containerRef.current, viewType as any, opts);
  }, [scramble, viewType, size]);

  useEffect(() => {
    insertSvg();
  }, [insertSvg]);

  return (
    <div
      ref={containerRef}
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default', display: 'inline-block' }}
    />
  );
}
