// 键盘快捷键:e.code → 转动。默认对齐 cstimer 标准布局 + 方向键。
// 用户可在 SettingDrawer 中自定义,持久化到 localStorage 'sim.keymap'。
export interface KeyMove { sign: string; reverse?: boolean }

export const DEFAULT_KEYMAP: Record<string, KeyMove> = {
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
  ArrowUp: { sign: 'R' },                ArrowDown: { sign: 'R', reverse: true },
  ArrowLeft: { sign: 'U' },              ArrowRight: { sign: 'U', reverse: true },
};

const STORAGE_KEY = 'sim.keymap';

export function loadKeymap(): Record<string, KeyMove> {
  if (typeof window === 'undefined') return { ...DEFAULT_KEYMAP };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_KEYMAP };
    const parsed = JSON.parse(raw) as Record<string, KeyMove>;
    return parsed && typeof parsed === 'object' ? parsed : { ...DEFAULT_KEYMAP };
  } catch {
    return { ...DEFAULT_KEYMAP };
  }
}

export function saveKeymap(km: Record<string, KeyMove>): void {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(km)); } catch { /* ignore */ }
}

export function resetKeymap(): Record<string, KeyMove> {
  if (typeof window === 'undefined') return { ...DEFAULT_KEYMAP };
  try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  return { ...DEFAULT_KEYMAP };
}

const KEY_LABEL: Record<string, string> = {
  Comma: ',', Period: '.', Slash: '/', Semicolon: ';',
  Backquote: '`', Minus: '-', Equal: '=',
  BracketLeft: '[', BracketRight: ']', Backslash: '\\', Quote: "'",
  Space: 'Space', Tab: 'Tab', Enter: 'Enter', Backspace: '⌫',
  ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
};

export function keyLabel(code: string): string {
  if (KEY_LABEL[code]) return KEY_LABEL[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  return code;
}

export function moveLabel(m: KeyMove): string {
  return m.sign + (m.reverse ? "'" : '');
}

// 用于键盘 grid 中格子的简短显示。wide 用 Rw 风格 (cstimer/WCA 习惯)
export function displayMove(m: KeyMove): string {
  let sign = m.sign;
  if (/^[rludfb]$/.test(sign)) sign = sign.toUpperCase() + 'w';
  return sign + (m.reverse ? "'" : '');
}

// 键盘 4 行 × 10 列 (QWERTY,对齐 grid 不偏移)
export const KEYBOARD_ROWS: string[][] = [
  ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0'],
  ['KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY', 'KeyU', 'KeyI', 'KeyO', 'KeyP'],
  ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK', 'KeyL', 'Semicolon'],
  ['KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB', 'KeyN', 'KeyM', 'Comma', 'Period', 'Slash'],
];

export function moveEq(a: KeyMove, b: KeyMove): boolean {
  return a.sign === b.sign && !!a.reverse === !!b.reverse;
}

export function keysForMove(km: Record<string, KeyMove>, m: KeyMove): string[] {
  return Object.entries(km)
    .filter(([, v]) => moveEq(v, m))
    .map(([k]) => k);
}

export interface KeymapGroup {
  zh: string;
  en: string;
  moves: KeyMove[];
}

// 每个分组只列 move 列表,具体 key 在 UI 中从 effective keymap 反查
export const KEYMAP_GROUPS: KeymapGroup[] = [
  {
    zh: '基本 6 面', en: 'Basic faces',
    moves: [
      { sign: 'R' }, { sign: 'R', reverse: true },
      { sign: 'U' }, { sign: 'U', reverse: true },
      { sign: 'F' }, { sign: 'F', reverse: true },
      { sign: 'L' }, { sign: 'L', reverse: true },
      { sign: 'D' }, { sign: 'D', reverse: true },
      { sign: 'B' }, { sign: 'B', reverse: true },
    ],
  },
  {
    zh: '内层 (wide)', en: 'Wide (inner)',
    moves: [
      { sign: 'r' }, { sign: 'r', reverse: true },
      { sign: 'l' }, { sign: 'l', reverse: true },
      { sign: 'u' }, { sign: 'u', reverse: true },
      { sign: 'd' }, { sign: 'd', reverse: true },
    ],
  },
  {
    zh: '中层切片', en: 'Slices',
    moves: [
      { sign: 'M' }, { sign: 'M', reverse: true },
      { sign: 'E' }, { sign: 'E', reverse: true },
      { sign: 'S' }, { sign: 'S', reverse: true },
    ],
  },
  {
    zh: '整体转', en: 'Rotation',
    moves: [
      { sign: 'x' }, { sign: 'x', reverse: true },
      { sign: 'y' }, { sign: 'y', reverse: true },
      { sign: 'z' }, { sign: 'z', reverse: true },
    ],
  },
];
