/**
 * WCA 比赛视频标题生成工具 —— 移植自退役 Python gen_title.py。
 *
 * 用法(从 core/ 跑):
 *   pnpm --filter @cuberoot/server exec tsx src/tools/gen_title.ts                       # 交互模式
 *   pnpm ... gen_title.ts "5.55 3x3 NR Avg Nahm"                                          # 命令行
 *   pnpm ... gen_title.ts --list                                                          # 列出近期纪录
 *   pnpm ... gen_title.ts "标题" --uploader "频道名" --channel-id "ID"                     # 指定发布者
 *   pnpm ... gen_title.ts "标题" --write "D:\\cube\\upload-video"                          # 写 info_*.md
 *
 * 流程:① 选手身份从 --uploader 取(查 channel_aliases.json → WCA ID)→ ② 纪录路径(WCA Live
 * recentRecords 按选手 + 关键词匹配,命中出纪录快讯标题)→ ③ fallback(WCA REST 查选手历史成绩
 * 反查比赛 + 世界排名,出通用双语标题)。纪录文案复用权威 record_format.ts,无 Python 副本。
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as readline from 'node:readline/promises';
import {
  formatTime,
  splitName,
  countryFlag,
  COUNTRY_CN_MAP,
  ISO2_TO_CR,
  CR_ABBR_CN,
  EVENT_CN_MAP,
  EVENT_EN_MAP,
} from '../utils/record_format.js';
import { RANKINGS } from './wca_rankings.js';
import { queryRecentRecords, formatRecordMessage, type LiveRecord } from './wca_live_records.js';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));

// === 话题标签生成 ===

// 英文话题标签映射(去掉空格/特殊字符,全小写)
const _EVENT_TAG_EN: Record<string, string> = {
  '3x3x3 Cube': '3x3', '2x2x2 Cube': '2x2', '4x4x4 Cube': '4x4',
  '5x5x5 Cube': '5x5', '6x6x6 Cube': '6x6', '7x7x7 Cube': '7x7',
  '3x3x3 Blindfolded': '3bld', '3x3x3 Fewest Moves': 'fmc',
  '3x3x3 One-Handed': 'oh', Clock: 'clock',
  Megaminx: 'megaminx', Pyraminx: 'pyraminx', Skewb: 'skewb',
  'Square-1': 'sq1', '4x4x4 Blindfolded': '4bld',
  '5x5x5 Blindfolded': '5bld', '3x3x3 Multi-Blind': 'multibld',
};

/** 生成中英文话题标签行。record_tag: "WR"/"NR"/"CR" 或 null。返回 [cn, en]。 */
function generateTopics(
  eventName: string,
  recordTag: string | null = null,
  personIso2: string | null = null,
): [string, string] {
  const eventCn = (EVENT_CN_MAP[eventName] ?? eventName).trim();
  const eventEn = _EVENT_TAG_EN[eventName] ?? eventName.toLowerCase().replaceAll(' ', '');
  const cnTags = ['#魔方', `#${eventCn}`];
  const enTags = ['#rubikscube', `#${eventEn}`];

  if (recordTag === 'WR') {
    cnTags.push('#世界纪录');
    enTags.push('#worldrecord');
  } else if (recordTag === 'NR' && personIso2) {
    const countryCn = COUNTRY_CN_MAP[personIso2] ?? '';
    if (countryCn) cnTags.push(`#${countryCn}纪录`);
    enTags.push('#nationalrecord');
  } else if (recordTag === 'CR' && personIso2) {
    const crAbbr = ISO2_TO_CR[personIso2] ?? 'CR';
    const crCn = CR_ABBR_CN[crAbbr] ?? '洲际纪录';
    cnTags.push(`#${crCn}`);
    enTags.push('#continentalrecord');
  }

  return [cnTags.join(' '), enTags.join(' ')];
}

// 用户输入的项目缩写 → WCA event name
const _EVENT_ALIAS: Record<string, string> = {};
for (const [name, abbr] of Object.entries(EVENT_EN_MAP)) {
  _EVENT_ALIAS[abbr.toLowerCase()] = name;
}
Object.assign(_EVENT_ALIAS, {
  '3x3': '3x3x3 Cube',
  '2x2': '2x2x2 Cube',
  '4x4': '4x4x4 Cube',
  '5x5': '5x5x5 Cube',
  '6x6': '6x6x6 Cube',
  '7x7': '7x7x7 Cube',
  '2x2x2': '2x2x2 Cube',
  '3x3x3': '3x3x3 Cube',
  '4x4x4': '4x4x4 Cube',
  '5x5x5': '5x5x5 Cube',
  '6x6x6': '6x6x6 Cube',
  '7x7x7': '7x7x7 Cube',
  '3bld': '3x3x3 Blindfolded',
  '4bld': '4x4x4 Blindfolded',
  '5bld': '5x5x5 Blindfolded',
  mbld: '3x3x3 Multi-Blind',
  multi: '3x3x3 Multi-Blind',
  multibld: '3x3x3 Multi-Blind',
  fmc: '3x3x3 Fewest Moves',
  oh: '3x3x3 One-Handed',
  mega: 'Megaminx',
  megaminx: 'Megaminx',
  pyra: 'Pyraminx',
  pyraminx: 'Pyraminx',
  sq1: 'Square-1',
  'square-1': 'Square-1',
  cube: '3x3x3 Cube',
});

/** 计算纪录与关键词的匹配度,越高越匹配,0 = 完全不匹配。 */
function scoreMatch(record: LiveRecord, keywords: string[]): number {
  const result = record.result;
  const person = result.person;
  const event = result.round.competitionEvent.event;
  const eventId = event.id;

  const personName = person.name.toLowerCase();
  const eventName = event.name.toLowerCase();
  const timeStr = formatTime(record.attemptResult, eventId);

  let score = 0;
  for (const kw of keywords) {
    const kwLower = kw.toLowerCase();

    // 选手名匹配(部分匹配即可)
    if (personName.includes(kwLower)) score += 10;

    // 成绩匹配(精确)
    if (kwLower === timeStr.toLowerCase()) score += 20;

    // 项目匹配:先别名表找标准名再比较
    const matchedEvent = _EVENT_ALIAS[kwLower];
    if (matchedEvent && matchedEvent.toLowerCase() === eventName) score += 5;

    // 纪录类型匹配
    const tag = record.tag;
    if ((kwLower === 'wr' || kwLower === 'world record') && tag === 'WR') score += 3;
    else if ((kwLower === 'nr' || kwLower === 'national record') && tag === 'NR') score += 3;
    else if ((kwLower === 'cr' || kwLower === 'continental record') && tag === 'CR') score += 3;

    // 单次/平均匹配
    const recType = record.type;
    if ((kwLower === 'single' || kwLower === 's') && recType === 'single') score += 2;
    else if ((kwLower === 'average' || kwLower === 'avg' || kwLower === 'a') && recType === 'average') score += 2;
  }

  return score;
}

/** 将用户输入拆成关键词列表(保留数字/英文,去废词)。 */
function parseKeywords(text: string): string[] {
  // 用空格/常见分隔符/括号拆分(括号当分隔符,避免 "Average(Finally" 粘连)
  let tokens = text.trim().split(/[\s,|\-[\]()]+/);
  // 去尾部标点 Average! → Average
  tokens = tokens.map((t) => t.replace(/[!?.:;]+$/, ''));
  const stopwords = new Set([
    'in', 'at', 'the', 'a', 'an', 'of', 'by', 'new', 'record',
    'breaking', 'news', 'official', "rubik's", 'rubiks', 'cube',
    'from', 'pr', 'pb', 'wr', 'nr', 'cr', 'national', 'world', 'continental', 'holder',
    'my', 'best', 'ever', 'so', 'close', 'to', 'solve',
    // 多语言介词
    'av', 'von', 'de', 'och', 'und', 'et',
  ]);
  return tokens.filter((t) => t && !stopwords.has(t.toLowerCase()));
}

// 最低匹配分数门槛(成绩 +20 + 选手名 +10 + 项目 +5 = 35+;阈值 15 过滤误命中)
const _MIN_MATCH_SCORE = 15;

type Scored = [LiveRecord, number];

/** 按匹配度排序返回 [(record, score)],只返回 >= _MIN_MATCH_SCORE 的。 */
function findMatchingRecords(keywords: string[], records: LiveRecord[]): Scored[] {
  const scored: Scored[] = [];
  for (const r of records) {
    const s = scoreMatch(r, keywords);
    if (s >= _MIN_MATCH_SCORE) scored.push([r, s]);
  }
  scored.sort((a, b) => b[1] - a[1]);
  return scored;
}

function printRecordSummary(record: LiveRecord, idx = 0): void {
  const tag = record.tag;
  const recType = record.type;
  const result = record.result;
  const person = result.person;
  const event = result.round.competitionEvent.event;
  const comp = result.round.competitionEvent.competition;
  const timeStr = formatTime(record.attemptResult, event.id);
  const typeStr = recType === 'single' ? 'Single' : 'Avg';

  const prefix = idx ? `  [${idx}]` : '  ';
  console.log(`${prefix} ${tag} | ${timeStr} ${event.name} ${typeStr} | ${person.name} | ${comp.name}`);
}

/** 去掉纪录快讯前缀,只留纪录内容。 */
function stripPrefix(text: string): string {
  for (const prefix of ['纪录快讯! ', 'BREAKING NEWS! ', 'Breaking News! ']) {
    if (text.startsWith(prefix)) return text.slice(prefix.length);
  }
  return text;
}

/** 打印格式化标题和话题,可直接复制。 */
async function printFormatted(record: LiveRecord): Promise<void> {
  const { cn, en, url } = await formatRecordMessage(record);
  const tag = record.tag;
  const eventName = record.result.round.competitionEvent.event.name;
  const iso2 = record.result.person.country.iso2;
  const [cnTopics, enTopics] = generateTopics(eventName, tag, iso2);
  console.log();
  console.log(`  info_chs: ${stripPrefix(cn)}`);
  console.log(`            ${cnTopics}`);
  console.log(`  info_eng: ${stripPrefix(en)}`);
  console.log(`            ${enTopics}`);
  console.log(`  链接: ${url}`);
  console.log();
}

/** 将中英文标题写入 info_chs.md / info_eng.md(三行:标题、话题、空行)。 */
async function writeInfoFiles(record: LiveRecord, outDir: string): Promise<void> {
  const { cn, en } = await formatRecordMessage(record);
  const cnTitle = stripPrefix(cn);
  const enTitle = stripPrefix(en);
  const tag = record.tag;
  const eventName = record.result.round.competitionEvent.event.name;
  const iso2 = record.result.person.country.iso2;
  const [cnTopics, enTopics] = generateTopics(eventName, tag, iso2);

  for (const [fname, title, topics] of [
    ['info_chs.md', cnTitle, cnTopics],
    ['info_eng.md', enTitle, enTopics],
  ] as const) {
    writeFileSync(join(outDir, fname), `${title}\n${topics}\n\n`, 'utf-8');
  }
}

function listAllRecords(records: LiveRecord[]): void {
  console.log(`\nWCA Live 近期纪录 (共 ${records.length} 条):\n`);
  records.forEach((r, i) => printRecordSummary(r, i + 1));
  console.log();
}

// === WCA REST API 回退逻辑 ===

const WCA_API = 'https://www.worldcubeassociation.org/api/v0';

// WCA API event_id → event full name
const _EVENT_ID_TO_NAME: Record<string, string> = {
  '222': '2x2x2 Cube', '333': '3x3x3 Cube', '444': '4x4x4 Cube',
  '555': '5x5x5 Cube', '666': '6x6x6 Cube', '777': '7x7x7 Cube',
  '333bf': '3x3x3 Blindfolded', '333fm': '3x3x3 Fewest Moves',
  '333oh': '3x3x3 One-Handed', clock: 'Clock', minx: 'Megaminx',
  pyram: 'Pyraminx', skewb: 'Skewb', sq1: 'Square-1',
  '444bf': '4x4x4 Blindfolded', '555bf': '5x5x5 Blindfolded',
  '333mbf': '3x3x3 Multi-Blind',
};

const _CHANNEL_ALIASES_PATH = join(SCRIPT_DIR, 'channel_aliases.json');

interface ChannelAlias {
  wca_id: string;
  channel_id?: string;
}

/** 查 channel_aliases.json,按频道名(key)或频道 ID 匹配。 */
function loadChannelAlias(channelName = '', channelId = ''): ChannelAlias | null {
  if (!existsSync(_CHANNEL_ALIASES_PATH)) return null;
  try {
    const aliases = JSON.parse(readFileSync(_CHANNEL_ALIASES_PATH, 'utf-8')) as Record<string, ChannelAlias>;
    if (channelName && channelName in aliases) return aliases[channelName]!;
    if (channelId) {
      for (const entry of Object.values(aliases)) {
        if (entry.channel_id === channelId) return entry;
      }
    }
    return null;
  } catch {
    return null;
  }
}

/** 自动保存频道→WCA ID 映射(已有手动条目不覆盖)。 */
function saveChannelAlias(channelName: string, wcaId: string, channelId = ''): void {
  try {
    let aliases: Record<string, ChannelAlias> = {};
    if (existsSync(_CHANNEL_ALIASES_PATH)) {
      aliases = JSON.parse(readFileSync(_CHANNEL_ALIASES_PATH, 'utf-8')) as Record<string, ChannelAlias>;
    }
    if (channelName in aliases) return;
    const entry: ChannelAlias = { wca_id: wcaId };
    if (channelId) entry.channel_id = channelId;
    aliases[channelName] = entry;
    writeFileSync(_CHANNEL_ALIASES_PATH, JSON.stringify(aliases, null, 2), 'utf-8');
    console.log(`  已缓存映射: ${channelName} → ${wcaId}`);
  } catch {
    /* 忽略 */
  }
}

/** 带超时 + 参数的 GET JSON(raise_for_status 语义:非 2xx 抛错)。 */
async function getJson(url: string, params: Record<string, string> = {}, timeoutMs = 10000): Promise<unknown> {
  const u = new URL(url);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(u, { signal: ctrl.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

interface Candidate {
  wca_id: string;
  name: string;
  country_iso2: string;
}

/** 用 WCA REST 搜索选手,优先精确匹配名字,否则取第一个结果。 */
async function searchWcaPerson(name: string): Promise<Candidate[]> {
  try {
    // YouTube 频道名常用连字符(Seung-Hyuk),WCA 用空格
    const searchName = name.replaceAll('-', ' ');
    const data = (await getJson(`${WCA_API}/search/users`, { q: searchName, persons_table: 'true' }, 10000)) as {
      result?: { wca_id: string; name: string; country_iso2: string }[];
    };
    const results = data.result ?? [];
    if (!results.length) return [];

    const searchLower = searchName.toLowerCase();
    const normalize = (n: string) => n.replace(/\s*\([^)]*\)/g, '').replaceAll('-', ' ').trim().toLowerCase();
    const exact = results.filter((p) => normalize(p.name) === searchLower);

    const candidates = exact.length ? exact : [results[0]!];
    return candidates.map((p) => ({ wca_id: p.wca_id, name: p.name, country_iso2: p.country_iso2 }));
  } catch (e) {
    console.log(`  WCA API 搜人失败: ${(e as Error).message}`);
    return [];
  }
}

interface CompResult {
  comp_id: string;
  comp_name: string;
  comp_country_iso2: string;
  rest_last_date?: string;
  record_tag: string | null;
}

/** 用 WCA REST 查选手成绩反查比赛。返回比赛信息(含 NR/CR/WR 标记)或 null。 */
async function findCompetitionByResult(
  wcaId: string, timeCs: number, eventId: string, isAverage: boolean,
): Promise<CompResult | null> {
  let allResults: { event_id: string; best?: number; average?: number; competition_id: string;
    regional_single_record?: string | null; regional_average_record?: string | null }[];
  try {
    console.log('  查询选手历史成绩...');
    // /results 对顶尖选手可达 2000+ 条(~MB 级响应)。AbortController 是硬总超时(不同于
    // Python requests 的读超时),大响应需放宽到 60s,否则大选手永远 abort → 丢比赛名。
    allResults = (await getJson(`${WCA_API}/persons/${wcaId}/results`, {}, 60000)) as typeof allResults;
  } catch (e) {
    console.log(`  WCA API 查成绩失败: ${(e as Error).message}`);
    return null;
  }

  const field = isAverage ? 'average' : 'best';
  const recordField = isAverage ? 'regional_average_record' : 'regional_single_record';
  const matchingComps: string[] = [];
  let recordTag: string | null = null;
  for (const res of allResults) {
    if (res.event_id === eventId && (res as Record<string, unknown>)[field] === timeCs) {
      matchingComps.push(res.competition_id);
      recordTag = ((res as Record<string, unknown>)[recordField] as string | null) ?? null;
    }
  }

  console.log(`  获取到 ${allResults.length} 条成绩,匹配 ${matchingComps.length} 条`);

  if (!matchingComps.length) return null;

  const targetCompId = matchingComps[matchingComps.length - 1]!;

  try {
    console.log('  查询比赛详情...');
    const comps = (await getJson(`${WCA_API}/persons/${wcaId}/competitions`, {}, 30000)) as {
      id: string; name: string; country_iso2: string; start_date: string;
    }[];
    console.log(`  获取到 ${comps.length} 场比赛`);

    const lastDate = comps.length ? comps[comps.length - 1]!.start_date : '2000-01-01';

    for (const comp of comps) {
      if (comp.id === targetCompId) {
        return {
          comp_id: comp.id,
          comp_name: comp.name,
          comp_country_iso2: comp.country_iso2,
          rest_last_date: lastDate,
          record_tag: recordTag,
        };
      }
    }

    // 比赛没在列表里(成绩还没上传官网),用 ID 作名字
    return {
      comp_id: targetCompId,
      comp_name: targetCompId,
      comp_country_iso2: '',
      rest_last_date: lastDate,
      record_tag: recordTag,
    };
  } catch (e) {
    console.log(`  WCA API 查比赛失败: ${(e as Error).message}`);
    return {
      comp_id: targetCompId,
      comp_name: targetCompId,
      comp_country_iso2: '',
      rest_last_date: '2000-01-01',
      record_tag: recordTag,
    };
  }
}

const WCA_LIVE_API = 'https://live.worldcubeassociation.org/api';

interface LiveComp {
  comp_id: string;
  comp_name: string;
  comp_country_iso2: string;
}

/** 从 WCA Live 查选手注册的比 restLastDate 更新的比赛。 */
async function findLatestLiveCompetition(wcaId: string, restLastDate: string): Promise<LiveComp | null> {
  try {
    const since = restLastDate;
    // 本地日期(对齐 Python date.today(),非 UTC),避免跨日边界与 Python 差一天
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const q = `{ competitions(from: "${since}") { id name startDate `
      + `venues { country { iso2 } } `
      + `competitors { wcaId } } }`;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 15000);
    let data: {
      errors?: unknown;
      data?: { competitions?: { id: string | number; name: string; startDate: string;
        venues?: { country?: { iso2?: string } }[]; competitors?: { wcaId: string | null }[] }[] };
    };
    try {
      const r = await fetch(WCA_LIVE_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
        signal: ctrl.signal,
      });
      data = await r.json() as typeof data;
    } finally {
      clearTimeout(t);
    }
    if (data.errors) return null;

    const allComps = data.data?.competitions ?? [];

    // 只看已开始(排除未来)且比 REST API 更新的
    const recent = allComps.filter((c) => c.startDate > restLastDate && c.startDate <= today);
    if (!recent.length) return null;

    const matched = recent.filter((c) => (c.competitors ?? []).some((p) => p.wcaId === wcaId));
    if (!matched.length) return null;

    matched.sort((a, b) => (a.startDate < b.startDate ? 1 : a.startDate > b.startDate ? -1 : 0));
    const best = matched[0]!;
    let iso2 = '';
    if (best.venues?.length) iso2 = best.venues[0]!.country?.iso2 ?? '';

    console.log(`  WCA Live 找到: ${best.name} (${best.startDate})`);
    return { comp_id: String(best.id), comp_name: best.name, comp_country_iso2: iso2 };
  } catch (e) {
    console.log(`  WCA Live 查比赛失败: ${(e as Error).message}`);
    return null;
  }
}

const _TYPE_SINGLE_ALIASES = new Set(['single', 's', 'solve', 'singel']);
const _TYPE_AVERAGE_ALIASES = new Set(['average', 'avg', 'a', 'ao5', 'mean', 'mo3']);

interface TitleParts {
  time_str: string | null;
  event_name: string;
  event_id: string;
  rec_type: string;
  person_name: string | null;
  leftover: string[];
}

/** 从关键词分离 成绩/项目/类型;选手名优先从 uploader 取。 */
function extractTitleParts(keywords: string[], uploader: string | null = null): TitleParts {
  let timeStr: string | null = null;
  let eventName: string | null = null;
  let eventId: string | null = null;
  let recType = 'single';
  const leftover: string[] = [];

  for (const kw of keywords) {
    const kwLower = kw.toLowerCase();

    // 成绩:数字格式 4.89 / 1:23.45
    if (/^\d+[.:]\d[\d.]*$/.test(kw)) {
      if (!timeStr) timeStr = kw;
      continue;
    }

    // 项目:别名表
    const matched = _EVENT_ALIAS[kwLower];
    if (matched) {
      eventName = matched;
      for (const [eid, ename] of Object.entries(_EVENT_ID_TO_NAME)) {
        if (ename === matched) {
          eventId = eid;
          break;
        }
      }
      continue;
    }

    // 类型
    if (_TYPE_SINGLE_ALIASES.has(kwLower)) {
      recType = 'single';
      continue;
    }
    if (_TYPE_AVERAGE_ALIASES.has(kwLower)) {
      recType = 'average';
      continue;
    }

    leftover.push(kw);
  }

  // 选手名优先从 uploader 取,去非拉丁字符
  let person = uploader;
  if (person) person = person.replace(/[^\x00-\x7F]+/g, '').trim();

  return {
    time_str: timeStr,
    event_name: eventName ?? '3x3x3 Cube',
    event_id: eventId ?? '333',
    rec_type: recType,
    person_name: person ? person : null,
    leftover,
  };
}

/** 时间字符串 → 厘秒。'4.89' → 489, '1:23.45' → 8345。 */
function timeStrToCentiseconds(timeStr: string): number | null {
  try {
    if (timeStr.includes(':')) {
      const parts = timeStr.split(':');
      const minutes = parseInt(parts[0]!, 10);
      const seconds = parseFloat(parts[1]!);
      if (Number.isNaN(minutes) || Number.isNaN(seconds)) return null;
      return Math.round((minutes * 60 + seconds) * 100);
    }
    const v = parseFloat(timeStr);
    if (Number.isNaN(v)) return null;
    return Math.round(v * 100);
  } catch {
    return null;
  }
}

/** 组装通用中英文标题(fallback 路径)。返回 [cn, en]。 */
function formatGeneralTitle(
  timeStr: string,
  eventName: string,
  recType: string,
  personName: string,
  personIso2: string,
  compName: string | null,
  compIso2: string | null,
  isPr = false,
  eventId: string | null = null,
  timeCs: number | null = null,
  recordTag: string | null = null,
): [string, string] {
  const eventCn = EVENT_CN_MAP[eventName] ?? eventName;
  const eventEn = EVENT_EN_MAP[eventName] ?? eventName;
  const typeCn = recType === 'single' ? '单次' : '平均';
  const typeEn = recType === 'single' ? 'Single' : 'Avg';
  const personFlag = personIso2 ? countryFlag(personIso2) : '';

  const [cnName, enName] = splitName(personName);

  // 先查世界排名
  let rank: number | null = null;
  if (eventId && timeCs) rank = RANKINGS.getWorldRank(eventId, recType, timeCs);

  let cn: string;
  let en: string;

  // 纪录标签优先级:NR/CR/WR > PR > 纯排名
  if (recordTag) {
    let cnTagStr: string;
    let enTagStr: string;
    if (recordTag === 'NR') {
      const countryCn = COUNTRY_CN_MAP[personIso2] ?? '';
      const cnRecord = countryCn ? `${countryCn}纪录${personFlag}` : `NR${personFlag}`;
      const enRecord = `${personFlag}`;
      const tagStr = rank ? `${recordTag}/WR${rank}` : recordTag;
      cnTagStr = `${cnRecord}${tagStr}`;
      enTagStr = `${enRecord}${tagStr}`;
    } else if (recordTag === 'CR') {
      const crAbbr = ISO2_TO_CR[personIso2] ?? 'CR';
      const crCn = CR_ABBR_CN[crAbbr] ?? '洲际纪录';
      const cnRecord = `${crCn}${personFlag}`;
      const enRecord = `${personFlag}`;
      const tagStr = rank ? `${crAbbr}/WR${rank}` : crAbbr;
      cnTagStr = `${cnRecord}${tagStr}`;
      enTagStr = `${enRecord}${tagStr}`;
    } else {
      // WR
      cnTagStr = '世界纪录WR';
      enTagStr = 'WR';
    }
    // 有纪录标记时不显示选手国旗(已含在纪录前缀中)
    cn = `${timeStr}${eventCn}${typeCn}${cnTagStr} ${enName}`;
    en = `${timeStr} ${eventEn}${enTagStr} ${typeEn} ${enName}`;
  } else {
    // 无纪录标记:PR/WRxx 逻辑
    let tagStr: string;
    if (isPr && rank) tagStr = `PR/WR${rank}`;
    else if (isPr) tagStr = 'PR';
    else if (rank) tagStr = `WR${rank}`;
    else tagStr = '';
    cn = `${timeStr}${eventCn}${typeCn}${tagStr} ${cnName}${personFlag}`;
    en = `${timeStr} ${eventEn} ${tagStr ? tagStr + ' ' : ''}${typeEn} ${enName}${personFlag}`;
  }

  if (compName) {
    const compFlag = compIso2 ? countryFlag(compIso2) : '';
    cn += ` | ${compName}${compFlag}`;
    en += ` | ${compName}${compFlag}`;
  }

  return [cn, en];
}

interface PersonalRecords {
  [eventId: string]: { single?: { best?: number }; average?: { best?: number } };
}

/** 纪录匹配失败后的回退:WCA REST 查选手 + 比赛。成功输出/写入并返回 true。 */
async function fallbackWcaApi(
  keywords: string[],
  writeDir: string | null,
  uploader: string | null = null,
  channelId: string | null = null,
): Promise<boolean> {
  const parts = extractTitleParts(keywords, uploader);
  if (!parts.person_name || !parts.time_str) return false;

  let personalRecords: PersonalRecords = {};

  // 先查频道映射表(按频道名或频道ID)
  const alias = loadChannelAlias(parts.person_name, channelId ?? '');
  let candidates: Candidate[];
  if (alias) {
    const wcaId = alias.wca_id;
    console.log(`\n  频道映射命中: WCA ID = ${wcaId}`);
    try {
      const resp = (await getJson(`${WCA_API}/persons/${wcaId}`, {}, 10000)) as {
        person?: { name?: string; country_iso2?: string }; personal_records?: PersonalRecords;
      };
      const p = resp.person ?? {};
      personalRecords = resp.personal_records ?? {};
      candidates = [{ wca_id: wcaId, name: p.name ?? wcaId, country_iso2: p.country_iso2 ?? '' }];
      console.log(`  选手: ${candidates[0]!.name} (${candidates[0]!.country_iso2})`);
    } catch {
      candidates = [{ wca_id: wcaId, name: wcaId, country_iso2: '' }];
    }
  } else {
    console.log(`\n  回退: WCA API 查询 '${parts.person_name}'...`);
    candidates = await searchWcaPerson(parts.person_name);
    // 唯一匹配时自动缓存
    if (candidates.length === 1 && channelId) {
      saveChannelAlias(parts.person_name, candidates[0]!.wca_id, channelId);
    } else if (candidates.length === 1) {
      saveChannelAlias(parts.person_name, candidates[0]!.wca_id);
    }
    if (candidates.length === 1) {
      try {
        const resp = (await getJson(`${WCA_API}/persons/${candidates[0]!.wca_id}`, {}, 10000)) as {
          personal_records?: PersonalRecords;
        };
        personalRecords = resp.personal_records ?? {};
      } catch {
        /* 忽略 */
      }
    }
  }

  if (!candidates.length) {
    // uploader 非选手,尝试用标题里未识别 token 当候选名
    const leftover = parts.leftover;
    if (leftover.length) {
      const fallbackName = leftover.join(' ');
      console.log(`  uploader 非选手,尝试从标题提取: '${fallbackName}'`);
      candidates = await searchWcaPerson(fallbackName);
      if (candidates.length === 1) {
        try {
          const resp = (await getJson(`${WCA_API}/persons/${candidates[0]!.wca_id}`, {}, 10000)) as {
            personal_records?: PersonalRecords;
          };
          personalRecords = resp.personal_records ?? {};
        } catch {
          /* 忽略 */
        }
      }
    }
    if (!candidates.length) {
      console.log('  未找到 WCA 选手');
      return false;
    }
  }

  if (candidates.length > 1) {
    console.log(`  找到 ${candidates.length} 个同名选手,用成绩消歧...`);
  }

  // 重名消歧:逐个候选查成绩
  let timeCs = timeStrToCentiseconds(parts.time_str);
  let person = candidates[0]!;
  let comp: CompResult | LiveComp | null = null;
  let restLastDate = '2000-01-01';

  if (timeCs) {
    const isAvg = parts.rec_type === 'average';
    for (const candidate of candidates) {
      console.log(`  尝试: ${candidate.name} (${candidate.country_iso2})`);
      const result = await findCompetitionByResult(candidate.wca_id, timeCs, parts.event_id, isAvg);
      if (result) {
        person = candidate;
        comp = result;
        restLastDate = result.rest_last_date ?? restLastDate;
        break;
      }
    }
  } else {
    console.log(`  找到: ${person.name} (${person.country_iso2})`);
  }

  // WCA REST 成绩有几天延迟;只在 REST 完全未找到比赛时才用 WCA Live 补充
  if (!comp) {
    const liveComp = await findLatestLiveCompetition(person.wca_id, restLastDate);
    if (liveComp) comp = liveComp;
  } else if ('comp_name' in comp && comp.comp_name === (comp as CompResult).comp_id) {
    const liveComp = await findLatestLiveCompetition(person.wca_id, restLastDate);
    if (liveComp && liveComp.comp_id) {
      comp.comp_name = liveComp.comp_name;
      comp.comp_country_iso2 = liveComp.comp_country_iso2 ?? '';
    }
  }

  if (comp) {
    console.log(`  比赛: ${comp.comp_name}`);
  } else {
    console.log(`  选手: ${person.name} (${person.country_iso2})`);
    if (timeCs) console.log('  未找到对应比赛成绩');
  }

  // 判断 PR(WCA 数据有延迟,成绩 <= 官网 PR 也算)
  let isPr = false;
  timeCs = timeStrToCentiseconds(parts.time_str);
  if (timeCs && Object.keys(personalRecords).length) {
    const prType = parts.rec_type === 'average' ? 'average' : 'single';
    const prData = personalRecords[parts.event_id]?.[prType] ?? {};
    const prBest = prData.best;
    if (prBest && timeCs <= prBest) {
      isPr = true;
      console.log(`  ✓ 成绩是 ${parts.event_name} ${prType} PR`);
    }
  }

  // 纪录标记(NR/CR/WR)
  const recordTag = comp && 'record_tag' in comp ? comp.record_tag : null;
  if (recordTag) console.log(`  ✓ 成绩是 ${parts.event_name} ${recordTag}`);

  const [cn, en] = formatGeneralTitle(
    parts.time_str, parts.event_name, parts.rec_type,
    person.name, person.country_iso2,
    comp ? comp.comp_name : null,
    comp ? comp.comp_country_iso2 : null,
    isPr,
    parts.event_id,
    timeCs,
    recordTag,
  );

  const [cnTopics, enTopics] = generateTopics(parts.event_name, recordTag, person.country_iso2);

  console.log();
  console.log(`  info_chs: ${cn}`);
  console.log(`            ${cnTopics}`);
  console.log(`  info_eng: ${en}`);
  console.log(`            ${enTopics}`);
  console.log();

  if (writeDir) {
    for (const [fname, title, topics] of [
      ['info_chs.md', cn, cnTopics],
      ['info_eng.md', en, enTopics],
    ] as const) {
      writeFileSync(join(writeDir, fname), `${title}\n${topics}\n\n`, 'utf-8');
    }
  }

  return true;
}

/** 交互模式:循环输入关键词搜索纪录。 */
async function interactiveMode(records: LiveRecord[]): Promise<void> {
  console.log('\n=== 纪录标题生成工具 ===');
  console.log(`已加载 ${records.length} 条近期纪录`);
  console.log('输入关键词搜索(如: 5.55 3x3 Nahm),输入 list 列出全部,输入 q 退出\n');

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    for (;;) {
      let userInput: string;
      try {
        userInput = (await rl.question('> ')).trim();
      } catch {
        break;
      }

      if (!userInput) continue;
      if (['q', 'quit', 'exit'].includes(userInput.toLowerCase())) break;
      if (userInput.toLowerCase() === 'list') {
        listAllRecords(records);
        continue;
      }

      const keywords = parseKeywords(userInput);
      if (!keywords.length) {
        console.log('  请输入有效的关键词\n');
        continue;
      }

      const matches = findMatchingRecords(keywords, records);
      if (!matches.length) {
        console.log('  未找到匹配纪录,试试其他关键词\n');
        continue;
      }

      if (matches.length === 1 || matches[0]![1] > matches[1]![1] * 1.5) {
        await printFormatted(matches[0]![0]);
      } else {
        console.log(`\n  找到 ${matches.length} 条匹配,请选择:\n`);
        const top = matches.slice(0, 8);
        top.forEach(([r], i) => printRecordSummary(r, i + 1));

        let choiceRaw: string;
        try {
          choiceRaw = (await rl.question(`\n  输入编号 (1-${top.length}): `)).trim();
        } catch {
          console.log();
          continue;
        }
        // 对齐 Python int(choice):非纯整数(如 '3.5'/'3abc')抛 ValueError → 空行 + continue,不选
        if (!/^[+-]?\d+$/.test(choiceRaw)) {
          console.log();
          continue;
        }
        const idx = parseInt(choiceRaw, 10) - 1;
        if (idx >= 0 && idx < top.length) {
          await printFormatted(top[idx]![0]);
        } else {
          console.log('  无效编号\n');
        }
      }
    }
  } finally {
    rl.close();
  }
}

/** 取出 `--flag <value>` 并从数组移除,返回值(无则 null)。 */
function takeFlagValue(args: string[], flag: string): { value: string | null; rest: string[] } {
  const i = args.indexOf(flag);
  if (i < 0) return { value: null, rest: args };
  if (i + 1 < args.length) {
    return { value: args[i + 1]!, rest: [...args.slice(0, i), ...args.slice(i + 2)] };
  }
  return { value: null, rest: args.slice(0, i) };
}

async function main(): Promise<void> {
  let rawArgs = process.argv.slice(2);

  const write = takeFlagValue(rawArgs, '--write');
  const writeDir = write.value;
  rawArgs = write.rest;

  const up = takeFlagValue(rawArgs, '--uploader');
  const uploader = up.value;
  rawArgs = up.rest;

  const ch = takeFlagValue(rawArgs, '--channel-id');
  const channelId = ch.value;
  rawArgs = ch.rest;

  const autoMode = rawArgs.includes('--auto');

  const args = rawArgs.filter((a) => !a.startsWith('--'));
  const flags = rawArgs.filter((a) => a.startsWith('--'));

  // 初始化排名缓存(用于 /WRxx 后缀)
  console.log('加载世界排名数据...');
  await RANKINGS.updateAll();

  console.log('查询 WCA Live 近期纪录...');
  const records = await queryRecentRecords();
  console.log(`获取到 ${records.length} 条纪录`);

  // --list
  if (flags.includes('--list')) {
    listAllRecords(records);
    return;
  }

  // 命令行模式
  if (args.length) {
    const allText = args.join(' ');
    const keywords = parseKeywords(allText);

    // 有 uploader 时先按选手身份过滤纪录列表
    let filteredRecords = records;
    if (uploader) {
      const alias = loadChannelAlias(uploader, channelId ?? '');
      const uploaderWcaId = alias ? alias.wca_id : null;

      if (uploaderWcaId) {
        filteredRecords = records.filter((r) => r.result.person.wcaId === uploaderWcaId);
      } else {
        const ul = uploader.toLowerCase();
        filteredRecords = records.filter((r) => r.result.person.name.toLowerCase().includes(ul));
      }
    }

    const matches = findMatchingRecords(keywords, filteredRecords);
    if (!matches.length) {
      // 诊断:fallback 原因
      if (filteredRecords.length === 0) {
        console.log('\n  ⚠ WCA Live 无该选手纪录 → fallback');
      } else {
        console.log(`\n  ⚠ WCA Live 有 ${filteredRecords.length} 条纪录但关键词不匹配 → fallback`);
      }
      if (await fallbackWcaApi(keywords, writeDir, uploader, channelId)) return;
      if (autoMode) {
        console.log('未匹配到纪录,跳过');
        return;
      }
      console.log('\n未找到匹配纪录');
      process.exit(1);
    }

    const best = matches[0]![0];

    if (!autoMode && matches.length > 1 && matches[1]![1] >= matches[0]![1] * 0.7) {
      console.log(`  (还有 ${matches.length - 1} 条可能匹配,用交互模式查看)`);
    }

    await printFormatted(best);

    if (writeDir) await writeInfoFiles(best, writeDir);
    return;
  }

  // 无参数 → 交互模式
  if (autoMode) {
    console.log('无关键词,跳过');
    return;
  }
  await interactiveMode(records);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
