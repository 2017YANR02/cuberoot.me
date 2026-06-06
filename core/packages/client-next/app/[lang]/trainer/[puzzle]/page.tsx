// Server wrapper: prerender every trainer-hub URL at build (SSG) so /trainer/<puzzle>
// is 100% static instead of SSR-per-request. The UI is a client shell
// (TrainerHubClient) that reads the segment via useParams and lazy-loads alg data.
// Import from the alg subpath, NOT the '@cuberoot/shared' barrel: the barrel
// re-exports client-only hooks/components which a Server Component can't pull in.
// (Mirror of the PUZZLE_EVENT map in _events.ts, kept local so we never import
// _events.ts here — it imports the barrel.)
import { ALG_CATALOG, ALG_PUZZLES, type AlgPuzzle } from '@cuberoot/shared/alg';
import TrainerHubClient from './TrainerHubClient';

export const dynamic = 'force-static';

const PUZZLE_EVENT: Record<AlgPuzzle, string> = {
  '2x2': '222', '3x3': '333', '4x4': '444', '5x5': '555',
  'sq1': 'sq1', 'megaminx': 'minx', 'pyraminx': 'pyram', 'skewb': 'skewb',
};

export function generateStaticParams() {
  // The hub accepts both WCA event codes (333) and legacy puzzle names (3x3);
  // segToEvent resolves either. Prerender both forms for every puzzle that has
  // trainable sets, plus the 3BLD discipline (333bf).
  const trainable = (ALG_PUZZLES as readonly AlgPuzzle[]).filter(p => ALG_CATALOG[p].length > 0);
  const segs = new Set<string>(['333bf']);
  for (const p of trainable) {
    segs.add(p);                 // legacy puzzle name: 3x3
    segs.add(PUZZLE_EVENT[p]);   // WCA event code: 333
  }
  return [...segs].map((puzzle) => ({ puzzle }));
}

export default function Page() {
  return <TrainerHubClient />;
}
