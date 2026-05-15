/**
 * MobileKeypad — 触屏底部键盘。
 * 18 键 = 6 面 (R/L/U/D/F/B) × 普通+逆 + 整体 x/y/z + 中层 M/E/S。
 */
import './mobile-keypad.css';

interface Props {
  onTwist: (sign: string, reverse: boolean) => void;
}

const ROW1: { label: string; sign: string; reverse?: boolean }[] = [
  { label: 'R',  sign: 'R' },
  { label: "R'", sign: 'R', reverse: true },
  { label: 'L',  sign: 'L' },
  { label: "L'", sign: 'L', reverse: true },
  { label: 'U',  sign: 'U' },
  { label: "U'", sign: 'U', reverse: true },
  { label: 'D',  sign: 'D' },
  { label: "D'", sign: 'D', reverse: true },
];
const ROW2: { label: string; sign: string; reverse?: boolean }[] = [
  { label: 'F',  sign: 'F' },
  { label: "F'", sign: 'F', reverse: true },
  { label: 'B',  sign: 'B' },
  { label: "B'", sign: 'B', reverse: true },
  { label: 'M',  sign: 'M' },
  { label: "M'", sign: 'M', reverse: true },
  { label: 'E',  sign: 'E' },
  { label: "E'", sign: 'E', reverse: true },
];
const ROW3: { label: string; sign: string; reverse?: boolean }[] = [
  { label: 'S',  sign: 'S' },
  { label: "S'", sign: 'S', reverse: true },
  { label: 'x',  sign: 'x' },
  { label: "x'", sign: 'x', reverse: true },
  { label: 'y',  sign: 'y' },
  { label: "y'", sign: 'y', reverse: true },
  { label: 'z',  sign: 'z' },
  { label: "z'", sign: 'z', reverse: true },
];

export default function MobileKeypad({ onTwist }: Props) {
  const cell = (k: { label: string; sign: string; reverse?: boolean }) => (
    <button
      key={k.label}
      className="stack-key"
      onPointerDown={(e) => {
        e.preventDefault();
        onTwist(k.sign, !!k.reverse);
      }}
    >
      {k.label}
    </button>
  );
  return (
    <div className="stack-keypad">
      <div className="stack-keypad-row">{ROW1.map(cell)}</div>
      <div className="stack-keypad-row">{ROW2.map(cell)}</div>
      <div className="stack-keypad-row">{ROW3.map(cell)}</div>
    </div>
  );
}
