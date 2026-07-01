/**
 * Pure NxN notation → single-slice atoms, for the group-theory kernel bridge.
 *
 * This is a THREE-free port of the engine's own move pipeline so the lazily-loaded
 * pgBindings bundle never drags in the Three.js cube:
 *   • `TwistAction` / `TwistNode` — copied verbatim from `nxn/twister.ts` (they are pure
 *     string parsers; only the surrounding `Twister` class / module tables use THREE).
 *   • `convertAction` — a faithful port of `GroupTable.convert` (`nxn/group.ts`) that
 *     returns `{axis,layer,twist}` instead of pushing `RotateAction(CubeGroup, …)`.
 *
 * The result is decomposed into **quarter-turn atoms** `{axis, layer, dir}` — a single
 * physical slice turned ±90°. The bridge maps each atom to one PG generator, so any
 * engine notation (faces, wide `Rw`, numbered `2R`/`k-kR`, slices `M/E/S`, rotations
 * `x/y/z`, lowercase wides, brackets/commutators) is mirrored into the group exactly as
 * the engine plays it. Keep this in lock-step with twister.ts / group.ts.
 */

/** Axis index: 0 = x (R↔L), 1 = y (U↔D), 2 = z (F↔B). Layer 0 = negative face
 *  (L/D/B), layer N-1 = positive face (R/U/F) — the engine's GroupTable indexing. */
export interface NxnAtom {
  axis: 0 | 1 | 2;
  layer: number;
  dir: 1 | -1;
}

// ── TwistAction (verbatim from twister.ts) ───────────────────────────────────
export class TwistAction {
  sign: string;
  reverse: boolean;
  times: number;
  constructor(exp: string, reverse = false, times = 1) {
    const values = exp.match(/([\*\#~;.#xyz]|[0123456789-]*[bsfdeulmr][w]*)('?)(\d*)('?)/i);
    if (values) {
      exp = values[1];
      reverse = reverse !== ((values[2] + values[4]).length == 1);
      times = times * (values[3].length == 0 ? 1 : parseInt(values[3]));
    }
    if (/[XYZ]/.test(exp)) {
      exp = exp.toLowerCase();
    }
    if (/[Ww]/.test(exp)) {
      exp = exp.toUpperCase();
      exp = exp.replace("W", "w");
    }
    this.sign = exp;
    this.reverse = reverse;
    this.times = times;
  }
}

// ── TwistNode (verbatim from twister.ts, minus the unused `value` getter) ─────
export class TwistNode {
  static AFFIX = "'Ww0123456789-";
  children: TwistNode[];
  twist: TwistAction;
  static SPLIT_SEGMENT(exp: string): string[] {
    const list = [];
    let buffer = "";
    let stack = 0;
    let ready = false;
    let note = false;
    for (let i = 0; i < exp.length; i++) {
      const c = exp.charAt(i);
      if (c === " " && buffer.length == 0) {
        continue;
      }
      if (c === "/" && exp.charAt(i + 1) === "/") {
        i++;
        note = true;
        continue;
      }
      if (c === "\n") {
        note = false;
        continue;
      }
      if (note) {
        continue;
      }
      if (TwistNode.AFFIX.indexOf(c) >= 0) {
        buffer = buffer.concat(c);
        continue;
      }
      if (buffer.length > 0 && stack == 0 && ready) {
        list.push(buffer);
        buffer = "";
        i--;
        ready = false;
        continue;
      }
      if (c === "(" || c === "[") {
        buffer = buffer.concat(c);
        stack++;
        continue;
      }
      if (c === ")" || c === "]") {
        buffer = buffer.concat(c);
        stack--;
        continue;
      }
      ready = true;
      buffer = buffer.concat(c);
    }
    if (buffer.length > 0) {
      list.push(buffer);
    }
    return list;
  }

  static SPLIT_BRACKET(exp: string): string[] {
    const list = [];
    let buffer = "";
    let stack = 0;
    for (let i = 0; i < exp.length; i++) {
      const c = exp.charAt(i);
      if (stack == 0 && (c === "," || c === ":")) {
        list.push(buffer);
        list.push(c);
        buffer = "";
        continue;
      }
      if (c === "(" || c === "[") {
        buffer = buffer.concat(c);
        stack++;
        continue;
      }
      if (c === ")" || c === "]") {
        buffer = buffer.concat(c);
        stack--;
        continue;
      }
      buffer = buffer.concat(c);
    }
    if (buffer.length > 0) {
      list.push(buffer);
    }
    return list;
  }

  constructor(exp: string, reverse = false, times = 1) {
    this.children = [];
    exp = exp.replace(/[‘＇’]/g, "'");
    if (exp.match(/^([\*\#~;.#xyz]|[0123456789-]*[bsfdeulmr][w]*)$/gi)) {
      this.twist = new TwistAction(exp, reverse, times);
      return;
    }
    this.twist = new TwistAction("", reverse, times);
    if (exp.length == 0) {
      return;
    }
    const list = TwistNode.SPLIT_SEGMENT(exp);
    for (const item of list) {
      let values;
      values = item.match(/^\[(.+[:|,].+)\]$/i);
      if (values) {
        const parts = TwistNode.SPLIT_BRACKET(values[1]);
        switch (parts[1]) {
          case ",":
            this.children.push(new TwistNode(parts[0], false, 1));
            this.children.push(new TwistNode(parts[2], false, 1));
            this.children.push(new TwistNode(parts[0], true, 1));
            this.children.push(new TwistNode(parts[2], true, 1));
            break;
          case ":":
            this.children.push(new TwistNode(parts[0], false, 1));
            this.children.push(new TwistNode(parts[2], false, 1));
            this.children.push(new TwistNode(parts[0], true, 1));
            break;
          default:
            break;
        }
        continue;
      }
      values = item.match(/^(\[.+[:|,].+\])('?)(\d*)('?)$/i);
      if (values === null) {
        values = item.match(/^\((.+)\)('?)(\d*)('?)$/i);
      }
      if (values === null) {
        values = item.match(/([\*\#~;.#xyz]|[0123456789-]*[bsfdeulmr][w]*)('?)(\d*)('?)/i);
      }
      if (null === values) {
        continue;
      }
      const reverseFlag = (values[2] + values[4]).length == 1;
      const timesNum = values[3].length == 0 ? 1 : parseInt(values[3]);
      this.children.push(new TwistNode(values[1], reverseFlag, timesNum));
    }
  }

  parse(reverse = false): TwistAction[] {
    reverse = this.twist.reverse !== reverse;
    const result: TwistAction[] = [];
    if (0 !== this.children.length) {
      for (let i = 0; i < this.twist.times; i++) {
        for (let j = 0; j < this.children.length; j++) {
          let n;
          if (reverse) {
            n = this.children[this.children.length - j - 1];
          } else {
            n = this.children[j];
          }
          const list = n.parse(reverse);
          for (const element of list) {
            result.push(element);
          }
        }
      }
    } else if (this.twist.sign != "" && !this.twist.sign.startsWith("//")) {
      const action = new TwistAction(this.twist.sign, reverse, this.twist.times);
      result.push(action);
    }
    return result;
  }
}

// ── convert (ported from GroupTable.convert / group.ts) ──────────────────────
const AXIS_MAP: { [key: string]: string } = {
  R: "x", L: "-x", U: "y", D: "-y", F: "z", B: "-z", M: "-x", E: "-y", S: "z",
};
const AXIS_IDX: { [key: string]: 0 | 1 | 2 } = { x: 0, y: 1, z: 2 };

interface RawRotate { axis: 0 | 1 | 2; layer: number; twist: number; }

/** Decompose one TwistAction into signed single-slice rotations, exactly as
 *  GroupTable.convert does (this.order → N, groups[axis][layer] → {axis,layer}). */
export function convertAction(action: TwistAction, N: number): RawRotate[] {
  const result: RawRotate[] = [];
  const push = (signChar: string, layer: number, twist: number) => {
    result.push({ axis: AXIS_IDX[signChar], layer, twist });
  };
  let sign = action.sign;
  if (sign.match(/.[Ww]/)) {
    sign = sign.toLowerCase().replace("w", "");
  }
  if (/[XYZ]/.test(sign)) {
    sign = sign.toLowerCase();
  }
  let twist: number = action.times * (action.reverse ? -1 : 1);
  let layer: number;
  if (sign.length === 1) {
    switch (sign) {
      case "x":
      case "y":
      case "z":
        for (let l = 0; l < N; l++) push(sign, l, twist);
        return result;
      case "R":
      case "U":
      case "F":
      case "L":
      case "D":
      case "B": {
        layer = 0;
        let s = AXIS_MAP[sign.toUpperCase()];
        if (s.length == 2) {
          twist = -twist;
          s = s[1];
        } else {
          layer = N - 1;
        }
        push(s, layer, twist);
        return result;
      }
      case "r":
      case "u":
      case "f":
      case "l":
      case "d":
      case "b": {
        layer = 0;
        let s = AXIS_MAP[sign.toUpperCase()];
        if (s.length == 2) {
          twist = -twist;
          s = s[1];
        } else {
          layer = N - 2;
        }
        push(s, layer, twist);
        push(s, layer + 1, twist);
        return result;
      }
      case "E":
      case "M":
      case "S": {
        layer = Math.floor((N - 1) / 2);
        let s = AXIS_MAP[sign.toUpperCase()];
        if (s.length == 2) {
          twist = -twist;
          s = s[1];
        }
        push(s, layer, twist);
        if (N % 2 == 0) push(s, layer + 1, twist);
        return result;
      }
      case "e":
      case "m":
      case "s": {
        let s = AXIS_MAP[sign.toUpperCase()];
        if (s.length == 2) {
          twist = -twist;
          s = s[1];
        }
        for (let l = 1; l < N - 1; l++) push(s, l, twist);
        return result;
      }
    }
  } else {
    const list = sign.match(/([0123456789]*)(-?)([0123456789]*)([lrudfb])/i);
    if (list == null) {
      return result;
    }
    let from = Number(list[1]);
    let to = Number(list[3]);
    if (Number.isNaN(to) || to === 0) {
      if (/[lrudfb]/.test(list[4])) {
        to = 1;
      } else {
        to = from;
      }
    }
    if (from > N) from = N;
    if (to > N) to = N;
    let s = AXIS_MAP[list[4].toUpperCase()];
    if (s.length == 2) {
      twist = -twist;
      s = s[1];
    } else {
      from = N - from + 1;
      to = N - to + 1;
    }
    if (from > to) {
      [from, to] = [to, from];
    }
    for (let l = from - 1; l < to; l++) push(s, l, twist);
  }
  return result;
}

/** Full parse: notation string → quarter-turn atoms (twist expanded mod 4). */
export function notationToAtoms(text: string, N: number): NxnAtom[] {
  const actions = new TwistNode(text).parse();
  const atoms: NxnAtom[] = [];
  for (const action of actions) {
    if ("#*.~;".includes(action.sign)) continue; // engine control markers — no slice
    for (const rot of convertAction(action, N)) {
      const t = ((rot.twist % 4) + 4) % 4;
      if (t === 0) continue;
      if (t === 3) {
        atoms.push({ axis: rot.axis, layer: rot.layer, dir: -1 });
      } else {
        for (let i = 0; i < t; i++) atoms.push({ axis: rot.axis, layer: rot.layer, dir: 1 });
      }
    }
  }
  return atoms;
}
