import * as cheerio from 'cheerio';
import fs from 'node:fs';
import path from 'node:path';
import { isAlgText } from './detectAlgs.js';
import { slugify } from './slugify.js';
import type {
  AlgsetCase,
  AlgsetGroup,
  CaseAlg,
  ExtractedAlgset,
  Lang,
  ManualOverride,
  SlugGroup,
} from './types.js';

/** 魔方案例图最小字节阈值。
 *  小于此值通常是装饰图/标记图(如 [oh] / [big] / [ft] 图标);
 *  真正的魔方状态 SVG 至少 ~2KB(9-21 个 rect/path) */
const MIN_CASE_IMG_SIZE = 1500;

/** 宽松的 "文本主要是 alg" 判定 —— 接受 isAlgText 严格集合之外的字符
 *  (箭头 `<-` / 等号 `=` / 步数括号 `(8*)` 等标注)。要求:
 *    - 长度 >= 20
 *    - 无 CJK
 *    - 含 "字母 + 修饰符" 紧邻形态(`R2` `U'` `x2` 等,避免 "U+,01,02" 里
 *      数字 2 触发误判)
 *    - 至少 3 个空白分词 token(label 通常是单 token) */
function looksLikeAlgCell(text: string): boolean {
  if (text.length < 20) return false;
  if (/[一-鿿㐀-䶿＀-￯]/.test(text)) return false;
  if (!/[RUFLDBMESruflmbesxyz][2w']/i.test(text)) return false;
  const tokens = text.split(/\s+/).filter(Boolean);
  if (tokens.length < 3) return false;
  return true;
}

/** 精确 algset slug 集合（base slug，不含 category 前缀） */
const ALGSET_BASE_SLUGS = new Set([
  'pll', 'oll', 'zbll', 'zbls', '1lll',
  'coll', 'cmll', 'wv', 'sv', 'vls', 'vhls', 'hls', 'ols',
  'ollcp', 'aollcp', 'eoll', 'epll',
  'ls', // last slot
  'ellpll', 'ellsf', 'ellss', 'cll', '2gll',
  'htr', 'eo', 'dr',
]);

export function isAlgsetSlug(slug: string, override?: ManualOverride): boolean {
  if (override?.view === 'algset') return true;
  if (override?.view === 'article') return false;

  // 1LLL 分多个 part (1lll1 / 1lll2 / 1lll3-h-pi / 1lll5-t 等)，prefix 匹配
  if (/^1lll\d*(-|$)/i.test(slug)) return true;

  // 完全匹配
  if (ALGSET_BASE_SLUGS.has(slug)) return true;

  // 各种形态：base 出现在 slug 的"边界"段
  for (const base of ALGSET_BASE_SLUGS) {
    if (slug === base) return true;
    if (slug.startsWith(base + '-')) return true;  // 'pll-...'
    if (slug.endsWith('-' + base)) return true;    // '3x3-pll'
    if (slug.includes('-' + base + '-')) return true; // '3x3-pll-recognition'
  }
  return false;
}

/** 从 case label 启发式推断 group id */
function inferGroup(label: string, slug: string): string {
  const L = label.trim();
  // ZBLL: H1-H72 / Pi / U / T / S / As / L
  const zbllMatch = /^(H|Pi|U|T|S|As|L|Aa)(?:\s|$|\d)/i.exec(L);
  if (zbllMatch && slug.includes('zbll')) return zbllMatch[1].toLowerCase();
  // PLL: Ua/Ub/H/Z/Aa/Ab/E/J/T/R/F/Y/V/N/G
  const pllGroups: Record<string, string> = {
    'ua': 'epll', 'ub': 'epll', 'h': 'epll', 'z': 'epll',
    'aa': 'adj', 'ab': 'adj', 'j': 'adj', 'ja': 'adj', 'jb': 'adj',
    't': 'adj', 'r': 'adj', 'ra': 'adj', 'rb': 'adj', 'f': 'adj',
    'y': 'opp', 'v': 'opp', 'n': 'opp', 'na': 'opp', 'nb': 'opp',
    'e': 'diag', 'g': 'g', 'ga': 'g', 'gb': 'g', 'gc': 'g', 'gd': 'g',
  };
  if (slug === 'pll' || slug.endsWith('-pll')) {
    const head = L.toLowerCase().replace(/\s.*$/, '').replace(/\d+$/, '');
    const g = pllGroups[head] || pllGroups[head.slice(0, 2)];
    if (g) return g;
  }
  return 'default';
}

/** 把 `/stats/tutorial/media/<slug>/<lang>/<file>` 转成磁盘绝对路径并取字节数。
 *  失败返回 0(fs 失败时不把图片当成有效).
 *  缓存:大 algset(如 1lll 3458 case)里同 src 会被多次 stat,cache 可省 ~60% I/O. */
const imgSizeCache = new Map<string, number>();
function getImgSize(src: string, outRoot: string): number {
  const cached = imgSizeCache.get(src);
  if (cached !== undefined) return cached;
  const prefix = '/stats/tutorial/';
  if (!src.startsWith(prefix)) {
    imgSizeCache.set(src, 0);
    return 0;
  }
  const rel = src.slice(prefix.length);
  let sz = 0;
  try { sz = fs.statSync(path.join(outRoot, rel)).size; } catch {}
  imgSizeCache.set(src, sz);
  return sz;
}

/** 在一个 cell 里,挑选最可能是 "魔方案例图" 的图片:
 *  - 过滤掉字节数 < MIN_CASE_IMG_SIZE 的装饰图
 *  - 多个合格图:**取第一张**(cell 里通常是 setup 在前、result 在后,
 *    result 经常是共享目标状态会重复,setup 是 case 特有的)
 *  - 找不到合格的图就返回 null
 */
function pickCaseImage(
  $cell: ReturnType<ReturnType<typeof cheerio.load>>,
  outRoot: string,
  $: ReturnType<typeof cheerio.load>,
): string | null {
  const imgs = $cell.find('img').toArray();
  for (const img of imgs) {
    const src = $(img).attr('src');
    if (!src) continue;
    const sz = getImgSize(src, outRoot);
    if (sz >= MIN_CASE_IMG_SIZE) return src;
  }
  return null;
}

/** 从 image cell 的文本提取 label，如 "U+,01,02,02,017,9,7,7" → "U+" */
function extractLabelFromImageCell(text: string): string | null {
  const trimmed = text.replace(/\s+/g, ' ').trim();
  if (!trimmed) return null;
  // 取第一个 `,` / `:` / 空格+数字 / 空格+左括号 前的部分
  const m = /^([^,:\t]+?)(?=,|:|\s\d|\s\(|$)/.exec(trimmed);
  if (!m) return trimmed.slice(0, 30);
  return m[1].trim().slice(0, 30);
}

/** 从 alg cell 的 HTML 拆出候选 alg 字符串（按 <p>/<br>/换行/等号） */
function splitAlgCandidates(
  $cell: ReturnType<ReturnType<typeof cheerio.load>>,
  $: ReturnType<typeof cheerio.load>,
): string[] {
  const candidates: string[] = [];
  const ps = $cell.children('p').toArray();
  const sources: string[] =
    ps.length > 0
      ? ps.map(p => $(p).text())
      : [$cell.text()];
  for (const src of sources) {
    // 按 "=" / "//" / "或" / ";" / newline 拆
    // 注意 "=" 是某些 docx（OLL / CMLL）的 alg 分隔符
    const parts = src
      .split(/(?:\/\/|或|;|\n|\r|=)/)
      .map(s => s.replace(/\s+/g, ' ').trim());
    for (const p of parts) {
      if (!p) continue;
      // 依次清理：
      // - 开头 "*" / "·" 推荐标记
      // - 开头 "1." "2)" 编号
      // - 前缀箭头 "->" "<-" "=>" "⇒" "→" "←"（表示变体方向）
      // - "[oh]" / "[lh]" / "[2h]" 等手位注释
      // - "(8*)" "(12)" 等步数/作者角标
      // - 结尾多余空格
      let cleaned = p
        .replace(/^\s*[*·•]+\s*/, '')
        .replace(/^\s*\d+[\.):)]?\s*/, '')
        .replace(/^\s*(?:->|<-|=>|<=|→|←|⇒|⇐|\.\.\.)\s*/, '')
        .replace(/\[(?:oh|lh|mh|rh|2h|one-hand|two-hand|Nakaji|Feliks|\w+)\]/gi, '')
        .replace(/\(\s*\d+\s*\*?\s*\)/g, '')
        .trim();
      if (isAlgText(cleaned)) candidates.push(cleaned);
    }
  }
  return [...new Set(candidates)];
}

interface ParsedCase {
  image: string;
  label: string;
  algs: string[];
}

/** 从 <tr> 抽取 1+ 个 case。
 *
 *  策略:先把每个 cell 分类为 "img cell"(有合格图 + 文字<20 char)或
 *  "alg cell"(长文字且通过 isAlgText 判定)或 "其他",
 *  然后 img cell 就近找未被消费的 alg cell 配对。
 *  这样能处理:
 *    - [img,alg,img,alg]: OLL/PLL 标准布局
 *    - [img,alg,alg,img]: CN OLL 镜像布局(col0-1 = case1, col2-3 = case2 反向)
 *    - 纯 [img,img]: 2 个 case 无 alg(留给 matrix parser 处理或 fallback selfAlgs)
 */
function parseRow(
  $row: ReturnType<ReturnType<typeof cheerio.load>>,
  $: ReturnType<typeof cheerio.load>,
  outRoot: string,
): ParsedCase[] {
  const cells = $row.find('td,th').toArray();
  if (cells.length < 2) return [];

  // Profile cells
  interface P {
    $c: ReturnType<ReturnType<typeof cheerio.load>>;
    imgSrc: string | null;
    text: string;
    isAlgCell: boolean;
  }
  const profiles: P[] = cells.map(cell => {
    const $c = $(cell);
    const text = $c.text().replace(/\s+/g, ' ').trim();
    const imgSrc = pickCaseImage($c, outRoot, $);
    // 强判定 alg cell:内容主要是 alg(严格 isAlgText 或宽松 looksLikeAlgCell)
    // 用于决定"即使 cell 内有合格图,也优先当作 alg cell"
    const strongAlgCell = isAlgText(text) || looksLikeAlgCell(text);
    // 弱判定 alg cell:用于没图但有 alg 文字的 cell
    const weakAlgCell = !imgSrc && text.length >= 8 && (isAlgText(text) || looksLikeAlgCell(text));
    return {
      $c,
      imgSrc: strongAlgCell ? null : imgSrc,
      text,
      isAlgCell: imgSrc && !strongAlgCell ? false : weakAlgCell || strongAlgCell,
    };
  });

  const imgIdxs: number[] = [];
  const algIdxs: number[] = [];
  for (let i = 0; i < profiles.length; i++) {
    if (profiles[i].imgSrc) imgIdxs.push(i);
    else if (profiles[i].isAlgCell) algIdxs.push(i);
  }

  if (imgIdxs.length === 0) return [];

  const results: ParsedCase[] = [];
  const consumedAlg = new Set<number>();
  for (const imgIdx of imgIdxs) {
    const p = profiles[imgIdx];
    const label = extractLabelFromImageCell(p.text) ?? 'Case';
    // 找未被消费 + 距离最近的 alg cell
    let bestAlgIdx = -1;
    let bestDist = Infinity;
    for (const algIdx of algIdxs) {
      if (consumedAlg.has(algIdx)) continue;
      const d = Math.abs(algIdx - imgIdx);
      if (d < bestDist) { bestDist = d; bestAlgIdx = algIdx; }
    }
    let algs: string[] = [];
    if (bestAlgIdx >= 0) {
      algs = splitAlgCandidates(profiles[bestAlgIdx].$c, $);
      consumedAlg.add(bestAlgIdx);
    } else {
      // 没配对到 alg cell → 试 img cell 自己的文本(docx 把 image+alg 同 cell 的情况)
      const selfAlgs = splitAlgCandidates(p.$c, $);
      if (selfAlgs.length) algs = selfAlgs;
    }
    results.push({ image: p.imgSrc!, label, algs });
  }
  return results;
}

/** 分类单 cell 的内容类型 —— 用于矩阵布局识别 */
interface CellProfile {
  hasCaseImg: boolean;
  textLen: number;
  hasAlgText: boolean;
  imgSrc: string | null;
  text: string;
}
function profileCell(
  cell: any,
  outRoot: string,
  $: ReturnType<typeof cheerio.load>,
): CellProfile {
  const $c = $(cell);
  const imgSrc = pickCaseImage($c, outRoot, $);
  const text = $c.text().replace(/\s+/g, ' ').trim();
  return {
    hasCaseImg: imgSrc !== null,
    textLen: text.length,
    hasAlgText: text.length > 0 && isAlgText(text),
    imgSrc,
    text,
  };
}

type RowKind = 'pureImage' | 'pureText' | 'mixed' | 'empty' | 'header';
function classifyRow(
  cells: any[],
  outRoot: string,
  $: ReturnType<typeof cheerio.load>,
): { kind: RowKind; profiles: CellProfile[] } {
  const profiles = cells.map(c => profileCell(c, outRoot, $));
  const nonEmpty = profiles.filter(p => p.hasCaseImg || p.textLen > 0);
  if (nonEmpty.length === 0) return { kind: 'empty', profiles };
  if (cells.length === 1) return { kind: 'header', profiles };
  const imgCells = profiles.filter(p => p.hasCaseImg).length;
  const textCells = profiles.filter(p => p.textLen > 0).length;
  // pureImage: 多数 cell 有合格图片 + 文字都很短(<5 chars)
  if (imgCells >= cells.length * 0.5 && profiles.every(p => p.textLen < 5)) {
    return { kind: 'pureImage', profiles };
  }
  // pureText: 无图片 + 半数以上 cell 有文字
  if (imgCells === 0 && textCells >= cells.length * 0.5) {
    return { kind: 'pureText', profiles };
  }
  return { kind: 'mixed', profiles };
}

/** 判断一张 table 是否为矩阵布局:
 *  严格要求 >= 2 行 "pureImage"(所有 cell 只有图无文字)。
 *  单个 pureImage 行 + 邻近 pureText 这种模糊匹配不触发矩阵,
 *  交给 1D parser 按 row-by-row 处理 —— 避免小缩略图表误判为矩阵. */
function isMatrixTable(
  rows: { kind: RowKind; profiles: CellProfile[] }[],
): boolean {
  let pureImageCount = 0;
  for (const r of rows) {
    if (r.kind === 'pureImage') pureImageCount++;
  }
  return pureImageCount >= 2;
}

/** 矩阵模式解析:对每个 pureImage 行,取它 **上方紧邻** 的 pureText 行作为 algs 源,
 *  再往上紧邻的 pureText 行作为 labels(可选)。按 column 配对成 case.
 *  严格约束:alg 行必须是 pureImage 上方 1-2 行内,且之间只允许 empty 行;
 *  不做 downward fallback(避免抓到下一组的 algs). */
function parseMatrixTable(
  rowData: { kind: RowKind; profiles: CellProfile[]; el: any }[],
  $: ReturnType<typeof cheerio.load>,
): ParsedCase[] {
  const out: ParsedCase[] = [];
  for (let i = 0; i < rowData.length; i++) {
    const row = rowData[i];
    if (row.kind !== 'pureImage') continue;

    // alg 源:往上紧邻的 pureText 行。仅允许跨越 'empty' 行,
    // 遇到 header / pureImage / mixed 即停(避免跨组拿错 alg).
    let algRowIdx = -1;
    for (let j = i - 1; j >= 0 && i - j <= 2; j--) {
      const k = rowData[j].kind;
      if (k === 'pureText') { algRowIdx = j; break; }
      if (k === 'empty') continue;
      break; // header / pureImage / mixed — 停
    }

    // labels:alg 行再往上一行的 pureText (ZBLL matrix 是: labels / algs / images)
    let labelRowIdx = -1;
    if (algRowIdx >= 0) {
      for (let j = algRowIdx - 1; j >= 0 && algRowIdx - j <= 2; j--) {
        const k = rowData[j].kind;
        if (k === 'pureText') { labelRowIdx = j; break; }
        if (k === 'empty') continue;
        break;
      }
    }

    const nCols = row.profiles.length;
    for (let col = 0; col < nCols; col++) {
      const imgSrc = row.profiles[col].imgSrc;
      if (!imgSrc) continue;
      const algRow = algRowIdx >= 0 ? rowData[algRowIdx] : null;
      const labelRow = labelRowIdx >= 0 ? rowData[labelRowIdx] : null;

      // 取 alg 源 cell 文本并拆分候选
      let algs: string[] = [];
      if (algRow) {
        const algCells = $(algRow.el).find('td,th').toArray();
        if (algCells[col]) {
          algs = splitAlgCandidates($(algCells[col]), $);
        }
      }

      // label 提取:如果 labels 行是第一个 pureText,文本可能像 "UUP,U72,..."
      let label = '';
      if (labelRow) {
        const labelCells = $(labelRow.el).find('td,th').toArray();
        if (labelCells[col]) {
          const t = $(labelCells[col]).text().replace(/\s+/g, ' ').trim();
          label = extractLabelFromImageCell(t) ?? '';
        }
      }

      out.push({ image: imgSrc, label: label || 'Case', algs });
    }
  }
  return out;
}

/** 从 mammoth 的原始 HTML 提取出 algset 结构 */
export function extractAlgset(
  htmlByLang: Partial<Record<Lang, string>>,
  slug: string,
  category: string,
  subcategory: string | null,
  topDir: string,
  override: ManualOverride | undefined,
  sourceTitles: Partial<Record<Lang, string>>,
  outRoot: string,
): ExtractedAlgset {
  // 主 HTML 用 en 优先，缺则 zh
  const mainHtml = htmlByLang.en ?? htmlByLang.zh ?? '';
  const $ = cheerio.load(mainHtml, null, false);

  const cases: AlgsetCase[] = [];
  const seenIds = new Set<string>();
  let caseCounter = 0;

  const pushCase = (p: ParsedCase) => {
    // Header row 启发过滤：image cell 无 text (label 为空/'Case') 且 alg cell 没找到 alg
    if (
      p.algs.length === 0 &&
      (p.label === '' || p.label === 'Case' || /^Case\s*\d*$/i.test(p.label))
    ) {
      return;
    }
    caseCounter++;
    const label = p.label || `Case ${caseCounter}`;
    const group = inferGroup(label, slug);
    let caseId = slugify(`${slug}-${label}.docx`) || `${slug}-case${caseCounter}`;
    let suffix = 0;
    while (seenIds.has(caseId)) {
      suffix++;
      caseId = `${slug}-${slugify(label + '.docx')}-${suffix}` || `${slug}-case${caseCounter}`;
    }
    seenIds.add(caseId);

    const caseAlgs: CaseAlg[] = p.algs.map((a, i) => ({
      alg: a,
      primary: i === 0,
    }));
    if (caseAlgs.length === 0 && p.image) {
      caseAlgs.push({ alg: '(no alg found)', primary: true });
    }

    cases.push({
      id: caseId,
      label,
      group,
      image: p.image,
      algs: caseAlgs,
    });
  };

  $('table').each((_, table) => {
    const $table = $(table);
    const trs = $table.find('tr').toArray();
    // 1. 按行分类,判断是否矩阵布局
    const rowData = trs.map(tr => {
      const cells = $(tr).find('td,th').toArray();
      const info = classifyRow(cells, outRoot, $);
      return { ...info, el: tr };
    });
    const useMatrix = isMatrixTable(rowData);

    if (useMatrix) {
      const parsed = parseMatrixTable(rowData, $);
      for (const p of parsed) pushCase(p);
    } else {
      // 原 1D 逻辑:每行独立 parse
      for (const tr of trs) {
        const $tr = $(tr);
        const parsed = parseRow($tr, $, outRoot);
        for (const p of parsed) pushCase(p);
      }
    }
  });

  // groups 汇总
  const groupCounts = new Map<string, number>();
  for (const c of cases) {
    groupCounts.set(c.group, (groupCounts.get(c.group) ?? 0) + 1);
  }
  let groups: AlgsetGroup[];
  if (override?.algset_groups) {
    groups = override.algset_groups;
  } else {
    groups = [...groupCounts].map(([id, count], i) => ({
      id,
      label: id === 'default' ? '全部' : id.toUpperCase(),
      count,
      order: id === 'default' ? 99 : i,
    }));
    groups.sort((a, b) => a.order - b.order);
  }

  const firstImg = cases.find(c => c.image)?.image ?? null;

  return {
    view: 'algset',
    slug,
    category,
    subcategory,
    topDir,
    title: sourceTitles,
    cases,
    groups,
    thumb: firstImg,
    warningCount: 0,
  };
}

/** 公认 algset 的 case 数基线（用于 Phase 5.5 review 校验） */
export const ALGSET_EXPECTED_CASES: Record<string, number> = {
  pll: 21,
  oll: 57,
  coll: 42,
  cmll: 42,
  wv: 27,
  zbll: 493,
  zbls: 302,
  epll: 4,
};

export function algsetExpectedCount(slug: string): number | null {
  if (ALGSET_EXPECTED_CASES[slug]) return ALGSET_EXPECTED_CASES[slug];
  const tail = slug.split('-').slice(-1)[0];
  if (tail && ALGSET_EXPECTED_CASES[tail]) return ALGSET_EXPECTED_CASES[tail];
  return null;
}
