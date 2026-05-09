/**
 * One-shot scraper for bestsiteever.net/colpi.
 *
 * The site has no bulk endpoint. The CSV download exposes only the top-1 word per
 * pair. To mirror the full crowdsourced list (categories + offensive flag) we POST
 * to /colpi/api/lpiquery.php once per pair (27 × 27 = 729 calls). Runs CONCURRENCY
 * requests in parallel (~30s total).
 *
 * Output: src/pages/memo/colpi/words.json
 *   { "BN": [{word, category, offensive?: true}, ...], ... }
 *
 * Usage: node scripts/fetch_colpi_words.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ENDPOINT = 'https://bestsiteever.net/colpi/api/lpiquery.php';
const CONCURRENCY = 12;
const RETRIES = 2;

const ALPHABET = [
  'A','B','C','D','E','F','G','H','I','J','K','L','M',
  'N','O','P','Q','R','S','T','U','V','W','X','Y','Z',
  'ʧ',
];

// Mapping observed on the site (paoIcon title attribute).
// 0=unspecified, 1=object, 2=person, 3=action, 4=place, 5=other.
// Unknown indices fall through to 'unspecified'.
const PAO_MAP = {
  '0': 'unspecified',
  '1': 'object',
  '2': 'person',
  '3': 'action',
  '4': 'place',
  '5': 'other',
};

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#039;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&apos;/g, "'");
}

function parseResponse(html) {
  // Each row: <tr id='votetr<ID>'>...<img id='paoForWord<ID>' src='img/icons/pao/<N>.png' ...
  //          ...<td class='wlWord [wlOffensive]'>...<span class='hl'>X</span>...word...<img ... flag.png ...></td>...
  const rowRe = /<tr id='votetr\d+'>([\s\S]*?)<\/tr>/g;
  const words = [];
  let m;
  while ((m = rowRe.exec(html)) !== null) {
    const row = m[1];
    const paoMatch = row.match(/pao\/(\d+)\.png/);
    const cat = paoMatch ? (PAO_MAP[paoMatch[1]] ?? 'unspecified') : 'unspecified';

    // wlOffensive marks community-flagged offensive entries (NSFW / slurs / etc.)
    const wlMatch = row.match(/<td class='(wlWord(?: wlOffensive)?)'>([\s\S]*?)<\/td>/);
    if (!wlMatch) continue;
    const offensive = wlMatch[1].includes('wlOffensive');
    let inner = wlMatch[2];
    inner = inner.replace(/<img[^>]*>/g, '');
    inner = inner.replace(/<\/?span[^>]*>/g, '');
    inner = decodeEntities(inner).trim();
    if (inner) {
      const entry = { word: inner, category: cat };
      if (offensive) entry.offensive = true;
      words.push(entry);
    }
  }
  return words;
}

async function fetchPairOnce(lp) {
  const body = `lp=${encodeURIComponent(lp)}&includeSmForm=1`;
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return parseResponse(await res.text());
}

async function fetchPair(lp) {
  let lastErr;
  for (let i = 0; i <= RETRIES; i++) {
    try { return await fetchPairOnce(lp); }
    catch (e) {
      lastErr = e;
      await new Promise(r => setTimeout(r, 200 * (i + 1)));
    }
  }
  throw lastErr;
}

/** Run async tasks with bounded concurrency. */
async function runPool(items, worker, concurrency) {
  let next = 0;
  async function loop() {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      await worker(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => loop()));
}

async function main() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const outFile = path.join(__dirname, '..', 'src', 'pages', 'memo', 'colpi', 'words.json');

  const pairs = [];
  for (const a of ALPHABET) for (const b of ALPHABET) pairs.push(a + b);
  const total = pairs.length;

  const out = {};
  let done = 0;
  let totalWords = 0;
  const failures = [];

  const t0 = Date.now();
  await runPool(pairs, async (lp) => {
    try {
      const words = await fetchPair(lp);
      if (words.length > 0) {
        out[lp] = words;
        totalWords += words.length;
      }
    } catch (e) {
      failures.push([lp, String(e?.message ?? e)]);
    }
    done++;
    if (done % 100 === 0 || done === total) {
      const dt = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(`[${done}/${total}] ${dt}s  ${Object.keys(out).length} pairs / ${totalWords} words`);
    }
  }, CONCURRENCY);

  if (failures.length > 0) {
    console.error(`Failures (${failures.length}):`);
    for (const [lp, err] of failures) console.error(`  ${lp}: ${err}`);
  }

  fs.writeFileSync(outFile, JSON.stringify(out));
  const sizeKb = (fs.statSync(outFile).size / 1024).toFixed(1);
  console.log(`Wrote ${Object.keys(out).length} pairs (${totalWords} words, ${sizeKb} KB) → ${outFile}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
