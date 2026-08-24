// Server wrapper: prerender every (puzzle, set) pair at build (SSG) so the route
// is 100% static instead of SSR-per-request. The actual UI is a client shell
// (AlgSetClient) that lazy-loads case data in the browser via useParams().
// Import from the alg subpath, NOT the '@cuberoot/shared' barrel: the barrel
// re-exports client-only hooks (useState) which a Server Component can't pull in.
import { ALG_CATALOG } from '@cuberoot/shared/alg';
import { notFound } from 'next/navigation';
import AlgSetClient from './AlgSetClient';

export const dynamic = 'force-static';
export const dynamicParams = false;

export function generateStaticParams() {
  const out: { puzzle: string; set: string }[] = [];
  for (const puzzle of Object.keys(ALG_CATALOG)) {
    for (const s of (ALG_CATALOG as Record<string, { slug: string }[]>)[puzzle]) {
      out.push({ puzzle, set: s.slug });
    }
  }
  return out;
}

export default async function Page({ params }: { params: Promise<{ puzzle: string; set: string }> }) {
  const { puzzle, set } = await params;
  const knownSet = (ALG_CATALOG as Record<string, { slug: string }[]>)[puzzle]
    ?.some((entry) => entry.slug === set);
  if (!knownSet) notFound();

  return <AlgSetClient />;
}
