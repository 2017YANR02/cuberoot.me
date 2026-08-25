import crypto from 'node:crypto';

export const ROOM_CODE_LENGTH = 4;
export const ROOM_CODE_SPACE = 10 ** ROOM_CODE_LENGTH;
export const ROOM_CODE_CREATE_ATTEMPTS = 100;
export const ROOM_CODE_RE = /^\d{4}$/;

/** 保留前导零，因此房间码始终是四位字符串。 */
export function formatRoomCode(value: number): string {
  if (!Number.isInteger(value) || value < 0 || value >= ROOM_CODE_SPACE) {
    throw new RangeError(`room code value must be an integer from 0 to ${ROOM_CODE_SPACE - 1}`);
  }
  return String(value).padStart(ROOM_CODE_LENGTH, '0');
}

export function generateRoomCode(): string {
  return formatRoomCode(crypto.randomInt(ROOM_CODE_SPACE));
}

/** 在已占用集合外挑一个码；空间满或连续碰撞时返回 null。 */
export function pickAvailableRoomCode(
  occupied: ReadonlySet<string>,
  draw: () => string = generateRoomCode,
  maxAttempts = 100,
): string | null {
  if (occupied.size >= ROOM_CODE_SPACE) return null;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const code = draw();
    if (ROOM_CODE_RE.test(code) && !occupied.has(code)) return code;
  }
  return null;
}
