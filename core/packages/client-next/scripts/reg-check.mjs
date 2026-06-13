#!/usr/bin/env node
// WCA Regulations drift detector.
//
// The official regs are a machine-readable markdown doc whose articles are
// delimited by `## <article-ID>...` level-2 headings (appendices included, as
// `## <article-A> Article A: ...`) with a `<version>Version: <date>` line on top.
// Source: https://raw.githubusercontent.com/thewca/wca-regulations/official/wca-regulations.md
//
// Our /regulation pages are paraphrased + illustrated, so we can't auto-replace
// text. What we CAN do is pin a snapshot of the official source per article and
// report exactly which articles changed, so the update-regulation skill rewrites
// only the affected chapters.
//
//   node scripts/reg-check.mjs            compare live vs snapshot, print report
//   node scripts/reg-check.mjs --report P also write the report to file P
//   node scripts/reg-check.mjs --write    (re)baseline the snapshot from live
//
// Exit: 0 = in sync, 3 = drift, 2 = no baseline, 1 = fetch/parse error.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../app/[lang]/regulation/_data');
const SNAP_MD = path.join(DATA_DIR, 'reg-source.snapshot.md');
const SNAP_JSON = path.join(DATA_DIR, 'reg-source.hashes.json');
const ARTICLES_TS = path.join(DATA_DIR, 'articles.ts');
const SOURCE_URL =
  'https://raw.githubusercontent.com/thewca/wca-regulations/official/wca-regulations.md';

const args = process.argv.slice(2);
const WRITE = args.includes('--write');
const reportIdx = args.indexOf('--report');
const REPORT_PATH = reportIdx >= 0 ? args[reportIdx + 1] : null;

async function fetchSource() {
  let lastErr;
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(SOURCE_URL, { headers: { 'User-Agent': 'cuberoot-reg-check' } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.text();
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

const normalizeBlock = (t) =>
  t
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.replace(/\s+$/, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const sha = (t) => crypto.createHash('sha256').update(t).digest('hex').slice(0, 16);

function parseDoc(text) {
  const version = (text.match(/<version>\s*Version:\s*([^\n<]+)/) || [])[1]?.trim() || '(unknown)';
  const re = /^## <article-([^>]+)>.*$/gm;
  const heads = [];
  let m;
  while ((m = re.exec(text))) {
    const id = m[1];
    const titleM = m[0].match(/Article\s+\S+:\s*(.+?)\s*$/);
    heads.push({ id, title: titleM ? titleM[1] : id, start: m.index, headLine: m[0] });
  }
  const articles = new Map();
  const order = [];
  for (let i = 0; i < heads.length; i++) {
    const end = i + 1 < heads.length ? heads[i + 1].start : text.length;
    const block = normalizeBlock(text.slice(heads[i].start, end));
    articles.set(heads[i].id, { id: heads[i].id, title: heads[i].title, block, sha: sha(block) });
    order.push(heads[i].id);
  }
  return { version, articles, order };
}

// num -> slug from the registry (regex, to avoid importing the TS module).
function slugMap() {
  const map = {};
  try {
    const src = fs.readFileSync(ARTICLES_TS, 'utf8');
    const re = /slug:\s*'([^']+)',\s*num:\s*'([^']+)'/g;
    let m;
    while ((m = re.exec(src))) map[m[2]] = m[1];
  } catch {
    /* registry optional */
  }
  return map;
}

function lineDiff(a, b) {
  const n = a.length, m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push([' ', a[i]]);
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) out.push(['-', a[i++]]);
    else out.push(['+', b[j++]]);
  }
  while (i < n) out.push(['-', a[i++]]);
  while (j < m) out.push(['+', b[j++]]);
  return out;
}

function hunkedDiff(oldText, newText) {
  const d = lineDiff(oldText.split('\n'), newText.split('\n'));
  const CTX = 3;
  const keep = new Array(d.length).fill(false);
  d.forEach((x, idx) => {
    if (x[0] !== ' ')
      for (let k = Math.max(0, idx - CTX); k <= Math.min(d.length - 1, idx + CTX); k++) keep[k] = true;
  });
  const lines = [];
  let gap = false;
  for (let idx = 0; idx < d.length; idx++) {
    if (keep[idx]) {
      lines.push(d[idx][0] + ' ' + d[idx][1]);
      gap = false;
    } else if (!gap) {
      lines.push('  …');
      gap = true;
    }
  }
  return lines.join('\n');
}

function buildReport(live, snap) {
  const slugs = slugMap();
  const changed = [];
  const added = [];
  for (const id of live.order) {
    const a = live.articles.get(id);
    const old = snap.articles[id];
    if (!old) added.push(a);
    else if (old.sha !== a.sha) changed.push({ a, old });
  }
  const removed = Object.keys(snap.articles).filter((id) => !live.articles.has(id));
  const verChanged = live.version !== snap.version;
  const drift = verChanged || changed.length || added.length || removed.length;

  const L = [];
  L.push('# WCA 规则漂移检测', '');
  L.push(`- 快照版本: \`${snap.version}\``);
  L.push(`- 线上版本: \`${live.version}\`${verChanged ? '  ← 已更新' : '  (一致)'}`);
  L.push(`- 源: ${SOURCE_URL}`, '');

  if (!drift) {
    L.push('✅ 与快照一致,无需改动。');
    return { text: L.join('\n'), drift: false };
  }

  if (changed.length) {
    L.push(`## 改动章节 (${changed.length})`, '');
    const snapMd = fs.existsSync(SNAP_MD) ? fs.readFileSync(SNAP_MD, 'utf8') : '';
    const snapParsed = snapMd ? parseDoc(snapMd) : null;
    for (const { a } of changed) {
      const slug = slugs[a.id];
      const page = slug ? `app/[lang]/regulation/${slug}/page.tsx` : '(未在站点注册表中)';
      L.push(`### Article ${a.id}: ${a.title} → ${slug ? `slug \`${slug}\`` : '⚠️ 无对应页'}`);
      L.push(`改 \`${page}\``, '');
      const oldBlock = snapParsed?.articles.get(a.id)?.block || '';
      L.push('```diff', hunkedDiff(oldBlock, a.block), '```', '');
    }
  }
  if (added.length) {
    L.push(`## 官网新增、站点未覆盖 (${added.length})`, '');
    for (const a of added) L.push(`- Article ${a.id}: ${a.title} —— 需在 \`_data/articles.ts\` 新建并加页`);
    L.push('');
  }
  if (removed.length) {
    L.push(`## 官网已删、站点仍有 (${removed.length})`, '');
    for (const id of removed) L.push(`- Article ${id} (snap: ${snap.articles[id].title}) —— 评估是否下线`);
    L.push('');
  }
  L.push('---');
  L.push('改完依次跑 `update-regulation` skill 重写受影响章节,然后:');
  L.push('`pnpm -F @cuberoot/client-next reg:check --write` 重新基线 + commit 快照。');
  return { text: L.join('\n'), drift: true };
}

async function main() {
  let text;
  try {
    text = await fetchSource();
  } catch (e) {
    console.error('[reg:check] fetch failed:', e.message);
    process.exit(1);
  }
  const live = parseDoc(text);
  if (live.order.length === 0) {
    console.error('[reg:check] parse failed: no `## <article-…>` headings found');
    process.exit(1);
  }

  if (WRITE) {
    fs.writeFileSync(SNAP_MD, text.replace(/\r\n/g, '\n'));
    const articles = {};
    for (const id of live.order)
      articles[id] = { title: live.articles.get(id).title, sha: live.articles.get(id).sha };
    fs.writeFileSync(
      SNAP_JSON,
      JSON.stringify(
        { source: SOURCE_URL, version: live.version, fetchedAt: new Date().toISOString(), order: live.order, articles },
        null,
        2,
      ) + '\n',
    );
    console.log(`[reg:check] baseline written: version "${live.version}", ${live.order.length} articles`);
    process.exit(0);
  }

  if (!fs.existsSync(SNAP_JSON)) {
    console.error('[reg:check] no baseline. Run: pnpm -F @cuberoot/client-next reg:check --write');
    process.exit(2);
  }
  const snap = JSON.parse(fs.readFileSync(SNAP_JSON, 'utf8'));
  const { text: report, drift } = buildReport(live, snap);
  console.log(report);
  if (REPORT_PATH) fs.writeFileSync(REPORT_PATH, report + '\n');
  process.exit(drift ? 3 : 0);
}

main();
