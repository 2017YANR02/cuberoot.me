import type { Quat } from '@cuberoot/shared/smart-cube/orientation';

export interface NativeCubeCanvas {
  width: number;
  height: number;
  getContext(type: 'webgl2'): unknown;
  requestAnimationFrame?(callback: () => void): number;
  cancelAnimationFrame?(handle: number): void;
}

export interface NativeCubeWebglOptions {
  solverBackdrop?: string;
}

export interface NativeCubeWebgl {
  reset(facelets: string): void;
  move(token: string, facelets: string, timestamp: number): void;
  gyro(pose: Quat): void;
  pose(pose: Quat): void;
  resetOrientation(pose: Quat | null): void;
  orbit(dx: number, dy: number): void;
  replaySetup(algorithm: string): void;
  replayMove(token: string, durationTicks: number): void;
  resize(width: number, height: number, pixelRatio?: number): void;
  dispose(): void;
}

export function createNativeCubeWebgl(
  canvas: NativeCubeCanvas,
  width: number,
  height: number,
  pixelRatio?: number,
  onUnavailable?: (error: unknown) => void,
  options?: NativeCubeWebglOptions,
): NativeCubeWebgl | null;
