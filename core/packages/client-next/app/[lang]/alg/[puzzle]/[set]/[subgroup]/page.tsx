// Server wrapper: subgroups are derived from runtime-loaded case data, so they
// aren't statically enumerable. force-static + dynamicParams renders each
// /alg/<puzzle>/<set>/<subgroup> on first request, then caches it as static.
// No '@cuberoot/shared' barrel import here (barrel re-exports client hooks).
import AlgSubgroupClient from './AlgSubgroupClient';

export const dynamic = 'force-static';
export const dynamicParams = true;

export function generateStaticParams() {
  return [];
}

export default function Page() {
  return <AlgSubgroupClient />;
}
