// WCA ID / 比赛名 → cubing.com slug。镜像 server packages/server/src/utils/cubing_slug.ts
// (两个包不能互相 import,故保持同一份逻辑;改一处记得改另一处)。

/** WCA ID (e.g. XuzhouZenith2026) → cubing.com slug (Xuzhou-Zenith-2026)。
 *  无横杠 ID 无法还原词边界,内部大写词会误拆(GuangzhouGraDUAL → Guangzhou-Gra-DUAL),
 *  能拿到真实比赛名时优先用 nameToCubingSlug。 */
export function wcaIdToCubingSlug(wcaId: string): string {
  return wcaId
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/(\d)([A-Z])/g, '$1-$2')
    .replace(/([A-Z])(\d)/g, '$1-$2')
    .replace(/(?<!\d)([a-z])(\d)/g, '$1-$2');
}

/** 真实比赛名 → cubing.com slug:按词边界(空格/连字符)分段,每段剥非字母数字(撇号等,与 WCA ID 同口径),
 *  再用 '-' 连。比 wcaIdToCubingSlug 更准 —— ID 丢了词边界,无法判断 "GraDUAL" 是一个词,会误拆成 "Gra-DUAL"。
 *  name 有真实空格直接给出正确边界;撇号按 WCA 口径剥掉(Xi'an→Xian)不会 404。 */
export function nameToCubingSlug(name: string): string {
  return name
    .split(/[\s-]+/)
    .map(t => t.replace(/[^A-Za-z0-9]/g, ''))
    .filter(Boolean)
    .join('-');
}
