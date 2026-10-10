// Server wrapper: prerender every known puzzle at build (SSG) so the route is
// static instead of SSR-per-request. Covers are included in the cached HTML;
// AlgPuzzleClient revalidates only the compact catalog. Unknown puzzles
// (legacy 3x3 slugs that redirect client-side) fall through dynamicParams.
// Import from the alg subpath, NOT the '@cuberoot/shared' barrel: the barrel
// re-exports client-only hooks (useState) which a Server Component can't pull in.
import { ALG_PUZZLES, type AlgPuzzle } from '@cuberoot/shared/alg';
import { fetchAlgCatalog } from '@/lib/alg-catalog-server';
import AlgPuzzleClient from './AlgPuzzleClient';

export const dynamic = 'force-static';
export const revalidate = 60;

export function generateStaticParams() {
  return (ALG_PUZZLES as readonly string[]).map((puzzle) => ({ puzzle }));
}

export default async function Page({ params }: { params: Promise<{ puzzle: string }> }) {
  const { puzzle } = await params;
  const initialCatalog = (ALG_PUZZLES as readonly string[]).includes(puzzle)
    ? await fetchAlgCatalog(puzzle as AlgPuzzle) : null;
  return <AlgPuzzleClient initialCatalog={initialCatalog} />;
}
