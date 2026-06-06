// Server wrapper: prerender every (puzzle, set)/run trainer URL at build (SSG) so the
// route is 100% static. 'run' is a fixed leaf under each (puzzle, set) pair. The UI is
// a client shell (TrainerRunClient) that reads the segments via useParams and runs the
// timer in the browser. Import from the alg subpath, NOT the '@cuberoot/shared' barrel:
// the barrel re-exports client-only hooks/components a Server Component can't pull in.
import { ALG_CATALOG, ALG_PUZZLES, type AlgPuzzle } from '@cuberoot/shared/alg';
import TrainerRunClient from './TrainerRunClient';

export const dynamic = 'force-static';

// Mirror of PUZZLE_EVENT in _events.ts (kept local — _events.ts imports the barrel).
const PUZZLE_EVENT: Record<AlgPuzzle, string> = {
  '2x2': '222', '3x3': '333', '4x4': '444', '5x5': '555',
  'sq1': 'sq1', 'megaminx': 'minx', 'pyraminx': 'pyram', 'skewb': 'skewb',
};

export function generateStaticParams() {
  // Same (puzzle, set) pairs as the parent /[set] route — under both the WCA event-code
  // segment form (what the hub links to) and the legacy puzzle-name form.
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
  return <TrainerRunClient />;
}
