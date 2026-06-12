import ColpiClient from '../_components/ColpiClient';

/**
 * /memo/colpi/[pair] — detail route for a single letter pair.
 *
 * The pair space is open-ended (per-language alphabets) and the page is a pure
 * client shell, so prerender ONE static shell at the sentinel param "_" and
 * route every real pair to it via a next.config rewrite (same trick as
 * /wca/persons/[wcaId]). The client reads the real pair from the browser URL.
 * Build-time static asset → zero function invocations, survives Vercel's
 * per-deployment ISR cache reset.
 */
export const dynamicParams = false;
export function generateStaticParams() {
  return [{ pair: '_' }];
}

export default function Page() {
  return <ColpiClient />;
}
