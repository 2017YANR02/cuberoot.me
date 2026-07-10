// Sentinel-shell server wrapper for /forum/f/[slug] — same trick as
// /wca/persons: one prerendered static shell, real slug read client-side
// (next.config beforeFiles rewrite routes every slug here).
import type { Metadata } from 'next';
import ForumListClient from './ForumListClient';

export const dynamicParams = false;
export const metadata: Metadata = { robots: { index: false, follow: false } };

export function generateStaticParams() {
  return [{ slug: '_' }];
}

export default function Page() {
  return <ForumListClient />;
}
