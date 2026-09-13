import type { Group, Vector3 } from 'three';

/** Scene-facing contract only. Web injects its optional, asset-backed hand rig. */
export interface HandsCubeLike {
  order: number;
  table: { groups: Record<'x' | 'y' | 'z', { angle: number }[]> };
}

export interface WorldHands extends Group {
  readonly isEnabled: boolean;
  setFullBody(want: boolean): void;
  setAvatar?(src: string, x?: number, y?: number, scale?: number): void;
  getHeadView?(position: Vector3, direction: Vector3): boolean;
  setEnabled(enabled: boolean): void;
  attachCube(cube: HandsCubeLike | null): void;
}
