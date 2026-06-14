// NOTE: 爬取 cubing.com 全部中国内地比赛，构建英文名 → 中文名映射
//
// 数据源：
//   1. cubing.com /competition?page=N — 所有中国内地比赛列表（含中文名 + alias）
//   2. WCA API /competitions?country_iso2=CN — 批量获取 WCA ID → 英文 short_name
//
// 输出：stats/comp_names_zh.json — { "English Name": "中文名", ... }
//
// 用法：npx tsx src/bin/fetch_comp_names_zh.ts [--refresh]
//   首次运行约 30 秒（自动检测页数 + WCA API 批量查询）
//   后续运行使用缓存，约 1 秒
//
// 忠实移植自退役 Python scripts/fetch_comp_names_zh.py（逐行翻译，行为一致）。
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
// bin -> src -> stats-build -> packages -> core -> repo root
const ROOT_DIR = resolve(__dirname, '../../../../../');
const OUTPUT_PATH = resolve(ROOT_DIR, 'stats/comp_names_zh.json');
const CACHE_DIR = resolve(ROOT_DIR, '.comp_names_zh_cache');

const CUBING_CHINA_URL = 'https://cubing.com/competition';
// 默认直连 WCA;CI 上被 WCA 403(GH runner IP 段),改经服务器代理:
// WCA_API_BASE=https://api.cuberoot.me/v1/wca-proxy/api/v0 + WCA_PROXY_SECRET(密钥头)。
const WCA_API_BASE = process.env.WCA_API_BASE || 'https://www.worldcubeassociation.org/api/v0';
const WCA_PROXY_SECRET = process.env.WCA_PROXY_SECRET;
const USER_AGENT = 'WCA-Stats-Bot/1.0 (cuberoot.me)';
const API_DELAY_SEC = 0.3;

function sleep(seconds: number): Promise<void> {
  return new Promise((r) => setTimeout(r, seconds * 1000));
}

interface CompInfo {
  name: string;
  short_name: string;
  start_date: string;
}

// NOTE: 对应 Python fetch_url 的 RuntimeError —— 仅"3 次重试耗尽"才抛这个，
//       main 只对它做优雅降级（保留旧文件）；损坏缓存的 JSON.parse 等其它错照常上抛崩溃。
class FetchError extends Error {}

/**
 * 带重试的 HTTP 请求。失败时抛 FetchError——避免静默写入 partial 缓存导致数据丢失。
 *
 * NOTE: Python urllib timeout=15 是读/inactivity 超时；JS AbortController 是硬总超时。
 * 这两个端点（cubing.com 一页 HTML / WCA API 一页 ≤100 条）响应都很小，15s 总预算足够。
 */
async function fetchUrl(url: string, raw: true): Promise<string>;
async function fetchUrl(url: string, raw?: false): Promise<unknown>;
async function fetchUrl(url: string, raw = false): Promise<string | unknown> {
  for (let attempt = 0; attempt < 3; attempt++) {
    let text: string;
    try {
      await sleep(API_DELAY_SEC);
      const ctrl = new AbortController();
      // 经代理走服务器出口(被 WCA 限带宽)时 CN list 可能慢,15s 偏紧 → 90s。
      const t = setTimeout(() => ctrl.abort(), 90 * 1000);
      try {
        const headers: Record<string, string> = { 'User-Agent': USER_AGENT };
        // 仅对经代理的 WCA 请求带密钥头;cubing.com 等其它 host 直连,不泄露 secret。
        if (WCA_PROXY_SECRET && url.startsWith(WCA_API_BASE)) headers['X-Proxy-Secret'] = WCA_PROXY_SECRET;
        const resp = await fetch(url, {
          headers,
          signal: ctrl.signal,
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        text = await resp.text();
      } finally {
        clearTimeout(t);
      }
    } catch (e) {
      console.log(`  [WARN] 请求失败 (${(e as Error).message}), 重试 ${attempt + 1}/3...`);
      await sleep(2);
      continue;
    }
    // NOTE: JSON.parse 在重试 try 之外 —— 对应 Python json.loads 不在 except(HTTPError,URLError,OSError) 内：
    //       200 但 body 损坏抛 SyntaxError 向上传播（崩溃），不被当网络失败重试 / 包成 FetchError 后降级到旧数据。
    return raw ? text : (JSON.parse(text) as unknown);
  }
  throw new FetchError(`fetch failed after 3 retries: ${url}`);
}

/** 从首页 HTML 的分页链接中提取最大 page=N 值。 */
function detectTotalPages(html: string): number {
  const pages = [...html.matchAll(/page=(\d+)/g)].map((m) => parseInt(m[1]!, 10));
  return pages.length ? Math.max(...pages) : 1;
}

// NOTE: 硬编码映射——cubing.com alias 与 WCA ID 差异过大、规则救不回来的老比赛
// 每年 update_upcoming.yml 会重新跑，新加的 alias 若走通规则就不需要进这里
// 加新条目前用 WCA API (https://www.worldcubeassociation.org/api/v0/competitions/<ID>) 验证 ID 存在
const ALIAS_TO_WCA_ID_OVERRIDE: Record<string, string> = {
  'Shenzhen-Cubing-10th-Anniversary-2019': 'Shenzhen10thAnniversary2019',
  'PKU-Spring-2019': 'PekingUniversitySpring2019',
  'Peking-University-2018': 'PKU2018',
  'Cross-strait-FMC-2018': 'CrossstraitFMC2018',
  'Nanchang-Medium-and-Small-Cubes-2018': 'NanchangMediumnSmallCubes2018',
  'FMC-Asia-2017': 'FMCAsia2017',
  'Qingdao-Cube-of-Prime-Numbers-2017': 'QingdaoPrimeNumbers2017',
  'FMC-Asia-2016': 'FMCAsia2016',
  'Cross-strait-Cubing-Exchange-2016': 'CrossstraitCubing2016',
  'Cross-strait-FMC-2016': 'CrossstraitFMC2016',
  '2015-Beijing-Long-Events-Open': 'BeijingLongEvents2015',
  'Cube-of-Prime-Numbers-2015': 'CubeOfPrimeNumbers2015',
  'Cross-strait-Cubing-Exchange-2014': 'CrossstraitCubing2014',
  'China-FM-2011-Beijing': 'ChinaFMBeijing2011',
  'China-FM-2011-Shanghai': 'ChinaFMShanghai2011',
  'China-FM-2011-Guangzhou': 'ChinaFMGuangzhou2011',
  'China-FM-2011-Xian': 'ChinaFMXian2011',
  'China-FM-2011-Shenyang': 'ChinaFMShenyang2011',
  'China-FM-2011-Zhengzhou': 'ChinaFMZhengzhou2011',
  'Hefei-After-Term-Open-2011': 'HefeiOpen2011',
  'Henan-University-of-Science-and-Technology-Open-2011': 'HenanUniversityOpen2011',
  'Shenyang-Cubing-Boxing-Day-2010': 'ShenyangBoxingDay2010',
  'Hong-Kong-Open-2010': 'HongKongOpen2010',
  'Hong-Kong-Cube-Day-2010': 'HongKongCubeDay2010',
  'Macau-Rubiks-Open-2009': 'MacauOpen2009',
  'Hong-Kong-Open-2009': 'HongKongOpen2009',
  'Hong-Kong-Open-2008': 'HongKongOpen2008',
  // NOTE: Hangzhou-open-2019 故意不加——cubing.com 中文名"杭州"与 WCA 里同日唯一的 HengyangOpen2019（衡阳）不一致，疑为 cubing.com 源数据错
};

/**
 * 从 cubing.com URL alias 推测可能的 WCA ID。
 * WCA 对比 cubing.com 的 alias 可能省略 'Open' 这类词（或 'Cubing' 前缀），
 * 所以一个 alias 需要生成多个候选 ID 去匹配。
 *
 * 返回有序数组（保持 Python generator 的 yield 顺序），去重逻辑一致。
 * 调用方按顺序短路命中，所以顺序至关重要。
 */
function aliasToWcaIdCandidates(alias: string): string[] {
  const tokens = alias.split('-');
  const seen = new Set<string>();
  const out: string[] = [];

  const yieldOnce = (candidate: string): boolean => {
    if (candidate && !seen.has(candidate)) {
      seen.add(candidate);
      out.push(candidate);
      return true;
    }
    return false;
  };

  // 1) 原始：全部 token 拼接
  yieldOnce(tokens.join(''));
  // 2) 去掉 "Open"（WCA ID 常省略）
  if (tokens.includes('Open')) {
    yieldOnce(tokens.filter((t) => t !== 'Open').join(''));
  }
  // 3) 去掉 "Cubing" 前缀（cubing.com 给非 WCA 赛加的）
  if (tokens.length && tokens[0] === 'Cubing') {
    const rest = tokens.slice(1);
    yieldOnce(rest.join(''));
    if (rest.includes('Open')) {
      yieldOnce(rest.filter((t) => t !== 'Open').join(''));
    }
  }
  // 4) 前 2 个 token（跳过 "Cubing" 前缀） + 年份 token
  //    WCA short_name 常是 "地点 + 季节/类型 + 年份"，ID 把空格删掉；cubing.com alias 多含冗余词
  //    例：Beijing-University-Cube-League-2025 → BeijingUniversity2025
  const start = tokens.length && tokens[0] === 'Cubing' ? 1 : 0;
  const yearTokens = tokens.filter((t) => /^\d{4}$/.test(t));
  if (tokens.length - start >= 2 && yearTokens.length) {
    yieldOnce(tokens[start]! + tokens[start + 1]! + yearTokens[0]!);
  }

  return out;
}

/**
 * 爬取 cubing.com 比赛列表全部页面（自动检测页数）。
 * 返回 [(alias, zh_name, start_date), ...] —— 保留 alias + 开始日期，供后续匹配用多种策略。
 */
async function scrapeCubingChina(): Promise<[string, string, string][]> {
  // NOTE: 一行结构：<td>YYYY-MM-DD[~END]</td><td><a class="comp-type-*" href="...">...</a>...</td>
  // 跨日 END 三种格式：~DD（同月）/ ~MM-DD（同年跨月）/ ~YYYY-MM-DD（跨年，如 2025-12-31~2026-01-01）
  // 捕获: (start_date, alias, inner_html)
  // cubing.com 临近开赛会把 URL 从 /competition/ 切到 /live/，alias 不变 —— 两种都收
  const rowPattern =
    /<td>(\d{4}-\d{2}-\d{2})(?:~(?:\d{4}-)?(?:\d{2}-)?\d{2})?<\/td>\s*<td>\s*<a[^>]*class="comp-type-\w+"[^>]*href="https:\/\/cubing\.com\/(?:competition|live)\/([^"?]+)"[^>]*>(.*?)<\/a>/gs;
  const tagStrip = /<[^>]+>/g;

  const rows: [string, string, string][] = [];
  mkdirSync(CACHE_DIR, { recursive: true });

  // NOTE: 先抓首页，自动检测总页数
  const firstCache = resolve(CACHE_DIR, 'page_1.html');
  let firstHtml: string;
  if (existsSync(firstCache)) {
    firstHtml = readFileSync(firstCache, 'utf-8');
  } else {
    firstHtml = await fetchUrl(
      `${CUBING_CHINA_URL}?year=&type=&province=&event=&page=1`,
      true,
    );
    if (firstHtml) {
      writeFileSync(firstCache, firstHtml, 'utf-8');
    }
  }

  const totalPages = firstHtml ? detectTotalPages(firstHtml) : 1;
  console.log(`  自动检测到 ${totalPages} 页`);

  for (let page = 1; page <= totalPages; page++) {
    const cacheFile = resolve(CACHE_DIR, `page_${page}.html`);

    let html: string;
    let source: string;
    if (existsSync(cacheFile)) {
      html = readFileSync(cacheFile, 'utf-8');
      source = '缓存';
    } else {
      const url = `${CUBING_CHINA_URL}?year=&type=&province=&event=&page=${page}`;
      html = await fetchUrl(url, true);
      if (!html) {
        console.log(`  [${page}/${totalPages}] 抓取失败`);
        continue;
      }
      writeFileSync(cacheFile, html, 'utf-8');
      source = '网络';
    }

    let count = 0;
    for (const m of html.matchAll(rowPattern)) {
      const startDate = m[1]!;
      const alias = m[2]!;
      const name = m[3]!.replace(tagStrip, '').trim();
      // NOTE: 只收 WCA 赛事——中文名里必含 "WCA"（非 WCA 比赛前端不会出现，抓了也是 noise）
      if (name && !alias.startsWith('?') && name.includes('WCA')) {
        rows.push([alias, name, startDate]);
        count++;
      }
    }

    console.log(`  [${page}/${totalPages}] ${count} 条 [${source}]`);
  }

  console.log(`[INFO] cubing.com: ${rows.length} 条`);
  return rows;
}

/**
 * 通过 WCA API 批量获取所有中国比赛的 WCA ID → {name, short_name, start_date}。
 * - name 是完整名（如 "Beijing Winter Open 2013"），stats/all_past_comps.json 用此字段
 * - short_name 是 WCA 展示用的短名（如 "Beijing 2013"），部分地方用此字段
 * - start_date 用于 cubing.com URL alias 和 WCA ID 差异过大（如词序颠倒）时按日期回退匹配
 * 输出英文 → 中文映射时 name + short_name 两者都作为 key，提高命中率。
 * ~738 条记录，每页 100 条 = ~8 次请求。
 */
async function fetchWcaCnComps(): Promise<Record<string, CompInfo>> {
  const cacheFile = resolve(CACHE_DIR, 'wca_cn_comps.json');
  let data: Record<string, CompInfo> | null = null;
  if (existsSync(cacheFile)) {
    data = JSON.parse(readFileSync(cacheFile, 'utf-8')) as Record<string, CompInfo>;
    // 兼容旧缓存：值须是字典且包含 start_date；否则丢弃缓存
    if (data && Object.keys(data).length) {
      const first = data[Object.keys(data)[0]!]!;
      if (typeof first !== 'object' || first === null || !('start_date' in first)) {
        data = null;
      }
    }
  }

  if (data !== null) {
    console.log(`[INFO] WCA API: ${Object.keys(data).length} 条 [缓存]`);
    return data;
  }

  const wcaIdToNames: Record<string, CompInfo> = {};
  let page = 1;
  for (;;) {
    const url = `${WCA_API_BASE}/competitions?country_iso2=CN&per_page=100&page=${page}`;
    const resp = (await fetchUrl(url)) as
      | { id: string; name?: string; short_name?: string; start_date?: string }[]
      | null;
    if (!resp || resp.length === 0) break;
    for (const c of resp) {
      const nameFull = c.name || c.short_name || '';
      const nameShort = c.short_name || nameFull;
      wcaIdToNames[c.id] = {
        name: nameFull,
        short_name: nameShort,
        start_date: c.start_date ?? '',
      };
    }
    console.log(`  [WCA API page ${page}] ${resp.length} 条`);
    if (resp.length < 100) break;
    page += 1;
  }

  // 写入缓存
  writeFileSync(cacheFile, JSON.stringify(wcaIdToNames), 'utf-8');
  console.log(`[INFO] WCA API: ${Object.keys(wcaIdToNames).length} 条`);
  return wcaIdToNames;
}

/**
 * 单条拉 WCA API detail，用于 ALIAS_TO_WCA_ID_OVERRIDE 里指向非 CN 国家（HK/MO/XA 等）
 * 的比赛。成功返回 {name, short_name, start_date}，否则 null。缓存到磁盘以免重复请求。
 */
async function fetchWcaCompDetail(wcaId: string): Promise<CompInfo | null> {
  const cacheFile = resolve(CACHE_DIR, `wca_comp_${wcaId}.json`);
  if (existsSync(cacheFile)) {
    return JSON.parse(readFileSync(cacheFile, 'utf-8')) as CompInfo;
  }

  const url = `${WCA_API_BASE}/competitions/${wcaId}`;
  const resp = (await fetchUrl(url)) as
    | { name?: string; short_name?: string; start_date?: string }
    | null;
  if (!resp) return null;
  const info: CompInfo = {
    name: resp.name || resp.short_name || '',
    short_name: resp.short_name || resp.name || '',
    start_date: resp.start_date ?? '',
  };
  writeFileSync(cacheFile, JSON.stringify(info), 'utf-8');
  return info;
}

async function main(): Promise<void> {
  console.log('=== 构建中国比赛英文名 → 中文名映射 ===\n');
  const start = Date.now();

  // NOTE: --refresh 必须清掉所有 cubing.com 页缓存 —— 新增比赛会让 alias 跨页位移，
  // 只清 page_1 会让"原来在 page_1 末尾的比赛被挤到 page_2"那一批从输出里消失。
  if (process.argv.slice(2).includes('--refresh')) {
    let pageCaches: string[] = [];
    if (existsSync(CACHE_DIR)) {
      pageCaches = readdirSync(CACHE_DIR).filter((f) => /^page_.*\.html$/.test(f));
      for (const p of pageCaches) {
        rmSync(resolve(CACHE_DIR, p));
      }
      const wca = resolve(CACHE_DIR, 'wca_cn_comps.json');
      if (existsSync(wca)) {
        rmSync(wca);
      }
    }
    console.log(
      `[INFO] 增量模式：已清除 ${pageCaches.length} 个 cubing.com 页缓存 + WCA API 缓存\n`,
    );
  }

  // Step 1: cubing.com → [(alias, zh_name, start_date), ...]
  console.log('[Step 1] 从 cubing.com 提取中文名...');
  const rows = await scrapeCubingChina();

  // Step 2: WCA API → { wca_id: {name, short_name, start_date} }
  console.log('\n[Step 2] 从 WCA API 获取英文名...');
  let wcaIdToNames: Record<string, CompInfo>;
  try {
    wcaIdToNames = await fetchWcaCnComps();
  } catch (e) {
    // NOTE: WCA API 对 CI runner IP 限流（403）时优雅降级：保留上次的 comp_names_zh.json，
    //       不让本步骤崩溃阻断整个 workflow 的 commit（中文名映射是 best-effort）。
    //       首次无旧数据才真失败。对应 Python `except RuntimeError`：只接重试耗尽的 FetchError，
    //       损坏缓存的 SyntaxError 等其它错照常上抛（与 Python json.loads 不在 except 内一致）。
    if (e instanceof FetchError && existsSync(OUTPUT_PATH)) {
      console.log(
        `[WARN] WCA API 拉取失败（${e.message}）；保留已有 comp_names_zh.json，跳过本次更新。`,
      );
      return;
    }
    throw e;
  }

  // 构建日期 → [wca_id, ...] 索引，作为 alias 匹配失败时的回退
  const wcaByDate: Record<string, string[]> = {};
  for (const [wcaId, info] of Object.entries(wcaIdToNames)) {
    const d = info.start_date ?? '';
    if (d) {
      (wcaByDate[d] ??= []).push(wcaId);
    }
  }

  // Step 3: 英文名 → 中文名
  // 匹配策略：(0) 硬编码 override；(a) alias 候选命中；(b) 按 start_date + country=CN 唯一回退
  const enToZh: Record<string, string> = {};
  let matchedByOverride = 0;
  let matchedByAlias = 0;
  let matchedByDate = 0;
  const unmatchedSamples: [string, string, string][] = [];
  for (const [alias, zhName, startDate] of rows) {
    let matchedNames: CompInfo | null = null; // {name, short_name}

    // (0) 硬编码 override——alias 与 WCA ID 差异大、规则救不回来的老比赛
    if (alias in ALIAS_TO_WCA_ID_OVERRIDE) {
      const wid = ALIAS_TO_WCA_ID_OVERRIDE[alias]!;
      if (wid in wcaIdToNames) {
        matchedNames = wcaIdToNames[wid]!;
      } else {
        // 非 CN 国家（HK/MO/XA 等）批量拉取没有，单条 detail fetch
        matchedNames = await fetchWcaCompDetail(wid);
      }
      if (matchedNames) {
        matchedByOverride += 1;
      }
    }

    // (a) alias 候选直接命中
    if (!matchedNames) {
      for (const cand of aliasToWcaIdCandidates(alias)) {
        if (cand in wcaIdToNames) {
          matchedNames = wcaIdToNames[cand]!;
          matchedByAlias += 1;
          break;
        }
      }
    }

    // (b) 日期唯一回退
    if (!matchedNames && startDate && (wcaByDate[startDate]?.length ?? 0) === 1) {
      matchedNames = wcaIdToNames[wcaByDate[startDate]![0]!]!;
      matchedByDate += 1;
    }

    if (matchedNames) {
      if (matchedNames.name) enToZh[matchedNames.name] = zhName;
      if (matchedNames.short_name) enToZh[matchedNames.short_name] = zhName;
    } else {
      unmatchedSamples.push([alias, zhName, startDate]);
    }
  }

  const matched = matchedByOverride + matchedByAlias + matchedByDate;
  const unmatched = rows.length - matched;
  console.log(
    `\n[INFO] 匹配成功: ${matched} (override ${matchedByOverride} + alias ${matchedByAlias} + 日期 ${matchedByDate}), 未匹配: ${unmatched}`,
  );
  if (unmatchedSamples.length) {
    console.log(
      `[INFO] 未匹配 ${unmatchedSamples.length} 条（alias 与 WCA ID 差异大，需硬编码对应）:`,
    );
    for (const [a, n, d] of unmatchedSamples) {
      console.log(`  - [${d}] ${a} → ${n}`);
    }
  }

  // Step 4: 输出 JSON（按英文名排序）
  // NOTE: Python dict(sorted(...)) 按 key 的 Unicode code point 升序排；JS 默认 sort 按 UTF-16
  // code unit 排，对 BMP 字符等价。英文比赛名为 ASCII，完全一致。
  const sortedKeys = Object.keys(enToZh).sort();
  const sortedMap: Record<string, string> = {};
  for (const k of sortedKeys) {
    sortedMap[k] = enToZh[k]!;
  }
  writeFileSync(OUTPUT_PATH, JSON.stringify(sortedMap, null, 2), 'utf-8');

  const rel = OUTPUT_PATH.slice(ROOT_DIR.length + 1).replace(/\\/g, '/');
  console.log(`[INFO] 输出: ${rel} (${sortedKeys.length} 条)`);
  console.log(`[INFO] 耗时: ${((Date.now() - start) / 1000).toFixed(1)} 秒`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
