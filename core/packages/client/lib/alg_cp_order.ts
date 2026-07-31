/**
 * 末位层公式按「角块换位」排序 —— 角块已成型的排最前,对角换次之。
 *
 * ZBLL 子组名末位那个字母说的就是角块换位(实测每个子组 12 个 case 的角块状态一致):
 *   U = 角块已成型,只差一个 AUF   D = 对角换   R / L / F / B = 四种相邻换
 * 这两类最好认、也最先学,所以列表和打印表都把它们提到**所在顶层组内**的最前面
 * (UU UD UR UL UB UF;LU LD LL LR …),其余四个保持库里的原顺序。顶层组之间不动。
 *
 * COLL 的 case 是同一批换位,只是名字里只剩编号(`U 1`..`U 6`)。下面这张对照表不是猜的:
 * 拿两边 case 自带的 sticker,把角块贴纸按各面中心格换成「面的角色」,再对整体 y 转和 AUF
 * 归一,40 个 ZBLL 子组签名两两不同,每个 COLL case 恰好命中一个。结论是每组 1 = U、
 * 末位(H 组只有 4 个,就是 4)= D。
 */

/** COLL `<组><编号>` → 角块换位字母。见文件头注:由贴纸比对得出,不是编号约定。 */
const COLL_CP: Record<string, string> = {
  AS1: 'U', AS2: 'F', AS3: 'L', AS4: 'B', AS5: 'R', AS6: 'D',
  S1: 'U', S2: 'B', S3: 'R', S4: 'F', S5: 'L', S6: 'D',
  L1: 'U', L2: 'L', L3: 'B', L4: 'R', L5: 'F', L6: 'D',
  U1: 'U', U2: 'B', U3: 'R', U4: 'F', U5: 'L', U6: 'D',
  T1: 'U', T2: 'B', T3: 'R', T4: 'F', T5: 'L', T6: 'D',
  Pi1: 'U', Pi2: 'R', Pi3: 'F', Pi4: 'L', Pi5: 'B', Pi6: 'D',
  H1: 'U', H2: 'B', H3: 'L', H4: 'D',
};

/** ZBLL 子组 `U/UD` → `D`;`Pi/PiU` → `U`。不是两级子组返回空。 */
export function zbllCpLetter(subgroup: string): string {
  const [top, sub] = subgroup.split('/');
  return sub && sub.startsWith(top) ? sub.slice(top.length) : '';
}

/** COLL case 名 `U 6` → `D`。 */
export function collCpLetter(name: string): string {
  const m = /^(AS|S|L|U|T|Pi|H)\s*(\d+)$/.exec(name.trim());
  return (m && COLL_CP[m[1] + m[2]]) || '';
}

/** U 最前,D 次之,其余同级(靠稳定排序保持原顺序)。 */
export function cpRank(letter: string): number {
  return letter === 'U' ? 0 : letter === 'D' ? 1 : 2;
}

interface CpCase { name: string; subgroup?: string }

/** 认得出换位的只有 zbll(看子组)和 coll(看 case 名);其余 set 一律同级。 */
function rankOf(set: string, c: CpCase): number {
  if (set === 'zbll') return cpRank(zbllCpLetter(c.subgroup || ''));
  if (set === 'coll') return cpRank(collCpLetter(c.name));
  return 2;
}

/** 顶层组:zbll 的子组是 `顶层/子组` 两级,coll 只有一级。 */
function topOf(set: string, c: CpCase): string {
  const s = c.subgroup || '';
  return set === 'zbll' ? s.split('/')[0] : s;
}

/**
 * 组内把 U / D 提前,顶层组的先后和组内其余顺序都不动(稳定排序)。
 * 非 zbll / coll 原样返回同一个数组引用 —— 上游 useMemo 拿它当依赖。
 */
export function sortByCp<T extends CpCase>(set: string, cases: T[]): T[] {
  if (set !== 'zbll' && set !== 'coll') return cases;
  const topOrder = new Map<string, number>();
  for (const c of cases) {
    const t = topOf(set, c);
    if (!topOrder.has(t)) topOrder.set(t, topOrder.size);
  }
  return cases
    .map((c, i) => ({ c, i, top: topOrder.get(topOf(set, c)) ?? 0, r: rankOf(set, c) }))
    .sort((a, b) => a.top - b.top || a.r - b.r || a.i - b.i)
    .map(x => x.c);
}
