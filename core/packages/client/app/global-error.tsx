'use client';

import { useEffect } from 'react';
import { AppFailure } from '@/components/StartupStatus';

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    console.error('[global-error]', error);
  }, [error]);

  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <AppFailure diagnosticCode={error.digest} overlay />
      </body>
    </html>
  );
}
