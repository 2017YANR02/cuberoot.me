import { tr } from '@/i18n/tr';
import { denyMessage as deny, disconnectMessage as disconnect } from '@cuberoot/timer-ui/video/video-call';
export { LIVEKIT_ROOM_OPTIONS } from '@cuberoot/timer-ui/video/video-call';
export type { FailReason } from '@cuberoot/timer-ui/video/video-call';
export const denyMessage = (reason: Parameters<typeof deny>[0], maxParticipants: number) => deny(reason, maxParticipants, tr);
export const disconnectMessage = (reason: Parameters<typeof disconnect>[0]) => disconnect(reason, tr);
