// out.csv → lsll_cases.csv(灌 PG 表 `lsll_cases` 的形状,migration 0094)。
//
// 列:canonical_key,htm,qtm,exhaustive,optimal_algs
//   * canonical_key = LSLL canonical key 的 base36(= URL 的 ?k=,client `model.keyToString`)
//   * optimal_algs  = JSON 数组,**CSV 双引号转义**(`\copy … FORMAT csv` 直接吃)
//   * exhaustive    = 阶段 1 恒 false —— 只有一条最优解,QTM 并列没穷尽(原因见 README)
//
// htm 的口径 = **这个 case 的最优**(16 个首尾 AUF 像里最短的),不是某一个代表元的最优,
// 见 solve.mjs 开头。
//
// 顺便做三件事:
//   1. **核对语料**:out.csv 的 key 集合必须是 corpus.txt 的子集,且没重复。
//   2. **核对口径**:每条解的首末招都不能是 U 系转动 —— 那是「取到轨道最短」的等价判据。
//      旧口径(只解展示相位)的 out.csv 有 59% 会在这里当场炸,不会被静默灌进库。
//   3. 输出覆盖率与 HTM 直方图,好知道跑到哪了(没跑完也能先灌,页面对没回填的 case 显示「计算中」)。
//
// Usage: node export_cases.mjs [--out lsll_cases.csv]
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const IN = resolve(process.env.OUT_CSV || resolve(__dirname, 'out.csv'));
const argOut = process.argv.indexOf('--out');
const OUT = resolve(argOut > 0 ? process.argv[argOut + 1] : resolve(__dirname, 'lsll_cases.csv'));

// 语料只有一个文件:corpus.txt 579,368 个可训练 case(见 corpus 生成脚本)。覆盖率的分母就是它。
// `CORPUS` 可给逗号分隔的清单覆盖默认(抽样跑时用)。
const CORPORA = (process.env.CORPUS ? process.env.CORPUS.split(',') : ['corpus.txt'])
  .map((p) => resolve(__dirname, p.trim())).filter((p) => existsSync(p));
if (!CORPORA.length) throw new Error('语料文件不存在 —— 先跑 lsll-corpus.mts');

const corpusKeys = new Set();
for (const file of CORPORA) {
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    if (line.includes(',')) corpusKeys.add(line.slice(0, line.indexOf(',')));
  }
}

// 「取到轨道最短」的等价判据:最短那条解的首末招都不是 U 系转动 —— 是的话剥掉就得到
// 同一个 case 里更短的成员,与「最短」矛盾。整表逐行核一遍,几乎零成本。
const U_END_RE = /^U[2']?(\s|$)|(^|\s)U[2']?$/;

const rows = [];
const seen = new Set();
const hist = new Map();
for (const line of readFileSync(IN, 'utf8').split('\n')) {
  if (!line.trim()) continue;
  const [key, htm, qtm, ...rest] = line.split(',');
  const sol = rest.join(',').trim();
  if (!key || !htm || !qtm || !sol) throw new Error(`out.csv 行格式不对:${line}`);
  if (!corpusKeys.has(key)) throw new Error(`out.csv 里的 ${key} 不在语料里 —— 语料对不上,别灌`);
  if (seen.has(key)) throw new Error(`out.csv 里 ${key} 重复`);
  if (U_END_RE.test(sol)) {
    throw new Error(`${key}:解 "${sol}" 首/末是 U 系 —— 这不是 case 的最优,只是某个代表元的最优。`
      + `旧口径的 out.csv 要整个作废重跑,别灌。`);
  }
  seen.add(key);
  hist.set(Number(htm), (hist.get(Number(htm)) ?? 0) + 1);
  // JSON 数组进 CSV:整段用双引号包,内部双引号翻倍(公式里只有 URFDLB/2/' 和空格,不会有引号,
  // 但照规矩转义,免得以后 alg 里带别的字符时静默出坏 CSV)。
  const json = JSON.stringify([sol]);
  rows.push(`${key},${htm},${qtm},false,"${json.replace(/"/g, '""')}"`);
}

rows.sort();   // 稳定顺序 ⇒ 行级 sha1 清单 diff 才有意义
writeFileSync(OUT, `canonical_key,htm,qtm,exhaustive,optimal_algs\n${rows.join('\n')}\n`);

const pct = ((rows.length / corpusKeys.size) * 100).toFixed(1);
console.log(`写出 ${OUT}`);
console.log(`  ${rows.length} / ${corpusKeys.size} 个 case(覆盖 ${pct}%)`);
console.log(`  HTM 分布 ${JSON.stringify(Object.fromEntries([...hist].sort((a, b) => a[0] - b[0])))}`);
if (rows.length < corpusKeys.size) {
  console.log(`  ⚠ 还没跑完,少 ${corpusKeys.size - rows.length} 个 —— 可以先灌,页面对缺的 case 显示「计算中」`);
}
