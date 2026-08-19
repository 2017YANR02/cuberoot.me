import { FTO_DRAW_ELEMENTS } from '@/lib/fto-draw-elements';

export const FTO_EIF_FACE_KEYS = ['u', 'f', 'r', 'l', 'd', 'e', 'i', 'b'] as const;
export type FtoEifFaceKey = (typeof FTO_EIF_FACE_KEYS)[number];

export interface FtoEifPalette extends Record<FtoEifFaceKey, string> {
  stroke: string;
}

export const DEFAULT_FTO_EIF_PALETTE: FtoEifPalette = {
  u: '#0fcc09',
  f: '#deff26',
  r: '#666666',
  l: '#ff9900',
  d: '#2997fd',
  e: '#8830e3',
  i: '#d80f0f',
  b: '#ffffff',
  stroke: '#000000',
};

export const FTO_EIF_FACE_LABELS: Record<FtoEifFaceKey, string> = {
  u: 'U', f: 'F', r: 'R', l: 'L', d: 'D', e: 'Bl', i: 'Br', b: 'B',
};

export const FTO_EIF_BASE_MOVES = ['R', 'U', 'F', 'L', 'D', 'B', 'Bl', 'Br', 'Rs', 'Ls', 'Us', 'Fs'] as const;
export type FtoEifBaseMove = (typeof FTO_EIF_BASE_MOVES)[number];
type StickerKey = `${FtoEifFaceKey}${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9}`;
export type FtoEifStickerState = Record<StickerKey, string>;

const CYCLES: Record<FtoEifBaseMove, StickerKey[][]> = {
  R: [
    ['f4', 'd7', 'i7'], ['f5', 'd9', 'i9'], ['f8', 'd8', 'i8'],
    ['f7', 'd4', 'i4'], ['f9', 'd5', 'i5'], ['l9', 'b5', 'u9'],
    ['r1', 'r5', 'r9'], ['r2', 'r7', 'r4'], ['r3', 'r6', 'r8'],
  ],
  U: [
    ['f1', 'i5', 'e5'], ['f2', 'i4', 'e4'], ['f3', 'i3', 'e3'],
    ['f4', 'i2', 'e2'], ['f5', 'i1', 'e1'], ['r1', 'b9', 'l1'],
    ['u1', 'u5', 'u9'], ['u2', 'u7', 'u4'], ['u3', 'u6', 'u8'],
  ],
  F: [
    ['u9', 'l1', 'r5'], ['i5', 'e1', 'd9'], ['r1', 'u5', 'l9'],
    ['u6', 'l8', 'r3'], ['u7', 'l4', 'r2'], ['u8', 'l3', 'r6'],
    ['f1', 'f9', 'f5'], ['f2', 'f7', 'f4'], ['f3', 'f6', 'f8'],
  ],
  L: [
    ['f1', 'e9', 'd9'], ['e1', 'd1', 'f9'], ['e2', 'd2', 'f7'],
    ['e7', 'd7', 'f2'], ['e6', 'd6', 'f6'], ['u5', 'b1', 'r5'],
    ['l1', 'l5', 'l9'], ['l2', 'l7', 'l4'], ['l3', 'l6', 'l8'],
  ],
  D: [
    ['f9', 'e9', 'i9'], ['b2', 'r8', 'l8'], ['b4', 'r6', 'l6'],
    ['b1', 'r9', 'l9'], ['b5', 'r5', 'l5'], ['b3', 'r7', 'l7'],
    ['d1', 'd5', 'd9'], ['d2', 'd4', 'd7'], ['d3', 'd8', 'd6'],
  ],
  B: [
    ['u1', 'r9', 'l5'], ['e5', 'i9', 'd1'], ['i1', 'd5', 'e9'],
    ['i2', 'd4', 'e7'], ['i6', 'd3', 'e8'], ['i7', 'd2', 'e4'],
    ['b1', 'b9', 'b5'], ['b2', 'b7', 'b4'], ['b3', 'b6', 'b8'],
  ],
  Bl: [
    ['l1', 'u1', 'b1'], ['u5', 'b9', 'l5'], ['u3', 'b2', 'l3'],
    ['f1', 'i1', 'd1'], ['u6', 'b7', 'l6'], ['u2', 'b6', 'l2'],
    ['e1', 'e5', 'e9'], ['e2', 'e4', 'e7'], ['e3', 'e8', 'e6'],
  ],
  Br: [
    ['u1', 'r1', 'b5'], ['u9', 'r9', 'b9'], ['u3', 'r3', 'b4'],
    ['u8', 'r8', 'b7'], ['u4', 'r4', 'b8'], ['f5', 'd5', 'e5'],
    ['i1', 'i5', 'i9'], ['i2', 'i4', 'i7'], ['i3', 'i8', 'i6'],
  ],
  Rs: [
    ['u8', 'l8', 'b4'], ['u4', 'l4', 'b3'], ['u7', 'l7', 'b8'],
    ['f3', 'd6', 'i6'], ['f6', 'd3', 'i3'], ['f2', 'd2', 'i2'],
  ],
  Ls: [
    ['u2', 'b3', 'r2'], ['u7', 'b6', 'r7'], ['u6', 'b2', 'r6'],
    ['f3', 'e8', 'd8'], ['f8', 'e3', 'd3'], ['f4', 'e4', 'd4'],
  ],
  Us: [
    ['r2', 'b8', 'l2'], ['r4', 'b6', 'l4'], ['r3', 'b7', 'l3'],
    ['f6', 'i8', 'e8'], ['f8', 'i6', 'e6'], ['f7', 'i7', 'e7'],
  ],
  Fs: [
    ['u2', 'l7', 'r4'], ['u4', 'l2', 'r7'], ['u3', 'l6', 'r8'],
    ['e3', 'd6', 'i8'], ['e6', 'd8', 'i3'], ['e2', 'd7', 'i4'],
  ],
};

const ROTATION_CYCLES: Record<'Rt' | 'Lt' | 'Ft', StickerKey[][]> = {
  Rt: [
    ['u1', 'f1', 'r5', 'i9'], ['u2', 'f6', 'r7', 'i6'], ['u3', 'f2', 'r6', 'i7'],
    ['u4', 'f3', 'r2', 'i8'], ['u5', 'f9', 'r9', 'i1'], ['u6', 'f7', 'r8', 'i2'],
    ['u7', 'f8', 'r4', 'i3'], ['u8', 'f4', 'r3', 'i4'], ['u9', 'f5', 'r1', 'i5'],
    ['l1', 'd9', 'b5', 'e5'], ['l2', 'd6', 'b3', 'e8'], ['l3', 'd7', 'b4', 'e4'],
    ['l4', 'd8', 'b8', 'e3'], ['l5', 'd1', 'b1', 'e9'], ['l6', 'd2', 'b2', 'e7'],
    ['l7', 'd3', 'b6', 'e6'], ['l8', 'd4', 'b7', 'e2'], ['l9', 'd5', 'b9', 'e1'],
  ],
  Lt: [
    ['f1', 'u5', 'e1', 'l1'], ['f2', 'u6', 'e2', 'l3'], ['f3', 'u2', 'e6', 'l4'],
    ['f6', 'u7', 'e3', 'l2'], ['f5', 'u1', 'e9', 'l9'], ['f9', 'u9', 'e5', 'l5'],
    ['f4', 'u3', 'e7', 'l8'], ['f7', 'u8', 'e4', 'l6'], ['f8', 'u4', 'e8', 'l7'],
    ['r9', 'i9', 'b5', 'd5'], ['r7', 'i8', 'b8', 'd3'], ['r4', 'i6', 'b3', 'd8'],
    ['r8', 'i7', 'b4', 'd4'], ['r5', 'i5', 'b9', 'd1'], ['r1', 'i1', 'b1', 'd9'],
    ['r2', 'i3', 'b6', 'd6'], ['r3', 'i2', 'b2', 'd7'], ['r6', 'i4', 'b7', 'd2'],
  ],
  Ft: [
    ['f1', 'l5', 'd5', 'r1'], ['f5', 'l1', 'd1', 'r9'], ['f9', 'l9', 'd9', 'r5'],
    ['f2', 'l6', 'd4', 'r3'], ['f3', 'l2', 'd3', 'r4'], ['f4', 'l3', 'd2', 'r8'],
    ['f6', 'l7', 'd8', 'r2'], ['f8', 'l4', 'd6', 'r7'], ['f7', 'l8', 'd7', 'r6'],
    ['u1', 'e5', 'b9', 'i1'], ['u9', 'e1', 'b1', 'i9'], ['u5', 'e9', 'b5', 'i5'],
    ['u2', 'e8', 'b8', 'i3'], ['u3', 'e4', 'b7', 'i2'], ['u4', 'e3', 'b6', 'i6'],
    ['u6', 'e7', 'b4', 'i4'], ['u8', 'e2', 'b2', 'i7'], ['u7', 'e6', 'b3', 'i8'],
  ],
};

export const FTO_EIF_ACTION_SEQUENCES: Readonly<Record<string, readonly FtoEifBaseMove[]>> = {
  Rw: ['R', 'Rs'], Lw: ['L', 'Ls'], Uw: ['U', 'Us'], Fw: ['F', 'Fs'],
  Dw: ['D', 'Us', 'Us'], Bw: ['B', 'Fs', 'Fs'],
  Blw: ['Bl', 'Rs', 'Rs'], Brw: ['Br', 'Ls', 'Ls'],
  Ro: ['R', 'Rs', 'Bl', 'Bl'], Lo: ['L', 'Ls', 'Br', 'Br'],
  Uo: ['U', 'Us', 'D', 'D'], Fo: ['F', 'Fs', 'B', 'B'],
  H: ['R', 'U', 'U', 'R', 'R', 'U'],
  "H'": ['U', 'U', 'R', 'U', 'R', 'R'],
  S: ['R', 'Rs', 'Bl', 'Bl', 'R', 'R', 'U', 'R', 'U', 'U', 'R', 'Rs', 'Bl', 'Bl', 'R', 'Rs', 'Bl', 'Bl'],
  "S'": ['R', 'Rs', 'Bl', 'Bl', 'U', 'R', 'R', 'U', 'U', 'R', 'R', 'Rs', 'Bl', 'Bl', 'R', 'Rs', 'Bl', 'Bl'],
};

const VALID_ROOTS = new Set([
  ...FTO_EIF_BASE_MOVES, 'Rw', 'Lw', 'Uw', 'Fw', 'Dw', 'Bw', 'Blw', 'Brw',
  'Ro', 'Lo', 'Uo', 'Fo', 'Rt', 'Lt', 'Ft', 'S', 'H',
]);

function cycle(state: FtoEifStickerState, keys: StickerKey[]): void {
  const first = state[keys[0]];
  for (let index = 0; index < keys.length - 1; index += 1) state[keys[index]] = state[keys[index + 1]];
  state[keys.at(-1)!] = first;
}

function applyBase(state: FtoEifStickerState, move: FtoEifBaseMove): void {
  for (const keys of CYCLES[move]) cycle(state, keys);
}

function applySequence(state: FtoEifStickerState, sequence: readonly FtoEifBaseMove[]): void {
  for (const move of sequence) applyBase(state, move);
}

export interface FtoEifTokenParts {
  root: string;
  turns: number;
  suffix: '' | "'" | '2';
}

export function parseFtoEifToken(token: string): FtoEifTokenParts | null {
  let normalized = token;
  if (normalized.endsWith("2'")) {
    const root = normalized.slice(0, -2);
    normalized = root === 'Rt' || root === 'Lt' || root === 'Ft' ? `${root}2` : root;
  }
  const suffix = normalized.endsWith("'") ? "'" : normalized.endsWith('2') ? '2' : '';
  const root = suffix ? normalized.slice(0, -1) : normalized;
  if (!VALID_ROOTS.has(root)) return null;
  // EIF macros and whole-puzzle 120° rotations only have forward/prime forms.
  // Accepting S2 or Uo2 would silently reinterpret unsupported source data.
  if (suffix === '2' && ['S', 'H', 'Ro', 'Lo', 'Uo', 'Fo'].includes(root)) return null;
  const orderFour = root === 'Rt' || root === 'Lt' || root === 'Ft';
  return { root, suffix, turns: suffix === "'" ? (orderFour ? 3 : 2) : suffix === '2' ? 2 : 1 };
}

export function parseFtoEifAlgorithm(algorithm: string): { tokens: string[]; invalid: string[] } {
  const raw = algorithm.trim() ? algorithm.trim().split(/\s+/) : [];
  const tokens: string[] = [];
  const invalid: string[] = [];
  for (const token of raw) (parseFtoEifToken(token) ? tokens : invalid).push(token);
  return { tokens, invalid };
}

export function invertFtoEifAlgorithm(algorithm: string): string {
  return algorithm.trim().split(/\s+/).filter(Boolean).reverse().map((token) => {
    // Preserve unsupported input so inversion cannot turn an invalid token into
    // a valid-but-different move before the caller reports it.
    if (!parseFtoEifToken(token)) return token;
    if (token.includes("'")) return token.replace("'", '');
    if (token.includes('2')) return /^(Rt|Lt|Ft)2$/.test(token) ? token : token.replace('2', '');
    return `${token}'`;
  }).join(' ');
}

export function ftoEifState(algorithm: string, palette: FtoEifPalette = DEFAULT_FTO_EIF_PALETTE): FtoEifStickerState {
  const state = {} as FtoEifStickerState;
  for (const face of FTO_EIF_FACE_KEYS) {
    for (let index = 1; index <= 9; index += 1) state[`${face}${index}` as StickerKey] = palette[face];
  }
  for (const token of parseFtoEifAlgorithm(algorithm).tokens) {
    const parts = parseFtoEifToken(token)!;
    for (let turn = 0; turn < parts.turns; turn += 1) {
      if (parts.root === 'Rt' || parts.root === 'Lt' || parts.root === 'Ft') {
        for (const keys of ROTATION_CYCLES[parts.root]) cycle(state, keys);
      } else if (parts.root === 'S' || parts.root === 'H') {
        const key = parts.turns === 2 ? `${parts.root}'` : parts.root;
        applySequence(state, FTO_EIF_ACTION_SEQUENCES[key]);
        break;
      } else if (FTO_EIF_ACTION_SEQUENCES[parts.root]) {
        const sequence = FTO_EIF_ACTION_SEQUENCES[parts.root];
        if (parts.turns === 1) applySequence(state, sequence);
        else {
          applySequence(state, sequence);
          applySequence(state, sequence);
        }
        break;
      } else {
        applyBase(state, parts.root as FtoEifBaseMove);
      }
    }
  }
  return state;
}

/** A solved FTO may be globally rotated; every logical face still has one uniform colour. */
export function isFtoEifSolved(algorithm: string): boolean {
  const state = ftoEifState(algorithm);
  return FTO_EIF_FACE_KEYS.every((face) => {
    const first = state[`${face}1` as StickerKey];
    for (let index = 2; index <= 9; index += 1) {
      if (state[`${face}${index}` as StickerKey] !== first) return false;
    }
    return true;
  });
}

function escapeXml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

export function renderFtoEifSvg(
  algorithm: string,
  palette: FtoEifPalette = DEFAULT_FTO_EIF_PALETTE,
  options: { title?: string } = {},
): string {
  const state = ftoEifState(algorithm, palette);
  const title = options.title ? `<title>${escapeXml(options.title)}</title>` : '';
  const paths = FTO_DRAW_ELEMENTS.map((element) => {
    if (element.key === 'body') return `<path d="${element.d}" fill="${escapeXml(palette.stroke)}"/>`;
    const key = element.key.toLowerCase() as StickerKey;
    const strokeWidth = element.key.startsWith('B') || element.key.startsWith('F') ? 4 : 2;
    return `<path d="${element.d}" fill="${escapeXml(state[key])}" stroke="${escapeXml(palette.stroke)}" stroke-width="${strokeWidth}" stroke-linejoin="round"/>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 279.92 301.94" role="img">${title}${paths}</svg>`;
}
