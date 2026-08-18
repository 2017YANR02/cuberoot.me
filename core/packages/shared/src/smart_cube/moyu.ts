const UUID_SUFFIX = '-0000-1000-8000-00805f9b34fb';

export const MOYU_SERVICE_UUID = `00001000${UUID_SUFFIX}`;
export const MOYU_WRITE_CHARACTERISTIC_UUID = `00001001${UUID_SUFFIX}`;
export const MOYU_READ_CHARACTERISTIC_UUID = `00001002${UUID_SUFFIX}`;
export const MOYU_TURN_CHARACTERISTIC_UUID = `00001003${UUID_SUFFIX}`;
export const MOYU_GYRO_CHARACTERISTIC_UUID = `00001004${UUID_SUFFIX}`;

const MOYU_AXIS_LUT: ReadonlyArray<number> = [3, 4, 5, 1, 2, 0];
const URFDLB = ['U', 'R', 'F', 'D', 'L', 'B'] as const;

export function matchesMoyuName(name?: string | null): boolean {
  return /^(MHC|MoYu|MY-)/i.test(name?.trim() ?? '');
}

export function createMoyuDecodeState(): Int8Array {
  return new Int8Array(6);
}

/** Parse one unencrypted MoYu MHC turn notification, mutating the face accumulator. */
export function parseMoyuTurnFrame(
  input: ArrayBuffer | DataView,
  faceStatus: Int8Array,
): string[] {
  const view = input instanceof DataView ? input : new DataView(input);
  if (faceStatus.length < 6 || view.byteLength < 1) return [];
  const moveCount = view.getUint8(0);
  if (view.byteLength < 1 + moveCount * 6) return [];

  const moves: string[] = [];
  for (let index = 0; index < moveCount; index += 1) {
    const offset = 1 + index * 6;
    const face = view.getUint8(offset + 4);
    if (face > 5) continue;
    const direction = Math.round(view.getUint8(offset + 5) / 36);
    if (direction === 0) continue;

    const previousRotation = faceStatus[face];
    const currentRotation = previousRotation + direction;
    faceStatus[face] = (currentRotation + 9) % 9;

    let counterClockwise = false;
    if (previousRotation >= 5 && currentRotation <= 4) counterClockwise = true;
    else if (!(previousRotation <= 4 && currentRotation >= 5)) continue;

    const axis = MOYU_AXIS_LUT[face];
    if (axis === undefined) continue;
    const faceName = URFDLB[axis];
    moves.push(counterClockwise ? `${faceName}'` : faceName);
  }
  return moves;
}
