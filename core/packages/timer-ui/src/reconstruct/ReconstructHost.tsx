import { createContext, useContext } from 'react';
import type { ComponentType } from 'react';
import type { Solve } from '@cuberoot/shared/timer';
import BoolToggle, { type BoolToggleProps } from '../BoolToggle';

export type ReconstructLocalize = <T>(text: { en: T; zh: T }) => T;

/** Only host capabilities; analysis, report structure and playback stay shared. */
export interface ReconstructHost {
  localize: ReconstructLocalize;
  writeClipboardText: (text: string) => Promise<void>;
  replayUrl: (solve: Solve) => string;
  recordGyro: boolean;
  onEnableGyro?: () => void;
  BoolToggle?: ComponentType<BoolToggleProps>;
}

export const ReconstructHostContext = createContext<ReconstructHost>({
  localize: (text) => text.en,
  writeClipboardText: async () => { throw new Error('Reconstruction clipboard host is not configured'); },
  replayUrl: () => { throw new Error('Reconstruction share host is not configured'); },
  recordGyro: false,
  BoolToggle,
});

export function useReconstructHost(): ReconstructHost {
  return useContext(ReconstructHostContext);
}
