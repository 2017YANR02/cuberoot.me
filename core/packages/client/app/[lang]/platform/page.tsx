import { notFound } from 'next/navigation';
import { PlatformRouteView } from '@/components/platform/PlatformRouteView';
import { matchPlatformRoute } from '@/lib/platform-routes';

export default function PlatformPage() {
  const match = matchPlatformRoute([]);
  if (!match) notFound();
  return <PlatformRouteView definition={match.definition} params={match.params} />;
}
