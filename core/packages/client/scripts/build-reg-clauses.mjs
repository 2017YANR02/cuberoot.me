#!/usr/bin/env node
// Build the per-article "full clauses" data for /regulation from the official
// WCA sources, aligned by clause id (4a / 12a1a / A3b2 / 10f1 ...).
//
//   English : the committed snapshot (_data/reg-source.snapshot.md, April 2026)
//   中文(简): official translation thewca/wca-regulations-translations chinese/
//   繁体     : OpenCC s2twp from 简体 at build time (same converter as conv.mjs)
//
// Emits one JSON per article to _data/reg-clauses/<id>.json so each chapter page
// statically imports only its own clauses (SSG-friendly, correct for all 3 langs).
//
//   node scripts/build-reg-clauses.mjs
//
// Re-run after the regs change (alongside reg:check --write).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../app/[lang]/regulation/_data');
const EN_SNAPSHOT = path.join(DATA_DIR, 'reg-source.snapshot.md');
const OUT_DIR = path.join(DATA_DIR, 'reg-clauses');
const ZH_URL =
  'https://raw.githubusercontent.com/thewca/wca-regulations-translations/main/chinese/wca-regulations.md';

async function fetchText(url) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'cuberoot-reg-clauses' } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.text();
    } catch (e) {
      if (i === 2) throw e;
    }
  }
}

// Drop inline angle-bracket markers (<label>, <article-…>, <version>, …) — these
// are compiler hints in the source, not displayed content.
const stripMarkers = (s) => (s || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

// Split a doc into articles, returning [{ id, title, heading, body }] in order.
// `heading` keeps the full printed heading ("Article 1: Officials" / "第一章：工作人员")
// so a faithful full-document view can show the official wording verbatim.
function splitArticles(text) {
  const md = text.replace(/\r\n/g, '\n');
  const re = /^## <article-([^>]+)>.*$/gm;
  const heads = [];
  let m;
  while ((m = re.exec(md))) {
    const titleM = m[0].match(/(?:Article|第[^：:]*[章则]|附则[A-Z])[^：:]*[：:]\s*(.+?)\s*$/) || m[0].match(/:\s*(.+?)\s*$/);
    heads.push({
      id: m[1],
      title: titleM ? titleM[1].trim() : m[1],
      heading: stripMarkers(m[0].replace(/^##\s*/, '')),
      start: m.index,
    });
  }
  return heads.map((h, i) => ({
    id: h.id,
    title: h.title,
    heading: h.heading,
    body: md.slice(h.start, i + 1 < heads.length ? heads[i + 1].start : md.length),
  }));
}

// Parse the pre-article "Notes" region (### sub-sections before Article 1) into
// [{ heading, body }]. `body` keeps newlines so list items survive.
function parseNotes(text) {
  const md = text.replace(/\r\n/g, '\n');
  const artIdx = md.search(/^## <article-/m);
  const head = artIdx >= 0 ? md.slice(0, artIdx) : md;
  const re = /^### (.+)$/gm;
  const segs = [];
  let m;
  while ((m = re.exec(head))) segs.push({ heading: stripMarkers(m[1]), start: m.index, hlen: m[0].length });
  return segs
    .map((s, i) => {
      const bodyStart = s.start + s.hlen;
      const bodyEnd = i + 1 < segs.length ? segs[i + 1].start : head.length;
      const body = head
        .slice(bodyStart, bodyEnd)
        .split('\n')
        .map((l) => stripMarkers(l))
        .filter((l, idx, arr) => l || (idx > 0 && idx < arr.length - 1)) // keep interior blanks as paragraph breaks
        .join('\n')
        .trim();
      return { heading: s.heading, body };
    })
    .filter((s) => s.heading);
}

// Parse a clause list out of one article body. Lines like `    - 12a1a) text`.
// Continuation / unlabelled indented lines are appended to the previous clause.
function parseClauses(body) {
  const out = [];
  const lines = body.split('\n');
  const clauseRe = /^(\s*)- ([0-9A-Za-z][0-9A-Za-z+]*)\)\s?(.*)$/;
  for (const line of lines) {
    const m = line.match(clauseRe);
    if (m) {
      out.push({ id: m[2], depth: Math.round(m[1].replace(/\t/g, '    ').length / 4), text: m[3].trim() });
    } else if (out.length) {
      const t = line.trim();
      if (t && !t.startsWith('## ') && !t.startsWith('#')) out[out.length - 1].text += ' ' + t;
    }
  }
  return out;
}

async function main() {
  if (!fs.existsSync(EN_SNAPSHOT)) {
    console.error('[reg:clauses] missing EN snapshot. Run reg:check --write first.');
    process.exit(1);
  }
  const enText = fs.readFileSync(EN_SNAPSHOT, 'utf8');
  const zhIdx = process.argv.indexOf('--zh');
  const zhText =
    zhIdx >= 0 ? fs.readFileSync(process.argv[zhIdx + 1], 'utf8') : await fetchText(ZH_URL);

  const enVer = (enText.match(/<version>\s*Version:\s*([^\n<]+)/) || [])[1]?.trim() || '?';
  const zhVer = (zhText.match(/<version>\s*版本[：:]\s*([^\n<]+)/) || [])[1]?.trim() || '?';
  if (zhVer === '?') console.warn('[reg:clauses] warning: could not read 中文 version line');

  const enArts = splitArticles(enText);
  const zhArts = new Map(splitArticles(zhText).map((a) => [a.id, a]));

  fs.mkdirSync(OUT_DIR, { recursive: true });
  let totalClauses = 0;
  let missingZh = 0;
  const summary = [];
  const articlesOut = []; // ordered, for the combined full-document mirror

  for (const a of enArts) {
    const enClauses = parseClauses(a.body);
    const zhArt = zhArts.get(a.id);
    const zhMap = new Map(zhArt ? parseClauses(zhArt.body).map((c) => [c.id, c.text]) : []);
    const clauses = enClauses.map((c) => {
      const zh = zhMap.get(c.id) || '';
      if (!zh) missingZh++;
      return { id: c.id, depth: c.depth, en: c.text, zh };
    });
    totalClauses += clauses.length;
    const payload = {
      articleId: a.id,
      version: { en: enVer, zh: zhVer },
      title: { en: a.title, zh: zhArt ? zhArt.title : a.title },
      clauses,
    };
    fs.writeFileSync(path.join(OUT_DIR, `${a.id}.json`), JSON.stringify(payload, null, 2) + '\n');
    summary.push(`${a.id}:${clauses.length}`);
    articlesOut.push({
      id: a.id,
      heading: { en: a.heading, zh: zhArt ? zhArt.heading : a.heading },
      title: { en: a.title, zh: zhArt ? zhArt.title : a.title },
      clauses: clauses.map(({ id, depth, en, zh }) => ({ id, depth, en, zh })),
    });
  }

  // Combined full-document payload for /regulation/full (verbatim mirror): intro
  // notes + every article in order. Built from the same official sources, so it
  // can be regenerated/auto-synced with zero human paraphrase.
  const enNotes = parseNotes(enText);
  const zhNotes = parseNotes(zhText);
  const notes = enNotes.map((n, i) => ({
    en: n,
    zh: zhNotes[i] && zhNotes[i].heading ? zhNotes[i] : n,
  }));
  fs.writeFileSync(
    path.join(OUT_DIR, '_full.json'),
    JSON.stringify({ version: { en: enVer, zh: zhVer }, notes, articles: articlesOut }, null, 2) + '\n',
  );

  console.log(`[reg:clauses] EN ${enVer} / ZH ${zhVer}`);
  console.log(`[reg:clauses] _full.json: ${notes.length} notes, ${articlesOut.length} articles`);
  console.log(`[reg:clauses] ${enArts.length} articles, ${totalClauses} clauses, ${missingZh} without 中文`);
  console.log('[reg:clauses] ' + summary.join('  '));
}

main();
