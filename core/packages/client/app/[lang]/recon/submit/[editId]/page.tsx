// Server wrapper for /recon/submit/[editId] — recon EDIT form.
//
// The editId space grows with every recon (~2.4k+), and every recon list/detail
// page renders an "edit" <Link> to /recon/submit/<id> which Next prefetches → each
// cold id was an on-demand SSR function (cache=MISS on Vercel) for a page with
// ZERO SEO value (auth-gated edit form, identical shell per id). Prerender ONE
// static shell at the sentinel "_" and route every real id to it via a next.config
// rewrite (/:lang/recon/submit/:editId -> .../submit/_); the client reads the real
// id from the browser URL. dynamicParams=false so nothing else SSRs; noindex keeps
// the edit form out of search. Mirrors the /wca/persons/[wcaId] sentinel pattern.
import type { Metadata } from 'next';
import ReconEditSubmitClient from './ReconEditSubmitClient';

export const dynamicParams = false;
export const metadata: Metadata = { robots: { index: false, follow: false } };

export function generateStaticParams() {
  return [{ editId: '_' }];
}

export default function Page() {
  return <ReconEditSubmitClient />;
}
