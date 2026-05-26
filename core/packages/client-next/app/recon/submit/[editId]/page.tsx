'use client';
// /recon/submit/[editId] — edit existing reconstruction. Same form as /recon/submit.

import { Suspense } from 'react';
import { useParams } from 'next/navigation';
import ReconSubmitForm from '../ReconSubmitForm';

export default function ReconEditSubmitPage() {
  const params = useParams<{ editId: string }>();
  const editId = (Array.isArray(params?.editId) ? params.editId[0] : params?.editId) ?? '';
  return (
    <Suspense fallback={null}>
      <ReconSubmitForm editId={editId} />
    </Suspense>
  );
}
