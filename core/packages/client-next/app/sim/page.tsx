'use client';

/**
 * /sim — 3D cube simulator (Next.js port).
 *
 * TODO (deferred from initial port — see packages/client/src/pages/sim/SimPage.tsx):
 *   - PlayerControls (alg input / scramble / playback) — depends on ~30 components &
 *     utils (AlgInput, CubeVirtualKeyboard, WheelPicker, cubingScramble, m2p WASM,
 *     scramble_555 server, 333 m2p, cstimer_444, recon_alg_utils, cube3, etc.)
 *   - AlgsPanel (algorithm library browser) — depends on @cuberoot/shared alg loader
 *   - DirectorPanel (video export) — depends on sim_export + recon_alg_utils
 *   - TwistySection (cubing.js TwistyPlayer fallback for skewb/pyraminx/megaminx)
 *   - SettingDrawer (verbose settings UI) — uses minimal defaults below instead
 *   - keymap (custom keyboard bindings) — fixed defaults below instead
 *
 * This shell renders the huazhechen/cuber engine (3D NxN cube via THREE.js) with
 * default 3x3 settings, mouse orbit, and keyboard moves. Enough to validate that
 * the cuber engine + Toucher + setup.worker bundle correctly under Next 16 Turbopack.
 */

import dynamic from 'next/dynamic';

const SimViewer = dynamic(() => import('./SimViewer'), {
  ssr: false,
  loading: () => (
    <div style={{ padding: 24, fontFamily: 'ui-sans-serif, system-ui' }}>
      <p style={{ color: '#888' }}>Loading 3D cube engine…</p>
    </div>
  ),
});

export default function SimPage() {
  return <SimViewer />;
}
