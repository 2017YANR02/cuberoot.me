/** Clock preview — applies WCA clock notation scramble.
 *
 * Renders 2 x 3x3 grids (front + back) of clock dials. Each dial draws a
 * circle, an hour-hand pointing at the dial's stored hour value [0..11],
 * and 12 hour-tick marks around the rim. Pin up/down state is shown as
 * small dots in the corners of the front grid (filled = up).
 */

import type { JSX } from 'react';
import {
  applyClockScramble,
  backGridDisplay,
  frontGridDisplay,
  type ClockState,
} from './clock_state.ts';

interface ClockFaceProps {
  scramble?: string;
  size?: number;
  className?: string;
}

function dial(cx: number, cy: number, r: number, hour: number, key: string): JSX.Element {
  const els: JSX.Element[] = [];
  els.push(
    <circle
      key={`${key}-c`}
      cx={cx} cy={cy} r={r}
      fill="#f5f5f5"
      stroke="#333"
      strokeWidth={1}
    />,
  );
  for (let h = 0; h < 12; h++) {
    const ang = (h * 30 - 90) * Math.PI / 180;
    const isQuarter = h % 3 === 0;
    const inner = r * (isQuarter ? 0.78 : 0.86);
    const outer = r * 0.96;
    const x1 = cx + inner * Math.cos(ang);
    const y1 = cy + inner * Math.sin(ang);
    const x2 = cx + outer * Math.cos(ang);
    const y2 = cy + outer * Math.sin(ang);
    els.push(
      <line
        key={`${key}-t${h}`}
        x1={x1} y1={y1} x2={x2} y2={y2}
        stroke="#333"
        strokeWidth={isQuarter ? 1.2 : 0.6}
      />,
    );
  }
  const handAng = (hour * 30 - 90) * Math.PI / 180;
  const handR = r * 0.7;
  const hx = cx + handR * Math.cos(handAng);
  const hy = cy + handR * Math.sin(handAng);
  els.push(
    <line
      key={`${key}-h`}
      x1={cx} y1={cy} x2={hx} y2={hy}
      stroke="#222"
      strokeWidth={Math.max(1.4, r * 0.12)}
      strokeLinecap="round"
    />,
  );
  els.push(
    <circle
      key={`${key}-n`}
      cx={cx} cy={cy} r={Math.max(1, r * 0.12)}
      fill="#222"
    />,
  );
  return <g key={key}>{els}</g>;
}

function gridDials(
  originX: number,
  originY: number,
  cellSize: number,
  gap: number,
  dials: number[],
  keyPrefix: string,
): JSX.Element[] {
  const out: JSX.Element[] = [];
  const r = cellSize / 2 - 1;
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const idx = row * 3 + col;
      const cx = originX + col * (cellSize + gap) + cellSize / 2;
      const cy = originY + row * (cellSize + gap) + cellSize / 2;
      out.push(dial(cx, cy, r, dials[idx], `${keyPrefix}-${idx}`));
    }
  }
  return out;
}

/** 4 pin indicators at the inner corners of the front 2x2 dial groups.
 * pinsFront ordering [UR, DR, DL, UL]. Filled circle = up, hollow = down.
 *
 * Corner-to-pin mapping in the front 3x3 (between the 2x2 sub-grids):
 *   top-left intersection    -> UL pin (between dials 0,1,3,4)
 *   top-right intersection   -> UR pin (between dials 1,2,4,5)
 *   bottom-left intersection -> DL pin (between dials 3,4,6,7)
 *   bottom-right intersection-> DR pin (between dials 4,5,7,8)
 */
function frontPins(
  originX: number,
  originY: number,
  cellSize: number,
  gap: number,
  pegR: number,
  pinsFront: [boolean, boolean, boolean, boolean],
  keyPrefix: string,
): JSX.Element[] {
  const out: JSX.Element[] = [];
  // [UL, UR, DL, DR] in (row, col) intersection order:
  const cornerToPinIdx = [3, 0, 2, 1]; // pinsFront idx for [UL, UR, DL, DR]
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 2; col++) {
      const cx = originX + (col + 1) * cellSize + col * gap + gap / 2;
      const cy = originY + (row + 1) * cellSize + row * gap + gap / 2;
      const cornerOrd = row * 2 + col; // 0=UL 1=UR 2=DL 3=DR
      const pinIdx = cornerToPinIdx[cornerOrd];
      const up = pinsFront[pinIdx];
      out.push(
        <circle
          key={`${keyPrefix}-pin-${cornerOrd}`}
          cx={cx} cy={cy} r={pegR}
          fill={up ? '#222' : '#f5f5f5'}
          stroke="#333"
          strokeWidth={0.8}
        />,
      );
    }
  }
  return out;
}

function backPegs(
  originX: number,
  originY: number,
  cellSize: number,
  gap: number,
  pegR: number,
  keyPrefix: string,
): JSX.Element[] {
  const out: JSX.Element[] = [];
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 2; col++) {
      const cx = originX + (col + 1) * cellSize + col * gap + gap / 2;
      const cy = originY + (row + 1) * cellSize + row * gap + gap / 2;
      out.push(
        <circle
          key={`${keyPrefix}-p${row}-${col}`}
          cx={cx} cy={cy} r={pegR}
          fill="#bbb"
          stroke="#333"
          strokeWidth={0.6}
        />,
      );
    }
  }
  return out;
}

export default function ClockFace(props: ClockFaceProps): JSX.Element {
  const size = props.size ?? 28;
  const cellSize = size;
  const gap = Math.max(2, Math.round(size * 0.18));
  const sideW = cellSize * 3 + gap * 2;
  const padding = Math.max(3, Math.round(size * 0.18));
  const sideGap = Math.max(6, Math.round(size * 0.4));
  const totalW = sideW * 2 + sideGap + padding * 2;
  const totalH = sideW + padding * 2;

  const state: ClockState = applyClockScramble(props.scramble ?? '');
  const front = frontGridDisplay(state);
  const back = backGridDisplay(state);

  const items: JSX.Element[] = [];
  const pegR = Math.max(1.2, size * 0.1);
  // Front grid + pins.
  const fx = padding;
  const fy = padding;
  items.push(...gridDials(fx, fy, cellSize, gap, front, 'f'));
  items.push(...frontPins(fx, fy, cellSize, gap, pegR, state.pinsFront, 'f'));
  // Back grid (no pin tracking on back; render decorative pegs).
  const bx = padding + sideW + sideGap;
  const by = padding;
  items.push(...gridDials(bx, by, cellSize, gap, back, 'b'));
  items.push(...backPegs(bx, by, cellSize, gap, pegR, 'b'));

  return (
    <svg
      width={totalW}
      height={totalH}
      viewBox={`0 0 ${totalW} ${totalH}`}
      className={props.className}
      style={{ display: 'block' }}
      role="img"
      aria-label="clock preview"
    >
      {items}
    </svg>
  );
}
