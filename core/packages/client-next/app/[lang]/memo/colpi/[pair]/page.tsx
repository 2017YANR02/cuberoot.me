import ColpiClient from '../_components/ColpiClient';

/**
 * /memo/colpi/[pair] — detail route for a single letter pair.
 * Shares the same client component as /memo/colpi; useParams() supplies the pair.
 */
export const dynamic = 'force-static';
export const dynamicParams = true;
export function generateStaticParams() {
  return [];
}

export default function Page() {
  return <ColpiClient />;
}
