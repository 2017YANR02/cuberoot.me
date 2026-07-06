/**
 * splits.ts — 解析 splits.txt (Ground Truth)。
 *
 * 格式: 首行 `Splits:679:686:...`(帧号, N+1 个点对应 N 段) + 复盘 notation 行。
 * 解析出三样东西:
 *   - splitFrames: 帧号数组
 *   - segLabels:   每段一个面名 (供 Step 2 分类器, 含 y)
 *   - gtTokens:    完整动作 token (供 Step 3 逆推, 保留 U2'/UD'/f 等原样)
 */
import { FINGERING, ROTATION_TOKENS, getFace, splitByFingering } from "./notation.ts";

const META_RE = /^\d+\s*(段|STM)/;

/** 从内容中取出 notation 动作行 (剔除 Splits 行 / 段/STM 元信息行 / 空行) */
function reconLines(content: string): string[] {
  const out: string[] = [];
  for (const raw of content.trim().split("\n")) {
    const s = raw.trim();
    if (!s || s.startsWith("Splits:") || META_RE.test(s)) continue;
    out.push(s);
  }
  return out;
}

/** 解析 Splits 行的帧号列表 */
export function parseSplitFrames(content: string): number[] {
  for (const line of content.split("\n")) {
    const s = line.trim();
    if (s.startsWith("Splits:")) {
      return s
        .slice("Splits:".length)
        .replace(/\|+$/, "")
        .split(":")
        .map((x) => {
          const n = parseInt(x, 10);
          if (Number.isNaN(n)) throw new Error(`parseSplitFrames: 非法帧号 "${x}"`);
          return n;
        });
    }
  }
  return [];
}

/**
 * 解析每段的面标签 (Step 2 分类器用) — 与 template_cnn.parseSegMoves 一致。
 * 每个 token 归约为单个面名 (getFace); 返回 {splitFrames, segLabels}。
 */
export function parseSegMoves(content: string): { splitFrames: number[]; segLabels: string[] } {
  const splitFrames = parseSplitFrames(content);
  const segLabels: string[] = [];
  for (let line of reconLines(content)) {
    if (line.includes("//")) line = line.slice(0, line.indexOf("//"));
    line = line.trim();
    if (!line) continue;
    for (const token of line.split(/\s+/)) {
      for (const p of token.split("...")) {
        for (const st of splitByFingering(p)) {
          const face = getFace(st);
          if (face !== null) segLabels.push(face);
        }
      }
    }
  }
  return { splitFrames, segLabels };
}

/**
 * 解析完整 GT token + 分离末尾转体 — 与 greedy_reverse.parseGT 一致。
 * 返回 {tokens, tailRotations}: tokens 保留原样 (U2'/UD'/f 等), 末尾朝向校正转体分离。
 */
export function parseGT(content: string): { tokens: string[]; tailRotations: string[] } {
  const allTokens: string[] = [];
  for (let line of reconLines(content)) {
    if (line.includes("//")) line = line.slice(0, line.indexOf("//"));
    line = line.trim();
    if (!line) continue;
    for (const token of line.split(/\s+/)) {
      for (let p of token.split("...")) {
        for (const c of FINGERING) p = p.split(c).join(" ");
        for (const st of p.split(/\s+/).filter((x) => x.length > 0)) {
          if (ROTATION_TOKENS.has(st)) {
            allTokens.push(st);
          } else if ([...st].some((ch) => "UDLRFBudlrf".includes(ch))) {
            allTokens.push(st);
          }
        }
      }
    }
  }

  const tailRotations: string[] = [];
  while (allTokens.length && ROTATION_TOKENS.has(allTokens[allTokens.length - 1])) {
    tailRotations.unshift(allTokens.pop()!);
  }
  return { tokens: allTokens, tailRotations };
}
