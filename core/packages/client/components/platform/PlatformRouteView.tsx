'use client';

import { useAuthUser } from '@/lib/auth-store';
import type { PlatformRouteDefinition } from '@/lib/platform-types';
import { PlatformResourceRouteView } from './PlatformResourceRouteView';

export function PlatformRouteView(props: { definition: PlatformRouteDefinition; params: Record<string, string>; activityManagementHref?: string; onActivityNavigate?: (id: string) => void }) {
  const user = useAuthUser();
  // Private resources and drafts belong to the current account and route only.
  return <PlatformResourceRouteView key={`${user?.uid ?? user?.wcaId ?? 'guest'}:${props.definition.id}:${JSON.stringify(props.params)}`} {...props} />;
}
