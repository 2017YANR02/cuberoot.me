// Server wrapper for /wca/comp/[slug]. CompDetailPage is 'use client' and loads ALL
// data client-side (fetch + WebSocket), so the server render produces only the empty
// <Suspense fallback={null}> shell — identical for every slug. Serve that shell as a
// cached static asset (CDN) instead of re-rendering per request:
//   - force-static makes useSearchParams() return empty server-side (no DYNAMIC_SERVER_
//     USAGE throw — the earlier force-dynamic was working around exactly that error).
//   - 17k comps → don't prebuild; dynamicParams renders the shell on first hit per slug,
//     then it's cached. Kills the per-hit / per-prefetch function invocation + CPU.
import { Suspense } from 'react';
import CompDetailPage from './CompDetailPage';

export const dynamic = 'force-static';
export const dynamicParams = true;
export function generateStaticParams(): { slug: string }[] {
  return [];
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <CompDetailPage />
    </Suspense>
  );
}
