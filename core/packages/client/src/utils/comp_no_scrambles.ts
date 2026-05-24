// WCA 2020 前真办过(有 results)但 dump 里 scrambles 表没出现的比赛 id。
// 1675 条,2003..2014 集中(2015 起几乎 100% 有 scrambles,2020 后没有例外),
// 名单从 WCA developer dump 一次性抽出,基本永久不变。
// 用途:/scramble/gen Comp 模式的 "随机抽一场" 过滤,免得抽中老赛 → "暂无打乱"。

let cache: Set<string> | null = null;
let inflight: Promise<Set<string>> | null = null;

export async function loadNoScrambleIds(): Promise<Set<string>> {
  if (cache) return cache;
  if (!inflight) {
    inflight = (async () => {
      try {
        const res = await fetch('/stats/comp_no_scrambles.json');
        if (!res.ok) return new Set<string>();
        const arr = await res.json();
        cache = new Set(Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string') : []);
        return cache;
      } catch {
        cache = new Set();
        return cache;
      }
    })();
  }
  return inflight;
}
