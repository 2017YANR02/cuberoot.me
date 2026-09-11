import type { Group } from 'three';

/** Scene-facing contract only. Web injects its optional, asset-backed hand rig. */
export interface HandsCubeLike {
  order: number;
  table: { groups: Record<'x' | 'y' | 'z', { angle: number }[]> };
}

export interface WorldHands extends Group {
  readonly isEnabled: boolean;
  setFullBody(want: boolean): void;
  setEnabled(enabled: boolean): void;
  attachCube(cube: HandsCubeLike | null): void;
}
