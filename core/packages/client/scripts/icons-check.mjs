#!/usr/bin/env node
// cubing/icons upstream drift detector.
//
// The site vendors https://github.com/cubing/icons src/svg verbatim into
// components/EventIcon/svg/{event,unofficial,penalty}/ (single source for
// <CubingIcon>/<EventIcon>, the /sim picker and the /icon gallery, via
// gen-svg-map.mjs → svg-map.ts). This script asks the GitHub trees API for the
// upstream file list + blob SHAs (one request), hashes the vendored files the
// same way git does, and reports added / changed / removed SVGs so the drift
// workflow can open an issue for an AI to vendor the new icons.
//
//   node scripts/icons-check.mjs            compare upstream vs vendored, print report
//   node scripts/icons-check.mjs --report P also write the report to file P
//
// Exit: 0 = in sync, 3 = drift, 1 = fetch/parse error.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SVG_DIR = path.resolve(__dirname, '../components/EventIcon/svg');
const TREE_URL = 'https://api.github.com/repos/cubing/icons/git/trees/main?recursive=1';
const UPSTREAM_BLOB = 'https://github.com/cubing/icons/blob/main/src/svg';

// Site-own icons that intentionally have no upstream counterpart — never drift.
const LOCAL_ONLY = new Set(['unofficial/rex.svg']);

const args = process.argv.slice(2);
const reportIdx = args.indexOf('--report');
const REPORT_PATH = reportIdx >= 0 ? args[reportIdx + 1] : null;

async function fetchUpstreamTree() {
  const headers = { 'User-Agent': 'cuberoot-icons-check', Accept: 'application/vnd.github+json' };
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;
  let lastErr;
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(TREE_URL, { headers });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const json = await r.json();
      if (json.truncated) throw new Error('tree response truncated');
      if (!Array.isArray(json.tree)) throw new Error('unexpected tree shape');
      return json.tree;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

// git blob SHA-1: sha1("blob <byte-length>\0<content>") — byte-exact match
// with the SHAs the trees API returns.
function gitBlobSha(buf) {
  return crypto
    .createHash('sha1')
    .update(`blob ${buf.length}\0`)
    .update(buf)
    .digest('hex');
}

function localSvgs() {
  const out = new Map(); // 'event/333.svg' -> sha
  for (const kind of fs.readdirSync(SVG_DIR)) {
    const dir = path.join(SVG_DIR, kind);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.svg')) continue;
      out.set(`${kind}/${f}`, gitBlobSha(fs.readFileSync(path.join(dir, f))));
    }
  }
  return out;
}

function upstreamSvgs(tree) {
  const out = new Map(); // 'event/333.svg' -> sha
  for (const e of tree) {
    if (e.type !== 'blob') continue;
    const m = /^src\/svg\/(.+\.svg)$/.exec(e.path);
    if (m) out.set(m[1], e.sha);
  }
  if (out.size === 0) throw new Error('no src/svg/*.svg found upstream — layout changed?');
  return out;
}

function main(upstream, local) {
  const added = []; // upstream has, we don't
  const changed = []; // both have, content differs
  const removed = []; // we have, upstream dropped (excl. LOCAL_ONLY)
  for (const [rel, sha] of upstream) {
    if (!local.has(rel)) added.push(rel);
    else if (local.get(rel) !== sha) changed.push(rel);
  }
  for (const rel of local.keys()) {
    if (!upstream.has(rel) && !LOCAL_ONLY.has(rel)) removed.push(rel);
  }
  for (const list of [added, changed, removed]) list.sort();

  const drift = added.length + changed.length + removed.length > 0;
  const lines = [];
  const stamp = new Date().toISOString().slice(0, 10);
  lines.push(`# cubing/icons 上游漂移报告 (${stamp})`, '');
  lines.push(`上游 ${upstream.size} 个 SVG,本地 ${local.size} 个(含 ${LOCAL_ONLY.size} 个站内自有:${[...LOCAL_ONLY].join(', ')})。`, '');
  const section = (title, list) => {
    lines.push(`## ${title} (${list.length})`, '');
    if (list.length === 0) lines.push('无', '');
    else {
      for (const rel of list) lines.push(`- [\`${rel}\`](${UPSTREAM_BLOB}/${rel})`);
      lines.push('');
    }
  };
  section('上游新增', added);
  section('上游内容变更', changed);
  section('上游已删除(本地仍保留)', removed);
  if (drift) {
    lines.push('## 处理方法(给 AI)', '');
    lines.push('1. 把上面每个新增/变更的 SVG 原样下载到 `core/packages/client/components/EventIcon/svg/<同路径>`(上游 `src/svg/` 下的相对路径不变;若出现全新目录,还需把目录名加进 `gen-svg-map.mjs` 的 kind 列表和 `/icon` 的 `_catalog.ts` 分类)。');
    lines.push('2. 运行 `node core/packages/client/components/EventIcon/gen-svg-map.mjs` 重新生成 svg-map.ts。');
    lines.push('3. 打开 `/icon` 页确认新图标渲染正常(明暗两主题),然后 typecheck + commit。');
    lines.push('4. 「上游已删除」的条目默认保留不动(站内可能还在用),除非确认无引用。');
    lines.push('');
  }
  const report = lines.join('\n');
  console.log(report);
  if (REPORT_PATH) fs.writeFileSync(REPORT_PATH, report);
  return drift ? 3 : 0;
}

// process.exitCode (not process.exit()): hard-exiting while undici's keep-alive
// socket is mid-teardown trips a libuv assert on Windows (exit 127).
try {
  const tree = await fetchUpstreamTree();
  process.exitCode = main(upstreamSvgs(tree), localSvgs());
} catch (e) {
  console.error(`icons-check failed: ${e?.message ?? e}`);
  process.exitCode = 1;
}
