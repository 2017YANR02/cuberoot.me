/**
 * Shared, public-surface types for the bluetooth module.
 *
 * Lives in its own file so `driver.ts`, the per-brand drivers, and the
 * top-level hook in `index.ts` can all import them without creating an
 * import cycle.
 */

/**
 * `moyu` is the older unencrypted MHC protocol (MoYu AI Cube); `moyu32` is
 * the encrypted WCU_MY32 protocol every currently-sold MoYu smart cube
 * (WeiLong V10 Ai onward) speaks. They share nothing but the vendor.
 */
export type CubeBrand =
  | 'gan-v2' | 'gan-v3' | 'gan-v4'
  | 'gocube' | 'qiyi' | 'giiker'
  | 'moyu' | 'moyu32'
  | 'unknown';

export interface BluetoothCubeStatus {
  connected: boolean;
  brand: CubeBrand;
  /** 0..100, or null when the cube doesn't expose / hasn't reported it yet. */
  battery: number | null;
  /** Pretty name like "GAN 356 i3 (XX:XX)" — for the UI. */
  deviceName: string;
  /**
   * True when the connected driver can decode an orientation quaternion off
   * the wire, i.e. passing `onGyro` to the hook will actually produce
   * samples. This is a PROTOCOL capability, not a hardware probe: an old
   * non-gyro batch of a gyro-capable model still reports true and simply
   * never emits.
   */
  hasGyro: boolean;
}
