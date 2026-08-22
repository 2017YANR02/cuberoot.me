'use client';

import { useEffect } from 'react';
import { AppFailure } from '@/components/StartupStatus';

export default function RouteError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    console.error('[route-error]', error);
  }, [error]);

  return <AppFailure diagnosticCode={error.digest} />;
}
