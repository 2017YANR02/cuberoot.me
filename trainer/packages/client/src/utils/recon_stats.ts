/**
 * 复盘统计引擎——1:1 移植自 recon/recon_stats.js（409 行）
 * NOTE: 纯函数模块，不依赖 DOM/React，可在任意环境使用
 */
import type { ReconStatsResult } from '@cuberoot/shared';

// ── 步数分类映射 ──

/**
 * NOTE: STM (Slice Turn Metric) 计数规则：
 *   - 普通面转（R, U, L, D, F, B 及带'或2后缀）= 1
 *   - 宽转动（r, u, l, d, f, b 及 Rw 等）= 1
 *   - 旋转（x, y, z）= 0（不计入 STM）
 *   - 括号标记 [regrip] [lockup] [freePair] 等 = 0
 */

/** 需要跳过的标记性 token（不参与步数计算） */
const ANNOTATIONS = new Set([
  '[regrip]', '[lockup]', '[freePair]', '[free_pair]',
  '[yRot]', '[y_rot]', '[sMove]', '[s_move]',
]);

/** 旋转（不计入 STM） */
const ROTATIONS = new Set(['x', "x'", 'x2', 'y', "y'", 'y2', 'z', "z'", 'z2']);

/** 阶段标签正则——如 "// Cross (5)", "// F2L 1" */
const STAGE_LABEL_RE = /^\/\/\s*(cross|xcross|xxcross|f2l|oll|pll|ll|pair|slot)/i;

/** 公式行分隔正则——按步骤标签分割 "\n" */
const NEWLINE_RE = /\r?\n/;

// ── 公式解析 ──

/**
 * 将解法文本拆分为 token（步骤）数组
 * NOTE: 跳过注释行（以 // 开头）和注解标记
 */
function tokenize(text: string): string[] {
  if (!text) return [];
  const tokens: string[] = [];
  const lines = text.split(NEWLINE_RE);
  for (const line of lines) {
    const trimmed = line.trim();
    // NOTE: 纯注释行跳过
    if (trimmed.startsWith('//')) continue;
    // NOTE: 行内 // 注释截断
    const commentIdx = trimmed.indexOf('//');
    const effective = commentIdx >= 0 ? trimmed.substring(0, commentIdx) : trimmed;
    const parts = effective.trim().split(/\s+/);
    for (const p of parts) {
      if (p.length === 0) continue;
      if (ANNOTATIONS.has(p)) continue;
      tokens.push(p);
    }
  }
  return tokens;
}

/**
 * 计算 token 的 STM（跳过旋转）
 */
function countStm(tokens: string[]): number {
  let count = 0;
  for (const t of tokens) {
    if (ROTATIONS.has(t)) continue;
    if (ANNOTATIONS.has(t)) continue;
    count++;
  }
  return count;
}

// ── 阶段解析 ──

/** 解析阶段标签，返回阶段名 */
function parseStageLabel(line: string): string | null {
  const match = line.match(STAGE_LABEL_RE);
  if (!match) return null;
  return match[1].toLowerCase();
}

/**
 * 将解法文本按阶段分割
 * 返回 { stage: string, moves: string[] }[]
 */
interface StageBlock {
  stage: string;
  moves: string[];
}

function splitStages(text: string): StageBlock[] {
  if (!text) return [];
  const lines = text.split(NEWLINE_RE);
  const blocks: StageBlock[] = [];
  let currentStage = 'unknown';
  let currentMoves: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    const label = parseStageLabel(trimmed);
    if (label) {
      // NOTE: 新阶段开始，保存上一阶段
      if (currentMoves.length > 0) {
        blocks.push({ stage: currentStage, moves: currentMoves });
      }
      currentStage = label;
      currentMoves = [];
      // NOTE: 同行可能紧跟步骤（如 "// Cross (5) R U R'"）——提取注释后的步骤
      const afterComment = trimmed.replace(/^\/\/\s*\S+(\s*\(\d+\))?/, '').trim();
      if (afterComment) {
        const parts = afterComment.split(/\s+/).filter(s => s.length > 0 && !ANNOTATIONS.has(s));
        currentMoves.push(...parts);
      }
      continue;
    }
    // NOTE: 跳过纯注释行
    if (trimmed.startsWith('//')) continue;
    // NOTE: 提取步骤
    const commentIdx = trimmed.indexOf('//');
    const effective = commentIdx >= 0 ? trimmed.substring(0, commentIdx) : trimmed;
    const parts = effective.trim().split(/\s+/).filter(s => s.length > 0 && !ANNOTATIONS.has(s));
    currentMoves.push(...parts);
  }
  // NOTE: 最后一个阶段
  if (currentMoves.length > 0) {
    blocks.push({ stage: currentStage, moves: currentMoves });
  }
  return blocks;
}

// ── OLL/PLL 解析 ──

/** 从注释中提取 OLL 名 */
function parseOllFromText(text: string): { full: string; short: string } {
  if (!text) return { full: '', short: '' };
  // NOTE: 匹配 "// OLL 21" 或 "// OLL(21)" 格式
  const match = text.match(/\/\/\s*OLL\s*\(?\s*(\d+|[A-Za-z]+(?:\s*\d+)?)\s*\)?/i);
  if (match) {
    const name = match[1].trim();
    return { full: `OLL ${name}`, short: name };
  }
  return { full: '', short: '' };
}

/** 从注释中提取 PLL 名 */
function parsePllFromText(text: string): { full: string; short: string } {
  if (!text) return { full: '', short: '' };
  // NOTE: 匹配 "// PLL - Aa" 或 "// Aa-Perm" 或 "// PLL(Aa)" 格式
  const patterns = [
    /\/\/\s*PLL\s*[-–—:]\s*([A-Za-z][a-z]?)/i,
    /\/\/\s*([A-Za-z][a-z]?)\s*[-–—]?\s*[Pp]erm/,
    /\/\/\s*PLL\s*\(?\s*([A-Za-z][a-z]?)\s*\)?/i,
  ];
  for (const re of patterns) {
    const match = text.match(re);
    if (match) {
      const name = match[1].trim();
      return { full: `${name}-Perm`, short: name };
    }
  }
  return { full: '', short: '' };
}

// ── 标注解析 ──

/** 计算指定注解的出现次数 */
function countAnnotation(text: string, ...tags: string[]): number {
  if (!text) return 0;
  let count = 0;
  for (const tag of tags) {
    // NOTE: 全局搜索（大小写不敏感时需注意）
    let idx = 0;
    while ((idx = text.indexOf(tag, idx)) !== -1) {
      count++;
      idx += tag.length;
    }
  }
  return count;
}

/** 检测 S 系列转动 */
function countSMoves(tokens: string[]): number {
  let count = 0;
  for (const t of tokens) {
    // NOTE: S, M, E 系列（slice moves）
    if (/^[SME][2']?$/.test(t)) count++;
  }
  return count;
}

// ── Cross 分析 ──

/**
 * 判断 cross 类型：0=普通, 1=xCross, 2=xxCross, 3=xxxCross, 4=xxxxCross
 * NOTE: 通过阶段标签判断——如果 cross 阶段标签写的是 "xcross" 则返回 1
 */
function detectCrossType(text: string): number {
  if (!text) return 0;
  const lc = text.toLowerCase();
  if (lc.includes('xxxxcross')) return 4;
  if (lc.includes('xxxcross')) return 3;
  if (lc.includes('xxcross')) return 2;
  if (lc.includes('xcross')) return 1;
  return 0;
}

/** 提取 cross 颜色——从注释中查找颜色标记 */
function detectCrossColor(text: string): string {
  if (!text) return '';
  // NOTE: 匹配 "// Cross (white)" 或 "// white cross" 等
  const colorMap: Record<string, string> = {
    white: 'W', yellow: 'Y', red: 'R', orange: 'O', green: 'G', blue: 'B',
  };
  const lc = text.toLowerCase();
  for (const [name, code] of Object.entries(colorMap)) {
    if (lc.includes(name)) return code;
  }
  return '';
}

// ── 主入口 ──

/**
 * 计算复盘的所有统计指标
 * @param solutionText 纯解法文本（阶段注释分隔）
 * @param rawTimeSec 单次成绩（秒）
 * @returns 统计结果对象
 *
 * NOTE: 与原版 ReconStats.computeAllStats() 逻辑 1:1 对齐
 */
export function computeAllStats(
  solutionText: string,
  rawTimeSec: number,
): ReconStatsResult {
  const tokens = tokenize(solutionText);
  const stm = countStm(tokens);
  // NOTE: TPS = STM / 秒，保留两位小数
  const tps = rawTimeSec > 0 ? Math.round((stm / rawTimeSec) * 100) / 100 : 0;

  // NOTE: 阶段解析
  const stages = splitStages(solutionText);

  // NOTE: 计算 cross STM
  let crossStm = 0;
  let f2lStm = 0;
  let llStm = 0;
  for (const block of stages) {
    const blockStm = countStm(block.moves);
    const s = block.stage;
    if (s === 'cross' || s === 'xcross' || s === 'xxcross') {
      crossStm += blockStm;
    } else if (s === 'f2l' || s === 'pair' || s === 'slot') {
      f2lStm += blockStm;
    } else if (s === 'oll' || s === 'pll' || s === 'll') {
      llStm += blockStm;
    }
  }

  // NOTE: OLL / PLL 名称
  const oll = parseOllFromText(solutionText);
  const pll = parsePllFromText(solutionText);

  // NOTE: 标注计数
  const freePair = countAnnotation(solutionText, '[freePair]', '[free_pair]');
  const yRot = countAnnotation(solutionText, '[yRot]', '[y_rot]');
  const regrip = countAnnotation(solutionText, '[regrip]');
  const lockup = countAnnotation(solutionText, '[lockup]');

  const crossType = detectCrossType(solutionText);
  const crossColor = detectCrossColor(solutionText);
  const sMove = countSMoves(tokens);

  return {
    stm,
    tps,
    ollFull: oll.full,
    pllFull: pll.full,
    ollShort: oll.short,
    pllShort: pll.short,
    freePair,
    yRot,
    regrip,
    lockup,
    crossType,
    crossStm,
    f2l: f2lStm,
    ll: llStm,
    sMove,
    crossColor,
  };
}
