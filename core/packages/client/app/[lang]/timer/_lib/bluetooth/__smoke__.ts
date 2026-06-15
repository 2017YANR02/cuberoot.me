/**
 * Type-only smoke test for the bluetooth module's public surface.
 *
 * This file is compiled by `tsc --noEmit` along with the rest of the
 * client; if any of the imports below fail to resolve / type-check, the
 * whole repo's typecheck breaks. We do NOT execute any of this code (no
 * runtime test runner runs it), so it's fine that it touches `navigator`
 * and React.
 *
 * To eyeball-test imports under tsx without a browser:
 *     pnpm exec tsx core/packages/client/src/pages/timer/bluetooth/__smoke__.ts
 *
 * We don't try to actually call `useBluetoothCube` here — that requires a
 * React renderer. The `_assertHook` line below proves the function's type
 * matches the documented contract.
 */

import {
  useBluetoothCube,
  type BluetoothCubeHandle,
  type BluetoothCubeStatus,
  type CubeBrand,
  type CubeDriver,
  type CubeDriverStartResult,
} from './index';
import { CubeStateTracker } from './state_track';

// Hook signature.
type Hook = (opts?: {
  onMove?: (move: string) => void;
  onSolved?: () => void;
}) => BluetoothCubeHandle;

const _assertHook: Hook = useBluetoothCube;
void _assertHook;

// Status type-shape sanity.
const _status: BluetoothCubeStatus = {
  connected: false,
  brand: 'unknown',
  battery: null,
  deviceName: '',
};
void _status;

// Brand union sanity.
const _brands: CubeBrand[] = ['gan-v3', 'gan-v4', 'gocube', 'qiyi', 'unknown'];
void _brands;

// Driver shape sanity.
function _assertDriver(d: CubeDriver): CubeDriver { return d; }
void _assertDriver;

// CubeDriverStartResult sanity.
function _assertStart(r: CubeDriverStartResult): CubeDriverStartResult { return r; }
void _assertStart;

// State tracker round-trip — a real, runnable check.
function smokeTracker(): boolean {
  const t = new CubeStateTracker();
  if (!t.isSolved()) return false;
  // R U R' U' brings the cube back to non-solved after R, then to non-
  // solved still after U R' U' — a sequence that ends solved is "R U R' U'"
  // applied 6 times (the sexy-move identity has order 6).
  const sexy = "R U R' U'";
  for (let i = 0; i < 6; i++) {
    for (const m of sexy.split(' ')) t.applyMove(m);
  }
  return t.isSolved();
}

// Re-export so `tsx` execution actually exercises something at runtime.
export const smokeOk = smokeTracker();
