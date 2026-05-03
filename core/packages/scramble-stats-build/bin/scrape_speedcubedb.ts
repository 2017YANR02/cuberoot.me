#!/usr/bin/env tsx
/**
 * Scraper: speedcubedb.com → core/packages/shared/data/algdb_<puzzle>_<slug>.json
 *
 * Usage:
 *   pnpm --filter @cuberoot/scramble-stats-build run scrape:algdb                 # all sets
 *   pnpm --filter @cuberoot/scramble-stats-build run scrape:algdb -- --puzzle 3x3 # all 3x3 sets
 *   pnpm --filter @cuberoot/scramble-stats-build run scrape:algdb -- --puzzle 2x2 --set cll
 *   NO_CACHE=1 ... force re-fetch
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

/** Generic sticker hint extracted from the case row's preview cube element. */
type Sticker =
  | { kind: 'f2l'; fl: string }
  | { kind: 'face'; us: string; ub: string; uf: string; ul: string; ur: string }
  /** Catch-all for puzzle-specific previews — keeps every data-* attr on the preview node. */
  | { kind: 'raw'; tag: string; attrs: Record<string, string> };

interface CaseEntry {
  name: string;
  subgroup: string;
  setup: string;
  standard?: string;
  sticker: Sticker;
  /** F2L: 4 orientations (FR/FL/BL/BR). Most others: single. */
  algs: AlgEntry[][];
  oriNames?: string[];
}

interface AlgDb {
  scrapedAt: string;
  source: string;
  puzzle: string;
  set: string;
  cases: CaseEntry[];
}

/**
 * Set definition. `scd` is either:
 *   - string: single-page set (scrape one URL)
 *   - { umbrella: true, parent }: umbrella set whose index page links to per-subgroup
 *     pages (e.g. ZBLL → ZBLLU/ZBLLL/.../ZBLLAS). Discovered at scrape time.
 */
type SetDef = {
  puzzle: string;
  outSlug: string;
  scd: string | { umbrella: true; parent: string };
};

const SETS: SetDef[] = [
  // 3x3 — existing 4 (re-scrape under new filenames)
  { puzzle: '3x3', outSlug: 'f2l',       scd: 'F2L' },
  { puzzle: '3x3', outSlug: 'adv-f2l',   scd: 'AdvancedF2L' },
  { puzzle: '3x3', outSlug: 'oll',       scd: 'OLL' },
  { puzzle: '3x3', outSlug: 'pll',       scd: 'PLL' },
  // 3x3 — 14 new
  { puzzle: '3x3', outSlug: 'coll',      scd: 'COLL' },
  { puzzle: '3x3', outSlug: 'wv',        scd: 'WV' },
  { puzzle: '3x3', outSlug: 'cmll',      scd: 'CMLL' },
  { puzzle: '3x3', outSlug: 'sbls',      scd: 'SBLS' },
  { puzzle: '3x3', outSlug: 'eo4a',      scd: 'EO4A' },
  { puzzle: '3x3', outSlug: 'anti-pll',  scd: 'AntiPLL' },
  { puzzle: '3x3', outSlug: 'sv',        scd: 'SV' },
  { puzzle: '3x3', outSlug: 'ell',       scd: 'ELL' },
  { puzzle: '3x3', outSlug: 'fruf',      scd: 'FRUF' },
  { puzzle: '3x3', outSlug: 'cls',       scd: 'CLS' },
  { puzzle: '3x3', outSlug: '1lll',      scd: { umbrella: true, parent: '1LLL' } },
  { puzzle: '3x3', outSlug: 'ollcp',     scd: { umbrella: true, parent: 'OLLCP' } },
  { puzzle: '3x3', outSlug: 'vls',       scd: { umbrella: true, parent: 'VLS' } },
  { puzzle: '3x3', outSlug: 'zbll',      scd: { umbrella: true, parent: 'ZBLL' } },
  // 2x2
  { puzzle: '2x2', outSlug: 'ortega-oll', scd: 'OrtegaOLL' },
  { puzzle: '2x2', outSlug: 'ortega-pbl', scd: 'OrtegaPBL' },
  { puzzle: '2x2', outSlug: 'cll',        scd: 'CLL' },
  { puzzle: '2x2', outSlug: 'eg1',        scd: 'EG1' },
  { puzzle: '2x2', outSlug: 'eg2',        scd: 'EG2' },
  // 4x4
  { puzzle: '4x4', outSlug: 'oll-parity', scd: 'OLLParity' },
  { puzzle: '4x4', outSlug: 'pll-parity', scd: 'PLLParity' },
  // 5x5
  { puzzle: '5x5', outSlug: 'l2e', scd: 'L2E' },
  { puzzle: '5x5', outSlug: 'l2c', scd: 'L2C' },
];

function urlFor(puzzle: string, scdSlug: string): string {
  return `https://speedcubedb.com/a/${puzzle}/${scdSlug}`;
}

async function fetchHtmlCached(puzzle: string, outSlug: string, scdSlug: string): Promise<string> {
  const cachePath = join(TMP_DIR, `${puzzle}_${outSlug}.html`);
  if (existsSync(cachePath) && process.env.NO_CACHE !== '1') {
    return readFileSync(cachePath, 'utf-8');
  }
  const url = urlFor(puzzle, scdSlug);
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

function extractSticker($: cheerio.CheerioAPI, $row: cheerio.Cheerio<cheerio.Element>): Sticker {
  // Prefer .icube (F2L style: data-fl).
  const $i = $row.find('.icube').first();
  if ($i.length > 0 && $i.attr('data-fl')) {
    return { kind: 'f2l', fl: $i.attr('data-fl') ?? '' };
  }
  // .jcube (face style: data-us/ub/uf/ul/ur).
  const $j = $row.find('.jcube').first();
  if ($j.length > 0 && ($j.attr('data-us') || $j.attr('data-uf'))) {
    return {
      kind: 'face',
      us: $j.attr('data-us') ?? '',
      ub: $j.attr('data-ub') ?? '',
      uf: $j.attr('data-uf') ?? '',
      ul: $j.attr('data-ul') ?? '',
      ur: $j.attr('data-ur') ?? '',
    };
  }
  // Fallback: dump every data-* attr on the first cube-ish preview node.
  const candidates = ['.icube', '.jcube', '.kcube', '.lcube', '.mcube', '.cube', '.preview'];
  for (const sel of candidates) {
    const $el = $row.find(sel).first();
    if ($el.length === 0) continue;
    const node = $el[0];
    if (node.type !== 'tag') continue;
    const attrs: Record<string, string> = {};
    for (const [k, v] of Object.entries(node.attribs ?? {})) {
      if (k.startsWith('data-')) attrs[k] = v;
    }
    return { kind: 'raw', tag: node.name, attrs };
  }
  return { kind: 'raw', tag: '', attrs: {} };
}

function extractCase($: cheerio.CheerioAPI, row: cheerio.Element): CaseEntry {
  const $row = $(row);
  const name = $row.attr('data-alg') ?? '';
  const subgroup = $row.attr('data-subgroup') ?? '';

  const setupRaw = cleanWs($row.find('.setup-case').first().text());
  const setup = setupRaw.replace(/^setup:\s*/i, '').trim();

  let standard: string | undefined;
  const $std = $row.find('.scdb-panel').first();
  if ($std.length > 0) {
    const stdRaw = cleanWs($std.text());
    standard = stdRaw.replace(/^Standard Alg:\s*/i, '').trim();
    if (!standard) standard = undefined;
  }

  const sticker = extractSticker($, $row);

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
        const $li = $el.closest('li');
        const altId = $li.find('[data-altid]').first().attr('data-altid');
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
    $row.find('.tabs-orientation a[data-ori] .subcatname').each((_, el) => {
      oriNames.push($(el).text().trim());
    });
  }

  // Drop empty orientation slots that came from unrelated `[data-ori]` nodes.
  const algsClean = algs.some(g => g.length > 0) ? algs.filter((g, i) => g.length > 0 || (oriNames[i] != null)) : algs;

  const result: CaseEntry = { name, subgroup, setup, sticker, algs: algsClean };
  if (standard) result.standard = standard;
  if (oriNames.length > 0) result.oriNames = oriNames;
  return result;
}

function scrapeCases(html: string): CaseEntry[] {
  const $ = cheerio.load(html);
  const cases: CaseEntry[] = [];
  $('.singlealgorithm').each((_, row) => {
    cases.push(extractCase($, row));
  });
  return cases;
}

/** Pull every subset slug linked from an umbrella index page. e.g. ZBLL → [ZBLLU, ZBLLL, ...]. */
function discoverSubsets(html: string, puzzle: string, parent: string): string[] {
  const $ = cheerio.load(html);
  const subs = new Set<string>();
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    // Both relative ("a/3x3/ZBLLU") and absolute paths can occur.
    const m = href.match(new RegExp(`(?:^|/)a/${puzzle}/([^/?#]+)`));
    if (!m) return;
    const slug = m[1];
    if (slug === parent) return;
    if (!slug.startsWith(parent)) return;
    subs.add(slug);
  });
  return [...subs];
}

async function scrapeOne(def: SetDef): Promise<AlgDb> {
  const { puzzle, outSlug, scd } = def;

  // Single-page set
  if (typeof scd === 'string') {
    const html = await fetchHtmlCached(puzzle, outSlug, scd);
    return {
      scrapedAt: new Date().toISOString(),
      source: urlFor(puzzle, scd),
      puzzle,
      set: outSlug,
      cases: scrapeCases(html),
    };
  }

  // Umbrella set: discover subsets, scrape each, merge.
  const indexHtml = await fetchHtmlCached(puzzle, `${outSlug}__index`, scd.parent);
  const subsets = discoverSubsets(indexHtml, puzzle, scd.parent);
  if (subsets.length === 0) {
    throw new Error(`umbrella ${scd.parent}: no subsets discovered (page changed?)`);
  }
  console.log(`  ${scd.parent} → ${subsets.length} subsets: ${subsets.join(', ')}`);
  const allCases: CaseEntry[] = [];
  for (const sub of subsets) {
    const subHtml = await fetchHtmlCached(puzzle, `${outSlug}__${sub}`, sub);
    const subLabel = sub.slice(scd.parent.length); // ZBLLU → "U"
    for (const c of scrapeCases(subHtml)) {
      // Tag with parent subgroup label so all cases of one umbrella share `subgroup`.
      // Preserve any existing data-subgroup as a sub-subgroup if non-empty and different.
      const orig = c.subgroup?.trim() ?? '';
      c.subgroup = orig && orig !== subLabel ? `${subLabel}/${orig}` : subLabel;
      allCases.push(c);
    }
    await sleep(150);
  }
  return {
    scrapedAt: new Date().toISOString(),
    source: urlFor(puzzle, scd.parent),
    puzzle,
    set: outSlug,
    cases: allCases,
  };
}

async function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

function parseArgs(): { puzzle?: string; set?: string } {
  const out: { puzzle?: string; set?: string } = {};
  for (let i = 2; i < process.argv.length; i++) {
    const a = process.argv[i];
    if (a === '--puzzle') out.puzzle = process.argv[++i];
    else if (a === '--set') out.set = process.argv[++i];
  }
  return out;
}

async function main() {
  const { puzzle, set } = parseArgs();
  const filtered = SETS.filter(d =>
    (puzzle == null || d.puzzle === puzzle) && (set == null || d.outSlug === set)
  );
  if (filtered.length === 0) {
    console.error(`No sets matched (puzzle=${puzzle ?? '*'}, set=${set ?? '*'}).`);
    process.exit(1);
  }
  mkdirSync(SHARED_DATA_DIR, { recursive: true });
  for (const def of filtered) {
    const { puzzle: p, outSlug, scd } = def;
    try {
      const tag = typeof scd === 'string' ? scd : `${scd.parent} (umbrella)`;
      console.log(`scraping ${p}/${outSlug} (speedcubedb ${tag})…`);
      const db = await scrapeOne(def);
      const out = join(SHARED_DATA_DIR, `algdb_${p}_${outSlug}.json`);
      writeFileSync(out, JSON.stringify(db, null, 2));
      const totalAlgs = db.cases.reduce((sum, c) => sum + c.algs.flat().length, 0);
      const stickerKinds = new Set(db.cases.map(c => c.sticker.kind));
      console.log(`  → ${out} (${db.cases.length} cases, ${totalAlgs} algs, sticker=${[...stickerKinds].join('/')})`);
    } catch (err) {
      console.error(`  ! FAILED ${p}/${outSlug}: ${(err as Error).message}`);
    }
    await sleep(200);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
