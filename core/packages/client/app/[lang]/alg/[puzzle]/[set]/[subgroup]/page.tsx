// Server wrapper for `/alg/<puzzle>/<set>/<seg>` where <seg> is a subgroup OR a
// single case. The space is unbounded (1LLL alone is ~3.4k cases), so this is a
// pure client shell: prerender ONE static sentinel shell at puzzle/set/seg = "_"
// and route every real URL to it via a next.config rewrite (excluding the static
// run/select siblings). AlgSubOrCaseClient reads the real ids from window.location
// and decides subgroup-list vs case-detail. Zero per-URL function invocations,
// survives the per-deploy ISR cache reset. Same trick as wca/comp/[slug].
// Guard: tests/dynamic-param-shell-sentinel.
// No '@cuberoot/shared' barrel import here (barrel re-exports client hooks).
import { Suspense } from 'react';
import AlgSubOrCaseClient from './AlgSubOrCaseClient';

export const dynamicParams = false;

export function generateStaticParams(): { puzzle: string; set: string; subgroup: string }[] {
  return [{ puzzle: '_', set: '_', subgroup: '_' }];
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <AlgSubOrCaseClient />
    </Suspense>
  );
}
