import {
  cubieToFacelets,
  isValidCubieState,
  type CubieState,
  type FaceletTables,
} from './cubie';

export const GIIKER_DATA_SERVICE_UUID = '0000aadb-0000-1000-8000-00805f9b34fb';
export const GIIKER_NOTIFY_CHARACTERISTIC_UUID = '0000aadc-0000-1000-8000-00805f9b34fb';
export const GIIKER_RW_SERVICE_UUID = '0000aaaa-0000-1000-8000-00805f9b34fb';
export const GIIKER_READ_CHARACTERISTIC_UUID = '0000aaab-0000-1000-8000-00805f9b34fb';
export const GIIKER_WRITE_CHARACTERISTIC_UUID = '0000aaac-0000-1000-8000-00805f9b34fb';
export const GIIKER_COMMAND_BATTERY = 0xb5;

const GIIKER_DECRYPT_KEY: ReadonlyArray<number> = [
  176, 81, 104, 224, 86, 137, 237, 119,
  38, 26, 193, 161, 210, 126, 150, 81,
  93, 13, 236, 249, 89, 235, 88, 24,
  113, 81, 214, 131, 130, 199, 2, 169,
  39, 165, 171, 41,
];
const GIIKER_FACE_ORDER = ['B', 'D', 'L', 'U', 'R', 'F'] as const;
const GIIKER_DIR_SUFFIX = ['', '2', "'"] as const;
const GIIKER_CO_MASK = [-1, 1, -1, 1, 1, -1, 1, -1] as const;
const GIIKER_FACELET_TABLES: FaceletTables = {
  corners: [
    [26, 15, 29], [20, 8, 9], [18, 38, 6], [24, 27, 44],
    [51, 35, 17], [45, 11, 2], [47, 0, 36], [53, 42, 33],
  ],
  edges: [
    [25, 28], [23, 12], [19, 7], [21, 41], [32, 16], [5, 10],
    [3, 37], [30, 43], [52, 34], [48, 14], [46, 1], [50, 39],
  ],
};

export interface GiikerFrame {
  facelets: string | null;
  history: number[];
  moves: string[];
}

export function matchesGiikerName(name?: string): boolean {
  return /^(Gi|Mi Smart Magic Cube|Hi-)/.test((name ?? '').trim());
}

function toHexVal(view: DataView): number[] {
  if (view.byteLength < 20) return [];
  const raw = Array.from({ length: 20 }, (_, index) => view.getUint8(index));
  let plain = raw;
  if (raw[18] === 0xa7) {
    const key1 = (raw[19] >> 4) & 0xf;
    const key2 = raw[19] & 0xf;
    plain = raw.slice(0, 18).map((byte, index) => (
      byte + GIIKER_DECRYPT_KEY[index + key1] + GIIKER_DECRYPT_KEY[index + key2]
    ) & 0xff);
  }
  return plain.flatMap((byte) => [(byte >> 4) & 0xf, byte & 0xf]);
}

function parseState(nibbles: ReadonlyArray<number>): string | null {
  if (nibbles.length < 31) return null;
  const ca = new Array<number>(8);
  for (let index = 0; index < 8; index++) {
    const permutation = nibbles[index] - 1;
    const orientation = nibbles[index + 8];
    if (permutation < 0 || permutation > 7 || orientation > 2) return null;
    ca[index] = permutation
      | (((3 + orientation * GIIKER_CO_MASK[index]) % 3) << 3);
  }

  const edgeOrientations: number[] = [];
  for (let index = 0; index < 3; index++) {
    for (let mask = 8; mask !== 0; mask >>= 1) {
      edgeOrientations.push(nibbles[index + 28] & mask ? 1 : 0);
    }
  }
  const ea = new Array<number>(12);
  for (let index = 0; index < 12; index++) {
    const permutation = nibbles[index + 16] - 1;
    if (permutation < 0 || permutation > 11) return null;
    ea[index] = (permutation << 1) | edgeOrientations[index];
  }
  const state: CubieState = { ca, ea };
  return isValidCubieState(state) ? cubieToFacelets(state, GIIKER_FACELET_TABLES) : null;
}

function moveCodes(nibbles: ReadonlyArray<number>): number[] {
  const codes: number[] = [];
  for (let index = 0; index + 1 < nibbles.length; index += 2) {
    codes.push((nibbles[index] << 4) | nibbles[index + 1]);
  }
  return codes;
}

function newMoveCodes(
  currentHistory: ReadonlyArray<number>,
  previousHistory: ReadonlyArray<number> | null,
): number[] {
  const current = moveCodes(currentHistory);
  if (!previousHistory) return current[0] ? [current[0]] : [];
  const previous = moveCodes(previousHistory);
  for (let newCount = 1; newCount <= current.length; newCount++) {
    let aligned = true;
    for (let index = 0; index + newCount < current.length && index < previous.length; index++) {
      if (current[index + newCount] !== previous[index]) {
        aligned = false;
        break;
      }
    }
    if (!aligned) continue;
    return current.slice(0, newCount).reverse().filter(Boolean);
  }
  return [];
}

function formatMove(code: number): string | null {
  const face = (code >> 4) & 0xf;
  const direction = code & 0xf;
  if (face < 1 || face > 6 || direction < 1) return null;
  return `${GIIKER_FACE_ORDER[face - 1]}${GIIKER_DIR_SUFFIX[(direction - 1) % 7] ?? ''}`;
}

export function parseGiikerFrame(
  input: ArrayBuffer | DataView,
  previousHistory: ReadonlyArray<number> | null = null,
): GiikerFrame | null {
  const nibbles = toHexVal(input instanceof DataView ? input : new DataView(input));
  if (nibbles.length < 36) return null;
  const history = nibbles.slice(32, 40);
  return {
    facelets: parseState(nibbles),
    history,
    moves: newMoveCodes(history, previousHistory)
      .map(formatMove)
      .filter((move): move is string => move !== null),
  };
}
