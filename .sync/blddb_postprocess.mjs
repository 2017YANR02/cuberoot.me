#!/usr/bin/env node
// BLDDB 同步的后处理 —— 由 scripts/upstream/sync-blddb.ps1 在拷贝完 out/ 之后调用，也可以单独跑。
//
//   node .sync/blddb_postprocess.mjs [--upstream D:\cube\blddb] [--repo <仓库根>] [--data-dir <候选 data 目录>]
//
// 干四件事，全部写进 tools/blddb/data/（那份 JSON 只有本站原生页面在吃，iframe 版
// 是编译期把数据内联进 chunk 的，改这里动不到它）：
//
//  ① 起手位置。上游给每条公式算「起手拇指在哪」(finger.ts)，是它最有辨识度的一列。
//     那份逻辑是 GPL-3.0 的，所以**不进 client bundle** —— 这里用 esbuild 把上游那个
//     模块打包起来在构建期跑一遍，只把结果(一条公式一个字符)写进数据。程序的输出不是
//     程序的衍生作品，license 边界仍然停在「只读它的数据」。
//     编码：h=中立 u=拇指上 d=拇指下，大写是左手镜像那三种，- = 算不出来。
//     顺带把每条记录补齐成定长 4 位 [公式[], 用者[], 换位子[]|null, 起手[]]，
//     免得客户端还要按类型猜第三位是什么。
//
//  ①b 高阶盲拧(翼棱 / X 中心 / T 中心 / 中棱)那四套的记录形状跟三阶不一样，一并归一成
//     同一个四位元组。
//
//  ② Nightmare 推荐解。cornerNightmareSelected / edgeNightmareSelected 等，加起来
//     130KB，是「每个 case 一条推荐公式」的速查网格，跟 37MB 的穷举全集不是一回事
//     （那个仍然只留给 iframe）。
//
//  ③ Nightmare 静态速查表。上游 public/data/nightmare/*.ts 是编译期内联的 TS 模块，
//     这里转成 JSON 落地，给 /alg/3bld/tables 用。
//
// 幂等：重复跑结果一致（起手会重算并覆盖）。

import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveWorkspacePath } from '../core/scripts/resolve-workspace-path.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const UPSTREAM = path.resolve(arg('upstream', 'D:/cube/blddb'));
const REPO = path.resolve(arg('repo', path.join(HERE, '..')));
const DATA = path.resolve(arg('data-dir', path.join(REPO, 'tools', 'blddb', 'data')));
const UP_DATA = path.join(UPSTREAM, 'public', 'data');

for (const [label, p] of [['上游 clone', UPSTREAM], ['上游 public/data', UP_DATA], ['tools/blddb/data', DATA]]) {
  if (!existsSync(p)) throw new Error(`${label} 不存在：${p}`);
}

// esbuild 装在 core 的 workspace 里（server 包用它打 bundle），从那儿解析。
const require_ = createRequire(path.join(
  REPO,
  'core',
  resolveWorkspacePath('@cuberoot/server', path.join(REPO, 'core')),
  'package.json',
));
const esbuild = require_('esbuild');

const TMP = path.join(tmpdir(), 'blddb-postprocess');
mkdirSync(TMP, { recursive: true });

/** 把上游的一个 TS 模块打成 CJS 后 require 进来。 */
async function loadUpstream(entry, name) {
  const out = path.join(TMP, `${name}.cjs`);
  await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    format: 'cjs',
    platform: 'node',
    target: 'node20',
    outfile: out,
    logLevel: 'silent',
    absWorkingDir: UPSTREAM,
  });
  // 每次都重新 require —— 长跑时上游可能已经换了版本。
  delete require_.cache?.[out];
  return require_(out);
}

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const writeJson = (p, v) => writeFileSync(p, `${JSON.stringify(v)}\n`, 'utf8');
const kb = (n) => `${(n / 1024).toFixed(0)}KB`;

// ── ① 起手位置 ────────────────────────────────────────────────────────────

/** 上游 i18n key → 单字符。左手那三种用大写，省一半体积。 */
const FINGER_CODE = {
  'finger.homegrip': 'h',
  'finger.thumbup': 'u',
  'finger.thumbdown': 'd',
  'finger.lefthomegrip': 'H',
  'finger.leftthumbup': 'U',
  'finger.leftthumbdown': 'D',
  '/': '-',
};

const MANMADE_TYPES = ['corner', 'edge', 'parity', 'twists', 'flips', 'ltct'];
/** 这几套上游带换位子列（Table 的 commutatorNeededList）。 */
const HAS_COMM = new Set(['corner', 'edge', 'flips', 'twists']);

/** 高阶盲拧那四套(data/bigbld/ 下)。记录形状与三阶不同，见 stepBigbld。 */
const BIGBLD_TYPES = ['wing', 'xcenter', 'tcenter', 'midge'];

async function stepFinger() {
  const fingerMod = await loadUpstream(path.join(UPSTREAM, 'src', 'utils', 'finger.ts'), 'finger');
  const finger = fingerMod.default ?? fingerMod;
  if (typeof finger.fingerbeginfrom !== 'function') {
    throw new Error('上游 finger.ts 不再导出 fingerbeginfrom —— 起手那一列的算法换了，去看 src/utils/finger.ts。');
  }

  // 全站只有 1.8 万条互不相同的公式，一份缓存就够，跨类型复用。
  const memo = new Map();
  const encode = (alg) => {
    let hit = memo.get(alg);
    if (hit !== undefined) return hit;
    let out;
    try {
      out = finger
        .fingerbeginfrom(alg)
        .map((k) => FINGER_CODE[k] ?? '-')
        .join('');
    } catch {
      out = '-'; // 上游对少数怪写法会抛，这里降级成「算不出来」而不是让整个同步挂掉
    }
    if (out === '') out = '-';
    memo.set(alg, out);
    return out;
  };

  const started = Date.now();
  for (const type of MANMADE_TYPES) {
    const file = path.join(DATA, `${type}Manmade.json`);
    if (!existsSync(file)) throw new Error(`缺 ${type}Manmade.json —— 先跑 sync_upstream.ps1 -Only blddb`);
    const set = readJson(file);
    const before = readFileSync(file).length;
    let entries = 0;
    for (const key of Object.keys(set)) {
      set[key] = set[key].map((e) => {
        entries++;
        const algs = e[0];
        // 定长化：第三位是换位子（这套没有就 null），第四位是起手。
        const comms = HAS_COMM.has(type) ? (e[2] ?? null) : null;
        return [algs, e[1], comms, algs.map(encode)];
      });
    }
    writeJson(file, set);
    const after = readFileSync(file).length;
    console.log(
      `  ${type.padEnd(7)} ${String(entries).padStart(5)} 条记录，` +
      `${kb(before)} → ${kb(after)}`,
    );
  }
  const dist = {};
  for (const v of memo.values()) dist[v] = (dist[v] ?? 0) + 1;
  console.log(
    `  ${memo.size} 条不同公式，耗时 ${((Date.now() - started) / 1000).toFixed(1)}s;` +
    ` 分布 ${Object.entries(dist).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k}:${n}`).join(' ')}`,
  );
  if ((dist['-'] ?? 0) > memo.size * 0.2) {
    throw new Error('两成以上的公式算不出起手 —— 上游 finger.ts 多半换了返回格式，别把坏数据发出去。');
  }
}

// ── ①b 高阶盲拧四套 ───────────────────────────────────────────────────────

/**
 * 上游 data/bigbld/*.json 的记录是 `[公式, 用者[], 换位子]`（一条记录只有一种写法，
 * 公式和换位子都是**裸字符串**），跟三阶那六套的数组形状对不上。这里补成同一个四位
 * 元组，客户端只认一种形状。
 *
 * 起手那一列留空：上游 Table 也只在三阶显示（`isThumbPositionNeeded = is3bld && …`）——
 * finger.ts 那套握法判断没在宽层 / 内层记号上验证过，宁可不给也别给个看着像真的错值。
 */
function stepBigbld() {
  const dir = path.join(DATA, 'bigbld');
  if (!existsSync(dir)) throw new Error(`缺 tools/blddb/data/bigbld/ —— 先跑 sync_upstream.ps1 -Only blddb`);
  for (const type of BIGBLD_TYPES) {
    const file = path.join(dir, `${type}Manmade.json`);
    if (!existsSync(file)) throw new Error(`缺 bigbld/${type}Manmade.json`);
    const set = readJson(file);
    const before = readFileSync(file).length;
    let entries = 0;
    for (const key of Object.keys(set)) {
      set[key] = set[key].map((e) => {
        entries++;
        // 幂等：跑第二遍时 e[0] 已经是数组了，别再包一层。
        const algs = Array.isArray(e[0]) ? e[0] : [e[0]];
        const comms = e[2] == null ? null : (Array.isArray(e[2]) ? e[2] : [e[2]]);
        return [algs, e[1], comms, []];
      });
    }
    writeJson(file, set);
    console.log(
      `  bigbld/${type.padEnd(8)} ${String(entries).padStart(5)} 条记录，` +
      `${kb(before)} → ${kb(readFileSync(file).length)}`,
    );
  }
}

// ── ② Nightmare 推荐解 ────────────────────────────────────────────────────

// 只要角和棱这两套 —— 上游 Nightmare 菜单也只把它俩做成推荐解网格。翻棱那份跟人工集
// 同一个 case 空间(66 个)没有新东西,奇偶那份是子集,拿了是死重量。
const SELECTED_TYPES = ['corner', 'edge'];

function stepSelected() {
  const found = SELECTED_TYPES.map((t) => `${t}NightmareSelected.json`)
    .filter((f) => existsSync(path.join(UP_DATA, f)));
  if (found.length !== SELECTED_TYPES.length) {
    throw new Error(`上游少了 ${SELECTED_TYPES.map((t) => `${t}NightmareSelected.json`).join(' / ')} —— 速查表页会空。`);
  }
  // 上游删过 / 我们缩过范围时,把多余的旧文件清掉,别在 data/ 里攒孤儿。
  for (const f of readdirSync(DATA)) {
    if (f.endsWith('NightmareSelected.json') && !found.includes(f)) {
      rmSync(path.join(DATA, f));
      console.log(`  删掉不再使用的 ${f}`);
    }
  }
  for (const f of found) {
    const src = path.join(UP_DATA, f);
    const dst = path.join(DATA, f);
    const json = readJson(src);
    writeJson(dst, json);
    console.log(`  ${f.padEnd(32)} ${Object.keys(json).length} 个 case，${kb(readFileSync(dst).length)}`);
  }
}

// ── ③ Nightmare 静态速查表 ────────────────────────────────────────────────

async function stepTables() {
  const dir = path.join(UP_DATA, 'nightmare');
  if (!existsSync(dir)) throw new Error(`上游少了 public/data/nightmare/ —— 速查表没源头`);
  const names = readdirSync(dir).filter((f) => f.endsWith('.ts')).map((f) => f.replace(/\.ts$/u, ''));
  if (names.length === 0) throw new Error('public/data/nightmare/ 里没有 .ts 表源');

  // 一个入口把 9 张表一起打包，省 9 次 esbuild 启动。
  const entry = path.join(TMP, 'tables-entry.ts');
  writeFileSync(
    entry,
    `${names.map((n, i) => `import t${i} from ${JSON.stringify(path.join(dir, `${n}.ts`).replace(/\\/gu, '/'))};`).join('\n')}\n` +
    `export default { ${names.map((n, i) => `${JSON.stringify(n)}: t${i}`).join(', ')} };\n`,
    'utf8',
  );
  const mod = await loadUpstream(entry, 'tables');
  const tables = mod.default ?? mod;

  const outDir = path.join(DATA, 'nightmare');
  mkdirSync(outDir, { recursive: true });
  for (const name of names) {
    const rows = tables[name];
    if (!Array.isArray(rows) || rows.length === 0) throw new Error(`nightmare/${name}.ts 解出来是空的`);
    const dst = path.join(outDir, `${name}.json`);
    writeJson(dst, rows);
    console.log(`  nightmare/${name.padEnd(10)} ${String(rows.length).padStart(4)} 行，${kb(readFileSync(dst).length)}`);
  }
  // 上游删表时这里跟着删，免得留孤儿
  for (const f of readdirSync(outDir)) {
    if (f.endsWith('.json') && !names.includes(f.replace(/\.json$/u, ''))) {
      rmSync(path.join(outDir, f));
      console.log(`  删掉上游已移除的 nightmare/${f}`);
    }
  }
}

// ── 跑 ────────────────────────────────────────────────────────────────────

console.log('[blddb-postprocess] 起手位置（上游 finger.ts，构建期跑）...');
await stepFinger();
console.log('[blddb-postprocess] 高阶盲拧四套归一...');
stepBigbld();
console.log('[blddb-postprocess] Nightmare 推荐解...');
stepSelected();
console.log('[blddb-postprocess] Nightmare 静态速查表...');
await stepTables();
rmSync(TMP, { recursive: true, force: true });
console.log('[blddb-postprocess] 完成。');
