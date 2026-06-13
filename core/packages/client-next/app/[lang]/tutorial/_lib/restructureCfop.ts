/**
 * restructureCfop — 把 docx 直转的扁平 CFOP 教程 HTML 重构成可导航的分节结构。
 *
 * 原始内容是一长串顶层 <p> / <div class="table-wrap">,章节标题埋在
 * <p><strong> 里、末层公式(VLS/OLL/1LLL/PLL)整块塞在一个巨表的 colspan 表头行。
 * 这里在浏览器端用 DOMParser 做结构手术:
 *   - 按顶层标题切成 <section id> 区块,注入带图标的 <h2 data-icon>;
 *   - 抽出 hero(标题 + 简介 + 4 步骤卡);
 *   - 巨表里的 VLS/OLL/1LLL/PLL 表头行加锚点 → 二级目录;
 *   - 扁平的加粗短行升级成 cfop-subhead 小标题。
 * 产物喂给 CfopContent(沿用 chip / 图片 / 链接 的解析),原始 JSON 完全不动。
 */

export type CfopIcon =
  | 'rotate'
  | 'hand'
  | 'shuffle'
  | 'book'
  | 'globe'
  | 'zap'
  | 'layers'
  | 'cross'
  | 'compass'
  | 'f2l'
  | 'boxes'
  | 'crown'
  | 'brain';

export interface CfopTocEntry {
  id: string;
  zh: string;
  en: string;
  level: 1 | 2;
  icon?: CfopIcon;
}

export interface CfopHero {
  titleZh: string;
  titleEn: string;
  intro: { zh: string; en: string };
  pillars: { img: string; label: string; href: string | null }[];
}

export interface CfopStructured {
  hero: CfopHero | null;
  bodyHtml: string;
  toc: CfopTocEntry[];
}

interface Matcher {
  type: 'p' | 'table';
  key: string;
}
interface SectionDef {
  id: string;
  zh: string;
  en: string;
  icon: CfopIcon;
  match: Matcher;
}

const SECTION_DEFS: SectionDef[] = [
  { id: 'notation', zh: '转动记号', en: 'Move Notation', icon: 'rotate', match: { type: 'p', key: '转动记号' } },
  { id: 'fingertrick', zh: '指法记号', en: 'Fingertricks', icon: 'hand', match: { type: 'p', key: '指法记号' } },
  { id: 'scramble', zh: '打乱练习', en: 'Scramble Practice', icon: 'shuffle', match: { type: 'p', key: '打乱练习' } },
  { id: 'terms', zh: '常见术语', en: 'Glossary', icon: 'book', match: { type: 'p', key: '常见术语' } },
  { id: 'websites', zh: '常用网站', en: 'Useful Sites', icon: 'globe', match: { type: 'p', key: '常用网站' } },
  { id: 'triggers', zh: '触发器', en: 'Triggers', icon: 'zap', match: { type: 'p', key: '触发器' } },
  { id: 'basic-algs', zh: '基础公式', en: 'Basic Algorithms', icon: 'layers', match: { type: 'p', key: 'F2L基本公式' } },
  { id: 'cross', zh: '十字 Cross', en: 'Cross', icon: 'cross', match: { type: 'p', key: '十字Cross' } },
  { id: 'study', zh: '学习指南', en: 'Study Guide', icon: 'compass', match: { type: 'p', key: '学习指南' } },
  { id: 'f2l', zh: 'F2L', en: 'First Two Layers', icon: 'f2l', match: { type: 'table', key: 'F2L' } },
  { id: 'f2l-nonstd', zh: '非标准 F2L', en: 'Non-standard F2L', icon: 'boxes', match: { type: 'p', key: '基础非标F2L' } },
  { id: 'last-layer', zh: '末层公式', en: 'Last Layer', icon: 'crown', match: { type: 'table', key: '基础VLS' } },
  { id: 'memory', zh: '辅助记忆', en: 'Memory Aids', icon: 'brain', match: { type: 'p', key: '辅助记忆' } },
];

const LAST_LAYER_SUBS = [
  { kw: '基础VLS', id: 'll-vls', zh: 'VLS', en: 'VLS' },
  { kw: 'OLL', id: 'll-oll', zh: 'OLL', en: 'OLL' },
  { kw: '1LLL', id: 'll-1lll', zh: '1LLL', en: '1LLL' },
  { kw: 'PLL', id: 'll-pll', zh: 'PLL', en: 'PLL' },
];

function txt(el: Element | null): string {
  return (el?.textContent ?? '').trim();
}

/** 在中文与拉丁字母/数字交界处补空格(排版美化)。 */
function spaceCjkLatin(s: string): string {
  return s
    .replace(/([一-鿿])([A-Za-z0-9])/g, '$1 $2')
    .replace(/([A-Za-z0-9])([一-鿿])/g, '$1 $2');
}

function matchSection(el: Element, defs: SectionDef[], started: Set<string>): SectionDef | null {
  const t = txt(el);
  for (const d of defs) {
    if (started.has(d.id)) continue;
    if (d.match.type === 'p') {
      if (el.tagName === 'P' && t.startsWith(d.match.key) && !el.querySelector('img')) return d;
    } else {
      if (el.classList.contains('table-wrap')) {
        const first = el.querySelector('strong');
        if (first && txt(first).startsWith(d.match.key)) return d;
      }
    }
  }
  return null;
}

/** 扁平加粗短行 → 小标题(只在 section 直接子节点上判定,避开表格里的加粗 alg)。 */
function markSubheads(sec: HTMLElement): void {
  for (const child of Array.from(sec.children)) {
    if (child.tagName !== 'P') continue;
    if (child.querySelector('img') || child.querySelector('.tutorial-chip')) continue;
    const strong = child.querySelector('strong');
    if (!strong) continue;
    const whole = txt(child);
    // 整段就是加粗内容,且较短 → 真小标题
    if (whole && whole === txt(strong) && whole.length <= 36) {
      child.classList.add('cfop-subhead');
    }
  }
}

export function restructureCfop(rawHtml: string): CfopStructured {
  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') {
    return { hero: null, bodyHtml: rawHtml, toc: [] };
  }

  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(rawHtml, 'text/html');
  } catch {
    return { hero: null, bodyHtml: rawHtml, toc: [] };
  }
  const body = doc.body;
  const nodes = Array.from(body.children) as HTMLElement[];

  const started = new Set<string>();
  const introNodes: HTMLElement[] = [];
  const sections: { def: SectionDef; nodes: HTMLElement[] }[] = [];
  let current: { def: SectionDef; nodes: HTMLElement[] } | null = null;

  for (const el of nodes) {
    const hit = matchSection(el, SECTION_DEFS, started);
    if (hit) {
      started.add(hit.id);
      current = { def: hit, nodes: [] };
      sections.push(current);
      // 表格型边界:表格本身是内容,保留;<p> 型边界:丢掉原标题,注入自己的 h2
      if (hit.match.type === 'table') current.nodes.push(el);
      continue;
    }
    if (!current) introNodes.push(el);
    else current.nodes.push(el);
  }

  if (sections.length === 0) {
    return { hero: null, bodyHtml: rawHtml, toc: [] };
  }

  // ── hero ──
  const hero = buildHero(introNodes);

  // ── 组装分节 body ──
  const container = doc.createElement('div');
  const toc: CfopTocEntry[] = [];

  for (const s of sections) {
    const sec = doc.createElement('section');
    sec.className = 'cfop-sec';
    sec.id = `sec-${s.def.id}`;
    const h2 = doc.createElement('h2');
    h2.className = 'cfop-sec-head';
    h2.setAttribute('data-icon', s.def.icon);
    h2.innerHTML =
      `<span class="cfop-sec-zh">${s.def.zh}</span>` +
      `<span class="cfop-sec-en">${s.def.en}</span>`;
    sec.appendChild(h2);
    for (const n of s.nodes) sec.appendChild(n);
    markSubheads(sec);
    container.appendChild(sec);
    toc.push({ id: sec.id, zh: s.def.zh, en: s.def.en, level: 1, icon: s.def.icon });
  }

  // ── 末层巨表的二级锚点 ──
  const ll = container.querySelector('#sec-last-layer');
  if (ll) {
    const llIndex = toc.findIndex(t => t.id === 'sec-last-layer');
    const subEntries: CfopTocEntry[] = [];
    const strongs = Array.from(ll.querySelectorAll('strong'));
    for (const sub of LAST_LAYER_SUBS) {
      const hit = strongs.find(st => txt(st).startsWith(sub.kw));
      if (!hit) continue;
      const anchor = (hit.closest('tr') as HTMLElement) || (hit.closest('td') as HTMLElement) || (hit as HTMLElement);
      anchor.id = sub.id;
      anchor.classList.add('cfop-ll-anchor');
      subEntries.push({ id: sub.id, zh: sub.zh, en: sub.en, level: 2 });
    }
    if (llIndex >= 0 && subEntries.length) {
      toc.splice(llIndex + 1, 0, ...subEntries);
    }
  }

  return { hero, bodyHtml: container.innerHTML, toc };
}

function buildHero(introNodes: HTMLElement[]): CfopHero | null {
  if (!introNodes.length) return null;
  // 标题
  const titleEl = introNodes.find(n => txt(n).length > 0);
  const rawTitle = txt(titleEl ?? null);
  // 简介段落(非空、无图、非标题)
  const paras = introNodes.filter(
    n => n.tagName === 'P' && !n.querySelector('img') && txt(n) && n !== titleEl
  );
  const zhIntro = paras.find(p => /[一-鿿]/.test(txt(p)));
  const enIntro = paras.find(p => p !== zhIntro && /[A-Za-z]/.test(txt(p)));

  // 4 步骤卡:第一个 table-wrap
  const pillarTable = introNodes
    .map(n => (n.classList?.contains('table-wrap') ? n.querySelector('table') : null))
    .find(Boolean);
  const pillars: CfopHero['pillars'] = [];
  if (pillarTable) {
    const rows = Array.from(pillarTable.querySelectorAll('tr'));
    const imgRow = rows.find(r => r.querySelector('img'));
    const labelRow = rows.find(r => r !== imgRow);
    const imgs = imgRow ? Array.from(imgRow.querySelectorAll('img')) : [];
    const labelCells = labelRow ? Array.from(labelRow.children) : [];
    const n = Math.max(imgs.length, labelCells.length);
    for (let i = 0; i < n; i++) {
      const img = imgs[i]?.getAttribute('src') ?? '';
      const cell = labelCells[i] as HTMLElement | undefined;
      const a = cell?.querySelector('a');
      pillars.push({
        img,
        label: txt(cell ?? null) || `Step ${i + 1}`,
        href: a?.getAttribute('href') ?? null,
      });
    }
  }

  // 标题切分:"三阶魔方CFOP教程3x3 CFOP Tutorial" → zh / en
  const m = rawTitle.match(/^(.*?教程)\s*(.*)$/);
  const titleZh = spaceCjkLatin(m ? m[1] : '三阶魔方 CFOP 教程');
  const titleEn = (m ? m[2] : rawTitle).replace(/^3x3/i, '3×3') || '3×3 CFOP Tutorial';

  return {
    titleZh,
    titleEn,
    intro: { zh: txt(zhIntro ?? null), en: txt(enIntro ?? null) },
    pillars,
  };
}
