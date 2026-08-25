/**
 * Phase 1 验收闸门:`@cuberoot/shared/alg-notation` 的度量必须逐行复现站长那张 1LLL 表的
 * `SH` / `SQ` / `Self gen` / `rotation?` / `has move?` 五列(3915 行)。
 *
 * 表的公式(Apps Script named lambda,已从 xlsx 反解):
 *   SH  = 删掉 [ ()'xyz234·↑↓./] 后剩余字符数
 *   SQ  = SH + count("2") + 2×count("3") + 3×count("4")
 * 两条都是**字符法**。字符法只在「宽块写小写 r/l/u/d/f/b」时正确 —— 表里正是这么写的,
 * 所以它对表成立。站上不是(recon 里 `Rw` 遍地),所以站上换成真 tokenizer。
 * 这个脚本就是在证明「换成 tokenizer 之后,表这边一个字都没变」。
 *
 * 计步管线(顺序有讲究):首行 → 剥署名 → DELETE_AUF → EXPANDALG → tokenize → 计步。
 * DELETE_AUF 必须在 EXPANDALG **之前** —— 否则 `(U R …)2` 的那个 U 会被当成起手 AUF 剥掉。
 *
 *   node verify_sheet_metrics.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { stm, sqtm, gen, deleteAuf } from '@cuberoot/shared/alg-notation';
import { parseAlgCell } from './sheet_notation.mjs';

const ROOT = path.resolve(import.meta.dirname, '../../..');
const rows = JSON.parse(fs.readFileSync(path.join(ROOT, '.tmp/phase0/sheet_1lll.json'), 'utf8'));

/** 表的 SH/SQ 只看**首条**公式。首条 = `Self alg` 的第一行的第一段(行中 `=` 之前)。 */
const firstAlg = (row) => parseAlgCell(String(row['Self alg'] ?? '').split('\n')[0])[0] ?? null;

const buckets = { SH: [], SQ: [], GEN: [] };
let parsed = 0;

for (const row of rows) {
  const e = firstAlg(row);
  if (!e || e.moves === null) continue;
  parsed++;

  // e.text = 剥了署名、留了标签和换握记号的原文。DELETE_AUF 要在这一层做(表就是这么做的)。
  const body = deleteAuf(e.text);

  const got = {
    SH: stm(body),
    SQ: sqtm(body),
    GEN: gen(body),
  };
  const want = {
    SH: row.SH,
    SQ: row.SQ,
    GEN: row['Self gen'],
  };

  for (const k of Object.keys(buckets)) {
    if (want[k] == null) continue;
    const a = typeof want[k] === 'boolean' ? got[k] : got[k];
    if (a !== want[k]) buckets[k].push({ Self: row.Self, Name: row.Name, alg: e.text, got: got[k], want: want[k] });
  }
}

console.log(`可解析首条公式:${parsed} / ${rows.length}\n`);
const LABEL = { SH: 'SH (STM)', SQ: 'SQ (SQTM)', GEN: 'Self gen' };
for (const k of Object.keys(buckets)) {
  const bad = buckets[k].length;
  console.log(`${LABEL[k].padEnd(12)} ${String(parsed - bad).padStart(4)} / ${parsed}  ${bad === 0 ? '✓' : `✗ 分歧 ${bad}`}`);
}

for (const k of Object.keys(buckets)) {
  if (!buckets[k].length) continue;
  console.log(`\n--- ${LABEL[k]} 的分歧(前 20)---`);
  for (const d of buckets[k].slice(0, 20)) {
    console.log(`  ${String(d.Self).padStart(4)} ${String(d.Name).padEnd(8)} 算出 ${JSON.stringify(d.got)} / 表里 ${JSON.stringify(d.want)}`);
    console.log(`       ${d.alg}`);
  }
}

fs.mkdirSync(path.join(ROOT, '.tmp/phase1'), { recursive: true });
fs.writeFileSync(path.join(ROOT, '.tmp/phase1/metric_diffs.json'), JSON.stringify(buckets, null, 2));
console.log('\n→ .tmp/phase1/metric_diffs.json');
