// Server wrapper: prerender every (puzzle, set)/run pair at build (SSG) so the route
// is 100% static. 'run' is a fixed leaf under each (puzzle, set) pair. The UI is a
// client shell (TrainerRunClient) that reads segments via useParams and runs the timer
// in the browser. Import from the alg subpath, NOT the '@cuberoot/shared' barrel: the
// barrel re-exports client-only hooks/components a Server Component can't pull in.
import { ALG_CATALOG } from '@cuberoot/shared/alg';
import TrainerRunClient from './TrainerRunClient';

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
  return <TrainerRunClient />;
}
