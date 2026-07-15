/**
 * 复盘统计引擎——1:1 对齐 scripts/recon_stats.py
 * 关键算法：基于子串搜索 / 整行抽取，识别 inline `// label` 形式的阶段注释
 * （之前的 block-based 实现要求标签独占一行，会让所有 inline 注释的 recon 全部得 0）
 */
import type { ReconStatsResult } from '@cuberoot/shared';
import { stm } from '@cuberoot/shared/alg-notation';
import { formatTime, truncateCs } from './recon-utils';
import { sq1MoveCounts } from './sq1-metrics';

/** 删除每行 `//` 之后的注释，去掉空行 */
function deleteComment(recon: string): string {
  if (!recon) return '';
  const out: string[] = [];
  for (const line of recon.split(/\r?\n/)) {
    const stripped = line.replace(/\/\/.*/, '').trim();
    if (stripped) out.push(stripped);
  }
  return out.join('\n');
}

// 这里原本有一个字符法计步器(删掉 ` ()'xyz234·↑↓./` 后数剩余字符),剥离集里没有 `w`,
// 于是 `Rw` 被数成 2 步 —— 而 recon 文本里宽块正是写 `Rw`。现在走 `@cuberoot/shared/alg-notation`
// 的 tokenizer。`stm` 自带剥注释 / 剥换握记号 / 展开 `(...)N`,所以调用点不再需要预处理。

/** 取含指定阶段名的整行（取 `//` 之前部分；大小写不敏感） */
function findStage(recon: string, stageName: string): string {
  if (!recon || !stageName) return '';
  const target = stageName.toLowerCase();
  for (const line of recon.split(/\r?\n/)) {
    if (line.toLowerCase().includes(target)) {
      const idx = line.indexOf('//');
      return idx >= 0 ? line.substring(0, idx).trim() : line.trim();
    }
  }
  return '';
}

/** 从 inspection 之后到 stageName 出现位置之前的所有内容 */
function startToStage(recon: string, stageName: string): string {
  if (!recon || !stageName) return '';
  let stagePos = recon.indexOf(stageName);
  if (stagePos < 0) {
    stagePos = recon.toLowerCase().indexOf(stageName.toLowerCase());
  }
  if (stagePos < 0) return '';

  const inspPos = recon.indexOf('insp');
  let start: number;
  if (inspPos >= 0) {
    start = inspPos + 4;
  } else {
    // NOTE: 跳过前两行（首行 STM 摘要 + 打乱）
    const firstNl = recon.indexOf('\n');
    if (firstNl < 0) return '';
    const secondNl = recon.indexOf('\n', firstNl + 1);
    if (secondNl < 0) return '';
    start = secondNl + 1;
  }
  let temp = recon.substring(start, stagePos);
  if (temp.startsWith('\n')) temp = temp.substring(1);
  return temp;
}

/** 计算 y 旋转 + d 旋转次数（inspection 之后），先除掉 "Gd" 防误算 */
function countY(recon: string): number {
  if (!recon) return 0;
  const text = recon.replace(/Gd/g, '');
  const inspIdx = text.indexOf('insp');
  const after = inspIdx >= 0 ? text.substring(inspIdx) : text;
  let count = 0;
  for (const ch of after) {
    if (ch === 'y' || ch === 'd') count++;
  }
  return count;
}

/** 换手次数：↑ ↓ · 字符 */
function countRegrip(recon: string): number {
  if (!recon) return 0;
  let n = 0;
  for (const ch of recon) {
    if (ch === '↑' || ch === '↓' || ch === '·') n++;
  }
  return n;
}

/** 卡顿次数："..." 出现次数 */
function countLockup(recon: string): number {
  if (!recon) return 0;
  return (recon.match(/\.\.\./g) || []).length;
}

/** Cross 类型：0=普通, 1=xCross, ..., 4=xxxxCross；按最长匹配优先 */
function detectCrossType(recon: string): number {
  if (!recon) return 0;
  const lc = recon.toLowerCase();
  if (lc.includes('xxxxcross')) return 4;
  if (lc.includes('xxxcross')) return 3;
  if (lc.includes('xxcross')) return 2;
  if (lc.includes('xcross')) return 1;
  return 0;
}

/** Slice S 步数：大写 S 字符出现次数（减去 STM/TPS/SPS 关键字带的） */
function countS(recon: string): number {
  if (!recon) return 0;
  let total = 0;
  for (const ch of recon) if (ch === 'S') total++;
  if (recon.includes('STM')) total -= 1;
  if (recon.includes('TPS')) total -= 1;
  if (recon.includes('SPS')) total -= 1;
  return Math.max(total, 0);
}

/** Cross 颜色：从 cross 标签前的字母提取（"// Y cross" → "Y"） */
function detectCrossColor(recon: string): string {
  if (!recon) return '';
  if (!/cross/i.test(recon)) return '';
  const hasInsp = /insp/i.test(recon);
  const positions: number[] = [];
  let idx = 0;
  while (true) {
    const pos = recon.indexOf('// ', idx);
    if (pos < 0) break;
    positions.push(pos);
    idx = pos + 3;
  }
  let charPos: number;
  if (hasInsp && positions.length >= 2) charPos = positions[1] + 3;
  else if (positions.length >= 1) charPos = positions[0] + 3;
  else return '';
  return charPos < recon.length ? recon[charPos] : '';
}

/** 从首行解析 STM（"33STM /3.05=10.82TPS" → 33）；解析失败则按 token 计数兜底 */
function parseStmFromHeader(recon: string): number | null {
  if (!recon) return null;
  const m = recon.match(/^\s*(\d+)STM/);
  if (m) {
    const v = parseInt(m[1], 10);
    return v > 0 ? v : null;
  }
  return null;
}

/** Token 计数法 STM——非旋转、非注解的 token 数 */
const ROTATIONS = new Set(['x', "x'", 'x2', 'y', "y'", 'y2', 'z', "z'", 'z2']);
const ANNOTATIONS = new Set([
  '[regrip]', '[lockup]', '[freePair]', '[free_pair]',
  '[yRot]', '[y_rot]', '[sMove]', '[s_move]',
]);

function countStmFromTokens(recon: string): number {
  return stm(recon);
}

function computeStm(recon: string, event?: string): number {
  const fromHeader = parseStmFromHeader(recon);
  if (fromHeader != null) return fromHeader;
  // SQ1 记号("(a,b)/"式)不适用 3x3 字符剥离法;按"/"切片计(即求解器页的
  // "slash"度量,层转免费),对应 lib/sq1-metrics.ts 的 twist 口径。
  if (event === 'sq1') return sq1MoveCounts(recon).twist;
  return countStmFromTokens(recon);
}

// FMC(最少步)的 rawTime 存的是步数而非秒数,stm/rawTime 算不出有意义的 TPS —— 直接不算。
function computeTps(stm: number, single: number, event?: string): number {
  if (event === 'fmc') return 0;
  if (!stm || !single || single <= 0) return 0;
  const floored = truncateCs(single);
  if (floored <= 0) return 0;
  return Math.round((stm / floored) * 100) / 100;
}

/** Cross STM */
function computeCrossStm(recon: string): number {
  const ct = detectCrossType(recon);
  const stageNames: Record<number, string> = {
    0: 'cross', 1: 'xcross', 2: 'xxcross', 3: 'xxxcross', 4: 'xxxxcross',
  };
  let sn = stageNames[ct];
  const lower = recon.toLowerCase();
  for (const variant of ['ps' + sn, sn]) {
    if (lower.includes(variant)) { sn = variant; break; }
  }
  const text = startToStage(recon, sn);
  if (!text) return 0;
  return stm(text);
}

/** LL 步数：按 LL 方法组合分支判断 */
function computeLl(recon: string): number {
  if (!recon || !/cross/i.test(recon)) return 0;

  const stageHtm = (name: string) => stm(findStage(recon, name));
  const trailingAuf = (name: string): number => {
    const s = findStage(recon, name);
    if (!s) return 0;
    const cleaned = s
      .replace(/\/\/.*/g, '')
      .replace(/[ ()'’‘`xyz23·↑↓./]/g, '');
    const m = cleaned.match(/(U+)$/);
    return m ? m[1].length : 0;
  };
  const upper = recon.toUpperCase();
  const has = (kw: string) => upper.includes(kw.toUpperCase());

  // OLL Skip 系列
  if (has('OCLL Skip')) return stageHtm('PLL');
  if (has('OLL(CP) Skip')) return stageHtm('EPLL');
  if (has('OLL Skip')) return stageHtm('PLL');

  // PLL Skip 系列
  if (has('PLL Skip')) {
    if (has('COLL')) return stageHtm('COLL');
    if (has('OLL(CP)')) return stageHtm('OLL(CP)');
    if (has('VLS')) return trailingAuf('VLS');
    if (has('OLS')) return trailingAuf('OLS');
    if (has('SV')) return trailingAuf('SV');
    if (has('WV')) return trailingAuf('WV');
    return 0;
  }

  // LL Skip
  if (has('LL Skip')) {
    const s = findStage(recon, 'LL');
    if (!s) return 0;
    const cleaned = s
      .replace(/\/\/.*/g, '')
      .replace(/[ ()'’‘`xyz23·↑↓./]/g, '');
    const m = cleaned.match(/(U+)$/);
    return m ? m[1].length : 0;
  }

  // VLS/WV/SV 后接 EPLL/PLL
  if (has('WV') || has('SV') || has('VLS')) {
    if (has('EPLL')) return stageHtm('EPLL');
    if (has('PLL')) return stageHtm('PLL');
  }

  // EO + ZBLL
  if (recon.includes('// EO')) return stageHtm('EO') + stageHtm('ZBLL');

  if (has('1LLL')) return stageHtm('1LLL');
  if (has('ZBLL')) return stageHtm('ZBLL');

  if (has('EPLL')) {
    if (has('COLL')) return stageHtm('COLL') + stageHtm('EPLL');
    if (has('OLL(CP)')) return stageHtm('OLL(CP)') + stageHtm('EPLL');
  }

  if (has('PLL')) {
    if (has('OCLL')) return stageHtm('OCLL') + stageHtm('PLL');
    if (has('OLL')) return stageHtm('OLL') + stageHtm('PLL');
  }

  return 0;
}

/** Free Pair 计算 */
function computeFreePair(recon: string): number {
  if (!recon) return 0;
  const xcMatch = recon.match(/( cross| xcross| xxcross| xxxcross| xxxxcross)/i);
  if (!xcMatch) return 0;
  const xcType = xcMatch[1];
  let xcPos = recon.indexOf(xcType);
  if (xcPos < 0) xcPos = recon.toLowerCase().indexOf(xcType.toLowerCase());
  if (xcPos < 0) return 0;
  const after = recon.substring(xcPos + xcType.length);

  const pairLines = after.split(/\r?\n/).filter(l => l.includes('//'));
  if (pairLines.length === 0) return 0;
  const stageAfter = pairLines.join('\n');

  const cleanedText = stageAfter.replace(/[ ()'’‘`xyz23·↑↓.]/g, '');

  const cleanedLines: string[] = [];
  for (const line of cleanedText.split('\n')) {
    const trimmed = line.trim().replace(/^U+/, '');
    if (trimmed) cleanedLines.push(trimmed);
  }
  const deletePreAUF = cleanedLines.join('\n');

  let count = 0;
  for (const line of deletePreAUF.split('\n')) {
    const cIdx = line.indexOf('//');
    if (cIdx < 0) continue;
    const algLen = line.substring(0, cIdx).length;
    if (algLen >= 1 && algLen <= 4) count++;
  }

  const noComment = deleteComment(deletePreAUF);
  for (const pat of ['LRUR', 'RLUL']) {
    for (const line of noComment.split('\n')) {
      if (line.trim() === pat) count--;
    }
  }
  return Math.max(count, 0);
}

/** OLL 全名抽取 */
function _ciFind(text: string, kw: string): number {
  return text.toLowerCase().indexOf(kw.toLowerCase());
}
function _toEol(text: string, start: number): string {
  const nl = text.indexOf('\n', start);
  return nl < 0 ? text.substring(start) : text.substring(start, nl);
}

function computeOllFull(recon: string): string {
  if (!recon) return '';
  const keywords = ['OLL', 'OCLL', 'COLL', 'CMLL'];
  for (const kw of keywords) {
    const pos = _ciFind(recon, kw);
    if (pos >= 0) {
      let val = _toEol(recon, pos);
      const slash = val.indexOf('/');
      if (slash >= 0) val = val.substring(0, slash);
      return val.trim();
    }
  }
  const eoPos = _ciFind(recon, 'EO');
  if (eoPos >= 0) {
    const eolsPos = _ciFind(recon, 'EOLS');
    if (eolsPos < 0) {
      let val = _toEol(recon, eoPos);
      const slash = val.indexOf('/');
      if (slash >= 0) val = val.substring(0, slash);
      return val.trim();
    }
  }
  return '';
}

function computePllFull(recon: string): string {
  if (!recon) return '';
  if (!/cross/i.test(recon)) return '';
  let lastComment = '';
  for (const line of recon.split(/\r?\n/)) {
    const cIdx = line.indexOf('//');
    if (cIdx >= 0) lastComment = line.substring(cIdx + 2).trim();
  }
  if (!lastComment) return '';
  const slash = lastComment.indexOf('/');
  if (slash >= 0) return lastComment.substring(slash + 1).trim();
  return lastComment.trim();
}

function ollShortFrom(full: string): string {
  if (!full) return '';
  let r = full.replace(/\([^)]*\)/g, '');
  r = r.replace(/ cancel into/g, '');
  r = r.replace(/(COLL|OCLL)/g, 'OLL');
  return r.trim();
}

function pllShortFrom(full: string): string {
  if (!full) return '';
  let r = full.replace(/\([^)]*\)/g, '');
  r = r.replace(/ cancel into/g, '');
  r = r.replace(/(VLS\/|WV\/|SV\/)/g, '');
  return r.trim();
}

/**
 * 计算复盘的所有统计指标
 * @param solutionText 复盘文本（可含/不含 STM 摘要首行；含 inspection 注释更精确）
 * @param rawTimeSec 单次成绩（秒）
 */
export function computeAllStats(
  solutionText: string,
  rawTimeSec: number,
  event?: string,
): ReconStatsResult {
  const recon = solutionText || '';
  const stm = computeStm(recon, event);
  const tps = computeTps(stm, rawTimeSec, event);
  const ll = computeLl(recon);
  // NOTE: F2L = STM - LL（含 cross 步数；与 Python 参考一致）
  const f2l = stm > 0 && ll > 0 ? stm - ll : 0;
  const ollFull = computeOllFull(recon);
  const pllFull = computePllFull(recon);

  return {
    stm,
    tps,
    ollFull,
    pllFull,
    ollShort: ollShortFrom(ollFull),
    pllShort: pllShortFrom(pllFull),
    freePair: computeFreePair(recon),
    yRot: countY(recon),
    regrip: countRegrip(recon),
    lockup: countLockup(recon),
    crossType: detectCrossType(recon),
    crossStm: computeCrossStm(recon),
    f2l,
    ll,
    sMove: countS(recon),
    crossColor: detectCrossColor(recon),
  };
}

/** 纯旋转(inspection)行——只由 x/y/z + 2/' 组成 */
const ROTATION_LINE_RE = /^(?:[xyz][2']?\s*)+$/;

/**
 * `48STM/ 8.56=5.61TPS` 摘要行,caption 首行与详情页解法上方共用。
 * SQ1 按"/"切片计 STM(见 computeStm),速度单位相应改叫 SPS。
 * FMC(最少步)没有速度概念(rawTime 存的是步数而非秒数),只标 STM。
 */
export function buildCaptionHeader(solutionText: string, single: number, event?: string): string {
  const stm = computeStm(solutionText, event);
  if (event === 'fmc') return `${stm}STM`;
  const tps = computeTps(stm, single, event);
  const unit = event === 'sq1' ? 'SPS' : 'TPS';
  return `${stm}STM/ ${formatTime(single)}=${tps.toFixed(2)}${unit}`;
}

/**
 * 生成可复制的「caption」:首行 `48STM/ 8.56=5.61TPS` 摘要,其后每步去掉
 * `// 注释`,并丢弃纯旋转(inspection)行。纯前端格式化,不依赖数据库字段。
 */
export function buildCaption(solutionText: string, single: number, event?: string): string {
  if (!solutionText) return '';
  const body: string[] = [];
  for (const raw of solutionText.split(/\r?\n/)) {
    const stripped = raw.replace(/\/\/.*/, '').trim();
    if (!stripped || ROTATION_LINE_RE.test(stripped)) continue;
    body.push(stripped);
  }
  return [buildCaptionHeader(solutionText, single, event), ...body].join('\n');
}

// NOTE: 兼容旧用法保留 ANNOTATIONS / ROTATIONS 引用避免 unused 报错
void ROTATIONS;
void ANNOTATIONS;
