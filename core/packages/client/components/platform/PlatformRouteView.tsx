'use client';

import { useAuthUser } from '@/lib/auth-store';
import dynamic from 'next/dynamic';
import type { PlatformRouteDefinition } from '@/lib/platform-types';
import { PlatformResourceRouteView } from './PlatformResourceRouteView';
import { PlatformState } from './PlatformState';

// Competition/media dependencies belong to the competition routes, not the
// initial bundle of every catalog, news and administrative page.
const OnlineCompetitions = dynamic(() => import('./OnlineCompetitions').then(module => module.OnlineCompetitions),
  { ssr: false, loading: () => <PlatformState kind="loading" /> });
const OnlineCompetitionPreview = dynamic(() => import('./OnlineCompetitionPreview').then(module => module.OnlineCompetitionPreview),
  { ssr: false, loading: () => <PlatformState kind="loading" /> });

export function PlatformRouteView(props: { definition: PlatformRouteDefinition; params: Record<string, string> }) {
  const user = useAuthUser();
  if (props.definition.id === 'online-competitions') return <OnlineCompetitions />;
  if (props.definition.id === 'online-competition') return <OnlineCompetitions id={props.params.id} />;
  if (props.definition.id === 'online-competition-preview') return <OnlineCompetitionPreview />;
  // Private resources and drafts belong to the current account and route only.
  return <PlatformResourceRouteView key={`${user?.uid ?? user?.wcaId ?? 'guest'}:${props.definition.id}:${JSON.stringify(props.params)}`} {...props} />;
}
