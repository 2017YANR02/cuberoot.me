// 固定种子 mulberry32 PRNG。reservoir 采样确定化 -> 输入不变则输出逐字节不变。
// build.ts (每变体按 key reseed 隔离) 与 build_wca_cross.ts 共用同一实现, 防两份漂移。
export function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
