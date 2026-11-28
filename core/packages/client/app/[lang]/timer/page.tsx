'use client';

/**
 * /timer — speed-cubing timer (Next.js, redesigned shell).
 *
 * TimerBootstrap owns the client-only import so a failed shell chunk cannot
 * leave the server-rendered loading text on screen forever. The heavy timer
 * implementation still stays off the server render path.
 */

import dynamic from 'next/dynamic';
import { Suspense, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { listenForMiniProgramTabSession } from '@/lib/miniprogram-tab-session';
import TimerBootstrap from './_components/TimerBootstrap';
import { TimerPracticeUrlProvider } from '@/lib/timer-practice-url-adapter';

const EmbeddedVideoReview = dynamic(() => import('./_components/EmbeddedVideoReview'), { ssr: false });

function TimerEntry() {
  useEffect(() => listenForMiniProgramTabSession('timer'), []);
  const params = useSearchParams();
  if (params.get('video') === 'review') return <EmbeddedVideoReview />;
  return <TimerPracticeUrlProvider><TimerBootstrap /></TimerPracticeUrlProvider>;
}

export default function Page() {
  // Preserve the normal server-rendered timer loading shell while resolving the embedded entry.
  return <Suspense fallback={<TimerBootstrap />}><TimerEntry /></Suspense>;
}
