#!/usr/bin/env tsx
/**
 * One-shot scraper: speedcubedb.com → core/packages/shared/data/algdb_*.json
 *
 * Usage: pnpm --filter @cuberoot/scramble-stats-build run scrape:algdb
 *
 * Re-runnable. ~4 page fetches (~5MB), 200ms apart, no auth, no rate limiting.
 */
import * as cheerio from 'cheerio';
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SHARED_DATA_DIR = join(__dirname, '..', '..', 'shared', 'data');
const TMP_DIR = join(__dirname, '..', '..', '..', '..', '.tmp', 'scd');

interface AlgEntry {
  alg: string;
  altId?: string;
  ytId?: string;
}

interface CaseEntry {
  name: string;
  subgroup: string;
  setup: string;
  standard?: string;
  sticker:
    | { kind: 'f2l'; fl: string }
    | { kind: 'face'; us: string; ub: string; uf: string; ul: string; ur: string };
  /** F2L: 4 orientations (FR/FL/BL/BR). OLL/PLL: single orientation. */
  algs: AlgEntry[][];
  /** F2L only — names of each orientation tab (Front Right, etc.) */
  oriNames?: string[];
}

interface AlgDb {
  scrapedAt: string;
  source: string;
  category: string;
  cases: CaseEntry[];
}

const URLS = {
  f2l:     'https://speedcubedb.com/a/3x3/F2L',
  adv_f2l: 'https://speedcubedb.com/a/3x3/AdvancedF2L',
  oll:     'https://speedcubedb.com/a/3x3/OLL',
  pll:     'https://speedcubedb.com/a/3x3/PLL',
} as const;
type Cat = keyof typeof URLS;

async function fetchHtmlCached(category: Cat): Promise<string> {
  const cachePath = join(TMP_DIR, `${category}.html`);
  if (existsSync(cachePath) && process.env.NO_CACHE !== '1') {
    return readFileSync(cachePath, 'utf-8');
  }
  const url = URLS[category];
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (CubeRoot algdb scraper)' },
  });
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  const html = await res.text();
  mkdirSync(TMP_DIR, { recursive: true });
  writeFileSync(cachePath, html);
  return html;
}

function cleanWs(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

function extractCase($: cheerio.CheerioAPI, row: cheerio.AnyNode, kind: 'f2l' | 'face'): CaseEntry {
  const $row = $(row);
  const name = $row.attr('data-alg') ?? '';
  const subgroup = $row.attr('data-subgroup') ?? '';

  // setup: text inside .setup-case, stripped of "setup:" prefix
  const setupRaw = cleanWs($row.find('.setup-case').first().text());
  const setup = setupRaw.replace(/^setup:\s*/i, '').trim();

  // OLL/PLL only — Standard Alg
  let standard: string | undefined;
  const $std = $row.find('.scdb-panel').first();
  if ($std.length > 0) {
    const stdRaw = cleanWs($std.text());
    standard = stdRaw.replace(/^Standard Alg:\s*/i, '').trim();
    if (!standard) standard = undefined;
  }

  // sticker preview
  let sticker: CaseEntry['sticker'];
  if (kind === 'f2l') {
    // Two .icube divs may exist (the linked alg-name icon + the larger preview).
    // The bigger preview is in the algorithm card, has data-rank set; both have data-fl.
    const fl = $row.find('.icube').first().attr('data-fl') ?? '';
    sticker = { kind: 'f2l', fl };
  } else {
    const $j = $row.find('.jcube').first();
    sticker = {
      kind: 'face',
      us: $j.attr('data-us') ?? '',
      ub: $j.attr('data-ub') ?? '',
      uf: $j.attr('data-uf') ?? '',
      ul: $j.attr('data-ul') ?? '',
      ur: $j.attr('data-ur') ?? '',
    };
  }

  // algs grouped by orientation. Use `div[data-ori]` (avoid the <a data-ori> tab links).
  const algs: AlgEntry[][] = [];
  const oriNames: string[] = [];
  const $oris = $row.find('div[data-ori]');
  if ($oris.length === 0) {
    algs.push([]);
  } else {
    $oris.each((_, ori) => {
      const $ori = $(ori);
      const list: AlgEntry[] = [];
      $ori.find('.formatted-alg').each((__, el) => {
        const $el = $(el);
        const alg = cleanWs($el.text());
        if (!alg) return;
        // altid lives on the bookmark/learnt action divs in the same <li>
        const $li = $el.closest('li');
        const altId = $li.find('[data-altid]').first().attr('data-altid');
        // Find the alg-details panel for this altid (same row scope)
        let ytId: string | undefined;
        if (altId) {
          const $details = $row.find(`#alg-${altId}`);
          const ytSrc = $details.find('img.youtubefingertricksvideo').attr('data-src')
            ?? $details.find('img.youtubefingertricksvideo').attr('src')
            ?? '';
          const m = ytSrc.match(/\/vi\/([^/]+)\//);
          if (m) ytId = m[1];
        }
        list.push({ alg, altId, ytId });
      });
      algs.push(list);
    });
    // Capture orientation tab names (F2L only — OLL/PLL just has one orientation)
    $row.find('.tabs-orientation a[data-ori] .subcatname').each((_, el) => {
      oriNames.push($(el).text().trim());
    });
  }

  const result: CaseEntry = { name, subgroup, setup, sticker, algs };
  if (standard) result.standard = standard;
  if (oriNames.length > 0) result.oriNames = oriNames;
  return result;
}

async function scrape(category: Cat): Promise<AlgDb> {
  const url = URLS[category];
  const html = await fetchHtmlCached(category);
  const $ = cheerio.load(html);
  const kind = (category === 'f2l' || category === 'adv_f2l') ? 'f2l' : 'face';
  const cases: CaseEntry[] = [];
  $('.singlealgorithm').each((_, row) => {
    cases.push(extractCase($, row, kind));
  });
  return {
    scrapedAt: new Date().toISOString(),
    source: url,
    category,
    cases,
  };
}

async function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  mkdirSync(SHARED_DATA_DIR, { recursive: true });
  for (const cat of Object.keys(URLS) as Cat[]) {
    console.log(`scraping ${cat}…`);
    const db = await scrape(cat);
    const out = join(SHARED_DATA_DIR, `algdb_${cat}.json`);
    writeFileSync(out, JSON.stringify(db, null, 2));
    const totalAlgs = db.cases.reduce((sum, c) => sum + c.algs.flat().length, 0);
    console.log(`  → ${out} (${db.cases.length} cases, ${totalAlgs} algs)`);
    await sleep(200);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
