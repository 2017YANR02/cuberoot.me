/**
 * LSLL 镜像对合 σ 的不动点普查 —— issue #40 T6 要的那个数。
 *
 * 求解清单能减半的确切幅度 = (583,284 + F) / 2,F = 自镜像 case 数。本脚本把 42 个大类
 * 逐个枚举、逐个 case 求镜像,数出 F 与每个大类的配对关系。
 *
 * 跑:NODE_OPTIONS=--no-experimental-strip-types \
 *       pnpm --filter @cuberoot/client exec tsx scripts/lsll-mirror-census.mts
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { CATEGORIES, enumerateCategory, unpackState, classify, TOTAL_CASES } =
  require('../lib/lsll/model.ts') as typeof import('../lib/lsll/model.ts');
const { mirrorKey } = require('../lib/lsll/mirror.ts') as typeof import('../lib/lsll/mirror.ts');

let total = 0, fixed = 0;
const rows: string[] = [];

for (const cat of CATEGORIES) {
  const keys = enumerateCategory(cat.slug);
  const partner = classify(unpackState(mirrorKey(keys[0]))).category;
  let self = 0;
  for (const k of keys) if (mirrorKey(k) === k) self++;
  total += keys.length;
  fixed += self;
  rows.push(
    `${cat.letter.padEnd(3)} ${cat.kind.padEnd(3)} → ${partner.letter.padEnd(3)}` +
    `${String(keys.length).padStart(8)} case  ${self ? `不动点 ${self}` : ''}`,
  );
}

rows.forEach((r) => console.log(r));
console.log(`\n总 case ${total.toLocaleString()}(应为 ${TOTAL_CASES.toLocaleString()})`);
console.log(`自镜像 case F = ${fixed.toLocaleString()}`);
console.log(`镜像对(无序)= (${total.toLocaleString()} + ${fixed.toLocaleString()}) / 2 = ${((total + fixed) / 2).toLocaleString()}`);
console.log(`求解清单省下 ${(100 * (1 - (total + fixed) / 2 / total)).toFixed(2)}%`);
