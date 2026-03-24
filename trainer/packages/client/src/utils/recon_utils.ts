/**
 * 复盘格式化工具——1:1 移植自 recon/recon_utils.js（335 行）
 * NOTE: 提供国旗/格式化/事件名/puzzle 映射/纪录徽章/时间格式等
 */

// ── 国旗 ──

/**
 * 用 Unicode 区域指示符生成国旗 emoji
 * NOTE: ISO 3166-1 alpha-2 码转成对应的 emoji 国旗
 * @param iso2 小写两字母国家代码（如 "cn", "us"）
 */
export function countryFlag(iso2: string): string {
  if (!iso2 || iso2.length !== 2) return '';
  // NOTE: 区域指示符 A 的码点 = 0x1F1E6，a 的 charCode = 97
  const offset = 0x1F1E6 - 97; // 'a'.charCodeAt(0) = 97
  const lc = iso2.toLowerCase();
  return String.fromCodePoint(lc.charCodeAt(0) + offset, lc.charCodeAt(1) + offset);
}

// ── 时间格式化 ──

/**
 * 将秒数格式化为显示字符串
 * NOTE: 与原版 formatTime 一致
 * - < 60: "12.34"
 * - >= 60: "1:12.34"
 * - DNF: "DNF"
 */
export function formatTime(seconds: number | undefined | null): string {
  if (seconds === undefined || seconds === null || seconds < 0) return 'DNF';
  if (seconds === 0) return '0.00';
  if (seconds >= 60) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds - mins * 60;
    return `${mins}:${secs.toFixed(2).padStart(5, '0')}`;
  }
  return seconds.toFixed(2);
}

/**
 * 解析用户输入的成绩字符串
 * 支持格式：
 * - "12.34" → 12.34
 * - "1:12.34" → 72.34
 * - "305" → 3.05（自动 ÷ 100，WCA 导入格式）
 */
export function parseTimeInput(raw: string): number {
  if (!raw || !raw.trim()) return NaN;
  const s = raw.trim();
  // NOTE: mm:ss.xx 格式
  const colonMatch = s.match(/^(\d+):(\d{1,2}(?:\.\d+)?)$/);
  if (colonMatch) {
    return parseInt(colonMatch[1]) * 60 + parseFloat(colonMatch[2]);
  }
  const n = parseFloat(s);
  if (isNaN(n)) return NaN;
  // NOTE: 纯整数且 >= 100 视为 centiseconds（WCA 数据库格式）
  if (Number.isInteger(n) && n >= 100 && !s.includes('.')) {
    return n / 100;
  }
  return n;
}

// ── 事件映射 ──

/** WCA 项目 → 显示名称 */
const EVENT_DISPLAY_NAMES: Record<string, Record<string, string>> = {
  zh: {
    '3x3': '三阶', '2x2': '二阶', '4x4': '四阶', '5x5': '五阶',
    '6x6': '六阶', '7x7': '七阶', '3bld': '三盲', '4bld': '四盲',
    '5bld': '五盲', 'mbld': '多盲', 'oh': '单手', 'sq1': 'SQ1',
    pyra: '金字塔', mega: '五魔', clock: 'Clock', skewb: 'Skewb',
    fmc: 'FMC',
  },
  en: {
    '3x3': '3×3', '2x2': '2×2', '4x4': '4×4', '5x5': '5×5',
    '6x6': '6×6', '7x7': '7×7', '3bld': '3BLD', '4bld': '4BLD',
    '5bld': '5BLD', mbld: 'MBLD', oh: 'OH', sq1: 'SQ1',
    pyra: 'Pyra', mega: 'Mega', clock: 'Clock', skewb: 'Skewb',
    fmc: 'FMC',
  },
};

/** 获取项目显示名称 */
export function getEventDisplayName(event: string, locale = 'en'): string {
  return EVENT_DISPLAY_NAMES[locale]?.[event] ?? event;
}

/** 项目 → twisty-player puzzle ID */
const PUZZLE_MAP: Record<string, string> = {
  '3x3': '3x3x3', '2x2': '2x2x2', '4x4': '4x4x4', '5x5': '5x5x5',
  '6x6': '6x6x6', '7x7': '7x7x7', '3bld': '3x3x3', '4bld': '4x4x4',
  '5bld': '5x5x5', oh: '3x3x3', sq1: 'square1',
  pyra: 'pyraminx', mega: 'megaminx', clock: 'clock', skewb: 'skewb',
};

/** 获取 twisty-player puzzle ID */
export function getPuzzleId(event: string): string {
  return PUZZLE_MAP[event] ?? '3x3x3';
}

/** 判断是否为盲拧项目 */
export function isBldEvent(event: string): boolean {
  return ['3bld', '4bld', '5bld', 'mbld'].includes(event);
}

// ── 纪录徽章 ──

/** 纪录等级与显示配色 */
const RECORD_COLORS: Record<string, string> = {
  WR: '#e74c3c',
  CR: '#e67e22',
  NR: '#27ae60',
  PR: '#3498db',
};

/**
 * 生成纪录徽章 HTML
 * NOTE: 用于列表页/详情页的纪录标签显示
 */
export function recordBadgeHtml(record: string | undefined): string {
  if (!record) return '';
  const upper = record.toUpperCase();
  const color = RECORD_COLORS[upper] ?? '#888';
  return `<span class="recon-record-badge" style="background:${color}">${upper}</span>`;
}

// ── 轮次 ──

/** 轮次显示名称 */
const ROUND_DISPLAY: Record<string, Record<string, string>> = {
  zh: {
    f: '决赛', '1': '第一轮', '2': '第二轮', '3': '第三轮',
    sf: '半决赛', cf: '组合决赛',
  },
  en: {
    f: 'Final', '1': 'Round 1', '2': 'Round 2', '3': 'Round 3',
    sf: 'Semi Final', cf: 'Combined Final',
  },
};

/** 获取轮次显示名称 */
export function getRoundDisplay(round: string, locale = 'en'): string {
  return ROUND_DISPLAY[locale]?.[round] ?? round;
}

// ── 选项列表 ──

/** 纪录下拉选项（含 cancelled 前缀） */
export const RECORD_OPTIONS = (() => {
  const types = ['WR', 'CR', 'NR', 'PR'];
  const prefixes = ['', 'cancelled '];
  const options: string[] = [];
  for (const prefix of prefixes) {
    for (const t of types) {
      options.push(prefix + t);
    }
  }
  return options;
})();

// ── 比赛搜索 URL ──

/** WCA 比赛链接 */
export function wcaCompUrl(compWcaId: string): string {
  return `https://www.worldcubeassociation.org/competitions/${compWcaId}`;
}

/** WCA 选手链接 */
export function wcaPersonUrl(personId: string): string {
  return `https://www.worldcubeassociation.org/persons/${personId}`;
}

// ── i18n ──

/** 获取当前语言 */
export function getLocale(): string {
  if (typeof localStorage !== 'undefined') {
    return localStorage.getItem('i18n_locale') || 'en';
  }
  return 'en';
}

/** 简单的中英文选择 */
export function t(zh: string, en: string): string {
  return getLocale() === 'zh' ? zh : en;
}
