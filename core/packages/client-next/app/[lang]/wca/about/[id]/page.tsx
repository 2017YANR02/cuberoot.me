// Server wrapper: prerender every known about-entry id at build (SSG) so the
// route is 100% static instead of SSR-per-request. The actual UI is a client
// shell (WcaAboutClient) that reads the id via useParams() and renders the
// matching entry. Unknown ids fall through to the client's "missing" branch.
// Import ABOUT_REGISTRY directly from the server-safe _lib module — NOT the
// '@cuberoot/shared' barrel, which re-exports client-only hooks a Server
// Component can't pull in. registry.ts + its entries are pure data (import type
// only), so this is safe.
import { ABOUT_REGISTRY } from './_lib/registry';
import WcaAboutClient from './WcaAboutClient';

export const dynamic = 'force-static';

export function generateStaticParams() {
  return Object.keys(ABOUT_REGISTRY).map((id) => ({ id }));
}

export default function Page() {
  return <WcaAboutClient />;
}
