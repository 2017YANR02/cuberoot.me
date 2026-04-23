import * as cheerio from 'cheerio';

/** cube method 关键词 → 对应 algset slug 的 see-also 目标 */
const SEE_ALSO_KEYWORDS: { pattern: RegExp; slug: string }[] = [
  { pattern: /\bAOLLCP\b/, slug: 'aollcp' },
  { pattern: /\bOLLCP\b/, slug: 'ollcp' },
  { pattern: /\bZBLL\b/, slug: 'zbll' },
  { pattern: /\bZBLS\b/, slug: 'zbls' },
  { pattern: /\b1LLL\b/, slug: '1lll' },
  { pattern: /\bEPLL\b/, slug: 'epll' },
  { pattern: /\bEOLL\b/, slug: 'eoll' },
  { pattern: /\bCOLL\b/, slug: 'coll' },
  { pattern: /\bCMLL\b/, slug: 'cmll' },
  { pattern: /\bVHLS\b/, slug: 'vhls' },
  { pattern: /\bVLS\b/, slug: 'vls' },
  { pattern: /\bOLS\b/, slug: 'ols' },
  { pattern: /\bHLS\b/, slug: 'hls' },
  { pattern: /\bPLL\b/, slug: 'pll' },
  { pattern: /\bOLL\b/, slug: 'oll' },
  { pattern: /\bF2L\b/, slug: 'f2l' },
  { pattern: /\bWV\b/, slug: 'wv' },
  { pattern: /\bSV\b/, slug: 'sv' },
];

/**
 * HTML 整理：
 * - 剔除 mammoth 加的 class 属性（保留 alg-chip / see-also-link / table-wrap）
 * - 表格包 .table-wrap 给 overflow-x
 * - 外链 target + rel
 * - img loading=lazy + decoding=async
 * - see-also 关键词 → 自动链到 /alg/<slug>
 */
export function transformHtml(html: string, currentSlug: string): string {
  const $ = cheerio.load(html, null, false);

  // 1. 剥离 class 属性，保留必须的
  $('*').each((_, el) => {
    const $el = $(el);
    const cls = $el.attr('class');
    if (!cls) return;
    const kept = cls
      .split(/\s+/)
      .filter(c => c === 'alg-chip' || c === 'see-also-link' || c === 'table-wrap')
      .join(' ');
    if (kept) $el.attr('class', kept);
    else $el.removeAttr('class');
  });

  // 2. 表格包 .table-wrap
  $('table').each((_, el) => {
    const $t = $(el);
    if ($t.parent('.table-wrap').length === 0) {
      $t.wrap('<div class="table-wrap"></div>');
    }
  });

  // 3. 外链 target _blank + rel
  $('a[href]').each((_, el) => {
    const $a = $(el);
    const href = $a.attr('href') ?? '';
    if (/^https?:/i.test(href)) {
      $a.attr('target', '_blank');
      $a.attr('rel', 'noopener noreferrer');
    }
  });

  // 4. img 懒加载
  $('img').each((_, el) => {
    const $img = $(el);
    if (!$img.attr('loading')) $img.attr('loading', 'lazy');
    if (!$img.attr('decoding')) $img.attr('decoding', 'async');
  });

  // 5. see-also 自动链接（每 block 最多加 1 个，且 block 必须是纯文本，避免破坏富结构）
  $('p, li, td').each((_, el) => {
    const $el = $(el);
    // 含任何子 element 或已有 alg-chip / a → 跳
    if ($el.find('*').length > 0) return;
    let innerHtml = $el.html() ?? '';
    let added = false;
    for (const { pattern, slug } of SEE_ALSO_KEYWORDS) {
      if (added) break;
      if (slug === currentSlug) continue;
      if (!pattern.test(innerHtml)) continue;
      // 只替换第一处
      const p = new RegExp(pattern.source, 'm'); // 不用 global
      innerHtml = innerHtml.replace(
        p,
        match =>
          `<a href="/alg/${slug}" class="see-also-link" data-see-also="true">${match}</a>`,
      );
      added = true;
    }
    if (added) $el.html(innerHtml);
  });

  return $.html();
}
