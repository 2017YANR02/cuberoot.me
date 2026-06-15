// Faithful port of the PURE state-manipulation helpers from spooncuber
// codetrans.js (NO solver math — that is in m2p-bridge.ts). Byte-for-byte
// behavior. The chichu "state" is a 54-char string over `globalState`
// (0-23 = 24 corner stickers, 24-47 = 24 edge stickers, 48-53 = 6 centers).
//
// Upstream `~~x` (double bitwise-NOT) truncates toward zero like Math.trunc; we
// use Math.trunc to keep the same semantics without 32-bit overflow surprises on
// the small indices used here.
//
// The random* generators call Math.random() in upstream. They take an optional
// `rng: () => number` (default = the platform pseudo-random source) so tests can
// seed them; the draw expressions are otherwise unchanged.

import {
  globalState,
  eglobalState,
  cglobalState,
  posChichu,
} from './lettering';

export { posChichu };

// Re-export the state alphabets for callers that build/inspect chichu states.
export { globalState, eglobalState, cglobalState };

/** Default platform pseudo-random source (matches upstream Math.random()). */
export type Rng = () => number;
const defaultRng: Rng = Math.random;

/**
 * Apply a cycle of letter-targets to a state via repeated exCode 2-swaps
 * anchored on input_code[0] (BLD shooting sim). Verbatim codeTrans().
 */
export function codeTrans(input_code: string, input_state: string | string[]): string {
  // first assign input to output
  let output_state: string | string[] = input_state;

  // transfer code by exchanging every two code. (1 a-n; 2 a-g; 3 a-q; 4 a-y)
  for (let i = 0; i < input_code.length; i += 1) {
    output_state = exCode([input_code[0], input_code[i]], output_state);
  }
  return output_state as string;
}

/** Apply two codeTrans cycles in sequence. Verbatim integreteCode(). */
export function integreteCode(
  first_input: string,
  second_input: string,
  input_state: string | string[],
): string {
  let output_state = codeTrans(first_input, input_state);
  output_state = codeTrans(second_input, output_state);
  return output_state;
}

/**
 * Swap the two cubies referenced by two letters, honoring 3/2/1-fold
 * orientation slots via reOrder. Verbatim exCode().
 */
export function exCode(input_code: [string, string], input_state: string | string[]): string {
  // recognize which group current code is.(corner, edge or centre)
  const { div, indexNum } = groupRecog(input_code[0]);

  // the indexOfes of two code in globalState
  const index1 = globalState.indexOf(input_code[0]) - indexNum;
  const index2 = globalState.indexOf(input_code[1]) - indexNum;

  // assign input_state to output_state
  const output_list = Array.from(input_state);
  const input_arr = Array.from(input_state);
  // exchange two position of codes with new order
  for (let i = 0; i < div; i += 1) {
    const order1 = reOrder(index1, div);
    const order2 = reOrder(index2, div);
    output_list[order1[i] + indexNum] = input_arr[order2[i] + indexNum];
    output_list[order2[i] + indexNum] = input_arr[order1[i] + indexNum];
  }
  return output_list.join('');
}

/**
 * Orientation-rotated slot order for a piece (div=3 corner / 2 edge / 1 centre).
 * Verbatim reOrder(): input(1,3)->[1,2,0]; (17,3)->[17,15,16]; (5,2)->[5,4].
 */
export function reOrder(num: number, div: number): number[] {
  // if input (17, 3) the first of list will be 15
  const order_first = Math.trunc(num / div) * div;

  let order_double: number[];
  let order_output: number[];
  if (div === 3) {
    // extend 17 to [15 16 17 15 16 17]
    order_double = [order_first, order_first + 1, order_first + 2, order_first, order_first + 1, order_first + 2];
    // reOrder list from 17, and output 17 15 16
    order_output = [
      order_double[order_double.indexOf(num)],
      order_double[order_double.indexOf(num) + 1],
      order_double[order_double.indexOf(num) + 2],
    ];
  } else if (div === 2) {
    order_double = [order_first, order_first + 1, order_first, order_first + 1];
    order_output = [order_double[order_double.indexOf(num)], order_double[order_double.indexOf(num) + 1]];
  } else {
    order_double = [order_first, order_first];
    order_output = [order_double[order_double.indexOf(num)]];
  }
  return order_output;
}

/**
 * Classify a letter: A-Z -> {div:3, indexNum:0} corner; a-z -> {div:2, indexNum:24}
 * edge; else -> {div:1, indexNum:48} centre. Verbatim groupRecog().
 */
export function groupRecog(input_code: string): { div: number; indexNum: number } {
  // if it's corner code, then the divisor(orientations) will be 3 and it's first num is 0. edge's are 2 and 24
  let div: number;
  let indexNum: number;
  const cc = input_code.charCodeAt(0);
  if (cc >= 65 && cc <= 90) {
    div = 3;
    indexNum = 0;
  } else if (cc >= 97 && cc <= 122) {
    div = 2;
    indexNum = 24;
  } else {
    div = 1;
    indexNum = 48;
  }
  return { div, indexNum };
}

/**
 * Enumerate all valid 2-letter target pairs of one piece-type, excluding the
 * given codes' piece positions (BLD training set generator). Verbatim
 * algSetGenerator().
 */
export function algSetGenerator(codes: string[]): string[] {
  // global cube state(0-23 mean corners; 24-47 mean edges; 48-55 mean centre). It's a constant.
  const { div, indexNum } = groupRecog(codes[0]);

  const posList: number[] = [];

  for (let i = 0; i < codes.length; i += 1) {
    posList.push(Math.trunc((globalState.indexOf(codes[i]) - indexNum) / div));
  }

  const alg_set: string[] = [];
  // add corner alg set
  for (let i = 0; i < 24; i += 1) {
    const first_pos = Math.trunc(i / div);
    if (posList.indexOf(first_pos) === -1) {
      for (let j = 0; j < 24; j += 1) {
        const second_pos = Math.trunc(j / div);
        if (second_pos !== first_pos && posList.indexOf(second_pos) === -1) {
          alg_set.push(globalState[i + indexNum] + globalState[j + indexNum]);
        }
      }
    }
  }

  return alg_set;
}

/**
 * Random edge scramble state via 24 (even) / 25 (odd) random transpositions
 * against the fixed buffer 'a'. Verbatim randomEdge() with seedable rng.
 */
export function randomEdge(parity: 0 | 1, rng: Rng = defaultRng): string {
  let exTimes = 0;
  let output_state = globalState;
  if (parity === 0) {
    exTimes = 24;
  } else {
    exTimes = 25;
  }

  for (let i = 0; i < exTimes; i++) {
    const code2 = globalState[Math.trunc(rng() * 22) + 26];
    output_state = exCode(['a', code2], output_state);
  }

  return output_state;
}

/**
 * As randomEdge but restricting random targets to edge positions not in
 * codeList (excludes known pieces). Verbatim randomEdge1() with seedable rng.
 */
export function randomEdge1(
  parity: 0 | 1,
  codeList: string[],
  output_state: string,
  rng: Rng = defaultRng,
): string {
  let exTimes = 0;
  if (parity === 0) {
    exTimes = 24;
  } else {
    exTimes = 25;
  }

  let posList: number[] = Array.from({ length: 12 }, (_, i) => i);
  if (codeList.length > 0) {
    const inputList: number[] = [];
    for (let i = 0; i < codeList.length; i++) {
      inputList.push(posChichu(codeList[i]));
    }
    posList = posList.filter((item) => !inputList.includes(item));
  }
  const pos0 = posList[0];
  posList.splice(0, 1);

  for (let i = 0; i < exTimes; i++) {
    const pos = posList[Math.trunc(rng() * posList.length)];
    const code = eglobalState[pos * 2 + Math.trunc(rng() * 2)];
    output_state = exCode([eglobalState[pos0 * 2], code], output_state);
  }

  return output_state;
}

/**
 * Random corner scramble state via 24 (even) / 25 (odd) random transpositions
 * against the fixed buffer 'A'. Verbatim randomCorner() with seedable rng.
 */
export function randomCorner(parity: 0 | 1, rng: Rng = defaultRng): string {
  let exTimes = 0;
  let output_state = globalState;
  if (parity === 0) {
    exTimes = 24;
  } else {
    exTimes = 25;
  }

  for (let i = 0; i < exTimes; i++) {
    const code2 = globalState[Math.trunc(rng() * 21) + 3];
    output_state = exCode(['A', code2], output_state);
  }

  return output_state;
}

/**
 * As randomCorner but restricting random targets to corner positions not in
 * codeList (excludes known pieces). Verbatim randomCorner1() with seedable rng.
 */
export function randomCorner1(
  parity: 0 | 1,
  codeList: string[],
  output_state: string,
  rng: Rng = defaultRng,
): string {
  let exTimes = 0;
  if (parity === 0) {
    exTimes = 24;
  } else {
    exTimes = 25;
  }

  let posList: number[] = Array.from({ length: 8 }, (_, i) => i);
  if (codeList.length > 0) {
    const inputList: number[] = [];
    for (let i = 0; i < codeList.length; i++) {
      inputList.push(posChichu(codeList[i]));
    }
    posList = posList.filter((item) => !inputList.includes(item));
  }
  const pos0 = posList[0];
  posList.splice(0, 1);

  for (let i = 0; i < exTimes; i++) {
    const pos = posList[Math.trunc(rng() * posList.length)];
    const code = globalState[pos * 3 + Math.trunc(rng() * 3)];
    output_state = exCode([globalState[pos0 * 3], code], output_state);
  }

  return output_state;
}

/**
 * Splice a corner-state (slots 0-23) + edge-state (slots 24-47) + the fixed
 * '123456' centers into one chichu state. Verbatim mergeState().
 */
export function mergeState(cornerstate: string, edgestate: string): string {
  return cornerstate.slice(0, 24).concat(edgestate.slice(24, 48)).concat('123456');
}

/**
 * Fisher-Yates-style destructive shuffle from spooncuber utils.js. Mutates the
 * input array (splices out picked elements) and returns a new shuffled array,
 * matching upstream behavior exactly. Takes an optional seedable rng.
 */
export function shuffle<T>(array: T[], rng: Rng = defaultRng): T[] {
  const res: T[] = [];
  let random: number;
  while (array.length) {
    random = Math.floor(rng() * array.length);
    res.push(array[random]);
    array.splice(random, 1);
  }
  return res;
}
