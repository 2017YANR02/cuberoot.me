import * as cheerio from 'cheerio';
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

/** 从 image cell 的文本提取 label，如 "U+,01,02,02,017,9,7,7" → "U+" */
function extractLabelFromImageCell(text: string): string | null {
  const trimmed = text.replace(/\s+/g, ' ').trim();
  if (!trimmed) return null;
  // 取第一个 `,` / `:` / 空格+数字 / 空格+左括号 前的部分
  const m = /^([^,:\t]+?)(?=,|:|\s\d|\s\(|$)/.exec(trimmed);
  if (!m) return trimmed.slice(0, 30);
  return m[1].trim().slice(0, 30);
}

/** 从 alg cell 的 HTML 拆出候选 alg 字符串（按 <p>/<br>/换行） */
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
    // 再按 "//" / "或" / ";" / newline 拆
    const parts = src
      .split(/(?:\/\/|或|;|\n|\r)/)
      .map(s => s.replace(/\s+/g, ' ').trim());
    for (const p of parts) {
      if (!p) continue;
      // 去掉开头的 "*" 标记（表示推荐）、"1." "2." 编号、"[oh]" 注释
      let cleaned = p
        .replace(/^\s*[*·]\s*/, '')
        .replace(/^\s*\d+\.?\)?\s*/, '')
        .replace(/\[(?:oh|lh|mh|rh|2h|one-hand|two-hand|Nakaji|Feliks)\]/gi, '')
        .trim();
      if (isAlgText(cleaned)) candidates.push(cleaned);
    }
  }
  // 去重
  return [...new Set(candidates)];
}

interface ParsedCase {
  image: string;
  label: string;
  algs: string[];
  notes: string;
}

/** 从 <tr> 抽取 1+ 个 case（同行可能并排多个 case，每 "image cell + alg cell" 为一 case） */
function parseRow(
  $row: ReturnType<ReturnType<typeof cheerio.load>>,
  $: ReturnType<typeof cheerio.load>,
): ParsedCase[] {
  const cells = $row.find('td,th').toArray();
  if (cells.length < 2) return [];

  const results: ParsedCase[] = [];
  let i = 0;
  while (i < cells.length) {
    const $cell = $(cells[i]);
    const img = $cell.find('img').first();
    if (!img.length) {
      i++;
      continue;
    }
    // 找到 image cell。下一个 cell 期望是 alg cell
    const imgSrc = img.attr('src') ?? '';
    const imgText = $cell.text().replace(/\s+/g, ' ').trim();
    const label = extractLabelFromImageCell(imgText) ?? `Case`;

    let algs: string[] = [];
    let notesBits: string[] = [];
    const nextCell = cells[i + 1];
    if (nextCell) {
      const $next = $(nextCell);
      const nextImg = $next.find('img').length;
      if (nextImg === 0) {
        algs = splitAlgCandidates($next, $);
      }
    }

    // 如果 alg cell 找不到 alg，尝试看 image cell 本身是否含 alg 段落
    if (algs.length === 0) {
      const selfAlgs = splitAlgCandidates($cell, $);
      if (selfAlgs.length) algs = selfAlgs;
    }

    // 所有其他 non-img / non-alg 文本作为 notes
    results.push({ image: imgSrc, label, algs, notes: notesBits.join(' | ').slice(0, 300) });

    // 跳过：image cell + alg cell（即使 alg cell 没东西也跳过避免误识别）
    i += 2;
  }
  return results;
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
): ExtractedAlgset {
  // 主 HTML 用 en 优先，缺则 zh
  const mainHtml = htmlByLang.en ?? htmlByLang.zh ?? '';
  const $ = cheerio.load(mainHtml, null, false);

  const cases: AlgsetCase[] = [];
  const seenIds = new Set<string>();
  let caseCounter = 0;

  $('table').each((_, table) => {
    const $table = $(table);
    $table.find('tr').each((_, tr) => {
      const $tr = $(tr);
      const parsed = parseRow($tr, $);
      for (const p of parsed) {
        // Header row 启发过滤：image cell 无 text (label 为空/'Case') 且 alg cell 没找到 alg
        if (p.algs.length === 0 && (p.label === '' || p.label === 'Case' || /^Case\s*\d*$/i.test(p.label))) {
          continue;
        }
        caseCounter++;
        const label = p.label || `Case ${caseCounter}`;
        const group = inferGroup(label, slug);
        let caseId = slugify(`${slug}-${label}.docx`) || `${slug}-case${caseCounter}`;
        // 唯一化
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
          notes: p.notes || undefined,
        });
      }
    });
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
