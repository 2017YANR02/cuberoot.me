// Server wrapper for the per-case metadata detail page (replaces the old modal).
// Cases come from runtime-loaded DB data and the space is unbounded (1LLL alone is
// ~4k cases), so this is a pure client shell: prerender ONE static sentinel shell at
// puzzle/set/name = "_" and route every real /alg/<p>/<s>/case/<name> to it via a
// next.config rewrite. AlgCaseDetailClient reads the real ids from window.location.
// Zero per-case function invocations, survives the per-deploy ISR cache reset.
// Same trick as wca/comp/[slug], wca/persons/[wcaId]. Guard: tests/dynamic-param-shell-sentinel.
// No '@cuberoot/shared' barrel import here (barrel re-exports client hooks).
import { Suspense } from 'react';
import AlgCaseDetailClient from './AlgCaseDetailClient';

export const dynamicParams = false;

export function generateStaticParams(): { puzzle: string; set: string; name: string }[] {
  return [{ puzzle: '_', set: '_', name: '_' }];
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <AlgCaseDetailClient />
    </Suspense>
  );
}
