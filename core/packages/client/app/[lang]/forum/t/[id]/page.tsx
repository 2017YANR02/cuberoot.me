// Sentinel-shell server wrapper for /forum/t/[id] — one prerendered static
// shell for the unbounded thread-id space (next.config rewrite routes every
// id here; the client reads the real id from window.location).
import type { Metadata } from 'next';
import ThreadClient from './ThreadClient';

export const dynamicParams = false;
export const metadata: Metadata = { robots: { index: false, follow: false } };

export function generateStaticParams() {
  return [{ id: '_' }];
}

export default function Page() {
  return <ThreadClient />;
}
