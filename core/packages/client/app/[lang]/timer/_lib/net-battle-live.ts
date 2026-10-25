'use client';
import { useNetBattleLiveCube as useSharedLiveCube, type UseNetBattleLiveCubeOptions } from '@cuberoot/timer-ui';
import { NET_BATTLE_LIVE_PATH } from '@cuberoot/shared/timer';
import { websocketApiUrl } from '@/lib/api-base';
export type { NetBattleLiveCubePlayer } from '@cuberoot/timer-ui';
const solve: UseNetBattleLiveCubeOptions['solve'] = async state => {
  const { solve333 } = await import('./scramble/kociemba/random_state');
  return solve333(state);
};
export function useNetBattleLiveCube(options: Omit<UseNetBattleLiveCubeOptions, 'websocketUrl' | 'solve'>) {
  return useSharedLiveCube({ ...options, solve, websocketUrl: websocketApiUrl(NET_BATTLE_LIVE_PATH) });
}
