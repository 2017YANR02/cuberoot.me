// Faithful port of the lettering-scheme tables + helpers from spooncuber
// reader.js (cornerCh/edgeCh defaults, nearedge/nearcorner) and codetrans.js
// (posChichu, globalState/eglobalState/cglobalState).
//
// All strings are byte-for-byte. NON-alphabetical ordering (W after KL, X after
// ST in globalState/cglobalState/eglobalState) is INTENTIONAL — do NOT "fix" it.

// Default Chichu (彳亍) scheme strings, 1-indexed (index 0 = space sentinel).
// 24 chars = 8 corners x3 stickers (cornerCh) / 12 edges x2 stickers (edgeCh),
// arranged in default borrow order. These are the upstream module-level defaults
// (let cornerCh / let edgeCh); edgeread/cornerread rebuild their own working
// strings from the buffer+order, so these constants stay immutable here.
export const DEFAULT_CORNER_CH = ' JKLGHIABCDEFXYZWMNRSTOPQ';
export const DEFAULT_EDGE_CH = ' GHABCDEFOPKLQRSTYZIJWXMN';

// codetrans.js globals (byte-for-byte).
export const globalState = 'ABCDEFGHIJKLWMNOPQRSTXYZabcdefghijklmnopqrstwxyz123456';
export const eglobalState = 'abcdefghijklmnopqrstwxyz';
export const cglobalState = 'ABCDEFGHIJKLWMNOPQRSTXYZ';

/**
 * nearcorner — next sticker (CW within the 3-sticker triplet of the DEFAULT
 * corner pairing) of the same physical corner piece.
 *
 * LOAD-BEARING: this uses its OWN local hardcoded default string cornerChtemp,
 * NOT the mutated working cornerCh. It encodes the physical piece-pairing and
 * MUST remain this exact default even when the active scheme rebuilds.
 */
export function nearcorner(s1: string): string {
  const cornerChtemp = ' JKLGHIABCDEFXYZWMNRSTOPQ';
  if (cornerChtemp.indexOf(s1) % 3 === 0) {
    return cornerChtemp[cornerChtemp.indexOf(s1) - 2];
  }
  return cornerChtemp[cornerChtemp.indexOf(s1) + 1];
}

/**
 * nearedge — the OTHER sticker of the same physical edge piece (paired in the
 * DEFAULT edge pairing).
 *
 * LOAD-BEARING: uses its OWN local hardcoded default string edgeChtemp, NOT the
 * mutated working edgeCh. Physical piece-pairing — keep the default verbatim.
 */
export function nearedge(s1: string): string {
  const edgeChtemp = ' GHABCDEFOPKLQRSTYZIJWXMN';
  if (edgeChtemp.indexOf(s1) % 2 === 1) {
    return edgeChtemp[edgeChtemp.indexOf(s1) + 1];
  }
  return edgeChtemp[edgeChtemp.indexOf(s1) - 1];
}

/**
 * posChichu — maps any sticker letter to its 0-based PIECE index over
 * globalState. A-Z -> idx/3 (corners 0..7), a-z -> (idx-24)/2 (edges 0..11),
 * digits -> idx-48 (centers 0..5); -1 if the letter is not in globalState.
 *
 * Used to dedupe buffer/order and to fetch the implied-buffer sticker for the
 * skip-cycle (eglobalState[pos*2] / cglobalState[pos*3]).
 */
export function posChichu(input_code: string): number {
  if (globalState.indexOf(input_code) === -1) {
    return -1;
  }
  if (input_code.charCodeAt(0) >= 65 && input_code.charCodeAt(0) <= 90) {
    return Math.trunc(globalState.indexOf(input_code) / 3);
  } else if (input_code.charCodeAt(0) >= 97 && input_code.charCodeAt(0) <= 122) {
    return Math.trunc((globalState.indexOf(input_code) - 24) / 2);
  } else {
    return globalState.indexOf(input_code) - 48;
  }
}
