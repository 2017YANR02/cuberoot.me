'use client';

import { useSyncExternalStore } from 'react';

const QUERY = '(min-width: 768px) and (min-height: 600px)';
const serverSnapshot = () => false;
const snapshot = () => window.matchMedia(QUERY).matches;
const subscribe = (onChange: () => void) => {
  const media = window.matchMedia(QUERY);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
};

/** Shared by the training surface and its host menu; a URL flag alone is insufficient. */
export function useTrainerSplitScreen({ requested, sessionReady, doubleZbll, room, caseCount }: {
  requested: boolean;
  sessionReady: boolean;
  doubleZbll: boolean;
  room: boolean;
  caseCount: number;
}) {
  const available = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  return {
    available,
    eligible: requested && sessionReady && available && !doubleZbll && !room && caseCount >= 2,
  };
}
