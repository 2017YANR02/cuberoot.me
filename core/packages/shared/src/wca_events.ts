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
