'use client';

import { useAuthUser } from '@/lib/auth-store';
import type { PlatformRouteDefinition } from '@/lib/platform-types';
import { OnlineCompetitionPreview } from './OnlineCompetitionPreview';
import { OnlineCompetitions } from './OnlineCompetitions';
import { PlatformResourceRouteView } from './PlatformResourceRouteView';

export function PlatformRouteView(props: { definition: PlatformRouteDefinition; params: Record<string, string> }) {
  const user = useAuthUser();
  if (props.definition.id === 'online-competitions') return <OnlineCompetitions />;
  if (props.definition.id === 'online-competition') return <OnlineCompetitions id={props.params.id} />;
  if (props.definition.id === 'online-competition-preview') return <OnlineCompetitionPreview />;
  // Private resources and drafts belong to the current account and route only.
  return <PlatformResourceRouteView key={`${user?.uid ?? user?.wcaId ?? 'guest'}:${props.definition.id}:${JSON.stringify(props.params)}`} {...props} />;
}
