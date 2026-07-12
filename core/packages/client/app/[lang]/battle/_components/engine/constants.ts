/**
 * Battle 模块常量定义
 * 1:1 翻译自 battle.js（行 13~90）
 */

// NOTE: cubing.js event ID → [csTimer scrambler type, 默认步数] 映射
// 步数来源：csTimer 的 scrdata 定义（WCA 标准值）
export const EVENT_TO_CSTIMER: Record<string, [string, number]> = {
  '222':      ['222so',  0],   // 2x2 random-state（步数由求解器决定）
  '333':      ['333',    0],   // 3x3 random-state (Kociemba)
  '444':      ['444wca', 40],  // 4x4 WCA random-state, 40 步
  '555':      ['555wca', 60],  // 5x5 WCA, 60 步
  '666':      ['666wca', 80],  // 6x6 WCA, 80 步
  '777':      ['777wca', 100], // 7x7 WCA, 100 步
  '333oh':    ['333',    0],   // OH 用 3x3 打乱
  '333bf':    ['333',    0],   // 3BLD 用 3x3 打乱
  '444bf':    ['444wca', 40],  // 4BLD 用 4x4 打乱
  '555bf':    ['555wca', 60],  // 5BLD 用 5x5 打乱
  '333mbf':   ['333',    0],   // MBLD 用 3x3 打乱
  'clock':    ['clkwca', 0],   // Clock WCA
  'minx':     ['mgmp',   70],  // Megaminx WCA (Pochmann), 70 步
  'pyram':    ['pyrso',  0],   // Pyraminx random-state
  'skewb':    ['skbso',  0],   // Skewb random-state
  'sq1':      ['sqrs',   0],   // Square-1 random-state
  'fto':      ['ftoso',  0],   // FTO random-state
  'kilominx': ['klmso',  0],   // Kilominx random-state
};

// NOTE: 双语名称类型
export interface PuzzleName {
  en: string;
  zh: string;
}

export interface PuzzleInfo {
  id: string;
  name: PuzzleName;
}

// NOTE: 所有 WCA 官方项目 + 显示名
export const PUZZLES: PuzzleInfo[] = [
  // WCA 速拧
  { id: '222',    name: { en: '2×2',      zh: '二阶'
} },
  { id: '333',    name: { en: '3×3',      zh: '三阶'
} },
  { id: '444',    name: { en: '4×4',      zh: '四阶'
} },
  { id: '555',    name: { en: '5×5',      zh: '五阶'
} },
  { id: '666',    name: { en: '6×6',      zh: '六阶'
} },
  { id: '777',    name: { en: '7×7',      zh: '七阶'
} },
  { id: '333oh',  name: { en: 'OH',       zh: '单手'
} },
  // WCA 盲拧
  { id: '333bf',  name: { en: '3BLD',     zh: '三盲' } },
  { id: '444bf',  name: { en: '4BLD',     zh: '四盲' } },
  { id: '555bf',  name: { en: '5BLD',     zh: '五盲' } },
  { id: '333mbf', name: { en: 'MBLD',     zh: '多盲' } },
  // WCA 异形
  { id: 'clock',  name: { en: 'Clock',    zh: '魔表'
} },
  { id: 'minx',   name: { en: 'Megaminx', zh: '五魔方' } },
  { id: 'pyram',  name: { en: 'Pyraminx', zh: '金字塔' } },
  { id: 'skewb',  name: { en: 'Skewb',    zh: '斜转'
} },
  { id: 'sq1',    name: { en: 'SQ1',      zh: 'SQ1' } },
  // 非 WCA（cubing.js 支持）
  { id: 'fto',       name: { en: 'FTO',      zh: 'FTO' } },
  { id: 'kilominx',  name: { en: 'Kilominx', zh: '二阶五魔'
} },
];

// NOTE: 罚时类型枚举
export const PENALTY = {
  OK: 'ok',
  PLUS2: '+2',
  DNF: 'dnf',
} as const;

export type PenaltyType = typeof PENALTY[keyof typeof PENALTY];

// NOTE: 防止误触停止的最短计时时间（ms），与 Flutter 版一致
export const MIN_SOLVE_TIME = 100;

// localStorage 键名前缀，避免和其他页面冲突
export const LS_PREFIX = 'battle_';

// NOTE: 桌面端键盘映射默认值 — P1(下左)=空格, P2(下右)=Enter, P3(上左)=Q, P4(上右)=P。
// 用户可在设置里自定义(battle_store.playerKeys),这里只是初值 + 重置基准。
// KeyboardEvent.key 原样存(单字母大小写不敏感,由 keyToPlayer 归一化比较)。
export const DEFAULT_PLAYER_KEYS = [' ', 'Enter', 'q', 'p'];

// NOTE: 双语文本映射（JS 动态设置的文本，无法用 data-i18n 属性）
export const I18N_TEXT: Record<string, Record<string, string>> = {
  hide_time:  { en: 'Hide time', zh: '隐藏时间'
},
  show_time:  { en: 'Show time', zh: '显示时间'
},
  generating: { en: 'Generating scramble...',    zh: '正在生成打乱...'
},
  // NOTE: WCA 观察倒计时状态文字
  inspecting: { en: 'Inspecting',                zh: '观察中'
},
};

// NOTE: 背景图片最大体积
export const BG_MAX_BYTES = 4 * 1024 * 1024; // 4MB 上限
