// WCA 项目展示顺序 (17 现役 + 4 已停办).
// 用于:Calendar chip 排版、/comp 页面 event tab 排序、其它需要"WCA 官方顺序" 的 UI.
// 已停办放末尾,这些项目实际数据一般为 0.
export const WCA_EVENT_ORDER = [
  '333', '222', '444', '555', '666', '777',
  '333bf', '333fm', '333oh',
  'clock', 'minx', 'pyram', 'skewb', 'sq1',
  '444bf', '555bf', '333mbf',
  '333ft', '333mbo', 'magic', 'mmagic',
] as const;

/** Compact Chinese event names shared by Web and record notifications. */
export const EVENT_DISPLAY_ZH: Record<string, string> = {
  '333': '三阶', '222': '二阶', '444': '四阶', '555': '五阶', '666': '六阶', '777': '七阶',
  '333bf': '三盲', '444bf': '四盲', '555bf': '五盲', '333mbf': '多盲',
  '333oh': '单手', '333fm': '最少步', '333ft': '脚拧',
  'minx': '五魔', 'pyram': '金字塔', 'clock': '魔表', 'skewb': '斜转', 'sq1': 'SQ1',
  'magic': '八板', 'mmagic': '十二板', '333mbo': '旧多盲',
  // 非 WCA(cubing.js twizzleEvents)
  'fto': 'FTO', 'master_tetraminx': '四阶金字塔', 'kilominx': '二阶五魔', 'ivy': '枫叶', 'redi_cube': 'Redi', 'baby_fto': '二阶 FTO',
  // 非 WCA cubing.com 自定义项目
  'funny': '趣味',
};
