// Ported from packages/client-vite/src/utils/trainerCaseKey.ts
import type { AlgCase } from '@cuberoot/shared';

/**
 * case 在一场训练里的唯一键。
 *
 * 单集会话:`subgroup|name`(历史格式,标记 / 记忆 / 勾选全按它存,不能改)。
 * 合练会话:前面加成员 set —— `zbll:U|Ua`。PLL 和 ZBLL 里都有 `T|…`,不限定就会串味。
 * 限定只发生在带 `srcSet` 的 case 上,所以单集那条路径逐字节不变。
 */
export function caseKey(c: { subgroup: string; name: string; srcSet?: string }): string {
  const raw = `${c.subgroup}|${c.name}`;
  return c.srcSet ? `${c.srcSet}:${raw}` : raw;
}

/**
 * 按数组身份缓存 key → case 的索引。虚拟集(LSLL)一场能有 15,552 个 case,而每次渲染
 * 都要查当前 / 上一个 / 下一个 / 历史里每一条 —— 线性 find 会把一次渲染变成几十万次比较。
 * 换了 cases 数组(换会话)自然换索引;store 现算打乱时**原地**改 case 正是为了不换数组。
 */
const INDEX = new WeakMap<AlgCase[], Map<string, AlgCase>>();

export function findCaseByKey(cases: AlgCase[], key: string): AlgCase | undefined {
  let idx = INDEX.get(cases);
  if (!idx) {
    idx = new Map(cases.map(c => [caseKey(c), c]));
    INDEX.set(cases, idx);
  }
  return idx.get(key);
}

/**
 * 拆一个可能带 set 前缀的 key。
 *
 * 只有前缀确实是本场的成员 set 才算限定 —— 单集 key 里的 subgroup 理论上也可能含 `:`,
 * 拿成员表比对比盲拆安全。`sets` 为空(单集会话)时一律当未限定。
 */
export function splitCaseKey(key: string, sets: readonly string[] | null | undefined): {
  /** 该 case 属于哪个 set;单集会话为 null。 */
  set: string | null;
  /** 去掉前缀后的 set 内原始 key —— 标记 / 记忆按它存,与单独练那套是同一份。 */
  raw: string;
} {
  if (sets && sets.length > 0) {
    const i = key.indexOf(':');
    if (i > 0) {
      const head = key.slice(0, i);
      if (sets.includes(head)) return { set: head, raw: key.slice(i + 1) };
    }
  }
  return { set: null, raw: key };
}

/** 给一批 key 按成员 set 分组(写标记 / 记忆时用,一个 set 一次落地)。 */
export function groupKeysBySet(
  keys: readonly string[], sets: readonly string[] | null | undefined,
): Map<string | null, { key: string; raw: string }[]> {
  const out = new Map<string | null, { key: string; raw: string }[]>();
  for (const key of keys) {
    const { set, raw } = splitCaseKey(key, sets);
    const arr = out.get(set) ?? [];
    arr.push({ key, raw });
    out.set(set, arr);
  }
  return out;
}
