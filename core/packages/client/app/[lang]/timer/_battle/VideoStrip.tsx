'use client';

import { createBattleVideoClient } from '@cuberoot/shared/video';
import { useTimerBattleVideo } from '@cuberoot/timer-ui/video/TimerBattleVideo';
import { apiUrl } from '@/lib/api-base';
import { tr } from '@/i18n/tr';

export { default, VideoToggle, type VideoRoom } from '@cuberoot/timer-ui/video/TimerBattleVideo';
const client = createBattleVideoClient({ apiUrl, fetcher: (...args) => fetch(...args) });
export function useVideoRoom(code: string | null, pid: string | null, playerToken: string | null, generation: string | null) {
  return useTimerBattleVideo(client, code, pid, playerToken, generation, tr({ en: 'en', zh: 'zh' }));
}
