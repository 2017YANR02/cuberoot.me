// Faithful pure port of spooncuber reader.js edgeread / cornerread /
// edgeorientation / cornerorientation, refactored to BldConfig-driven signatures
// (the four DOM reads per side are replaced by config fields). Output is
// STRUCTURED LetterCell[] (role start/end/normal) instead of HTML spans.
//
// The upstream functions reuse mutable module globals (arra/arrc/edgeCh/cornerCh)
// per call. Here every read uses a FRESH CubeModel (re-init each call) and a
// locally-rebuilt working scheme string, so reads are fully re-entrant.

import { CubeModel } from './facelet-model';
import {
  nearedge,
  nearcorner,
  posChichu,
  eglobalState,
  cglobalState,
} from './lettering';
import type { BldConfig, LetterCell, CodeReadResult } from './types';

// ~~ (double bitwise NOT) in JS truncates toward zero within 32-bit range, which
// for the non-negative piece indices used here equals Math.trunc.
const trunc = Math.trunc;

/**
 * readEdges — port of edgeread(s1).
 *
 * DOM mapping:
 *   orientFlag    = Number(#edgeorientflag.checked)  -> cfg.keepHueE (0/1)
 *   skipCycleNum  = Number(#edgeskipcyclenum.checked) -> cfg.skipE (0/1)
 *   edgebuffer    = #edgebuffer.value.toUpperCase()  -> cfg.eBuf (UPPERCASE)
 *   edgeorder     = #edgeorder.value.toUpperCase()   -> cfg.eOrder (UPPERCASE)
 */
export function readEdges(scramble: string, cfg: BldConfig): LetterCell[] {
  const model = new CubeModel();
  model.operatealg(scramble);

  const cycleList: string[] = [];
  const cycleOrders: number[] = [];
  let edgereadChar = '';
  let edgereadpartChar = '';
  let sumorient = 0;

  const orientFlag = cfg.keepHueE ? 1 : 0;
  const skipCycleNum = cfg.skipE;
  const edgebuffer = String(cfg.eBuf).toUpperCase();
  const edgeorder = String(cfg.eOrder).toUpperCase();

  // LIVE scheme rebuild from buffer + borrow-order (nearedge keeps its OWN
  // default pairing — see lettering.ts).
  let edgeCh = ` ${edgebuffer}${nearedge(edgebuffer)}`;
  for (let i = 0; i <= edgeorder.length - 1; i++) {
    edgeCh = edgeCh + edgeorder[i] + nearedge(edgeorder[i]);
  }

  for (let i = 1; i <= 24; i = i + 2) {
    if (edgereadChar.indexOf(edgeCh[i]) === -1 && edgereadChar.indexOf(edgeCh[i + 1]) === -1) {
      edgereadpartChar = edgeCh[i];
      // Extra near-sticker stop condition: end the trace ONE SHORT so the
      // closing target is appended explicitly afterward.
      while (
        model.track1(edgereadpartChar[edgereadpartChar.length - 1]) !== edgereadpartChar[0] &&
        nearedge(String(model.track1(edgereadpartChar[edgereadpartChar.length - 1]))) !== edgereadpartChar[0]
      ) {
        edgereadpartChar = edgereadpartChar + model.track1(edgereadpartChar[edgereadpartChar.length - 1]);
      }
      // `|| i === 1` keeps the buffer piece's cycle even if it looks solved.
      if (edgereadpartChar !== edgeCh[i] || i === 1) {
        edgereadpartChar = edgereadpartChar + model.track1(edgereadpartChar[edgereadpartChar.length - 1]);
        edgereadChar = edgereadChar + edgereadpartChar;
        cycleList.push(edgereadpartChar);
        cycleOrders.push(trunc((i - 1) / 2));
      }
      // sumorient is summed over ALL unvisited pieces (incl. ones not pushed).
      sumorient +=
        edgeCh.indexOf(edgereadpartChar[edgereadpartChar.length - 1]) - edgeCh.indexOf(edgereadpartChar[0]);
    }
  }

  let orientLast = 0;
  const out: LetterCell[] = [];
  let endList = '';
  let codenum = 0;
  for (let i = 0; i < cycleList.length; i++) {
    if (i > 0) {
      orientLast +=
        edgeCh.indexOf(cycleList[i - 1][cycleList[i - 1].length - 1]) - edgeCh.indexOf(cycleList[i - 1][0]);
    }
    for (let j = 0; j < cycleList[i].length; j++) {
      let code = cycleList[i][j];
      // KEEP-HUE shift: keepHue OR cycleOrders[i] <= skip -> shift orientLast times.
      if (i > 0 && (orientFlag === 1 || (orientFlag === 0 && cycleOrders[i] <= skipCycleNum))) {
        for (let k = 0; k < orientLast; k++) {
          code = nearedge(code);
        }
      }
      if (j === cycleList[i].length - 1 && cycleOrders[i] === 0) continue;
      if (j === cycleList[i].length - 1 && cycleOrders[i] <= skipCycleNum) {
        // SKIP-CYCLE implied buffer: recompute the buffer-orientation sticker of
        // the implied piece, then hue-correct by sumorient % 2 near shifts.
        let lastcode = eglobalState[trunc(posChichu(code.toLowerCase()) * 2)].toUpperCase();
        for (let k = 0; k < sumorient % 2; k++) {
          lastcode = nearedge(lastcode);
        }
        endList += lastcode;
      } else {
        if (i > 0 && j === 0) {
          out.push({ letter: code, role: 'start' });
        } else if (i > 0 && j === cycleList[i].length - 1) {
          out.push({ letter: code, role: 'end' });
        } else {
          out.push({ letter: code, role: 'normal' });
        }
        codenum += 1;
        // codenum % 2 space grouping is presentational; omitted from cells.
      }
    }
  }
  if (skipCycleNum > 0) {
    const reversed = endList.split('').reverse().join('');
    for (const ch of reversed) {
      out.push({ letter: ch, role: 'end' });
    }
  }

  // Upstream `.slice(1)` drops the leading sentinel char (the buffer cycle's
  // sole emitted letter, always a single plain char). Drop the first cell.
  return out.slice(1);
}

/**
 * readCorners — port of cornerread(s1).
 *
 * DOM mapping mirrors readEdges with #corner* inputs, step 3, nearcorner x2.
 */
export function readCorners(scramble: string, cfg: BldConfig): LetterCell[] {
  const model = new CubeModel();
  model.operatealg(scramble);

  const orientFlag = cfg.keepHueC ? 1 : 0;
  const skipCycleNum = cfg.skipC;
  const cornerbuffer = String(cfg.cBuf).toUpperCase();
  const cornerorder = String(cfg.cOrder).toUpperCase();

  let cornerCh = ` ${cornerbuffer}${nearcorner(cornerbuffer)}${nearcorner(nearcorner(cornerbuffer))}`;
  for (let i = 0; i <= cornerorder.length - 1; i++) {
    cornerCh =
      cornerCh + cornerorder[i] + nearcorner(cornerorder[i]) + nearcorner(nearcorner(cornerorder[i]));
  }

  const cycleList: string[] = [];
  const cycleOrders: number[] = [];
  let cornerreadChar = '';
  let cornerreadpartChar = '';
  let sumorient = 0;

  for (let i = 1; i <= 24; i = i + 3) {
    if (
      cornerreadChar.indexOf(cornerCh[i]) === -1 &&
      cornerreadChar.indexOf(cornerCh[i + 1]) === -1 &&
      cornerreadChar.indexOf(cornerCh[i + 2]) === -1
    ) {
      cornerreadpartChar = cornerCh[i];
      while (
        model.track2(cornerreadpartChar[cornerreadpartChar.length - 1]) !== cornerreadpartChar[0] &&
        nearcorner(String(model.track2(cornerreadpartChar[cornerreadpartChar.length - 1]))) !== cornerreadpartChar[0] &&
        model.track2(cornerreadpartChar[cornerreadpartChar.length - 1]) !== nearcorner(cornerreadpartChar[0])
      ) {
        cornerreadpartChar = cornerreadpartChar + model.track2(cornerreadpartChar[cornerreadpartChar.length - 1]);
      }
      if (cornerreadpartChar !== cornerCh[i] || i === 1) {
        cornerreadpartChar = cornerreadpartChar + model.track2(cornerreadpartChar[cornerreadpartChar.length - 1]);
        cornerreadChar = cornerreadChar + cornerreadpartChar;
        cycleList.push(cornerreadpartChar);
        cycleOrders.push(trunc((i - 1) / 3));
      }
      sumorient +=
        cornerCh.indexOf(cornerreadpartChar[cornerreadpartChar.length - 1]) - cornerCh.indexOf(cornerreadpartChar[0]);
    }
  }

  let orientLast = 0;
  const out: LetterCell[] = [];
  let endList = '';
  let codenum = 0;
  for (let i = 0; i < cycleList.length; i++) {
    if (i > 0) {
      orientLast +=
        cornerCh.indexOf(cycleList[i - 1][cycleList[i - 1].length - 1]) - cornerCh.indexOf(cycleList[i - 1][0]);
    }
    for (let j = 0; j < cycleList[i].length; j++) {
      let code = cycleList[i][j];
      if (i > 0 && (orientFlag === 1 || (orientFlag === 0 && cycleOrders[i] <= skipCycleNum))) {
        for (let k = 0; k < orientLast; k++) {
          code = nearcorner(code);
        }
      }
      if (j === cycleList[i].length - 1 && cycleOrders[i] === 0) continue;
      if (j === cycleList[i].length - 1 && cycleOrders[i] <= skipCycleNum) {
        let lastcode = cglobalState[trunc(posChichu(code) * 3)];
        for (let k = 0; k < sumorient % 3; k++) {
          lastcode = nearcorner(lastcode);
        }
        endList += lastcode;
      } else {
        if (i > 0 && j === 0) {
          out.push({ letter: code, role: 'start' });
        } else if (i > 0 && j === cycleList[i].length - 1) {
          out.push({ letter: code, role: 'end' });
        } else {
          out.push({ letter: code, role: 'normal' });
        }
        codenum += 1;
      }
    }
  }
  if (skipCycleNum > 0) {
    const reversed = endList.split('').reverse().join('');
    for (const ch of reversed) {
      out.push({ letter: ch, role: 'end' });
    }
  }

  return out.slice(1);
}

/**
 * edgeOrientation — port of edgeorientation(s1) -> 棱块翻色 string.
 *
 * Rebuilds the SAME working edgeCh from cfg (upstream relies on the module
 * edgeCh left mutated by the most recent edgeread; here we rebuild it locally so
 * the read is self-contained and re-entrant). Lists flipped-in-place edges as
 * letter pairs "<other><self> " joined, trailing space trimmed.
 */
export function edgeOrientation(scramble: string, cfg: BldConfig): string {
  const model = new CubeModel();
  model.operatealg(scramble);

  const edgebuffer = String(cfg.eBuf).toUpperCase();
  const edgeorder = String(cfg.eOrder).toUpperCase();
  let edgeCh = ` ${edgebuffer}${nearedge(edgebuffer)}`;
  for (let i = 0; i <= edgeorder.length - 1; i++) {
    edgeCh = edgeCh + edgeorder[i] + nearedge(edgeorder[i]);
  }

  let edgeorientationOut = '';
  for (let i = 3; i <= 24; i = i + 2) {
    if (model.track1(edgeCh[i]) === edgeCh[i + 1]) {
      edgeorientationOut = `${edgeorientationOut + edgeCh[i + 1] + edgeCh[i]} `;
    }
  }
  edgeorientationOut = edgeorientationOut.slice(0, edgeorientationOut.length - 1);
  return edgeorientationOut;
}

/**
 * cornerOrientation — port of cornerorientation(s1) -> 角块翻色 string.
 *
 * Two checks per corner (CW vs CCW twist in place). Rebuilds working cornerCh
 * from cfg for self-containment.
 */
export function cornerOrientation(scramble: string, cfg: BldConfig): string {
  const model = new CubeModel();
  model.operatealg(scramble);

  const cornerbuffer = String(cfg.cBuf).toUpperCase();
  const cornerorder = String(cfg.cOrder).toUpperCase();
  let cornerCh = ` ${cornerbuffer}${nearcorner(cornerbuffer)}${nearcorner(nearcorner(cornerbuffer))}`;
  for (let i = 0; i <= cornerorder.length - 1; i++) {
    cornerCh =
      cornerCh + cornerorder[i] + nearcorner(cornerorder[i]) + nearcorner(nearcorner(cornerorder[i]));
  }

  let cornerorientationOut = '';
  for (let i = 4; i <= 24; i = i + 3) {
    if (model.track2(cornerCh[i]) === cornerCh[i + 1]) {
      cornerorientationOut = `${cornerorientationOut + cornerCh[i + 2] + cornerCh[i]} `;
    }
    if (model.track2(cornerCh[i]) === cornerCh[i + 2]) {
      cornerorientationOut = `${cornerorientationOut + cornerCh[i + 1] + cornerCh[i]} `;
    }
  }
  cornerorientationOut = cornerorientationOut.slice(0, cornerorientationOut.length - 1);
  return cornerorientationOut;
}

/**
 * codereader — the real entry path (replaces upstream analyse(), which has a
 * latent undefined-`alg` bug and is NOT ported). Runs all four reads against the
 * same scramble/config (each on a fresh CubeModel) and returns structured cells
 * + orientation strings.
 */
export function codereader(scramble: string, cfg: BldConfig): CodeReadResult {
  return {
    edges: readEdges(scramble, cfg),
    corners: readCorners(scramble, cfg),
    flips: edgeOrientation(scramble, cfg),
    twists: cornerOrientation(scramble, cfg),
  };
}
