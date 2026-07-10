import type { PinSpec } from "./handsRig";

/**
 * FTN `[...]` 注解块(FINGERTRICKS.md §7)解析/剥离 —— 部分实装(§6):
 * 支持「招式尾紧贴、块内无空白」的注解 token 与 `Fn:@S[>S2]` 贴块单簇;
 * 其余 clause 静默忽略(§7.4:写错的注解剥离后招式照播)。
 */

/** 喂 cubing.js / 变换工具前整块剥除(先于换握/推法剥取,`U'p[…]` 先塌成 `U'p`)。 */
export const stripFtnBlocks = (s: string): string => s.replace(/\[[^\]]*\]/g, "");

/** FTN 注解 token:招式尾紧贴 `[...]`(块内暂不支持空白 —— 空白分隔的解析
 *  chunk 会把带空格的块切开,§6 部分实装范围)。 */
export const FTN_TOKEN = /^(\S+?)\[([^\]]*)\]$/;

/** 注解块 → @pin。编排目前仅 `R[R2:@C]`(R2 贴块钉 C = UFR 的 U 面贴纸,随
 *  weld 骑到 Q):终点可省 —— pin 落点被群论唯一决定(C 随 R 必到 Q);写了
 *  非 Q 的终点视为规格错误,整簇忽略。未编排的 (move, finger, sticker) 组合
 *  一律返回 undefined(剥块后按默认指法照播)。 */
export function parseFtnPin(block: string, move: string): PinSpec | undefined {
  for (const clause of block.split(";")) {
    const m = /^([LR])([1-5]):@([A-X])(?:>([A-X]))?$/.exec(clause.trim());
    if (!m) continue;
    if (move !== "R" || m[1] !== "R" || m[2] !== "2" || m[3] !== "C") continue;
    if (m[4] && m[4] !== "Q") continue;
    return { hand: "R", finger: "index", sticker: "C" };
  }
  return undefined;
}
