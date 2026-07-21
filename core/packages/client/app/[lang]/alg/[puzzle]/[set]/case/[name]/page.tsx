// Server wrapper for the per-case metadata detail page (replaces the old modal).
// Cases aren't statically enumerable (derived from runtime-loaded case data), so
// force-static + dynamicParams renders each /alg/<puzzle>/<set>/case/<name> on
// first request, then caches it as static — same pattern as the [subgroup] route.
// No '@cuberoot/shared' barrel import here (barrel re-exports client hooks).
import AlgCaseDetailClient from './AlgCaseDetailClient';

export const dynamic = 'force-static';
export const dynamicParams = true;

export function generateStaticParams() {
  return [];
}

export default function Page() {
  return <AlgCaseDetailClient />;
}
