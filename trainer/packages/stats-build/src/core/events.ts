// NOTE: WCA 项目映射 + 中英文翻译
// 与 Ruby _stats_build/core/events.rb 1:1 对应
// 包含所有项目 ID、子集常量（WITH_AVERAGE/MO3 等）和翻译表

export const EVENTS: Record<string, string> = {
  '333':    "Rubik's Cube",
  '222':    '2x2x2 Cube',
  '444':    '4x4x4 Cube',
  '555':    '5x5x5 Cube',
  '666':    '6x6x6 Cube',
  '777':    '7x7x7 Cube',
  '333bf':  '3x3x3 Blindfolded',
  '333fm':  '3x3x3 Fewest Moves',
  '333oh':  '3x3x3 One-Handed',
  'minx':   'Megaminx',
  'pyram':  'Pyraminx',
  'clock':  "Rubik's Clock",
  'skewb':  'Skewb',
  'sq1':    'Square-1',
  '444bf':  '4x4x4 Blindfolded',
  '555bf':  '5x5x5 Blindfolded',
  '333mbf': '3x3x3 Multi-Blind',
  '333ft':  '3x3x3 With Feet',
  'magic':  "Rubik's Magic",
  'mmagic': 'Master Magic',
  '333mbo': 'Rubik\'s Cube: Multiple blind old style',
};

// NOTE: 所有有官方平均/mo3 的项目（去掉 333mbf 和 333mbo——它们无平均）
export const EVENTS_WITH_AVERAGE: Record<string, string> = Object.fromEntries(
  Object.entries(EVENTS).filter(([id]) => !['333mbf', '333mbo'].includes(id))
);

// NOTE: Mo3 项目（一轮只有 3 把）——666, 777, 333bf, 333fm, 444bf, 555bf
export const MO3_EVENTS = ['666', '777', '333bf', '333fm', '444bf', '555bf'] as const;

// NOTE: Ao5 项目（一轮 5 把）= WITH_AVERAGE 去掉 Mo3 项目
export const EVENTS_WITH_AO5: Record<string, string> = Object.fromEntries(
  Object.entries(EVENTS_WITH_AVERAGE).filter(([id]) => !(MO3_EVENTS as readonly string[]).includes(id))
);

// NOTE: 盲拧项目（333bf, 444bf, 555bf, 333mbf）
export const BLD_EVENTS: Record<string, string> = Object.fromEntries(
  Object.entries(EVENTS).filter(([id]) => ['333bf', '444bf', '555bf', '333mbf'].includes(id))
);

// NOTE: 当前官方项目 ID 列表（rank < 900，排除已退役项目 333ft/magic/mmagic/333mbo）
// 与 Ruby Events::OFFICIAL 对应
const RETIRED_EVENTS = ['333ft', 'magic', 'mmagic', '333mbo'] as const;
export const OFFICIAL_EVENTS: string[] = Object.keys(EVENTS).filter(
  id => !(RETIRED_EVENTS as readonly string[]).includes(id)
);

// NOTE: 英文名 → 中文名
export const NAMES_ZH: Record<string, string> = {
  "Rubik's Cube":       '三阶魔方',
  '2x2x2 Cube':         '二阶魔方',
  '4x4x4 Cube':         '四阶魔方',
  '5x5x5 Cube':         '五阶魔方',
  '6x6x6 Cube':         '六阶魔方',
  '7x7x7 Cube':         '七阶魔方',
  '3x3x3 Blindfolded':  '三盲',
  '3x3x3 Fewest Moves': '最少步',
  '3x3x3 One-Handed':   '三阶单手',
  'Megaminx':            '五魔',
  'Pyraminx':            '金字塔',
  "Rubik's Clock":       '魔表',
  'Skewb':               '斜转',
  'Square-1':            'SQ1',
  '4x4x4 Blindfolded':  '四盲',
  '5x5x5 Blindfolded':  '五盲',
  '3x3x3 Multi-Blind':  '多盲',
  '3x3x3 With Feet':    '三阶脚拧',
  "Rubik's Magic":       '八板',
  'Master Magic':        '十二板',
  'Rubik\'s Cube: Multiple blind old style': '旧多盲',
};

// NOTE: 表头英文 → 中文映射（与 Ruby events.rb HEADER_ZH 完全同步）
export const HEADER_ZH: Record<string, string> = {
  'Person': '选手',
  'Event': '项目',
  'Count': '次数',
  'Competition': '比赛',
  'Competitions': '比赛',
  'Competitors': '参赛人数',
  'Continents': '大洲数',
  'Countries': '国家数',
  'Citizen of': '国籍',
  'Date': '日期',
  'Start Date': '开始日期',
  'Start Comp': '开始比赛',
  'Country': '国家',
  'Continent': '大洲',
  'Delegated': '代表次数',
  'Delegated per year': '年均代表',
  'Events count': '项目数',
  'Events': '项目数',
  'Competitions count': '比赛数',
  'Finals': '决赛次数',
  'List': '列表',
  'List on WCA': 'WCA 页面',
  'Month': '月份',
  'Podiums': '登上领奖台',
  'Rank': '排名',
  'Result': '成绩',
  'Details': '详情',
  'Gain': '提升',
  'Days': '天数',
  'Records': '纪录数',
  'Gold': '金牌',
  'Silver': '银牌',
  'Bronze': '铜牌',
  'Total': '总计',
  'WRs': '世界纪录数',
  'People': '选手',
  'Year': '年份',
  'Years': '年数',
  '4th places': '第四名次数',
  'Single': '单次',
  'Average': '平均',
  'DNF rate': 'DNF 率',
  'DNFs': 'DNF 次数',
  'Attempts': '尝试次数',
  'Parts': '词数',
  'Countries of origin': '主要国家',
  'Week start': '周起始',
  'Week end': '周结束',
  'Solves': '完成数',
  'Place': '名次',
  'Started at': '开始于',
  'Ended at': '结束于',
  'Week': '周',
  'Streak': '连续',
  'Name': '姓名',
  'First name': '名',
  'Last name': '姓',
  'Months': '月数',
  'Wins': '冠军',
  'Round': '轮次',
  'Sum': '总和',
  '1st': '第一名',
  '2nd': '第二名',
  '3rd': '第三名',
  'Times': '成绩',
  // NOTE: 阶段 A 续——新统计需要的表头
  'Average event count': '平均参赛项目数',
  'Competitions per year': '年均比赛数',
  'Mean': '平均',
  'Attempt 1': '尝试 1',
  'Attempt 2': '尝试 2',
  'Attempt 3': '尝试 3',
  '#': '#',
  'Type': '类型',
  'Distance': '距离',
  'Missed': '错过',
  'Start date': '开始日期',
  'End date': '结束日期',
  'Dates': '日期数',
  'Improvement': '进步',
  'Mo3': 'Mo3',
};

export function eventZh(name: string): string {
  return NAMES_ZH[name] ?? name;
}

export function headerZh(name: string): string {
  return HEADER_ZH[name] ?? name;
}
