import ColpiClient from '../_components/ColpiClient';

/**
 * /memo/colpi/[pair] — detail route for a single letter pair.
 * Shares the same client component as /memo/colpi; useParams() supplies the pair.
 */
export default function Page() {
  return <ColpiClient />;
}
