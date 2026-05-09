/**
 * Multi-language scraper for bestsiteever.net/colpi.
 *
 * Each language is gated behind a session cookie: GET /api/setlang.php?lang_id=N
 * sets `colpi_lang=N`, and subsequent POST /api/lpiquery.php returns words for
 * THAT language only. We iterate 41 languages × 729 pairs ≈ 30k requests.
 *
 * Output: one NDJSON file (`words_multilang.ndjson`), one record per word:
 *   {"pair":"AA","word":"AA BATTERY","category":"object","language":"en","offensive":false}
 *
 * Usage: node scripts/fetch_colpi_words_multilang.mjs [--only=en,zh,...] [--out=path]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SETLANG = 'https://bestsiteever.net/colpi/api/setlang.php?lang_id=';
const ENDPOINT = 'https://bestsiteever.net/colpi/api/lpiquery.php';
const CONCURRENCY = 20;
const RETRIES = 2;

// lang_id → ISO code, scraped from the upstream language dialog HTML.
// Order roughly = display order on bestsiteever.net.
const LANGS = [
  { id: 33, code: 'af' }, { id: 30, code: 'ar' }, { id: 39, code: 'bg' },
  { id: 35, code: 'ca' }, { id: 11, code: 'cz' }, { id: 21, code: 'da' },
  { id:  6, code: 'de' }, { id:  2, code: 'en' }, { id:  5, code: 'es' },
  { id: 40, code: 'eu' }, { id: 43, code: 'fa' }, { id: 42, code: 'fi' },
  { id:  8, code: 'fr' }, { id: 16, code: 'gu' }, { id: 34, code: 'he' },
  { id: 15, code: 'hi' }, { id: 37, code: 'hr' }, { id: 22, code: 'hu' },
  { id: 12, code: 'id' }, { id:  9, code: 'it' }, { id: 31, code: 'ja' },
  { id: 38, code: 'kr' }, { id: 13, code: 'lt' }, { id: 26, code: 'mk' },
  { id: 14, code: 'ms' }, { id: 10, code: 'nl' }, { id: 18, code: 'no' },
  { id:  4, code: 'pl' }, { id:  7, code: 'pt' }, { id: 41, code: 'ro' },
  { id:  1, code: 'ru' }, { id: 24, code: 'se' }, { id: 28, code: 'sk' },
  { id: 27, code: 'sl' }, { id: 20, code: 'th' }, { id: 17, code: 'tr' },
  { id: 29, code: 'uk' }, { id: 32, code: 'uz' }, { id: 23, code: 'vi' },
  { id: 19, code: 'zh' }, { id: 36, code: 'zu' },
];

const ALPHABET = [
  'A','B','C','D','E','F','G','H','I','J','K','L','M',
  'N','O','P','Q','R','S','T','U','V','W','X','Y','Z',
  'ʧ',
];

const PAO_MAP = {
  '0': 'unspecified', '1': 'object', '2': 'person',
  '3': 'action', '4': 'place', '5': 'other',
};

function decodeEntities(s) {
  return s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&#039;/g, "'").replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ').replace(/&apos;/g, "'");
}

function parseResponse(html) {
  const rowRe = /<tr id='votetr\d+'>([\s\S]*?)<\/tr>/g;
  const out = [];
  let m;
  while ((m = rowRe.exec(html)) !== null) {
    const row = m[1];
    const paoMatch = row.match(/pao\/(\d+)\.png/);
    const cat = paoMatch ? (PAO_MAP[paoMatch[1]] ?? 'unspecified') : 'unspecified';
    const wlMatch = row.match(/<td class='(wlWord(?: wlOffensive)?)'>([\s\S]*?)<\/td>/);
    if (!wlMatch) continue;
    const offensive = wlMatch[1].includes('wlOffensive');
    let inner = wlMatch[2];
    inner = inner.replace(/<img[^>]*>/g, '').replace(/<\/?span[^>]*>/g, '');
    inner = decodeEntities(inner).trim();
    if (inner) out.push({ word: inner, category: cat, offensive });
  }
  return out;
}

async function getLangCookie(langId) {
  const res = await fetch(SETLANG + langId, { redirect: 'manual' });
  // Server returns 302 + Set-Cookie: colpi_lang=N; PHPSESSID=...
  const sc = res.headers.get('set-cookie') || '';
  const cookies = sc.split(/,(?=\s*\w+=)/).map(c => c.split(';')[0].trim()).join('; ');
  if (!cookies.includes('colpi_lang=')) {
    throw new Error(`setlang ${langId}: no colpi_lang cookie`);
  }
  return cookies;
}

async function fetchPairOnce(lp, cookie) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', cookie },
    body: `lp=${encodeURIComponent(lp)}&includeSmForm=1`,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return parseResponse(await res.text());
}

async function fetchPair(lp, cookie) {
  let lastErr;
  for (let i = 0; i <= RETRIES; i++) {
    try { return await fetchPairOnce(lp, cookie); }
    catch (e) {
      lastErr = e;
      await new Promise(r => setTimeout(r, 250 * (i + 1)));
    }
  }
  throw lastErr;
}

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

function parseArgs() {
  const out = { only: null, outFile: null };
  for (const a of process.argv.slice(2)) {
    if (a.startsWith('--only=')) out.only = a.slice(7).split(',').map(s => s.trim());
    else if (a.startsWith('--out=')) out.outFile = a.slice(6);
  }
  return out;
}

async function main() {
  const args = parseArgs();
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const outFile = args.outFile || path.join(__dirname, 'words_multilang.ndjson');
  fs.writeFileSync(outFile, ''); // truncate

  const langs = args.only
    ? LANGS.filter(l => args.only.includes(l.code))
    : LANGS;

  const pairs = [];
  for (const a of ALPHABET) for (const b of ALPHABET) pairs.push(a + b);

  const overallStart = Date.now();
  const grandStats = {};

  for (const { id, code } of langs) {
    const tLang = Date.now();
    let cookie;
    try { cookie = await getLangCookie(id); }
    catch (e) {
      console.error(`[${code}] cookie failed: ${e.message}`);
      continue;
    }

    let pairsHit = 0, words = 0;
    const failures = [];
    const buf = [];

    await runPool(pairs, async (lp) => {
      try {
        const rows = await fetchPair(lp, cookie);
        if (rows.length > 0) {
          pairsHit++;
          for (const r of rows) {
            buf.push(JSON.stringify({
              pair: lp, word: r.word, category: r.category,
              language: code, offensive: r.offensive,
            }));
            words++;
          }
        }
      } catch (e) {
        failures.push([lp, String(e?.message ?? e)]);
      }
    }, CONCURRENCY);

    if (buf.length > 0) {
      fs.appendFileSync(outFile, buf.join('\n') + '\n');
    }
    const dt = ((Date.now() - tLang) / 1000).toFixed(1);
    const totalDt = ((Date.now() - overallStart) / 60000).toFixed(1);
    console.log(`[${code}] ${pairsHit} pairs / ${words} words / ${dt}s  (cumulative ${totalDt}m)`);
    if (failures.length > 0) console.warn(`  ${failures.length} failures (showing 3): ${failures.slice(0, 3).map(([p, e]) => `${p}:${e}`).join(', ')}`);
    grandStats[code] = { pairsHit, words, failures: failures.length };
  }

  const totalDt = ((Date.now() - overallStart) / 60000).toFixed(1);
  const totalWords = Object.values(grandStats).reduce((s, x) => s + x.words, 0);
  console.log(`\n=== done in ${totalDt}m, ${totalWords} words → ${outFile} ===`);
  console.log(JSON.stringify(grandStats, null, 2));
}

main().catch(err => { console.error(err); process.exit(1); });
