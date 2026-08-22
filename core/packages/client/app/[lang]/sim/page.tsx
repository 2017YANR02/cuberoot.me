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
import { ClientLoadStatus } from '@/components/StartupStatus';

const SimPage = dynamic(() => import('./SimPage'), {
  ssr: false,
  loading: () => <ClientLoadStatus label={{ zh: '正在加载 3D 魔方引擎…', en: 'Loading 3D cube engine…' }} />,
});

export default function Page() {
  return (
    <Suspense
      fallback={<ClientLoadStatus />}
    >
      <SimPage />
    </Suspense>
  );
}
