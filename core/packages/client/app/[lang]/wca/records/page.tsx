'use client';

import { Suspense } from 'react';
import RecordsView from '@/components/wca-records/RecordsView';
import { LoadingIndicator } from '@/components/LoadingIndicator';

// Keep the original URL and query contract available until the merged page is accepted.
export default function RecordsPage() {
  return (
    <Suspense fallback={<div style={{ padding: 16, color: 'var(--muted)' }}><LoadingIndicator /></div>}>
      <RecordsView />
    </Suspense>
  );
}
