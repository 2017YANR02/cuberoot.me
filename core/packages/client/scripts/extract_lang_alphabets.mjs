/**
 * For each upstream lang, fetch / and extract the unique chars used in the
 * letter-pair grid (`showLp("XX")` calls). Output:
 *   colpi_alphabets.json: { "ja": ["あ","い",...], "en": ["A","B",..., "ʧ"], ... }
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SETLANG = 'https://bestsiteever.net/colpi/api/setlang.php?lang_id=';
const PAGE    = 'https://bestsiteever.net/colpi/';

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

async function getCookie(langId) {
  const res = await fetch(SETLANG + langId, { redirect: 'manual' });
  const sc = res.headers.get('set-cookie') || '';
  return sc.split(/,(?=\s*\w+=)/).map(c => c.split(';')[0].trim()).join('; ');
}

async function getAlphabet(cookie) {
  const res = await fetch(PAGE, { headers: { cookie } });
  const html = await res.text();
  // showLp("ああ") — pair string between quotes.
  const re = /showLp\("([^"]+)"/g;
  const pairs = new Set();
  let m;
  while ((m = re.exec(html)) !== null) pairs.add(m[1]);

  // Compose alphabet preserving first-occurrence order (rows pass) then
  // filling in any chars that only appear as a 2nd char.
  const seenRow = [];
  const seenAny = new Set();
  for (const p of pairs) {
    const chars = [...p];
    if (chars.length !== 2) continue;
    if (!seenAny.has(chars[0])) { seenRow.push(chars[0]); seenAny.add(chars[0]); }
  }
  // Append any 2nd-char-only chars (rare, keeps grid square).
  for (const p of pairs) {
    const chars = [...p];
    if (chars.length !== 2) continue;
    if (!seenAny.has(chars[1])) { seenRow.push(chars[1]); seenAny.add(chars[1]); }
  }
  return { alphabet: seenRow, totalPairs: pairs.size };
}

async function main() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const outFile = path.join(__dirname, '..', '..', '..', '..', '.tmp', 'colpi_alphabets.json');

  const out = {};
  for (const { id, code } of LANGS) {
    try {
      const cookie = await getCookie(id);
      const { alphabet, totalPairs } = await getAlphabet(cookie);
      out[code] = alphabet;
      console.log(`[${code}] ${alphabet.length} chars / ${totalPairs} pairs : ${alphabet.slice(0, 12).join(' ')}${alphabet.length > 12 ? ' …' : ''}`);
    } catch (e) {
      console.error(`[${code}] failed: ${e.message}`);
      out[code] = [];
    }
  }
  fs.writeFileSync(outFile, JSON.stringify(out, null, 2));
  console.log(`\nWrote ${outFile}`);
}

main().catch(err => { console.error(err); process.exit(1); });
