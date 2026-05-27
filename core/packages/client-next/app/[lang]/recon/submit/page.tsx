'use client';
/**
 * /recon/submit — submit a new reconstruction.
 *
 * Functional scaffold: WCA OAuth login, CompPicker, person/event/round/solveNum fields,
 * raw time + average + solution textarea, save → POST /v1/recon.
 *
 * NOT YET PORTED (deferred from full Vite version):
 *   - Smart paste / autofill of WCA results / scrambles (recon_autofill_core + ~1.3k lines of cubing math deps)
 *   - TwistySection live preview (TwistyPlayer dynamic import — server already wraps it)
 *   - Caret-driven move sync + on-screen virtual keyboard
 *   - WCIF round-format auto-population
 *   - Duplicate detection
 *   - Stats panel (STM / TPS / sub-stages)
 *   - Edit history audit trail
 *
 * Identity fields lock in edit mode (?editId=) the same way the Vite version does.
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
