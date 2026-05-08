// WCA 项目 ID 单一来源——归一化各种短名到 WCA 标准 id（用于 cubing-icons CSS 类）+ 显示名

// NOTE: 仓库里历史上有 3 套短名约定，全部归一化到 WCA 标准 id（333 / 222 / 333oh ...）
//   - recon 数据：3x3 / 2x2 / 3bld / oh / mbld / pyra / mega / fmc ...
//   - upcoming_comps：3 / 2 / 3bf / fm / py / sk / minx / mbf ...
//   - WCA 标准：333 / 222 / 333bf / 333oh / 333mbf / pyram / minx / ...
const SHORT_TO_WCA: Record<string, string> = {
  // recon 短名
  '3x3': '333', '2x2': '222', '4x4': '444', '5x5': '555', '6x6': '666', '7x7': '777',
  '3bld': '333bf', '4bld': '444bf', '5bld': '555bf', 'mbld': '333mbf',
  'oh': '333oh', 'fmc': '333fm', 'feet': '333ft',
  'pyra': 'pyram', 'mega': 'minx',
  // upcoming_comps 短名
  '3': '333', '2': '222', '4': '444', '5': '555', '6': '666', '7': '777',
  '3bf': '333bf', '4bf': '444bf', '5bf': '555bf', 'mbf': '333mbf',
  'fm': '333fm', 'ft': '333ft',
  'py': 'pyram', 'sk': 'skewb',
  'mbo': '333mbo', 'mag': 'magic', 'mmag': 'mmagic',
  // 全名（数据库中可能存"Pyraminx" / "Megaminx" / "Square-1" 等）
  'pyraminx': 'pyram', 'megaminx': 'minx', 'square1': 'sq1', 'square-1': 'sq1',
  // WCA 标准全名（stats-build SQL 输出 events.name 形如 "5x5x5 Cube" / "Rubik's Cube"）
  "rubik's cube": '333', "2x2x2 cube": '222', "3x3x3 cube": '333',
  "4x4x4 cube": '444', "5x5x5 cube": '555', "6x6x6 cube": '666', "7x7x7 cube": '777',
  "3x3x3 blindfolded": '333bf', "3x3x3 fewest moves": '333fm', "3x3x3 one-handed": '333oh',
  "rubik's clock": 'clock', "4x4x4 blindfolded": '444bf', "5x5x5 blindfolded": '555bf',
  "3x3x3 multi-blind": '333mbf', "3x3x3 with feet": '333ft',
  "rubik's magic": 'magic', "master magic": 'mmagic',
  "rubik's cube: multiple blind old style": '333mbo',
};

/** 把任何短名 / 标准 id 归一化为 WCA 标准 id（如 '3x3' / '3' / '333' → '333'）；找不到映射就原样返回。 */
export function toWcaEventId(input: string | undefined | null): string {
  if (!input) return '';
  const s = String(input).trim().toLowerCase();
  return SHORT_TO_WCA[s] ?? s;
}

// NOTE: WCA 标准 id → 显示名
const DISPLAY_ZH: Record<string, string> = {
  '333': '三阶', '222': '二阶', '444': '四阶', '555': '五阶', '666': '六阶', '777': '七阶',
  '333bf': '三盲', '444bf': '四盲', '555bf': '五盲', '333mbf': '多盲',
  '333oh': '单手', '333fm': '最少步', '333ft': '脚拧',
  'minx': '五魔', 'pyram': '金字塔', 'clock': '魔表', 'skewb': '斜转', 'sq1': 'SQ1',
  'magic': '八板', 'mmagic': '十二板', '333mbo': '旧多盲',
};

const DISPLAY_EN: Record<string, string> = {
  '333': '3×3', '222': '2×2', '444': '4×4', '555': '5×5', '666': '6×6', '777': '7×7',
  '333bf': '3BLD', '444bf': '4BLD', '555bf': '5BLD', '333mbf': 'MBLD',
  '333oh': 'OH', '333fm': 'FMC', '333ft': 'Feet',
  'minx': 'Mega', 'pyram': 'Pyra', 'clock': 'Clock', 'skewb': 'Skewb', 'sq1': 'SQ1',
  'magic': 'Magic', 'mmagic': 'M.Magic', '333mbo': 'MBO',
};

/** 获取项目显示名（接受短名或 WCA id）。zh/en 双语；未知 id 原样返回。 */
export function eventDisplayName(input: string, isZh: boolean): string {
  const id = toWcaEventId(input);
  const dict = isZh ? DISPLAY_ZH : DISPLAY_EN;
  return dict[id] ?? id;
}

/** WCA 标准 21 个项目 id（用于过滤数据库里的非 WCA 项目，如 Gear / Mirror / Smart cube 等） */
export const WCA_EVENT_IDS: ReadonlySet<string> = new Set(Object.keys(DISPLAY_EN));

/** 判断输入是否为 WCA 标准项目（接受短名或 WCA id） */
export function isWcaEvent(input: string | undefined | null): boolean {
  if (!input) return false;
  return WCA_EVENT_IDS.has(toWcaEventId(input));
}
