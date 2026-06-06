/**
 * /math/group/[slug] — dynamic section route.
 *
 * Re-uses the same GroupTheoryPage component as /math/group; the page reads
 * the slug via `useParams` and switches which `<GTSec>` renders.
 *
 * force-static: no params enumerated at build (the section list lives inside the
 * client component); dynamicParams lets any slug render on demand, statically.
 * NOTE: a bare `export { default } from '../page'` does NOT pick up the route
 * segment config, so render the parent page from an explicit server default.
 */
import GroupTheoryPage from '../page';

export const dynamic = 'force-static';
export const dynamicParams = true;
export function generateStaticParams() { return []; }

export default function Page() {
  return <GroupTheoryPage />;
}
