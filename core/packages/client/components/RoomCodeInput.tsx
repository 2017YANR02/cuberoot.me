'use client';
import { RoomCodeInput as SharedRoomCodeInput, type RoomCodeInputProps } from '@cuberoot/timer-ui/room-code-input';
import { tr } from '@/i18n/tr';
export { ROOM_CODE_LENGTH, normalizeRoomCode } from '@cuberoot/timer-ui/room-code-input';
export function RoomCodeInput(props: Omit<RoomCodeInputProps, 'label'>) {
  return <SharedRoomCodeInput {...props} label={tr({ en: 'Room code', zh: '房间码' })} />;
}
