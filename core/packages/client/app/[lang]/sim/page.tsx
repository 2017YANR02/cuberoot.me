'use client';

/**
 * /sim — 虚拟魔方 Playground / Player / Algs / Director (Next.js port).
 *
 * SimPage handles the full client-side simulator (cuber engine + AlgsPanel +
 * PuzzleImageStudio + PlayerControls). It's dynamically imported to keep the
 * THREE.js / cubing.js bundle off the SSR path.
 *
 * Deferred (vs Vite parity):
 *   - Twisty puzzles (pyraminx / skewb / megaminx) — TwistySection not ported.
 *   - AlgInput → plain <textarea> (markable/autospace skipped).
 *   - CubeVirtualKeyboard / SimQwertyKeypad.
 *   - tnoodleRandomScramble pool + m2p WASM + cstimer_444 + 555-rs server.
 *   - PerfOverlay (dev HUD).
 */

import dynamic from 'next/dynamic';
import { Suspense } from 'react';

const SimPage = dynamic(() => import('./SimPage'), {
  ssr: false,
  loading: () => (
    <div style={{ padding: 24, fontFamily: 'ui-sans-serif, system-ui' }}>
      <p style={{ color: '#888' }}>Loading 3D cube engine…</p>
    </div>
  ),
});

export default function Page() {
  return (
    <Suspense
      fallback={
        <div style={{ padding: 24, fontFamily: 'ui-sans-serif, system-ui' }}>
          <p style={{ color: '#888' }}>Loading…</p>
        </div>
      }
    >
      <SimPage />
    </Suspense>
  );
}
