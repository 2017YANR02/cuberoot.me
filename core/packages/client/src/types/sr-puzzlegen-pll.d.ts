// NOTE: sr-puzzlegen-pll 没有 TypeScript 类型定义，这里提供最小声明
declare module 'sr-puzzlegen-pll' {
  type VisualizerType = 'cube' | 'cube-pll' | 'cube-top' | 'plan' | string;

  interface PuzzleOptions {
    alg?: string;
    scheme?: Record<string, { value: string; name: string }>;
    rotations?: Array<{ x: number; y: number; z: number }>;
    mask?: Record<string, number[]>;
  }

  interface SVGOptions {
    puzzle: PuzzleOptions;
    width?: number;
    height?: number;
    strokeWidth?: number;
  }

  export function SVG(
    container: HTMLElement,
    type: VisualizerType,
    options: SVGOptions
  ): void;
}
