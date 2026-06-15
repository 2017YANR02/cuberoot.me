// Server wrapper: force-static so the route prerenders instead of SSR-per-request.
// The section list lives inside a client component, so we don't enumerate params
// at build; dynamicParams lets any sectionId render on demand, statically. The UI
// is a client shell (Prediction333SectionClient) that reads the slug via useParams().
import Prediction333SectionClient from './Prediction333SectionClient';

export const dynamic = 'force-static';
export const dynamicParams = true;
export function generateStaticParams() { return []; }

export default function Page() {
  return <Prediction333SectionClient />;
}
