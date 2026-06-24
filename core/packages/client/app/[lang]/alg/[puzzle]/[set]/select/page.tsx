// Server wrapper: prerender every (puzzle, set)/select pair at build (SSG) so the route
// is 100% static. 'select' is a fixed leaf under each (puzzle, set) pair (case picker).
// The UI is a client shell (TrainerSetClient) that reads segments via useParams and
// lazy-loads the alg set in the browser. Import from the alg subpath, NOT the
// '@cuberoot/shared' barrel: the barrel re-exports client-only hooks a Server Component
// can't pull in.
import { ALG_CATALOG } from '@cuberoot/shared/alg';
import TrainerSetClient from './TrainerSetClient';

export const dynamic = 'force-static';

export function generateStaticParams() {
  const out: { puzzle: string; set: string }[] = [];
  for (const puzzle of Object.keys(ALG_CATALOG)) {
    for (const s of (ALG_CATALOG as Record<string, { slug: string }[]>)[puzzle]) {
      out.push({ puzzle, set: s.slug });
    }
  }
  return out;
}

export default function Page() {
  return <TrainerSetClient />;
}
