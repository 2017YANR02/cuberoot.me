// 键盘快捷键:e.code → 转动。和 cstimer 标准布局对齐,加 S/E 切片,额外加方向键。
export interface KeyMove { sign: string; reverse?: boolean }

export const KEYMAP: Record<string, KeyMove> = {
  // 6 面
  KeyI: { sign: 'R' },                  KeyK: { sign: 'R', reverse: true },
  KeyW: { sign: 'B' },                  KeyO: { sign: 'B', reverse: true },
  KeyS: { sign: 'D' },                  KeyL: { sign: 'D', reverse: true },
  KeyD: { sign: 'L' },                  KeyE: { sign: 'L', reverse: true },
  KeyJ: { sign: 'U' },                  KeyF: { sign: 'U', reverse: true },
  KeyH: { sign: 'F' },                  KeyG: { sign: 'F', reverse: true },
  // wide (内 2 层)
  KeyU: { sign: 'r' },                  KeyM: { sign: 'r', reverse: true },
  KeyV: { sign: 'l' },                  KeyR: { sign: 'l', reverse: true },
  Comma: { sign: 'u' },                 KeyC: { sign: 'u', reverse: true },
  KeyZ: { sign: 'd' },                  Slash: { sign: 'd', reverse: true },
  // 中层切片
  Digit5: { sign: 'M' },                Digit6: { sign: 'M' },
  Period: { sign: 'M', reverse: true }, KeyX: { sign: 'M', reverse: true },
  Digit2: { sign: 'E' },                Digit9: { sign: 'E', reverse: true },
  Digit0: { sign: 'S' },                Digit1: { sign: 'S', reverse: true },
  // 整体转
  KeyT: { sign: 'x' },                  KeyY: { sign: 'x' },
  KeyN: { sign: 'x', reverse: true },   KeyB: { sign: 'x', reverse: true },
  Semicolon: { sign: 'y' },             KeyA: { sign: 'y', reverse: true },
  KeyP: { sign: 'z' },                  KeyQ: { sign: 'z', reverse: true },
  // 方向键
  ArrowUp: { sign: 'R' },                   ArrowDown: { sign: 'R', reverse: true },
  ArrowLeft: { sign: 'U' },                 ArrowRight: { sign: 'U', reverse: true },
};

const KEY_LABEL: Record<string, string> = {
  Comma: ',', Period: '.', Slash: '/', Semicolon: ';',
  ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
};

export function keyLabel(code: string): string {
  if (KEY_LABEL[code]) return KEY_LABEL[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  return code;
}

export interface KeymapRow {
  move: string;        // 显示标签,例如 "R" / "R'" / "r" / "M'"
  keys: string[];      // e.code 列表
}

export interface KeymapGroup {
  zh: string;
  en: string;
  rows: KeymapRow[];
}

// 每个 move 列出所有可触发的键。顺序按 R U F L D B → 外层 → wide → 切片 → 整体转。
export const KEYMAP_GROUPS: KeymapGroup[] = [
  {
    zh: '基本 6 面', en: 'Basic faces',
    rows: [
      { move: 'R',  keys: ['KeyI', 'ArrowUp'] },
      { move: "R'", keys: ['KeyK', 'ArrowDown'] },
      { move: 'U',  keys: ['KeyJ', 'ArrowLeft'] },
      { move: "U'", keys: ['KeyF', 'ArrowRight'] },
      { move: 'F',  keys: ['KeyH'] },
      { move: "F'", keys: ['KeyG'] },
      { move: 'L',  keys: ['KeyD'] },
      { move: "L'", keys: ['KeyE'] },
      { move: 'D',  keys: ['KeyS'] },
      { move: "D'", keys: ['KeyL'] },
      { move: 'B',  keys: ['KeyW'] },
      { move: "B'", keys: ['KeyO'] },
    ],
  },
  {
    zh: '内层 (wide)', en: 'Wide (inner)',
    rows: [
      { move: 'r',  keys: ['KeyU'] },
      { move: "r'", keys: ['KeyM'] },
      { move: 'l',  keys: ['KeyV'] },
      { move: "l'", keys: ['KeyR'] },
      { move: 'u',  keys: ['Comma'] },
      { move: "u'", keys: ['KeyC'] },
      { move: 'd',  keys: ['KeyZ'] },
      { move: "d'", keys: ['Slash'] },
    ],
  },
  {
    zh: '中层切片', en: 'Slices',
    rows: [
      { move: 'M',  keys: ['Digit5', 'Digit6'] },
      { move: "M'", keys: ['Period', 'KeyX'] },
      { move: 'E',  keys: ['Digit2'] },
      { move: "E'", keys: ['Digit9'] },
      { move: 'S',  keys: ['Digit0'] },
      { move: "S'", keys: ['Digit1'] },
    ],
  },
  {
    zh: '整体转', en: 'Rotation',
    rows: [
      { move: 'x',  keys: ['KeyT', 'KeyY'] },
      { move: "x'", keys: ['KeyN', 'KeyB'] },
      { move: 'y',  keys: ['Semicolon'] },
      { move: "y'", keys: ['KeyA'] },
      { move: 'z',  keys: ['KeyP'] },
      { move: "z'", keys: ['KeyQ'] },
    ],
  },
];
