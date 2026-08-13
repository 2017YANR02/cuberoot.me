/**
 * 公式集组名(`A+` / `A-` / `F` / `OLL 10`)的统一排序。
 *
 * 站内口径以 zbls 库的入库顺序为准:同一个字母下 **`+` 排在 `-` 前**(A+ A- B+ B- …)。
 * `localeCompare` 默认把 `-` 判在 `+` 前,正好相反 —— 所以 `/alg` 下任何在代码里排组名的
 * 地方都走这一个函数,别各页各写一遍。
 *
 * 底名相同才比正负号;底名本身按自然序(带数字的按数值,`OLL 2` 在 `OLL 10` 前)。
 * 无正负号的组(F / S / T / O)夹在同名的 `+` 与 `-` 之间 —— 站内没有这种同名冲突,
 * 定一个序只是为了结果稳定。
 */
const SIGN_RANK: Record<string, number> = { '+': 0, '': 1, '-': 2 };

function splitSign(label: string): { base: string; sign: string } {
  const m = /^(.*?)\s*([+-])$/.exec(label.trim());
  return m ? { base: m[1], sign: m[2] } : { base: label.trim(), sign: '' };
}

function signedSibling(label: string): { key: string; sign: '+' | '-' } | null {
  const m = /^(.*?)\s*([+-])(?:\s+\([^)]*\))?$/.exec(label.trim());
  const base = m?.[1].trim();
  if (!m || !base) return null;
  return { key: base.toLocaleLowerCase('en'), sign: m[2] as '+' | '-' };
}

export function compareAlgGroupLabel(a: string, b: string): number {
  const x = splitSign(a), y = splitSign(b);
  return x.base.localeCompare(y.base, 'en', { numeric: true, sensitivity: 'base' })
    || SIGN_RANK[x.sign] - SIGN_RANK[y.sign]
    || x.base.localeCompare(y.base);
}

/**
 * 保留数据库里不同 case 名的编排，只在同一个底名占据的槽位之间把 `+` 调到 `-` 前。
 * 这样 F2L 的 A/B/C 顺序不被全局字母排序改写，ZBLL/COLL 的专用 CP 顺序也仍然有效。
 */
export function sortAlgItemsBySignedLabel<T>(items: readonly T[], labelOf: (item: T) => string): T[] {
  const buckets = new Map<string, Array<{ item: T; sign: '+' | '-'; index: number }>>();
  const parsed = items.map((item, index) => {
    const signed = signedSibling(labelOf(item));
    if (signed) {
      const bucket = buckets.get(signed.key) ?? [];
      bucket.push({ item, sign: signed.sign, index });
      buckets.set(signed.key, bucket);
    }
    return signed;
  });
  for (const bucket of buckets.values()) {
    bucket.sort((a, b) => SIGN_RANK[a.sign] - SIGN_RANK[b.sign] || a.index - b.index);
  }
  const cursor = new Map<string, number>();
  return items.map((item, index) => {
    const signed = parsed[index];
    if (!signed) return item;
    const i = cursor.get(signed.key) ?? 0;
    cursor.set(signed.key, i + 1);
    return buckets.get(signed.key)?.[i]?.item ?? item;
  });
}
