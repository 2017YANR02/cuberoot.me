// Server wrapper: prerender every (puzzle, set) trainer URL at build (SSG) so the
// route is 100% static. The UI is a client shell (TrainerSetClient) that reads the
// segments via useParams and lazy-loads the alg set in the browser.
// Import from the alg subpath, NOT the '@cuberoot/shared' barrel: the barrel
// re-exports client-only hooks/components which a Server Component can't pull in.
import { ALG_CATALOG, ALG_PUZZLES, type AlgPuzzle } from '@cuberoot/shared/alg';
import TrainerSetClient from './TrainerSetClient';

export const dynamic = 'force-static';

// Mirror of PUZZLE_EVENT in _events.ts (kept local — _events.ts imports the barrel).
const PUZZLE_EVENT: Record<AlgPuzzle, string> = {
  '2x2': '222', '3x3': '333', '4x4': '444', '5x5': '555',
  'sq1': 'sq1', 'megaminx': 'minx', 'pyraminx': 'pyram', 'skewb': 'skewb',
};

export function generateStaticParams() {
  // The puzzle segment may be a WCA event code (333) — what the hub links to — or a
  // legacy puzzle name (3x3); resolveAlgPuzzle accepts both. Enumerate every set slug
  // for every puzzle, under both segment forms.
  const out: { puzzle: string; set: string }[] = [];
  for (const p of ALG_PUZZLES as readonly AlgPuzzle[]) {
    for (const s of ALG_CATALOG[p]) {
      out.push({ puzzle: PUZZLE_EVENT[p], set: s.slug });
      out.push({ puzzle: p, set: s.slug });
    }
  }
  return out;
}

export default function Page() {
  return <TrainerSetClient />;
}
