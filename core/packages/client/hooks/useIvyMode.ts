'use client';

import { useSyncExternalStore } from 'react';
import { getIvyMode, onIvyModeChange, setIvyMode, type IvyScrambleMode } from '@/lib/scramble-ivy-mode';

export function useIvyMode(): [IvyScrambleMode, typeof setIvyMode] {
  return [useSyncExternalStore(onIvyModeChange, getIvyMode, () => 'rldb' as const), setIvyMode];
}
