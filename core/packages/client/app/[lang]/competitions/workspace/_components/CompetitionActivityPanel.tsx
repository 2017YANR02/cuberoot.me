'use client';

import { PlatformRouteView } from '@/components/platform/PlatformRouteView';
import { COMPETITION_ACTIVITIES_PATH } from '@/lib/competition-links';
import { matchPlatformRoute } from '@/lib/platform-routes';
import '@/components/platform/platform.css';

export function CompetitionActivityPanel({ id, onNavigate }: { id?: string; onNavigate: (id: string) => void }) {
  const route = matchPlatformRoute(id ? ['admin', 'events', id] : ['admin', 'events']);
  return route && <PlatformRouteView {...route} activityManagementHref={COMPETITION_ACTIVITIES_PATH} onActivityNavigate={onNavigate} />;
}
