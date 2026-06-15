// Server wrapper: prerender the two known recognition sets (pll / oll) at build
// (SSG) so the route is fully static instead of SSR-per-request. The UI is a
// client shell (RecognizeClient) that reads the set from useParams().
import RecognizeClient from './RecognizeClient';

export const dynamic = 'force-static';

export function generateStaticParams() {
  return [{ algSetId: 'pll' }, { algSetId: 'oll' }];
}

export default function Page() {
  return <RecognizeClient />;
}
