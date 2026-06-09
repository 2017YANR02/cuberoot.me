#!/usr/bin/env node
// CLI Simplified->Traditional (OpenCC s2twp + domain override). Same converter the
// build-time injectors use, so manual/agent conversions stay consistent.
//   node scripts/conv.mjs "简体文本"      -> prints Traditional
//   echo "简体文本" | node scripts/conv.mjs
import * as OpenCC from 'opencc-js';
const raw = OpenCC.Converter({ from: 'cn', to: 'twp' });
const conv = (s) => raw(s).replace(/專案/g, '項目').replace(/開源項目/g, '開源專案');
const arg = process.argv.slice(2).join(' ');
if (arg) { process.stdout.write(conv(arg) + '\n'); }
else { let d = ''; process.stdin.on('data', (c) => (d += c)); process.stdin.on('end', () => process.stdout.write(conv(d))); }
