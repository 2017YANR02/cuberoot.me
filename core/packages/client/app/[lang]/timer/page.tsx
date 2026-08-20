'use client';

/**
 * /timer — speed-cubing timer (Next.js, redesigned shell).
 *
 * TimerBootstrap owns the client-only import so a failed shell chunk cannot
 * leave the server-rendered loading text on screen forever. The heavy timer
 * implementation still stays off the server render path.
 */

import TimerBootstrap from './_components/TimerBootstrap';

export default function Page() {
  return <TimerBootstrap />;
}
