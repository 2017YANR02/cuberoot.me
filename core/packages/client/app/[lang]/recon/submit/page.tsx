'use client';
/**
 * /recon/submit — submit a new reconstruction.
 *
 * Full Vite-parity port of packages/client-vite/src/pages/recon/ReconSubmitPage.tsx.
 * See ReconSubmitForm.tsx for the deferred-feature notes (autofill popup +
 * autoSpace contenteditable input remain out of scope for this port).
 *
 * Identity fields lock in edit mode (/recon/submit/[editId]) and when
 * `?from=<id>` is present (same-round prefill).
 */
import { Suspense } from 'react';
import ReconSubmitForm from './ReconSubmitForm';

export default function ReconSubmitPage() {
  return (
    <Suspense fallback={null}>
      <ReconSubmitForm />
    </Suspense>
  );
}
