'use client';

import { Suspense } from 'react';
import RecordsView from '@/components/wca-records/RecordsView';
import { ContentSkeleton } from '@/components/ContentSkeleton';

// Keep the original URL and query contract available until the merged page is accepted.
export default function RecordsPage() {
  return (
    <Suspense fallback={<ContentSkeleton variant="table" />}>
      <RecordsView />
    </Suspense>
  );
}
