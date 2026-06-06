// Server wrapper: make this route static instead of SSR-per-request. The actual
// UI is a client shell (WcaStatClient) that reads the statId via useParams() and
// fetches /stats/<statId>.json at runtime in the browser. There is no static,
// server-safe list of valid statIds — the /wca index page itself discovers them
// by fetching /stats/index.json at runtime, and the underlying data lives only
// in the /stats filesystem (not bundled). So we can't enumerate params at build;
// instead emit zero static params + force-static with dynamicParams so any
// statId is served as a static shell that hydrates and fetches its own data.
import WcaStatClient from './WcaStatClient';

export const dynamic = 'force-static';
export const dynamicParams = true;

export function generateStaticParams() {
  return [];
}

export default function Page() {
  return <WcaStatClient />;
}
