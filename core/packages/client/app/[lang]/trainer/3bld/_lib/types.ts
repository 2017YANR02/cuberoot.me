// 3BLD lettering engine types — faithful port of spooncuber reader.js (DOM-free).

/**
 * Configuration that drives a read. The DOM reads in upstream
 * edgeread/cornerread (#edgebuffer/#edgeorder/#edgeorientflag/#edgeskipcyclenum
 * and the corner equivalents) are replaced by these fields:
 *
 *  - cBuf / eBuf  -> #cornerbuffer / #edgebuffer  (single letter, UPPERCASE)
 *  - cOrder / eOrder -> #cornerorder / #edgeorder (borrow-order letter string, UPPERCASE)
 *  - keepHueC / keepHueE -> #cornerorientflag / #edgeorientflag (保持色相 / keep-hue)
 *  - skipC / skipE -> #cornerskipcyclenum / #edgeskipcyclenum (跳编法 / fixed-buffer skip-cycle)
 *
 * Upstream reads these via Number(checkbox.checked), so skipC/skipE are 0/1 ONLY
 * (despite the historical name "...num"); cycleOrders[i] <= skip only distinguishes
 * rank-0 vs rank>0.
 *
 * scheme / orientation are not used by the lettering trace itself (the color
 * binding is fixed by CubeModel.initialize() = Yellow-top/Red-front, and the 24
 * orientation labels only feed the visual player / scheme-display chooser); they
 * are carried here so the same config object can drive the UI and the visual
 * preview without re-shaping it.
 */
export interface BldConfig {
  cBuf: string;
  eBuf: string;
  cOrder: string;
  eOrder: string;
  keepHueC: boolean;
  keepHueE: boolean;
  skipC: 0 | 1;
  skipE: 0 | 1;
  scheme: 'chichu' | 'speffz';
  orientation: number;
}

/**
 * One emitted letter in a read-out.
 *  - role 'start' -> upstream <span style='color:blue'> (cycle start, i>0 && j===0)
 *  - role 'end'   -> upstream <span style='color:green'> (cycle end OR the reversed skip-cycle endList)
 *  - role 'normal' -> plain letter
 *
 * The "space every two letters" grouping in the upstream HTML is purely
 * presentational and is NOT encoded here; consumers group LetterCell[] in pairs.
 */
export interface LetterCell {
  letter: string;
  role: 'normal' | 'start' | 'end';
}

export interface CodeReadResult {
  edges: LetterCell[];
  corners: LetterCell[];
  flips: string;
  twists: string;
}
