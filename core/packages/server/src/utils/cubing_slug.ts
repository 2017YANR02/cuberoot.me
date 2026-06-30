/** WCA ID / 比赛名 → cubing.com slug 推导。两条路:
 *  - wcaIdToCubingSlug:从无横杠的 WCA ID 反推(启发式,丢了词边界,内部大写词会误拆)。
 *  - nameToCubingSlug:从真实比赛名推(有空格=词边界明确,更准)。优先用它。 */

/** WCA ID (e.g. XuzhouZenith2026) → cubing.com slug (Xuzhou-Zenith-2026)。
 *  在 小写↔大写 / 数字↔大写 / 小写↔数字 边界插横杠;
 *  但 NxN (3x3 / 4x4 / 5x5) 里 x 前是数字时不拆 — 否则 "League3x3IV" → "3-x-3-IV" 错的。
 *  注意:无横杠 ID 无法还原词边界,内部大写词会误拆(GuangzhouGraDUAL → Guangzhou-Gra-DUAL),
 *  能拿到真实比赛名时优先用 nameToCubingSlug。 */
export function wcaIdToCubingSlug(wcaId: string): string {
  return wcaId
    .replace(/([a-z])([A-Z])/g, '$1-$2')       // lc→UC: HefeiCubing → Hefei-Cubing
    .replace(/(\d)([A-Z])/g, '$1-$2')           // digit→UC: 3IV → 3-IV
    .replace(/([A-Z])(\d)/g, '$1-$2')           // UC→digit: IV2026 → IV-2026
    .replace(/(?<!\d)([a-z])(\d)/g, '$1-$2');   // lc→digit (前面不是 digit):League3 → League-3,但 NxN 里 x3 保留
}

/** 真实比赛名 → cubing.com slug:按词边界(空格/连字符)分段,每段剥非字母数字(撇号等,与 WCA ID 同口径),
 *  再用 '-' 连。比 wcaIdToCubingSlug 更准 —— 无横杠的 WCA ID 丢了词边界,无法判断 "GraDUAL" 是一个词,
 *  会误拆成 "Gra-DUAL"(GuangzhouGraDUAL3x3I2026)。name 有真实空格,直接给出正确边界;
 *  撇号按 WCA 口径剥掉(Xi'an→Xian)不会 404。round-trip 与 announced_comps 的 aliasToWcaIdCandidates 一致。 */
export function nameToCubingSlug(name: string): string {
  return name
    .split(/[\s-]+/)
    .map(t => t.replace(/[^A-Za-z0-9]/g, ''))
    .filter(Boolean)
    .join('-');
}
