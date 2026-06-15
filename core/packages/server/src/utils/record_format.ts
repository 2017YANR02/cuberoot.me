/**
 * 纪录快讯文案格式化 — 1:1 移植自生产 Python `/opt/wca-monitor/record_format.py`。
 *
 * 背景:首页 /wca/recent-records 与 /wca/format-record 的 cn/en 文案原本 spawn 跨 repo
 * Python 渲染,Python 每次 eager 同步联网拉世界排名(3 天 cache 过期→110s 串行→5s spawn
 * 超时→熔断→文案空→前端降级到无比赛名 fallback)。本模块把渲染搬进 core-api 进程,
 * 世界排名改查本地 wca_results_flat(复用 wca_stats_extra 的 rank-for 引擎),物理删除
 * spawn + 联网 + 超时 + 熔断整条脆弱链。
 *
 * 渲染纯函数化:`formatCombinedRecords(events, getRank)` 全同步,世界排名通过同步
 * `getRank(eventId, recType, attemptResult) => number|null` 注入(调用方先异步预解析)。
 * golden 回归在 client/tests/record_format.test.ts(fixtures 抓自上线前的 Python 输出)。
 *
 * ⚠️ 移植不变量:Python 字符串切片按 code point;本文件所有 `slice(0, len - label.length)`
 * 去掉的都是真实后缀(label/flag 是字符串末尾真子串),边界与计数方式无关,UTF-16 .length
 * 与 Python len() 在「去后缀」语义下等价 —— 不要把这些改成按 code point 数组操作。
 */

// === 项目名映射 ===

export const EVENT_CN_MAP: Record<string, string> = {
  '3x3x3 Cube': '三阶魔方',
  '2x2x2 Cube': '二阶魔方',
  '4x4x4 Cube': '四阶魔方',
  '5x5x5 Cube': '五阶魔方',
  '6x6x6 Cube': '六阶魔方',
  '7x7x7 Cube': '七阶魔方',
  '3x3x3 Blindfolded': '三盲',
  '3x3x3 Fewest Moves': '最少步',
  '3x3x3 One-Handed': '三阶魔方单手',
  Clock: '魔表',
  Megaminx: '五魔',
  Pyraminx: '金字塔魔方',
  Skewb: '斜转魔方',
  'Square-1': ' SQ1魔方', // NOTE: prompt 明确要求中文 SQ1 前必须有空格
  '4x4x4 Blindfolded': '四盲',
  '5x5x5 Blindfolded': '五盲',
  '3x3x3 Multi-Blind': '多盲',
  'Mirror Blocks': '镜面魔方',
  'Ivy Cube': '三叶魔方',
  Individual: '个人赛',
  Team: '团体赛',
};

export const EVENT_EN_MAP: Record<string, string> = {
  '3x3x3 Cube': '3x3',
  '2x2x2 Cube': '2x2',
  '4x4x4 Cube': '4x4',
  '5x5x5 Cube': '5x5',
  '6x6x6 Cube': '6x6',
  '7x7x7 Cube': '7x7',
  '3x3x3 Blindfolded': '3BLD',
  '3x3x3 Fewest Moves': 'FMC',
  '3x3x3 One-Handed': 'OH',
  Clock: 'Clock',
  Megaminx: 'Megaminx',
  Pyraminx: 'Pyraminx',
  Skewb: 'Skewb',
  'Square-1': 'SQ1',
  '4x4x4 Blindfolded': '4BLD',
  '5x5x5 Blindfolded': '5BLD',
  '3x3x3 Multi-Blind': '3BLD',
  'Mirror Blocks': 'Mirror',
  'Ivy Cube': 'Ivy',
  Individual: 'Individual',
  Team: 'Team',
};

export const EVENT_NAME_BY_ID: Record<string, string> = {
  '333': '3x3x3 Cube',
  '222': '2x2x2 Cube',
  '444': '4x4x4 Cube',
  '555': '5x5x5 Cube',
  '666': '6x6x6 Cube',
  '777': '7x7x7 Cube',
  '333bf': '3x3x3 Blindfolded',
  '333fm': '3x3x3 Fewest Moves',
  '333oh': '3x3x3 One-Handed',
  clock: 'Clock',
  minx: 'Megaminx',
  pyram: 'Pyraminx',
  skewb: 'Skewb',
  sq1: 'Square-1',
  '444bf': '4x4x4 Blindfolded',
  '555bf': '5x5x5 Blindfolded',
  '333mbf': '3x3x3 Multi-Blind',
  mirror: 'Mirror Blocks',
  ivy: 'Ivy Cube',
  individual: 'Individual',
  team: 'Team',
};

// === 洲际/国家映射 ===

export const CR_ABBR_CN: Record<string, string> = {
  AsR: '亚洲纪录',
  ER: '欧洲纪录',
  AfR: '非洲纪录',
  OcR: '大洋洲纪录',
  SAR: '南美洲纪录',
  NAR: '北美洲纪录',
};

export const COUNTRY_CN_MAP: Record<string, string> = {
  // 亚洲 (AsR)
  AF: '阿富汗', AM: '亚美尼亚', AZ: '阿塞拜疆', BD: '孟加拉国',
  BH: '巴林', BN: '文莱', BT: '不丹', CN: '中国',
  CY: '塞浦路斯', GE: '格鲁吉亚', HK: '中国香港', ID: '印度尼西亚',
  IL: '以色列', IN: '印度', IQ: '伊拉克', IR: '伊朗',
  JO: '约旦', JP: '日本', KG: '吉尔吉斯斯坦', KH: '柬埔寨',
  KR: '韩国', KW: '科威特', KZ: '哈萨克斯坦', LA: '老挝',
  LB: '黎巴嫩', LK: '斯里兰卡', MM: '缅甸', MN: '蒙古',
  MO: '中国澳门', MY: '马来西亚', NP: '尼泊尔', OM: '阿曼',
  PH: '菲律宾', PK: '巴基斯坦', QA: '卡塔尔', SA: '沙特阿拉伯',
  SG: '新加坡', SY: '叙利亚', TH: '泰国', TJ: '塔吉克斯坦',
  TM: '土库曼斯坦', TW: '中国台湾', UZ: '乌兹别克斯坦', VN: '越南',
  AE: '阿联酋', YE: '也门',
  // 欧洲 (ER)
  AL: '阿尔巴尼亚', AT: '奥地利', BA: '波黑', BE: '比利时',
  BG: '保加利亚', BY: '白俄罗斯', CH: '瑞士', CZ: '捷克',
  DE: '德国', DK: '丹麦', EE: '爱沙尼亚', ES: '西班牙',
  FI: '芬兰', FR: '法国', GB: '英国', GR: '希腊',
  HR: '克罗地亚', HU: '匈牙利', IE: '爱尔兰', IS: '冰岛',
  IT: '意大利', LT: '立陶宛', LU: '卢森堡', LV: '拉脱维亚',
  MD: '摩尔多瓦', ME: '黑山', MK: '北马其顿', MT: '马耳他',
  NL: '荷兰', NO: '挪威', PL: '波兰', PT: '葡萄牙',
  RO: '罗马尼亚', RS: '塞尔维亚', RU: '俄罗斯', SE: '瑞典',
  SI: '斯洛文尼亚', SK: '斯洛伐克', TR: '土耳其', UA: '乌克兰',
  XK: '科索沃',
  // 非洲 (AfR)
  AO: '安哥拉', BF: '布基纳法索', BJ: '贝宁', BW: '博茨瓦纳',
  CD: '刚果(金)', CI: '科特迪瓦', CM: '喀麦隆', DZ: '阿尔及利亚',
  EG: '埃及', ET: '埃塞俄比亚', GA: '加蓬', GH: '加纳',
  GM: '冈比亚', GN: '几内亚', KE: '肯尼亚', LR: '利比里亚',
  LS: '莱索托', LY: '利比亚', MA: '摩洛哥', MG: '马达加斯加',
  ML: '马里', MU: '毛里求斯', MW: '马拉维', MZ: '莫桑比克',
  NA: '纳米比亚', NE: '尼日尔', NG: '尼日利亚', RW: '卢旺达',
  SD: '苏丹', SL: '塞拉利昂', SN: '塞内加尔', SS: '南苏丹',
  TD: '乍得', TG: '多哥', TN: '突尼斯', TZ: '坦桑尼亚',
  UG: '乌干达', ZA: '南非', ZW: '津巴布韦',
  // 大洋洲 (OcR)
  AU: '澳大利亚', FJ: '斐济', GU: '关岛', NC: '新喀里多尼亚',
  NZ: '新西兰', PF: '法属波利尼西亚', PG: '巴布亚新几内亚',
  SB: '所罗门群岛', TO: '汤加', VU: '瓦努阿图', WS: '萨摩亚',
  // 南美洲 (SAR)
  AR: '阿根廷', BO: '玻利维亚', BR: '巴西', CL: '智利',
  CO: '哥伦比亚', EC: '厄瓜多尔', GY: '圭亚那', PE: '秘鲁',
  PY: '巴拉圭', SR: '苏里南', UY: '乌拉圭', VE: '委内瑞拉',
  // 北美洲 (NAR)
  AG: '安提瓜和巴布达', AW: '阿鲁巴', BB: '巴巴多斯', BS: '巴哈马',
  BZ: '伯利兹', CA: '加拿大', CR: '哥斯达黎加', CU: '古巴',
  CW: '库拉索', DM: '多米尼克', DO: '多米尼加', GD: '格林纳达',
  GT: '危地马拉', HN: '洪都拉斯', HT: '海地', JM: '牙买加',
  KN: '圣基茨和尼维斯', KY: '开曼群岛', LC: '圣卢西亚', MX: '墨西哥',
  NI: '尼加拉瓜', PA: '巴拿马', PR: '波多黎各', SV: '萨尔瓦多',
  TC: '特克斯和凯科斯群岛', TT: '特立尼达和多巴哥', US: '美国',
  VC: '圣文森特和格林纳丁斯', VI: '美属维尔京群岛',
};

const _CONTINENT_COUNTRIES: Record<string, string> = {
  AsR: 'AF,AM,AZ,BD,BH,BN,BT,CN,CY,GE,HK,ID,IL,IN,IQ,IR,JO,JP,KG,KH,'
    + 'KR,KW,KZ,LA,LB,LK,MM,MN,MO,MY,NP,OM,PH,PK,QA,SA,SG,SY,TH,TJ,'
    + 'TM,TW,UZ,VN,AE,YE',
  ER: 'AL,AT,BA,BE,BG,BY,CH,CZ,DE,DK,EE,ES,FI,FR,GB,GR,HR,HU,IE,IS,'
    + 'IT,LT,LU,LV,MD,ME,MK,MT,NL,NO,PL,PT,RO,RS,RU,SE,SI,SK,TR,UA,XK',
  AfR: 'AO,BF,BJ,BW,CD,CI,CM,DZ,EG,ET,GA,GH,GM,GN,KE,LR,LS,LY,MA,MG,'
    + 'ML,MU,MW,MZ,NA,NE,NG,RW,SD,SL,SN,SS,TD,TG,TN,TZ,UG,ZA,ZW',
  OcR: 'AU,FJ,GU,NC,NZ,PF,PG,SB,TO,VU,WS',
  SAR: 'AR,BO,BR,CL,CO,EC,GY,PE,PY,SR,UY,VE',
  NAR: 'AG,AW,BB,BS,BZ,CA,CR,CU,CW,DM,DO,GD,GT,HN,HT,JM,KN,KY,LC,MX,'
    + 'NI,PA,PR,SV,TC,TT,US,VC,VI',
};

export const ISO2_TO_CR: Record<string, string> = {};
for (const [abbr, countries] of Object.entries(_CONTINENT_COUNTRIES)) {
  for (const iso2 of countries.split(',')) ISO2_TO_CR[iso2.trim()] = abbr;
}

// 用 mean-of-3 而非 average-of-5 的项目:EN 文案该用 "Mean" 而非 "Avg"
const MEAN_EVENTS = new Set(['666', '777', '333fm', '444bf', '555bf']);

// === 名字拆分 ===

const NAME_PAREN_RE = /\s*\(([^)]+)\)\s*$/;

function hasCJK(s: string): boolean {
  // CJK Unified Ideographs 基本汉字 U+4E00-U+9FFF
  return /[一-鿿]/.test(s);
}

export function splitName(fullName: string): [string, string] {
  const m = NAME_PAREN_RE.exec(fullName);
  const enName = fullName.replace(NAME_PAREN_RE, '');
  if (m && hasCJK(m[1]!)) return [m[1]!, enName];
  return [enName, enName];
}

function typeEn(eventId: string, recType: string): string {
  if (recType === 'single') return 'Single';
  return MEAN_EVENTS.has(eventId) ? 'Mean' : 'Avg';
}

// === 国旗 ===

export function countryFlag(iso2: string | null | undefined): string {
  if (!iso2 || iso2.length !== 2) return '';
  return [...iso2.toUpperCase()]
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join('');
}

// === 时间格式化 ===

/** width-2 零填充整数(替 Python `:02d`) */
function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** WCA 厘秒成绩 → 可读字符串。FMC / 多盲有独立编码(1:1 record_format.format_time)。 */
export function formatTime(centiseconds: number, eventId: string): string {
  if (centiseconds <= 0) return 'DNF';
  if (eventId === '333fm') {
    // FMC: 单次=步数, 平均=步数*100
    if (centiseconds < 1000) return `${centiseconds}`;
    return (centiseconds / 100).toFixed(2);
  }
  if (eventId === '333mbf') {
    // 多盲编码 0DDTTTTTMM(D=差值, T=时间秒, M=错误数)
    const dd = 99 - Math.floor(centiseconds / 10000000);
    const ttttt = Math.floor(centiseconds / 100) % 100000;
    const mm = centiseconds % 100;
    const solved = dd + mm;
    const minutes = Math.floor(ttttt / 60);
    const seconds = ttttt % 60;
    return `${solved}/${solved + mm} ${minutes}:${pad2(seconds)}`;
  }
  const totalSeconds = centiseconds / 100;
  if (totalSeconds >= 60) {
    const minutes = Math.floor(totalSeconds / 60);
    const secs = totalSeconds - minutes * 60;
    // Python `f"{secs:05.2f}"` = 2 位小数、宽度 5、前补 0(cs/100 数学上恰好 2 位小数,
    // toFixed(2) 与 Python 一致;再 padStart(5,'0') 补足如 7.89→07.89)
    return `${minutes}:${secs.toFixed(2).padStart(5, '0')}`;
  }
  return totalSeconds.toFixed(2);
}

// === 类型 ===

export interface RecordEvent {
  tag: string;
  rec_type: string; // 'single' | 'average'
  attempt_result: number;
  event_id: string;
  event_name?: string;
  person_name: string;
  person_iso2: string;
  person_country_en?: string;
  comp_name: string;
  comp_iso2: string;
  url: string;
  comp_name_en?: string | null;
  tied?: boolean;
  pr_rank?: number | null;
  previous_pr?: number | null;
}

export type RankFn = (eventId: string, recType: string, attemptResult: number) => number | null;

export interface FormattedRecord {
  cn: string;
  en: string;
  url: string;
}

// === enrich(对应 format_cli._enrich) ===

/** value(cs) == current(cs) 即 tied;current 为 null 或 value<=0 不算(1:1 is_tied_value)。 */
export function isTiedValue(value: number, current: number | null | undefined): boolean {
  if (!value || value <= 0) return false;
  return current != null && value === current;
}

/** 给前端少传的字段补全:event_name / person_country_en / tied(由 previous_pr 推)。 */
export function enrich(evIn: RecordEvent): RecordEvent {
  const ev: RecordEvent = { ...evIn };
  if (!ev.event_name && ev.event_id) {
    ev.event_name = EVENT_NAME_BY_ID[ev.event_id] ?? ev.event_id;
  }
  if (!ev.person_country_en) {
    ev.person_country_en = COUNTRY_CN_MAP[ev.person_iso2 ?? ''] ?? '';
  }
  const prev = ev.previous_pr;
  delete ev.previous_pr;
  if (ev.tied === undefined) {
    ev.tied = isTiedValue(ev.attempt_result ?? 0, prev);
  }
  return ev;
}

// === 主格式化函数 ===

/** 参数化纪录消息(1:1 record_format.format_record_message)。 */
export function formatRecordMessage(ev: RecordEvent, getRank: RankFn): FormattedRecord {
  const {
    tag, rec_type, attempt_result, event_id,
    person_name, person_iso2, comp_name, comp_iso2, url,
  } = ev;
  const eventName = ev.event_name ?? event_id;
  const compFlag = countryFlag(comp_iso2);
  const personFlag = countryFlag(person_iso2);
  const [cnName, enName] = splitName(person_name);
  const timeStr = formatTime(attempt_result, event_id);
  const cnEvent = EVENT_CN_MAP[eventName] ?? eventName;
  const enEvent = EVENT_EN_MAP[eventName] ?? eventName;
  const typeCn = rec_type === 'single' ? '单次' : '平均';
  const tEn = typeEn(event_id, rec_type);
  const cnCompLabel = `${comp_name}${compFlag}`;
  const enCompLabel = `${ev.comp_name_en || comp_name}${compFlag}`;
  const prRank = ev.pr_rank;
  const tied = ev.tied ?? false;
  const tiedCn = tied ? '(平)' : '';
  const tiedEn = tied ? '(Tied)' : '';

  let cn: string;
  let en: string;
  let crAbbr: string | null = null;

  if (tag === 'WR') {
    cn = `纪录快讯! ${timeStr}${cnEvent}${typeCn}世界纪录WR ${cnName}${personFlag}| ${cnCompLabel}`;
    en = `BREAKING NEWS! ${timeStr} ${enEvent} WR ${tEn} ${enName}${personFlag}| ${enCompLabel}`;
  } else if (tag === 'NR') {
    const countryCn = COUNTRY_CN_MAP[person_iso2] ?? (ev.person_country_en || person_iso2);
    cn = `纪录快讯! ${timeStr}${cnEvent}${typeCn}${countryCn}纪录${personFlag}NR ${cnName} | ${cnCompLabel}`;
    en = `Breaking News! ${timeStr} ${enEvent}${personFlag}NR ${tEn} ${enName} | ${enCompLabel}`;
  } else if (tag === 'PR') {
    if (prRank && prRank > 1) {
      // 非真破 PR(历史第 N 快):走"成绩快讯/Result News"模板
      cn = `成绩快讯! ${timeStr}${cnEvent}${typeCn}PR${prRank} ${cnName} | ${cnCompLabel}`;
      en = `Result News! ${timeStr} PR${prRank} ${tEn} ${enEvent} ${enName} | ${enCompLabel}`;
    } else {
      cn = `PR快讯! ${timeStr}${cnEvent}${typeCn}个人纪录${personFlag}PR${tiedCn} ${cnName} | ${cnCompLabel}`;
      en = `PR News! ${timeStr} ${enEvent}${personFlag}PR${tiedEn} ${tEn} ${enName} | ${enCompLabel}`;
    }
  } else {
    crAbbr = tag in CR_ABBR_CN ? tag : (ISO2_TO_CR[person_iso2] ?? 'CR');
    const crCn = CR_ABBR_CN[crAbbr] ?? '洲际纪录';
    cn = `纪录快讯! ${timeStr}${cnEvent}${typeCn}${crCn}${crAbbr} ${cnName}${personFlag}| ${cnCompLabel}`;
    en = `Breaking News! ${timeStr} ${enEvent} ${crAbbr} ${tEn} ${enName}${personFlag}| ${enCompLabel}`;
  }

  // 追加 /WRxx(WR 已含"世界纪录"不叠加;PR<rank> 非真破也跳过)
  if (tag !== 'WR' && !(tag === 'PR' && prRank && prRank > 1)) {
    const rank = getRank(event_id, rec_type, attempt_result);
    if (rank) {
      const suffix = `/WR${rank}`;
      if (tag === 'NR') {
        cn = replaceFirst(cn, 'NR', `NR${suffix}`);
        en = replaceFirst(en, 'NR', `NR${suffix}`);
      } else if (tag === 'PR') {
        const anchorCn = `${personFlag}PR${tiedCn}`;
        const anchorEn = `${personFlag}PR${tiedEn}`;
        cn = replaceFirst(cn, anchorCn, `${anchorCn}${suffix}`);
        en = replaceFirst(en, anchorEn, `${anchorEn}${suffix}`);
      } else if (crAbbr) {
        cn = replaceFirst(cn, crAbbr, `${crAbbr}${suffix}`);
        en = replaceFirst(en, crAbbr, `${crAbbr}${suffix}`);
      }
    }
  }

  return { cn, en, url };
}

/** Python `str.replace(old, new, 1)` 等价:替换首个出现(纯字符串,不走正则特殊符)。 */
function replaceFirst(s: string, search: string, replacement: string): string {
  const i = s.indexOf(search);
  if (i < 0) return s;
  return s.slice(0, i) + replacement + s.slice(i + search.length);
}

// === 双纪录合并 ===

// tag 优先级:WR > 任一 CR > NR
function tagPriority(tag: string): number {
  if (tag === 'WR') return 0;
  if (tag in CR_ABBR_CN || tag === 'CR') return 1;
  if (tag === 'NR') return 2;
  return 3;
}

function resolveCrAbbr(tag: string, personIso2: string): string {
  if (tag in CR_ABBR_CN) return tag;
  return ISO2_TO_CR[personIso2] ?? 'CR';
}

/** NR / CR / PR 的 /WRn 后缀(无斜杠,用于同 tag 双纪录直接拼接);WR 隐含 WR1 不追加。 */
function wrSuffix(eventId: string, recType: string, attemptResult: number, tag: string, getRank: RankFn): string {
  if (tag === 'WR') return '';
  const rank = getRank(eventId, recType, attemptResult);
  return rank ? `WR${rank}` : '';
}

export function formatCombinedRecords(events: RecordEvent[], getRank: RankFn): FormattedRecord {
  if (events.length === 1) return formatRecordMessage(events[0]!, getRank);
  if (events.length !== 2) {
    throw new Error(`formatCombinedRecords expects 1 or 2 events, got ${events.length}`);
  }
  const [e0, e1] = events;
  if (e0!.tag === e1!.tag) return combineSameTag(events, getRank);
  return combineDiffTag(events, getRank);
}

function combineSameTag(eventsIn: RecordEvent[], getRank: RankFn): FormattedRecord {
  const events = [...eventsIn].sort((a, b) =>
    (a.rec_type === 'single' ? 0 : 1) - (b.rec_type === 'single' ? 0 : 1));
  const [single, avg] = events as [RecordEvent, RecordEvent];

  const tag = single.tag;
  const eventId = single.event_id;
  const eventName = single.event_name ?? eventId;
  const personIso2 = single.person_iso2;
  const compFlag = countryFlag(single.comp_iso2);
  const cnCompLabel = `${single.comp_name}${compFlag}`;
  const enCompLabel = `${single.comp_name_en || single.comp_name}${compFlag}`;
  const personFlag = countryFlag(personIso2);
  const [cnName, enName] = splitName(single.person_name);
  const cnEvent = EVENT_CN_MAP[eventName] ?? eventName;
  const enEvent = EVENT_EN_MAP[eventName] ?? eventName;

  const tS = formatTime(single.attempt_result, eventId);
  const tA = formatTime(avg.attempt_result, eventId);
  const avgEn = MEAN_EVENTS.has(eventId) ? 'Mean' : 'Avg';

  // tag=PR 且任一 pr_rank>1 = 非真破,走"成绩快讯"模板
  const sRank = single.pr_rank || 1;
  const aRank = avg.pr_rank || 1;
  if (tag === 'PR' && (sRank > 1 || aRank > 1)) {
    // 混合:一个真破 PR(rank 1)、一个非破(rank>1)→ 真破 PR 在前(带名+国旗),非破在后
    if ((sRank === 1) !== (aRank === 1)) {
      const prEv = sRank === 1 ? single : avg;   // 真破 PR
      const npEv = sRank === 1 ? avg : single;   // 非破(PR<rank>)
      const npRank = sRank === 1 ? aRank : sRank;
      const prTime = formatTime(prEv.attempt_result, eventId);
      const npTime = formatTime(npEv.attempt_result, eventId);
      const prTypeCn = prEv.rec_type === 'single' ? '单次' : '平均';
      const npTypeCn = npEv.rec_type === 'single' ? '单次' : '平均';
      const cn = `成绩快讯! ${prTime}${cnEvent}${prTypeCn}PR ${cnName}${personFlag} | ${npTime}${npTypeCn}PR${npRank} | ${cnCompLabel}`;
      const en = `Result News! ${prTime} ${enEvent} ${typeEn(eventId, prEv.rec_type)} PR ${enName}${personFlag} | ${npTime} ${typeEn(eventId, npEv.rec_type)} PR${npRank} | ${enCompLabel}`;
      return { cn, en, url: single.url };
    }
    const rsS = sRank > 1 ? `PR${sRank}` : 'PR';
    const rsA = aRank > 1 ? `PR${aRank}` : 'PR';
    const cn = `成绩快讯! ${tS}单次${rsS}, ${tA}平均${rsA}${cnEvent} ${cnName} | ${cnCompLabel}`;
    const en = `Result News! ${tS} ${rsS} Single, ${tA} ${rsA} ${avgEn} ${enEvent} ${enName} | ${enCompLabel}`;
    return { cn, en, url: single.url };
  }

  const rsS = wrSuffix(eventId, 'single', single.attempt_result, tag, getRank);
  const rsA = wrSuffix(eventId, 'average', avg.attempt_result, tag, getRank);

  let typeCnLabel: string;
  let typeEnLabel: string;
  let displayTag: string;
  if (tag === 'WR') {
    typeCnLabel = '世界纪录'; typeEnLabel = 'WR'; displayTag = 'WR';
  } else if (tag === 'NR') {
    const countryCn = COUNTRY_CN_MAP[personIso2] ?? (single.person_country_en || personIso2);
    typeCnLabel = `${countryCn}纪录`; typeEnLabel = 'NR'; displayTag = 'NR';
  } else if (tag === 'PR') {
    typeCnLabel = '个人纪录'; typeEnLabel = 'PR'; displayTag = 'PR';
  } else {
    const crAbbr = resolveCrAbbr(tag, personIso2);
    typeCnLabel = CR_ABBR_CN[crAbbr] ?? '洲际纪录'; typeEnLabel = crAbbr; displayTag = crAbbr;
  }

  const rsSEn = rsS ? ` ${rsS}` : '';
  const rsAEn = rsA ? ` ${rsA}` : '';

  let enPrefix: string;
  if (tag === 'WR') enPrefix = 'BREAKING NEWS!';
  else if (tag === 'PR') enPrefix = 'PR News!';
  else enPrefix = 'Breaking News!';
  const cnPrefix = tag === 'PR' ? 'PR快讯!' : '纪录快讯!';

  const cn = `${cnPrefix} ${tS}单次${rsS}, ${tA}平均${rsA}${cnEvent}双${typeCnLabel}${personFlag}${displayTag} ${cnName} | ${cnCompLabel}`;
  const en = `${enPrefix} ${tS} Single${rsSEn}, ${tA} ${avgEn}${rsAEn} ${enEvent}${personFlag}Double ${typeEnLabel} ${enName} | ${enCompLabel}`;
  return { cn, en, url: single.url };
}

function combineDiffTag(eventsIn: RecordEvent[], getRank: RankFn): FormattedRecord {
  const events = [...eventsIn].sort((a, b) => tagPriority(a.tag) - tagPriority(b.tag));
  const [r1, r2] = events as [RecordEvent, RecordEvent];

  const { cn: cn1, en: en1, url } = formatRecordMessage(r1, getRank);
  const compFlag = countryFlag(r1.comp_iso2);
  const cnCompLabel = `${r1.comp_name}${compFlag}`;
  const enCompLabel = `${r1.comp_name_en || r1.comp_name}${compFlag}`;

  // 去掉 r1 末尾比赛名(真实后缀,见文件头不变量注释)
  let cn1NoComp = cn1.slice(0, cn1.length - cnCompLabel.length).replace(/\s+$/, '');
  if (cn1NoComp.endsWith('|')) cn1NoComp = cn1NoComp.slice(0, -1).replace(/\s+$/, '');
  let en1NoComp = en1.slice(0, en1.length - enCompLabel.length).replace(/\s+$/, '');
  if (en1NoComp.endsWith('|')) en1NoComp = en1NoComp.slice(0, -1).replace(/\s+$/, '');

  const cn2 = reduceSegmentCn(r2, getRank, true);
  const en2 = reduceSegmentEn(r2, getRank, true);

  // r2 是 NR 时,去掉 r1 末尾(人名后)的 person_flag,避免整条消息出现两次
  const r1Flag = countryFlag(r1.person_iso2);
  if (r2.tag === 'NR') {
    if (r1Flag && cn1NoComp.endsWith(r1Flag)) cn1NoComp = cn1NoComp.slice(0, cn1NoComp.length - r1Flag.length);
    if (r1Flag && en1NoComp.endsWith(r1Flag)) en1NoComp = en1NoComp.slice(0, en1NoComp.length - r1Flag.length);
  }

  // 分隔符:r1 末尾是国旗 → "| "(无前空格);末尾是字母数字 → " | "(前有空格)
  const cnSep = r1Flag && cn1NoComp.endsWith(r1Flag) ? '| ' : ' | ';
  const enSep = r1Flag && en1NoComp.endsWith(r1Flag) ? '| ' : ' | ';

  const cn = `${cn1NoComp}${cnSep}${cn2} | ${cnCompLabel}`;
  const en = `${en1NoComp}${enSep}${en2} | ${enCompLabel}`;
  return { cn, en, url };
}

function reduceSegmentCn(ev: RecordEvent, getRank: RankFn, includeFlag: boolean): string {
  const tag = ev.tag;
  const eventId = ev.event_id;
  const personIso2 = ev.person_iso2;
  const t = formatTime(ev.attempt_result, eventId);
  const typeCn = ev.rec_type === 'single' ? '单次' : '平均';

  if (tag === 'WR') return `${t}${typeCn}世界纪录WR`;
  if (tag === 'NR') {
    const countryCn = COUNTRY_CN_MAP[personIso2] ?? (ev.person_country_en || personIso2);
    const rank = getRank(eventId, ev.rec_type, ev.attempt_result);
    const suffix = rank ? `/WR${rank}` : '';
    const flag = includeFlag ? countryFlag(personIso2) : '';
    return `${t}${typeCn}${countryCn}纪录${flag}NR${suffix}`;
  }
  const crAbbr = resolveCrAbbr(tag, personIso2);
  const rank = getRank(eventId, ev.rec_type, ev.attempt_result);
  const suffix = rank ? `/WR${rank}` : '';
  return `${t}${typeCn}${CR_ABBR_CN[crAbbr] ?? '洲际纪录'}${crAbbr}${suffix}`;
}

function reduceSegmentEn(ev: RecordEvent, getRank: RankFn, includeFlag: boolean): string {
  const tag = ev.tag;
  const eventId = ev.event_id;
  const personIso2 = ev.person_iso2;
  const t = formatTime(ev.attempt_result, eventId);
  const tEn = typeEn(eventId, ev.rec_type);

  if (tag === 'WR') return `${t} WR ${tEn}`;
  if (tag === 'NR') {
    const rank = getRank(eventId, ev.rec_type, ev.attempt_result);
    const suffix = rank ? `/WR${rank}` : '';
    const flag = includeFlag ? countryFlag(personIso2) : '';
    return `${t}${flag}NR${suffix} ${tEn}`;
  }
  const crAbbr = resolveCrAbbr(tag, personIso2);
  const rank = getRank(eventId, ev.rec_type, ev.attempt_result);
  const suffix = rank ? `/WR${rank}` : '';
  return `${t} ${crAbbr}${suffix} ${tEn}`;
}
