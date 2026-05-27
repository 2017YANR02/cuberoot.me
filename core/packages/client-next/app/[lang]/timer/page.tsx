'use client';

/**
 * /timer — speed-cubing timer (Next.js port).
 *
 * The implementation lives in `./TimerPage`. It's dynamically imported so the
 * cubing.js scramble bundle stays off the server render path.
 *
 * Minimal viable port — full feature set TODO list in TimerPage.tsx header.
 */

import dynamic from 'next/dynamic';

const TimerPage = dynamic(() => import('./TimerPage'), {
  ssr: false,
  loading: () => (
    <div style={{ padding: 24, fontFamily: 'ui-sans-serif, system-ui' }}>
      <p style={{ color: '#888' }}>Loading timer…</p>
    </div>
  ),
});

export default function Page() {
  return <TimerPage />;
}
