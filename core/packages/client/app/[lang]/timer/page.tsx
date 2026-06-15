'use client';

/**
 * /timer — speed-cubing timer (Next.js, redesigned shell).
 *
 * The implementation lives in `_shell/TimerShell` (mode host) → SoloView. It's
 * dynamically imported with ssr:false so the cubing.js scramble bundle stays
 * off the server render path and the page remains SSG (first paint = calm
 * Solo, mode read from ?mode after mount).
 */

import dynamic from 'next/dynamic';

const TimerShell = dynamic(() => import('./_shell/TimerShell'), {
  ssr: false,
  loading: () => (
    <div style={{ padding: 24, fontFamily: 'ui-sans-serif, system-ui' }}>
      <p style={{ color: 'var(--muted-foreground)' }}>Loading timer…</p>
    </div>
  ),
});

export default function Page() {
  return <TimerShell />;
}
