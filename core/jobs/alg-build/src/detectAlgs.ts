import * as cheerio from 'cheerio';
import type { DetectedAlg } from './types.js';

/** 与 extractAlgset 同步:文章视图里的 chip 保留这些指法记号标签 */
const SAFE_INLINE_TAGS = new Set([
  'u', 's', 'strike', 'del',
  'em', 'i',
  'strong', 'b',
  'sub', 'sup',
]);
const TAG_NORMALIZE: Record<string, string> = {
  i: 'em',
  b: 'strong',
  strike: 's',
  del: 's',
};

function nodeToSafeMarkup(node: any): string {
  if (!node) return '';
  if (node.type === 'text') return String(node.data ?? '');
  if (node.type !== 'tag') return '';
  const tag = String(node.name ?? '').toLowerCase();
  const inner = (node.children ?? []).map((c: any) => nodeToSafeMarkup(c)).join('');
  if (tag === 'br') return ' ';
  if (SAFE_INLINE_TAGS.has(tag)) {
    const norm = TAG_NORMALIZE[tag] ?? tag;
    const stripped = inner.replace(/<[^>]+>/g, '');
    if (stripped.replace(/\s/g, '').length === 0) return inner;
    return `<${norm}>${inner}</${norm}>`;
  }
  return inner;
}

/** 公式允许的字符集：魔方面字母 + 修饰符 + 常见括号/符号
 *  · = 中间点(指法记号)、* = 推荐标(部分 docx 用)、↑↓←→ = 朝向调整记号 */
const CHAR_RE = /^[RUFLDBMESrulfdbmesxyz0-9'2w ,()[\]/+\-→↑↓←·*\n\t.]*$/;
const CUBE_LETTER_RE = /[RUFLDBMESruflmbes]/;
const MODIFIER_RE = /['2w]/;
/** 含中日韩汉字 → 不是公式 */
const CJK_RE = /[一-鿿㐀-䶿＀-￯]/;

/** 判断一段文本是不是纯公式 */
export function isAlgText(text: string): boolean {
  const trimmed = text.replace(/\s+/g, ' ').trim();
  if (trimmed.length < 5) return false;
  if (CJK_RE.test(trimmed)) return false;
  if (!CHAR_RE.test(trimmed)) return false;
  if (!CUBE_LETTER_RE.test(trimmed)) return false;
  if (!MODIFIER_RE.test(trimmed)) return false;
  const tokens = trimmed.split(/\s+/).filter(Boolean);
  if (tokens.length < 2) return false;
  if (/^[0-9]+$/.test(trimmed)) return false;
  // 排除全是标签式大写字母缩写（如 "PLL OLL" "F2L ZBLL"）：
  // 这类没有 ' / 2 / w 以外的修饰符在"独立 token"里，上面 MODIFIER_RE 已经拦了多数
  // 但 "F2L" 单独 4 字符，我们 length < 5 过滤掉了；两个并列有可能：
  // "F2L ZBLL" → 没有 ' 修饰符 → MODIFIER_RE 会通过（2 在里面），会误判为 alg
  // 额外过滤：所有 tokens 都是 "全大写 + 数字" 的缩写形态
  const allTokensAreAbbrev = tokens.every(t => /^[A-Z0-9]+$/.test(t) && t.length <= 5);
  if (allTokensAreAbbrev) return false;
  return true;
}

export interface DetectAlgsResult {
  html: string;
  detected: DetectedAlg[];
}

function stripTagsLocal(s: string): string {
  return s.replace(/<[^>]+>/g, '');
}

/**
 * 扫描 HTML block 节点 (p / li / td)，如果整段文本是纯公式 → 包 AlgChip
 * 只对纯文本 block（无子 element 或仅 text-like inline）生效，避免破坏富文本结构。
 */
export function detectAlgs(html: string, slugContext?: string): DetectAlgsResult {
  const $ = cheerio.load(html, null, false);
  const detected: DetectedAlg[] = [];
  const blockSelector = 'p, li, td';

  $(blockSelector).each((_, el) => {
    const $el = $(el);
    // 跳过包含 tutorial-chip / 或其他 block children
    if ($el.find('p, table, ul, ol, img, .tutorial-chip').length > 0) return;
    const text = $el.text();
    if (!isAlgText(text)) return;
    const alg = text.replace(/\s+/g, ' ').trim();
    // 抽出 chip 内部的安全 markup (保留 <u>/<s>/<em> 等指法记号),
    // 同时存 plain text 到 data-alg 用于 clipboard.
    const safeMarkup = ($el.contents().toArray() as any[])
      .map(c => nodeToSafeMarkup(c))
      .join('')
      .replace(/[ \t]+/g, ' ')
      .trim();
    detected.push({
      alg,
      source: 'auto',
      context: slugContext ? `${slugContext}:${el.tagName}` : el.tagName,
    });
    $el.empty();
    const chip = $('<span>')
      .addClass('tutorial-chip')
      .attr('data-alg', alg);
    // 如果 markup 与 plain 不同(说明含指法记号标签),用 html 否则 text 节省字节
    if (safeMarkup && stripTagsLocal(safeMarkup) !== safeMarkup) {
      chip.html(safeMarkup);
    } else {
      chip.text(alg);
    }
    $el.append(chip);
  });

  return { html: $.html(), detected };
}

/** 从 detected 抽出唯一公式列表（按首次出现顺序去重） */
export function dedupeAlgs(detected: DetectedAlg[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const d of detected) {
    const normalized = d.alg.replace(/\s+/g, ' ').trim();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}
