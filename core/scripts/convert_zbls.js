/**
 * 一次性脚本：从上游 ZBLS Trainer 的 JS 数据文件提取数据，生成 zbls.json
 *
 * 用法: node scripts/convert_zbls.js
 *
 * 数据来源:
 *   - index.html — 提取每个 F2L 组有多少个 case（通过 checkbox class）
 *   - algorithms.js — algArray 扁平数组 [count, alg1, ..., count, alg1, ...]
 *   - scrambles.js — scrambleArray 扁平数组，同上
 */
const fs = require('fs');
const path = require('path');

const UPSTREAM_DIR = 'D:\\cube\\trainer\\zbls-trainer';
const OUTPUT = path.join(__dirname, '..', 'packages', 'shared', 'data', 'zbls.json');

// --- Step 1: 从 index.html 提取 F2L 组结构 ---
const html = fs.readFileSync(path.join(UPSTREAM_DIR, 'index.html'), 'utf-8');

// 统计每个 F2L 组有多少个 case（通过 class="F2LN" 出现次数）
const f2lGroups = {}; // { groupNum: count }
const classRegex = /class="F2L(\d+)"/g;
let match;
while ((match = classRegex.exec(html)) !== null) {
  const groupNum = parseInt(match[1]);
  f2lGroups[groupNum] = (f2lGroups[groupNum] || 0) + 1;
}

// 按组号排序，生成 case key 顺序列表
const sortedGroupNums = Object.keys(f2lGroups).map(Number).sort((a, b) => a - b);
const caseKeys = []; // ["1-1", "1-2", ..., "41-2"]
for (const groupNum of sortedGroupNums) {
  const count = f2lGroups[groupNum];
  for (let v = 1; v <= count; v++) {
    caseKeys.push(`${groupNum}-${v}`);
  }
}

console.log(`从 index.html 提取到 ${sortedGroupNums.length} 个 F2L 组，共 ${caseKeys.length} 个 case`);

// --- Step 2: 解析扁平数组 ---
function parseFlatArray(jsContent, varName) {
  // 提取数组内容（从 const varName = [ 到 ];）
  const startMarker = `const ${varName} = [`;
  const startIdx = jsContent.indexOf(startMarker);
  if (startIdx === -1) throw new Error(`Cannot find ${varName} in file`);
  const endIdx = jsContent.indexOf('];', startIdx);
  if (endIdx === -1) throw new Error(`Cannot find end of ${varName}`);

  const arrayContent = jsContent.substring(startIdx + startMarker.length, endIdx);

  // 解析为 JS 值
  const items = [];
  // 用正则匹配数字和带引号的字符串
  const tokenRegex = /(\d+)|"([^"]*?)"/g;
  let m;
  while ((m = tokenRegex.exec(arrayContent)) !== null) {
    if (m[1] !== undefined) {
      items.push(parseInt(m[1]));
    } else {
      items.push(m[2]);
    }
  }

  // 按 case 分组：每个 case 前有一个 count 数字
  const result = [];
  let i = 0;
  while (i < items.length) {
    const count = items[i];
    i++;
    const subArr = [];
    for (let j = 0; j < count; j++) {
      subArr.push(items[i]);
      i++;
    }
    result.push(subArr);
  }

  return result;
}

const algsContent = fs.readFileSync(
  path.join(UPSTREAM_DIR, 'Classes and Data Files', 'algorithms.js'),
  'utf-8'
);
const scramblesContent = fs.readFileSync(
  path.join(UPSTREAM_DIR, 'Classes and Data Files', 'scrambles.js'),
  'utf-8'
);

const algsByCaseIndex = parseFlatArray(algsContent, 'algArray');
const scramblesByCaseIndex = parseFlatArray(scramblesContent, 'scrambleArray');

console.log(`从 algorithms.js 解析到 ${algsByCaseIndex.length} 个 case 的算法`);
console.log(`从 scrambles.js 解析到 ${scramblesByCaseIndex.length} 个 case 的打乱`);

// --- Step 3: 验证数量一致 ---
if (caseKeys.length !== algsByCaseIndex.length) {
  throw new Error(
    `Case count mismatch: HTML=${caseKeys.length}, algs=${algsByCaseIndex.length}`
  );
}
if (caseKeys.length !== scramblesByCaseIndex.length) {
  throw new Error(
    `Case count mismatch: HTML=${caseKeys.length}, scrambles=${scramblesByCaseIndex.length}`
  );
}

// --- Step 4: 生成 zbls.json ---
const zblsJson = {};
for (let i = 0; i < caseKeys.length; i++) {
  const key = caseKeys[i];
  const groupNum = parseInt(key.split('-')[0]);
  zblsJson[key] = {
    f2lGroup: groupNum,
    algs: algsByCaseIndex[i],
    scrambles: scramblesByCaseIndex[i],
  };
}

fs.writeFileSync(OUTPUT, JSON.stringify(zblsJson, null, 2), 'utf-8');
console.log(`\n✅ 成功生成 ${OUTPUT}`);
console.log(`   共 ${Object.keys(zblsJson).length} 个 case`);

// 打印每个组的 case 数量
for (const groupNum of sortedGroupNums) {
  const casesInGroup = Object.values(zblsJson).filter(
    (c) => c.f2lGroup === groupNum
  );
  console.log(`   F2L ${groupNum}: ${casesInGroup.length} cases`);
}
