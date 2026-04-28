/**
 * Shared, public-surface types for the bluetooth module.
 *
 * Lives in its own file so `driver.ts`, the per-brand drivers, and the
 * top-level hook in `index.ts` can all import them without creating an
 * import cycle.
 */

export type CubeBrand = 'gan-v3' | 'gan-v4' | 'gocube' | 'qiyi' | 'giiker' | 'unknown';

export interface BluetoothCubeStatus {
  connected: boolean;
  brand: CubeBrand;
  /** 0..100, or null when the cube doesn't expose / hasn't reported it yet. */
  battery: number | null;
  /** Pretty name like "GAN 356 i3 (XX:XX)" — for the UI. */
  deviceName: string;
}
