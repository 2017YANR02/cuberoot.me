// Server wrapper for /wca/persons/[wcaId].
//
// The wcaId space is unbounded (~200k WCA persons) and the page is a pure
// client shell (all data fetched in the browser), so the server-rendered HTML
// is identical for every id. Prerendering one shell per id is impossible, and
// per-request SSR burns a Fluid function on every crawler hit. Instead we
// prerender ONE static shell at the sentinel param "_" and route every real id
// to it via a next.config rewrite (/:lang/wca/persons/:wcaId -> .../persons/_).
// The client (PersonDetailClient) reads the real id from window.location.
//
// Result: a build-time static asset (zero function invocations, survives
// Vercel's per-deployment ISR cache reset) backing every person page.
import PersonDetailClient from './PersonDetailClient';

export const dynamicParams = false;

export function generateStaticParams() {
  return [{ wcaId: '_' }];
}

export default function Page() {
  return <PersonDetailClient />;
}
