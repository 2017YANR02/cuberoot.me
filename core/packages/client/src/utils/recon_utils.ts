/**
 * 复盘格式化工具——1:1 移植自 recon/recon_utils.js（335 行）
 * NOTE: 提供国旗/格式化/事件名/puzzle 映射/纪录徽章/时间格式等
 */

// ── 国旗（CSS flag-icons 方式，对齐原版 <span class="fi fi-cn"> ）──

/**
 * 返回 flag-icons CSS 类名
 * NOTE: 对齐原版 recon.js 中的国旗渲染（CSS flag-icons 库）
 * @param iso2 小写两字母国家代码（如 "cn", "us"）
 * @returns CSS 类名字符串（如 "fi fi-cn"），或空字符串
 */
export function flagClass(iso2: string | undefined | null): string {
  if (!iso2 || iso2.length !== 2) return '';
  return `fi fi-${iso2.toLowerCase()}`;
}

/**
 * @deprecated 使用 flagClass() + <span> 代替
 * 保留向后兼容——返回空字符串，国旗通过 CSS flag-icons 渲染
 */
export function countryFlag(_iso2: string): string {
  // NOTE: 不再使用 emoji，返回空字符串
  // 调用方应改用 flagClass() + JSX <span className={flagClass(iso2)}>
  return '';
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

// ── 成绩格式化（原版 formatResult / formatAvg 1:1 移植） ──

/**
 * 成绩格式化（三位小数）
 * NOTE: 与原版 recon_utils.js formatResult 一致
 * ≥9999 → DNF, null → ''
 */
export function formatResult(val: number | undefined | null): string {
  if (val == null) return '';
  if (val >= 9999) return 'DNF';
  if (typeof val !== 'number') return String(val);
  return val.toFixed(3);
}

/**
 * 平均成绩格式化（两位小数）
 * NOTE: 与原版 recon_utils.js formatAvg 一致
 * ≥60 秒 → m:ss.xx 格式
 */
export function formatAvg(val: number | string | undefined | null): string {
  if (val == null) return '';
  const n = typeof val === 'number' ? val : parseFloat(String(val));
  if (isNaN(n)) return String(val);
  if (n >= 9999) return 'DNF';
  if (n >= 60) {
    const m = Math.floor(n / 60);
    const s = (n % 60).toFixed(2);
    return m + ':' + (parseFloat(s) < 10 ? '0' : '') + s;
  }
  return n.toFixed(2);
}

/**
 * AoXR 列紧凑格式
 * NOTE: "4.24 Ao4R" → "4.24(4)"，"Ao3R" → "(3)"
 */
export function formatAoXR(aoType: string | undefined): string {
  if (!aoType) return '';
  // NOTE: 完整格式 "4.24 Ao4R" — 提取平均值和轮数
  const m = aoType.match(/^([\d.]+)\s+Ao(\d)R$/);
  if (m) return m[1] + '(' + m[2] + ')';
  // NOTE: 仅轮数 "Ao3R"
  const m2 = aoType.match(/^Ao(\d)R$/);
  if (m2) return '(' + m2[1] + ')';
  return aoType;
}

/**
 * 轮次 + 把数格式化
 * NOTE: 与原版 createSolveRow 中的 round 列渲染一致
 * round="R2", solveNum=1 → "R2#1"
 * round="Fi", solveNum=null → "Fi"
 */
export function formatRound(round: string | undefined, solveNum: number | undefined): string {
  if (!round) return '';
  return round + (round && solveNum ? '#' + solveNum : '');
}

// ── 纪录徽章 ──

/**
 * 纪录分类——返回 CSS className 后缀
 * NOTE: 1:1 移植自原版 recon_utils.js getRecordClass
 * 用正则匹配各种纪录前缀（F/X/U/YT/1st/R 前缀 + WR/CR/NR/PR 后缀）
 */
export function getRecordClass(val: string): string {
  const v = val.toUpperCase();
  if (/^[FXU]?W[RB]$|^1STWR$|^RWR$|^YTW[RB]$|^XWR$/.test(v)) return 'wr';
  if (v === 'WCR') return 'wcr';
  // NOTE: 裸 CR（日历 summary 派生值）——放在洲际正则前
  if (v === 'CR') return 'cr';
  if (/(?:AS|E)[RB]$/.test(v) || /^(?:F|YT|X|U)?(?:SAR|SAB|NAR|NAB|OCR|OCB|AFR|AFB|ANR|ANB|ASR|ASB)$/.test(v)) return 'cr';
  if (/^[FXU]?N[RB]$|^NWR$|^ANR$|^YTN[RB]$/.test(v)) return 'nr';
  if (/[PU]?[RB]$/.test(v) && (v.endsWith('PR') || v.endsWith('PB')
    || v === 'YTPR' || v === 'YTPB' || v === 'UPR' || v === 'UPB')) return 'pr';
  return 'other';
}

/**
 * 纪录 badge——返回结构化对象供 React 渲染
 * NOTE: 支持 cancelled 前缀，与原版 formatRecord 一致
 */
export function formatRecord(val: string | undefined): { text: string; className: string } | null {
  if (!val) return null;
  const s = String(val);
  // NOTE: 匹配多种取消写法：cancel/cancelled/取消
  const cancelled = /\bcancell?ed?\b|取消/i.test(s);
  const recordType = cancelled
    ? s.replace(/\s*\bcancell?ed?\b\s*|\s*取消\s*/gi, '').trim()
    : s;
  const cls = cancelled ? 'cancelled' : getRecordClass(recordType);
  return { text: recordType, className: `record-badge record-${cls}` };
}

/** 纪录等级与显示配色（保留向后兼容） */
const RECORD_COLORS: Record<string, string> = {
  WR: '#e74c3c',
  CR: '#e67e22',
  NR: '#27ae60',
  PR: '#3498db',
};

/**
 * 生成纪录徽章 HTML（向后兼容，详情页仍在使用）
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
// NOTE: getLocale() 和 t(zh, en) 已废弃——统一使用 react-i18next 的 useTranslation() hook
// 非组件函数通过接收 isZh 参数获取语言

// ── 外部链接 ──

/** 项目 → cubedb puzzle ID（格式与 twisty 不同） */
const CUBEDB_PUZZLE_MAP: Record<string, string> = {
  '3x3': '3x3x3', '2x2': '2x2x2', '4x4': '4x4x4', '5x5': '5x5x5',
  '6x6': '6x6x6', '7x7': '7x7x7', '3bld': '3x3x3', '4bld': '4x4x4',
  '5bld': '5x5x5', oh: '3x3x3', sq1: 'sq1',
  pyra: 'pyraminx', mega: 'megaminx', clock: 'clock', skewb: 'skewb',
};

/** 获取 cubedb puzzle ID */
export function getCubedbPuzzle(event: string): string {
  return CUBEDB_PUZZLE_MAP[event] ?? '3x3x3';
}

/**
 * 构建 alg.cubing.net 和 cubedb.net 链接
 * NOTE: alg.cubing.net 只支持 NxNxN，非正阶用 alpha.twizzle.net
 */
export function buildExternalLinks(
  event: string,
  scramble: string,
  alg: string,
): { algUrl: string; algSiteName: string; cubedbUrl: string } {
  const puzzle = getPuzzleId(event);
  const setupStr = encodeURIComponent(scramble);
  const algStr = encodeURIComponent(alg);
  const isCube = /^\d+x\d+x\d+$/.test(puzzle);
  const algUrl = isCube
    ? `https://alg.cubing.net/?setup=${setupStr}&alg=${algStr}&puzzle=${puzzle}`
    : `https://alpha.twizzle.net/edit/?puzzle=${puzzle}&setup-alg=${setupStr}&alg=${algStr}`;
  const algSiteName = isCube ? 'alg.cubing.net' : 'twizzle.net';
  const cubedbPuzzle = getCubedbPuzzle(event);
  const cubedbUrl = `https://cubedb.net/?puzzle=${cubedbPuzzle}&scramble=${setupStr}&alg=${algStr}`;
  return { algUrl, algSiteName, cubedbUrl };
}

// ── 面颜色 ──

/** 魔方面颜色映射（用于 Cross Color 着色） */
export const FACE_COLORS: Record<string, string> = {
  W: '#e8e8e8',
  Y: '#facc15',
  R: '#ef4444',
  O: '#f97316',
  G: '#22c55e',
  B: '#3b82f6',
};
