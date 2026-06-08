#!/usr/bin/env node
// Build-time Simplified→Traditional generation. Runs in plain Node (opencc-js
// works fine here; it only breaks inside the Next server bundler), so the output
// is STATIC JSON that both SSR and the client read identically — no runtime
// conversion, no hydration mismatch, no flash, SEO-clean Traditional pages.
//
// Produces (committed, regenerated as part of `build`):
//   i18n/zh-Hant.json — zh.json run through OpenCC (the t() catalog), registered
//                       as a STATIC bundle so SSR + client match (no mismatch).
//
// tr()/<T> inline strings are converted at runtime (browser OpenCC), so they are
// NOT pre-generated here — only the t() catalog is.
//
// Run: node scripts/gen-zh-hant.mjs   (chained before `next build`)

import * as OpenCC from 'opencc-js';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const raw = OpenCC.Converter({ from: 'cn', to: 'twp' }); // Taiwan, phrase-level
// Domain override: s2twp renders 项目 (a cube EVENT) as 專案 (a software project,
// wrong here). Force 項目 — but keep 開源專案 (the site IS an open-source project).
export const conv = (s) => raw(s).replace(/專案/g, '項目').replace(/開源項目/g, '開源專案');

const zh = JSON.parse(readFileSync(join(ROOT, 'i18n/zh.json'), 'utf8'));
const convTree = (n) =>
  typeof n === 'string'
    ? conv(n)
    : Array.isArray(n)
      ? n.map(convTree)
      : n && typeof n === 'object'
        ? Object.fromEntries(Object.entries(n).map(([k, v]) => [k, convTree(v)]))
        : n;
writeFileSync(join(ROOT, 'i18n/zh-Hant.json'), JSON.stringify(convTree(zh), null, 2) + '\n');

const leaves = (n) => (typeof n === 'string' ? 1 : n && typeof n === 'object' ? Object.values(n).reduce((a, v) => a + leaves(v), 0) : 0);
console.log(`i18n/zh-Hant.json written — ${leaves(zh)} strings converted from zh.json.`);
