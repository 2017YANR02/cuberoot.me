// 生成全球比赛城市/行政区 → 简体中文 字典(lib/data/place-zh.ts),按 WCA 比赛城市裁剪。
// key = `${ISO2}:${norm(segment)}`(norm=去音标+小写+去非字母数字)。仅 CN 大陆跳过(走 cn-region)。
// 来源 = GeoNames alternateNames(zh,OpenCC t2s 转简)按比赛坐标反查城市 + LLM 兜底无 exonym 的长尾。
//
// 重新生成(两步,都在 core/packages/client 下跑,为 opencc-js 解析):
//   1. 下载 GeoNames 输入到 D:/cube/cuberoot.me/.tmp/geonames/(仓库外,gitignored):
//        curl -O https://download.geonames.org/export/dump/cities500.zip      && unzip cities500.zip
//        curl -O https://download.geonames.org/export/dump/admin1CodesASCII.txt
//        curl -O https://download.geonames.org/export/dump/alternateNamesV2.zip
//        unzip -p alternateNamesV2.zip alternateNamesV2.txt | \
//          awk -F'\t' 'tolower($3) ~ /^zh/ {print $2"\t"$3"\t"$4"\t"$5}' > zh-altnames.tsv
//   2. node scripts/gen-place-zh.mjs      # GeoNames → place-geo.json(cityZh + 待译任务清单)
//      node scripts/merge-place-zh.mjs    # + scripts/place-tail-zh.json(LLM 兜底层)→ lib/data/place-zh.ts
//   新城市没译名时:gen 报 LLM 任务、merge 报 missing → 往 place-tail-zh.json 补译再 merge。
//   CI 守卫:tests/city-localize-cn-coverage.test.ts(每个 upcoming 城市中文下必含 CJK)。
import fs from 'node:fs';
import readline from 'node:readline';
import * as OpenCC from 'opencc-js';

const GN = 'D:/cube/cuberoot.me/.tmp/geonames';
const ROOT = 'D:/cube/cuberoot.me';
const t2s = OpenCC.Converter({ from: 't', to: 'cn' });

const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
const hav = (a, b, c, d) => {
  const R = 6371, p = Math.PI / 180;
  const dLat = (c - a) * p, dLng = (d - b) * p;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a * p) * Math.cos(c * p) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(x)));
};

// lang → {score, group}. group: simp=explicit simplified, zh=generic (usually mainland), trad=needs OpenCC + review
const LANG = {
  'zh-hans': { s: 6, g: 'simp' }, 'zh-cn': { s: 6, g: 'simp' }, 'zh-sg': { s: 5, g: 'simp' }, 'zh-my': { s: 5, g: 'simp' },
  'zh': { s: 4, g: 'zh' },
  'zh-hant': { s: 2, g: 'trad' }, 'zh-tw': { s: 2, g: 'trad' }, 'zh-hk': { s: 1, g: 'trad' }, 'zh-mo': { s: 1, g: 'trad' },
};

// ── 1. best zh per geonameid ───────────────────────────────────────────
const zhById = new Map(); // id -> {name, score, group}
{
  const rl = readline.createInterface({ input: fs.createReadStream(`${GN}/zh-altnames.tsv`) });
  for await (const line of rl) {
    const [id, lang, name, pref] = line.split('\t');
    const L = LANG[(lang || '').toLowerCase()];
    if (!L || !name || !/[一-鿿㐀-䶿]/.test(name)) continue; // skip latin/pinyin rows mistagged zh
    const score = L.s + (pref === '1' ? 10 : 0);
    const cur = zhById.get(id);
    if (!cur || score > cur.score) zhById.set(id, { name, score, group: L.g });
  }
}
const zhOf = (id) => { // {name: simplified (always t2s, repairs leaked 內/薩/華), group} | null
  const e = zhById.get(id);
  if (!e) return null;
  return { name: t2s(e.name), group: e.group };
};
console.error(`zh names: ${zhById.size} geonameids`);

// ── 2. admin1: cc -> [{names:Set, zhId}] ───────────────────────────────
const admin1ByCc = new Map();
const admin1ByCode = new Map();
for (const line of fs.readFileSync(`${GN}/admin1CodesASCII.txt`, 'utf8').split('\n')) {
  if (!line.trim()) continue;
  const [code, name, ascii, id] = line.split('\t');
  const cc = code.split('.')[0];
  const rec = { names: new Set([norm(name), norm(ascii || name)]), id, code };
  (admin1ByCc.get(cc) || admin1ByCc.set(cc, []).get(cc)).push(rec);
  admin1ByCode.set(code, rec);
}
console.error(`admin1: ${admin1ByCode.size}`);

// ── 3. cities500 grid (feature_class P) ────────────────────────────────
const grid = new Map();
const cellKey = (lat, lng) => `${Math.floor(lat)},${Math.floor(lng)}`;
let cityCount = 0;
{
  const rl = readline.createInterface({ input: fs.createReadStream(`${GN}/cities500.txt`) });
  for await (const line of rl) {
    const f = line.split('\t');
    if (f[6] !== 'P') continue;
    const lat = +f[4], lng = +f[5];
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const names = new Set([norm(f[1]), norm(f[2])]);
    if (f[3]) for (const a of f[3].split(',')) { const n = norm(a); if (n) names.add(n); }
    const c = { id: f[0], lat, lng, cc: f[8], a1: f[10], pop: +f[14] || 0, names };
    const k = cellKey(lat, lng);
    (grid.get(k) || grid.set(k, []).get(k)).push(c);
    cityCount++;
  }
}
console.error(`cities500 (P): ${cityCount}`);
const nearby = (lat, lng) => {
  const fa = Math.floor(lat), fb = Math.floor(lng), out = [];
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { const a = grid.get(`${fa + i},${fb + j}`); if (a) out.push(...a); }
  return out;
};

// ── 4. unique WCA cities ───────────────────────────────────────────────
const load = (p) => { const j = JSON.parse(fs.readFileSync(p, 'utf8')); return Array.isArray(j) ? j : (j.competitions || []); };
const comps = [...load(`${ROOT}/stats/all_upcoming_comps.json`), ...load(`${ROOT}/stats/all_past_comps.json`)];
const uniq = new Map();
for (const c of comps) {
  if (!c.city || !c.country) continue;
  const iso2 = String(c.country).toUpperCase();
  if (iso2.length !== 2 || iso2 === 'CN') continue; // 仅跳过 CN 大陆(CN_PLACE_ZH 全量);HK/MO/TW 也生成
  const k = `${iso2}|${c.city}`;
  let u = uniq.get(k);
  if (!u) { u = { iso2, city: c.city, lat: null, lng: null, count: 0 }; uniq.set(k, u); }
  u.count++;
  if (u.lat == null && typeof c.latitude_degrees === 'number' && !(c.latitude_degrees === 0 && c.longitude_degrees === 0)) { u.lat = c.latitude_degrees; u.lng = c.longitude_degrees; }
}
console.error(`unique non-CN WCA cities: ${uniq.size}`);

// ── 5. resolve ─────────────────────────────────────────────────────────
// cities: trust GeoNames (t2s'd) for simp/zh-tagged hits; trad-group + misses → LLM.
// admins: ALL go to LLM for uniform style; GeoNames zh passed as a hint.
const cityZh = {};                 // key -> zh  (authoritative GeoNames, t2s'd)
const llmCity = new Map();          // key -> {key, iso2, seg, sampleCity, hint?, count}
const llmAdmin = new Map();         // key -> {key, iso2, seg, sampleCity, hint?, count}
const addLlm = (map, key, iso2, seg, city, count, hint) => {
  const e = map.get(key);
  if (e) { e.count += count; if (!e.hint && hint) e.hint = hint; }
  else map.set(key, { key, iso2, seg, sampleCity: city, ...(hint ? { hint } : {}), count });
};
let cByName = 0, cByDist = 0;

for (const u of uniq.values()) {
  const segs = u.city.split(',').map((s) => s.trim()).filter(Boolean);
  if (!segs.length) continue;
  const citySeg = segs[0], ncity = norm(citySeg);
  const cityKey = `${u.iso2}:${ncity}`;
  const cand = (u.lat != null) ? nearby(u.lat, u.lng).filter((c) => c.cc === u.iso2) : [];
  const ncands = new Set([ncity]);
  const stripped = citySeg.replace(/\s+(City|Town|Municipality|D\.?\s?C\.?)$/i, '').trim();
  if (stripped && stripped !== citySeg) ncands.add(norm(stripped));

  // city: in-country name-match within 40km (highest pop); else nearest within 8km
  let nameMatch = null, nearest = null, nd = 1e9;
  for (const c of cand) {
    const d = hav(u.lat, u.lng, c.lat, c.lng);
    if (d < nd) { nd = d; nearest = c; }
    let hit = false; for (const n of ncands) if (c.names.has(n)) { hit = true; break; }
    if (hit && d <= 40 && (!nameMatch || c.pop > nameMatch.pop)) nameMatch = c;
  }
  const chosen = nameMatch || (nearest && nd <= 8 ? nearest : null);
  if (!(cityKey in cityZh) && !llmCity.has(cityKey)) {
    const z = chosen ? zhOf(chosen.id) : null;
    if (z && z.group !== 'trad') { cityZh[cityKey] = z.name; nameMatch ? cByName++ : cByDist++; }
    else addLlm(llmCity, cityKey, u.iso2, citySeg, u.city, u.count, z ? z.name : undefined); // trad→hint / miss→none
  }

  // admin segs → all LLM; hint from direct admin1 name-match (t2s'd)
  const a1list = admin1ByCc.get(u.iso2) || [];
  const rgA1 = nearest && nd <= 150 ? admin1ByCode.get(`${nearest.cc}.${nearest.a1}`) : null;
  segs.slice(1).forEach((seg) => {
    const key = `${u.iso2}:${norm(seg)}`;
    if (key in cityZh) return;
    let rec = a1list.find((r) => r.names.has(norm(seg))) || (rgA1 && rgA1.names.has(norm(seg)) ? rgA1 : null);
    const z = rec ? zhOf(rec.id) : null;
    addLlm(llmAdmin, key, u.iso2, seg, u.city, u.count, z ? z.name : undefined);
  });
}
// a city seg that elsewhere appears as an admin (or vice-versa): keep city authoritative
for (const k of [...llmAdmin.keys()]) if (k in cityZh) llmAdmin.delete(k);

const bycount = (a, b) => b.count - a.count;
const out = {
  cityZh,
  llmCity: [...llmCity.values()].sort(bycount),
  llmAdmin: [...llmAdmin.values()].sort(bycount),
};
fs.writeFileSync(`${GN}/place-geo.json`, JSON.stringify(out, null, 1));
console.error(`\n== RESULT ==`);
console.error(`city authoritative (GeoNames+t2s): ${Object.keys(cityZh).length} (name-match ${cByName}, dist≤8km ${cByDist})`);
console.error(`LLM city tasks: ${out.llmCity.length} (with GeoNames hint: ${out.llmCity.filter(c=>c.hint).length})`);
console.error(`LLM admin tasks: ${out.llmAdmin.length} (with GeoNames hint: ${out.llmAdmin.filter(c=>c.hint).length})`);
console.error(`\ntop 20 LLM city (no hint):`); for (const t of out.llmCity.filter(c=>!c.hint).slice(0,20)) console.error(`  ${t.iso2} "${t.seg}" (x${t.count})`);
console.error(`\ntop 20 LLM admin:`); for (const t of out.llmAdmin.slice(0,20)) console.error(`  ${t.iso2} "${t.seg}"${t.hint?' hint='+t.hint:''} (x${t.count})`);
