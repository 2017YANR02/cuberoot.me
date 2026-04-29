/**
 * Scrape speedsolving.com wiki "List of Unofficial World Records"
 * → stats/world_bests.json
 *
 * Wiki tables use rowspan on the Event column (one big table per section,
 * with each event spanning ~5 rows for single/avg5/avg12/avg50/avg100).
 * We virtualize rowspan/colspan into a 2D grid before parsing rows.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';
import { countryToIso2 } from './country_map.js';
import type { WbDataset, WbRecord, WbTab, WbTabId, WbBilingual } from './types.js';

const SOURCE_URL = 'https://www.speedsolving.com/wiki/index.php?title=List_of_Unofficial_World_Records';
const OUT_PATH = resolve(fileURLToPath(import.meta.url), '../../../../../stats/world_bests.json');

// ── category labels ──

const CATEGORY_LABELS: Record<string, WbBilingual> = {
  'official':    { en: 'Official Events',          zh: '官方项目' },
  'bigcubes':    { en: 'Big Cubes',                zh: '大盘' },
  'relays':      { en: 'Relays',                   zh: '接力' },
  'minxes':      { en: 'Minxes',                   zh: 'Minx 系列' },
  'methods':     { en: '3x3x3 Methods',            zh: '3x3x3 解法' },
  'cuboids':     { en: 'Cuboids',                  zh: '长方体' },
  'subsets':     { en: 'Subsets',                  zh: '受限子集' },
  'sliding':     { en: 'Sliding Puzzles',          zh: '滑块' },
  'circle':      { en: 'Circle Puzzles',           zh: '圆周谜题' },
  'mods':        { en: 'Shape & Sticker Mods',     zh: '异形 / 贴纸改造' },
  'sized':       { en: 'Different-Sized Puzzles',  zh: '尺寸变体' },
  'solution':    { en: 'Solution-Limited Puzzles', zh: '解法受限' },
  'timeAttack':  { en: 'Time Attacks',             zh: '识别速度赛' },
  'multibld':    { en: 'Multi-Blind',              zh: '多盲' },
  'highdim':     { en: 'High-Dimensional',         zh: '高维' },
  'other':       { en: 'Other',                    zh: '其他' },
};

function categoryIdFromH3(text: string): keyof typeof CATEGORY_LABELS {
  const t = text.toLowerCase();
  if (t.includes('big cube'))                     return 'bigcubes';
  if (t.includes('relay'))                        return 'relays';
  if (t.includes('minx'))                         return 'minxes';
  if (t.includes('method'))                       return 'methods';
  if (t.includes('cuboid'))                       return 'cuboids';
  if (t.includes('subset'))                       return 'subsets';
  if (t.includes('sliding'))                      return 'sliding';
  if (t.includes('circle'))                       return 'circle';
  if (t.includes('shape') || t.includes('sticker') || t.includes('mod')) return 'mods';
  if (t.includes('size'))                         return 'sized';
  if (t.includes('solution'))                     return 'solution';
  if (t.includes('time attack'))                  return 'timeAttack';
  if (t.includes('multi-blind') || t.includes('multi blind') || t.includes('multibld')) return 'multibld';
  if (t.includes('high-dimensional') || t.includes('high dim')) return 'highdim';
  if (t.includes('official'))                     return 'official';
  return 'other';
}

// ── result string → ms ──

function parseResultMs(raw: string): number | null {
  const s = raw.trim().replace(/^\(|\)$/g, '');
  // "1:23.45"  /  "38:13.368"  /  "1:02:03.456"
  const colon = s.match(/^(?:(\d+):)?(\d+):(\d+(?:\.\d+)?)$/);
  if (colon) {
    const h = colon[1] ? parseInt(colon[1], 10) : 0;
    const m = parseInt(colon[2], 10);
    const sec = parseFloat(colon[3]);
    return Math.round((h * 3600 + m * 60 + sec) * 1000);
  }
  // "1.91"  /  "31.50"
  const num = s.match(/^(\d+(?:\.\d+)?)$/);
  if (num) {
    const n = parseFloat(num[1]);
    // FMC results are small integers (5–80); treat as non-time
    if (Number.isInteger(n) && n <= 100) return null;
    return Math.round(n * 1000);
  }
  return null;
}

// ── DOM helpers ──

function headingText($el: cheerio.Cheerio<any>): string {
  const headline = $el.find('.mw-headline').first();
  return (headline.length ? headline.text() : $el.text()).trim();
}

function findVideo($cell: cheerio.Cheerio<any>): string | null {
  const a = $cell.find('a[href]').filter((_, el) => {
    const href = (el as any).attribs?.href ?? '';
    return /youtu|youtube|imgur|drive\.google|vimeo|bilibili|twitch|reddit/i.test(href);
  }).first();
  if (a.length) return a.attr('href') ?? null;
  const anyExt = $cell.find('a[href^="http"]').first();
  return anyExt.length ? (anyExt.attr('href') ?? null) : null;
}

function parseDate(detail: string): string | null {
  const s = detail.trim();
  if (!s) return null;
  // "26th of September, 2023"
  const longish = s.match(/(\d{1,2})(?:st|nd|rd|th)?\s+of\s+(\w+),?\s+(\d{4})/i);
  if (longish) {
    const m = monthToNum(longish[2]);
    if (m) return `${longish[3]}-${m}-${pad2(parseInt(longish[1], 10))}`;
  }
  // "September 26, 2023" / "Sep 26 2023" / "September 26th, 2023"
  const mdY = s.match(/(\w+)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})/);
  if (mdY) {
    const m = monthToNum(mdY[1]);
    if (m) return `${mdY[3]}-${m}-${pad2(parseInt(mdY[2], 10))}`;
  }
  // "26 September 2023" / "26 Sep 2023"
  const dMy = s.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/);
  if (dMy) {
    const m = monthToNum(dMy[2]);
    if (m) return `${dMy[3]}-${m}-${pad2(parseInt(dMy[1], 10))}`;
  }
  // "2024-12-15" / "2024-12"
  const iso = s.match(/\b(\d{4})-(\d{2})(?:-(\d{2}))?\b/);
  if (iso) return iso[3] ? `${iso[1]}-${iso[2]}-${iso[3]}` : `${iso[1]}-${iso[2]}`;
  // Bare year
  const y = s.match(/\b(20\d{2}|19\d{2})\b/);
  if (y) return y[1];
  return null;
}

function pad2(n: number): string { return n < 10 ? `0${n}` : `${n}`; }

const MONTHS: Record<string, string> = {
  jan: '01', january: '01',
  feb: '02', february: '02',
  mar: '03', march: '03',
  apr: '04', april: '04',
  may: '05',
  jun: '06', june: '06',
  jul: '07', july: '07',
  aug: '08', august: '08',
  sep: '09', sept: '09', september: '09',
  oct: '10', october: '10',
  nov: '11', november: '11',
  dec: '12', december: '12',
};
function monthToNum(s: string): string | null {
  return MONTHS[s.trim().toLowerCase()] ?? null;
}

// ── 2D grid (handles rowspan/colspan) ──

interface GridCell { text: string; cell: any; }
type Grid = GridCell[][];

function buildGrid($: cheerio.CheerioAPI, table: any): Grid {
  const trs = $(table).find('tr').toArray();
  const grid: Grid = [];
  // pending[col] = remaining rowspans active at column `col`
  const pending: ({ text: string; cell: any; left: number } | null)[] = [];

  for (let r = 0; r < trs.length; r++) {
    const cells = $(trs[r]).find('td, th').toArray();
    const out: GridCell[] = [];
    let col = 0;
    let ci = 0;
    while (ci < cells.length || pending.some((p, i) => p && i >= col && p.left > 0)) {
      // 1) Fill in any active pending at the current col
      while (pending[col] && pending[col]!.left > 0) {
        out[col] = { text: pending[col]!.text, cell: pending[col]!.cell };
        pending[col]!.left--;
        if (pending[col]!.left === 0) pending[col] = null;
        col++;
      }
      // 2) Place next source cell, if any
      if (ci < cells.length) {
        const cell = cells[ci];
        const text = $(cell).text().trim();
        const rs = parseInt((cell as any).attribs?.rowspan ?? '1', 10);
        const cs = parseInt((cell as any).attribs?.colspan ?? '1', 10);
        for (let c = 0; c < cs; c++) {
          out[col + c] = { text, cell };
          if (rs > 1) pending[col + c] = { text, cell, left: rs - 1 };
        }
        col += cs;
        ci++;
      } else {
        // No more source cells; nothing left to do (loop guard handles trailing pending)
        break;
      }
    }
    grid.push(out);
  }
  return grid;
}

// ── column header detection ──

interface ColIdx {
  event: number; format: number; result: number; cuber: number;
  country: number; date: number; video: number; details: number;
}

function detectColumns(headerRow: GridCell[]): ColIdx | null {
  const idx: ColIdx = { event: -1, format: -1, result: -1, cuber: -1, country: -1, date: -1, video: -1, details: -1 };
  headerRow.forEach((c, i) => {
    if (!c) return;
    const t = c.text.toLowerCase();
    if      (idx.event   === -1 && /^event$/.test(t))               idx.event   = i;
    else if (idx.format  === -1 && /^(format|type)$/.test(t))       idx.format  = i;
    else if (idx.result  === -1 && /^(result|time|moves?|score)$/.test(t)) idx.result = i;
    else if (idx.cuber   === -1 && /^(name|cuber|person|holder)$/.test(t)) idx.cuber  = i;
    else if (idx.country === -1 && /^(country|nation)$/.test(t))    idx.country = i;
    else if (idx.date    === -1 && /^(date|when)$/.test(t))         idx.date    = i;
    else if (idx.video   === -1 && /^(video|videos|proof|link)/.test(t)) idx.video = i;
    else if (idx.details === -1 && /^(details?|notes?|comment|result details?|sources?|discussion)/.test(t)) idx.details = i;
  });
  if (idx.format === -1 || idx.result === -1 || idx.cuber === -1) return null;
  return idx;
}

// ── walk + organize ──

interface RawRecord {
  tabH2: string;
  catH3: string | null;
  parentH4: string | null;     // section heading just above the table
  eventName: string;            // from rowspan'd Event column, or fallback to parentH4
  rec: WbRecord;
}

function parseTable($: cheerio.CheerioAPI, tableEl: any, tabH2: string, catH3: string | null, parentH4: string | null): RawRecord[] {
  const grid = buildGrid($, tableEl);
  if (grid.length < 2) return [];
  const idx = detectColumns(grid[0]);
  if (!idx) return [];
  const out: RawRecord[] = [];
  for (let r = 1; r < grid.length; r++) {
    const row = grid[r];
    const text = (i: number) => i >= 0 ? (row[i]?.text ?? '') : '';
    const cell = (i: number) => i >= 0 ? row[i]?.cell : null;
    const cuber = text(idx.cuber);
    if (!cuber) continue;
    const result = text(idx.result);
    const format = text(idx.format);
    const country = text(idx.country);
    const detailsRaw = text(idx.details);
    const dateRaw = idx.date >= 0 ? text(idx.date) : detailsRaw;
    const videoCell = cell(idx.video) ?? cell(idx.details);
    const eventName = (idx.event >= 0 ? text(idx.event) : '') || parentH4 || catH3 || tabH2;
    out.push({
      tabH2,
      catH3,
      parentH4,
      eventName,
      rec: {
        format,
        result,
        resultMs: parseResultMs(result),
        cuber,
        country,
        iso2: countryToIso2(country),
        date: parseDate(dateRaw || detailsRaw),
        video: videoCell ? findVideo($(videoCell)) : null,
        notes: detailsRaw || null,
      },
    });
  }
  return out;
}

function walk($: cheerio.CheerioAPI): RawRecord[] {
  const root = $('#mw-content-text').first();
  const container = root.find('.mw-parser-output').first().length
    ? root.find('.mw-parser-output').first()
    : root;
  let h2: string | null = null;
  let h3: string | null = null;
  let h4: string | null = null;
  const all: RawRecord[] = [];
  container.children().each((_, el) => {
    const tag = (el as any).tagName?.toLowerCase();
    const $el = $(el);
    if (tag === 'h2') { h2 = headingText($el); h3 = null; h4 = null; }
    else if (tag === 'h3') { h3 = headingText($el); h4 = null; }
    else if (tag === 'h4') { h4 = headingText($el); }
    else if (tag === 'table' && h2) {
      const recs = parseTable($, el, h2, h3, h4);
      all.push(...recs);
    }
  });
  return all;
}

// ── organize into WbDataset ──

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'unnamed';
}

// Per actual wiki structure:
//   H2 "Official events"   → tab=standard, cat=official (single table, events from rowspan)
//   H2 "Unofficial events":
//     H4 directly under H2 (Big cubes, Relays, Minxes, ...) → tab=standard, cat=H4
//     H3 "Different-Sized Puzzles"/"Solution-Limited"/"Time Attacks"/"Other" → tab=standard, cat=H3
//     H3 "One Handed"/"With Feet"/"Blindfolded"/"Fewest Moves" → tab=oh/wf/bld/fm, cat=H4
//   H2 "Virtual Puzzles" → tab=virtual, cat=H3
//   H2 "Team Events"     → tab=team, cat=other
function determineTabCat(h2: string, h3: string | null, h4: string | null): { tab: WbTabId; tabName: WbBilingual; cat: string } {
  const h2k = h2.toLowerCase().trim();
  const h3k = (h3 ?? '').toLowerCase().trim();

  if (h2k === 'official events') {
    return { tab: 'standard', tabName: { en: 'Standard', zh: '标准' }, cat: 'official' };
  }
  if (h2k === 'team events') {
    return { tab: 'team', tabName: { en: 'Team', zh: '团体' }, cat: 'other' };
  }
  if (h2k === 'virtual puzzles') {
    return { tab: 'virtual', tabName: { en: 'Virtual', zh: '虚拟' }, cat: h3 ? categoryIdFromH3(h3) : 'other' };
  }
  if (h2k === 'unofficial events') {
    // Tab markers: H3 names that promote into their own tab
    if (h3k === 'one handed' || h3k === 'one-handed') {
      return { tab: 'oh', tabName: { en: 'One-Handed', zh: '单手' }, cat: h4 ? categoryIdFromH3(h4) : 'official' };
    }
    if (h3k === 'with feet') {
      return { tab: 'wf', tabName: { en: 'With Feet', zh: '脚解' }, cat: h4 ? categoryIdFromH3(h4) : 'official' };
    }
    if (h3k === 'blindfolded') {
      return { tab: 'bld', tabName: { en: 'Blindfolded', zh: '盲拧' }, cat: h4 ? categoryIdFromH3(h4) : 'official' };
    }
    if (h3k === 'fewest moves') {
      return { tab: 'fm', tabName: { en: 'Fewest Moves', zh: '最少步' }, cat: h4 ? categoryIdFromH3(h4) : 'official' };
    }
    // Standard tab: cat from H3 if present, else from H4
    if (h3) return { tab: 'standard', tabName: { en: 'Standard', zh: '标准' }, cat: categoryIdFromH3(h3) };
    if (h4) return { tab: 'standard', tabName: { en: 'Standard', zh: '标准' }, cat: categoryIdFromH3(h4) };
    return { tab: 'standard', tabName: { en: 'Standard', zh: '标准' }, cat: 'other' };
  }
  return { tab: 'other', tabName: { en: 'Other', zh: '其他' }, cat: 'other' };
}

function organize(raw: RawRecord[]): WbTab[] {
  const tabMap = new Map<WbTabId, {
    name: WbBilingual;
    cats: Map<string, { name: WbBilingual; events: Map<string, WbRecord[]> }>;
  }>();

  for (const r of raw) {
    const { tab, tabName, cat } = determineTabCat(r.tabH2, r.catH3, r.parentH4);

    if (!tabMap.has(tab)) tabMap.set(tab, { name: tabName, cats: new Map() });
    const tabBucket = tabMap.get(tab)!;
    if (!tabBucket.cats.has(cat)) {
      tabBucket.cats.set(cat, {
        name: CATEGORY_LABELS[cat] ?? CATEGORY_LABELS.other,
        events: new Map(),
      });
    }
    const catBucket = tabBucket.cats.get(cat)!;
    if (!catBucket.events.has(r.eventName)) catBucket.events.set(r.eventName, []);
    catBucket.events.get(r.eventName)!.push(r.rec);
  }

  const tabOrder: WbTabId[] = ['standard', 'oh', 'wf', 'bld', 'fm', 'virtual', 'team', 'other'];
  const catOrder: string[] = ['official', 'bigcubes', 'relays', 'minxes', 'methods', 'cuboids', 'subsets', 'sliding', 'circle', 'mods', 'sized', 'solution', 'timeAttack', 'multibld', 'highdim', 'other'];

  return tabOrder.filter(id => tabMap.has(id)).map(id => {
    const t = tabMap.get(id)!;
    const cats = catOrder.filter(c => t.cats.has(c)).map(c => {
      const cb = t.cats.get(c)!;
      const events = [...cb.events.entries()].map(([name, records]) => ({
        id: slugify(name),
        name,
        records,
      }));
      return { id: c, name: cb.name, events };
    });
    return { id, name: t.name, categories: cats };
  });
}

// ── main ──

async function main() {
  console.log(`Fetching ${SOURCE_URL}…`);
  // NOTE: Cloudflare on speedsolving.com checks UA + browser-fingerprint headers (sec-ch-ua, sec-fetch-*).
  //       Full Chrome header set passes from residential IPs; on datacenter IPs (CI runners) CF may still
  //       block via IP reputation regardless. On failure we dump cf-ray + body snippet to confirm cause.
  const res = await fetch(SOURCE_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br, zstd',
      'Cache-Control': 'max-age=0',
      'Sec-Ch-Ua': '"Chromium";v="131", "Google Chrome";v="131", "Not_A Brand";v="24"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"Windows"',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1',
    },
  });
  if (!res.ok) {
    const cfRay = res.headers.get('cf-ray');
    const server = res.headers.get('server');
    const body = await res.text().catch(() => '');
    console.error(`HTTP ${res.status} | server=${server} | cf-ray=${cfRay}`);
    console.error(`Body (first 500 chars): ${body.slice(0, 500)}`);
    throw new Error(`HTTP ${res.status}`);
  }
  const html = await res.text();
  console.log(`Fetched ${html.length} bytes`);

  const $ = cheerio.load(html);
  const raw = walk($);
  console.log(`Total record rows: ${raw.length}`);

  const unmapped = new Set<string>();
  for (const r of raw) if (r.rec.country && !r.rec.iso2) unmapped.add(r.rec.country);
  if (unmapped.size > 0) {
    const sample = [...unmapped].slice(0, 30);
    console.warn(`Unmapped countries (${unmapped.size}). First 30: ${sample.join(', ')}`);
  }

  const tabs = organize(raw);
  const dataset: WbDataset = {
    scrapedAt: new Date().toISOString(),
    sourceUrl: SOURCE_URL,
    tabs,
  };

  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, JSON.stringify(dataset, null, 2));
  console.log(`Wrote ${OUT_PATH}`);
  const totalEvents = tabs.reduce((s, t) => s + t.categories.reduce((s2, c) => s2 + c.events.length, 0), 0);
  const totalRecords = tabs.reduce((s, t) => s + t.categories.reduce((s2, c) => s2 + c.events.reduce((s3, e) => s3 + e.records.length, 0), 0), 0);
  console.log(`Tabs: ${tabs.length}, Categories: ${tabs.reduce((s, t) => s + t.categories.length, 0)}, Events: ${totalEvents}, Records: ${totalRecords}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
