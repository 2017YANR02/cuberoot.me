// Server wrapper: prerender every known puzzle at build (SSG) so the route is
// 100% static instead of SSR-per-request. The actual UI is a client shell
// (AlgPuzzleClient) that lazy-loads alg data in the browser. Unknown puzzles
// (legacy 3x3 slugs that redirect client-side) fall through dynamicParams.
// Import from the alg subpath, NOT the '@cuberoot/shared' barrel: the barrel
// re-exports client-only hooks (useState) which a Server Component can't pull in.
import { ALG_PUZZLES } from '@cuberoot/shared/alg';
import AlgPuzzleClient from './AlgPuzzleClient';

export const dynamic = 'force-static';

export function generateStaticParams() {
  return (ALG_PUZZLES as readonly string[]).map((puzzle) => ({ puzzle }));
}

export default function Page() {
  return <AlgPuzzleClient />;
}
