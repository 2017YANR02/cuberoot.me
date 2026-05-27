// 著名复盘 — 每条都有 STM, TPS, method, scramble, solution. 手写, 不自动生成.

export interface Reconstruction {
  name: string;
  date: string;
  time: number;
  stm: number;
  tps: number;
  method: string;
  hardware?: string;
  scramble?: string;
  solution?: string;
  source?: string;
  significance_en: string;
  significance_zh: string;
}

export const FAMOUS_RECONSTRUCTIONS: Reconstruction[] = [
  {
    name: 'Erik Akkersdijk 7.08',
    date: '2008-07-12',
    time: 7.08,
    stm: 49,
    tps: 6.92,
    method: 'CFOP, X-cross + OLL skip + 1-look PLL',
    scramble: "R2 D B U F2 R' B U' R' L F2 R' U2 F2 R2 U2 F2 L2 D L'",
    solution: "y2 R' U F2 D2 L D R' U2 R // X-cross + 1st F2L\n(U) y R U R' // 2nd pair\nU' R U2 R' U R U' R' // 3rd pair\nU L' U L // 4th pair\nU' (LL skip = AUF only)",
    source: 'https://www.speedsolving.com/wiki/index.php/Erik_Akkersdijk',
    hardware: 'modified Type-A Rubik\'s',
    significance_en: '极幸运 scramble + X-cross + OLL skip + 1-look PLL. 49 STM × 6.92 TPS 这把单次站住 WR 854 天, 到 2010-11 Zemdegs 才超过.',
    significance_zh: '极幸运打乱 + X-cross + OLL 跳过 + 1-look PLL。49 STM × 6.92 TPS, WR 站了 854 天, 到 2010-11 才被 Zemdegs 打破。',
  },
  {
    name: 'Mats Valk 4.74',
    date: '2016-11-05',
    time: 4.74,
    stm: 40,
    tps: 8.44,
    method: 'CFOP + VLS',
    hardware: 'magnetic Valk 3 (TheCubicle retrofit)',
    significance_en: 'First WR with factory-style magnets (Chris Tran 手装的 Valk 3 磁铁版).',
    significance_zh: '首个用工厂级磁铁的 WR — Valk 3 磁铁版由 TheCubicle 的 Chris Tran 手装。',
  },
  {
    name: 'Yusheng Du 3.47',
    date: '2018-11-24',
    time: 3.47,
    stm: 27,
    tps: 7.78,
    method: 'CFOP, XX-cross + 1-look LL (lucky CP-OLL skip)',
    scramble: "F U2 L2 B2 F' U L2 U R2 D2 L' B L2 B' R2 U2",
    solution: "z2 F' R U' R2 U F // XX-cross\nU' R U' R' // 3rd pair\nU' R U R' U R U' R' // 4th pair\nU R U R' U R U2 R' // OLL\nU // AUF",
    source: 'https://www.facebook.com/moyumagiccube/posts/1922639067817044',
    hardware: 'GAN 356 X',
    significance_en: '社区公认最幸运的 WR — 27 STM 极低. 站了 4 年 7 个月, 到 2023-06 Park 3.13 才被打破.',
    significance_zh: '社区公认最幸运的 WR — 27 STM 极低。WR 站了 4 年 7 个月, 直到 2023-06 Park 用 3.13 打破。',
  },
  {
    name: 'Max Park 3.13',
    date: '2023-06-11',
    time: 3.13,
    stm: 33,
    tps: 10.54,
    method: 'CFOP, double X-cross + PLL skip',
    scramble: "F2 D' R2 B2 L2 D' L2 D' F2 U' B L F' L' U2 F2 R2 U'",
    solution: "z2 y' R' U' F2 D' L2 // double X-cross\nU R U R' U' R U' R' // 3rd pair\nU2 R U' R' U R U' R' // 4th pair\nF R U R' U' F' // OLL (PLL skip)\nU // AUF",
    hardware: 'QiYi X-Man Tornado V3 Pioneer',
    significance_en: 'TPS 从 Du 7.78 跳到 Park 10.54 — 磁铁 + 智能魔方训练时代的交汇.',
    significance_zh: 'TPS 从 Du 的 7.78 跳到 Park 的 10.54 — 磁铁加智能魔方训练这两个时代的交汇。',
  },
  {
    name: 'Yiheng Wang 3.08',
    date: '2025-02-15',
    time: 3.08,
    stm: 45,
    tps: 14.61,
    method: 'CFOP, 2-look LL (OLL skip)',
    hardware: 'MoYu Super WeiLong V2',
    significance_en: 'WR 级最高持续 TPS. 全程 CFOP, 说明 CFOP 还有空间.',
    significance_zh: 'WR 级最高持续 TPS。全程 CFOP, 说明 CFOP 还有空间。',
  },
  {
    name: 'Teodor Zajder 2.76',
    date: '2026-02-07',
    time: 2.76,
    stm: 29,
    tps: 10.50,
    method: 'CFOP + ZBLL, XXX-cross',
    hardware: 'GAN 12 MagLev (Signature)',
    significance_en: '人类首次单次 sub-3. XXX-cross = cross 阶段顺手出 3 个 F2L 对. ZBLL 一个算法替代 OLL+PLL.',
    significance_zh: '人类首次单次 sub-3。XXX-cross = cross 阶段顺手做出 3 个 F2L 对, ZBLL 一个算法替代 OLL + PLL。',
  },
];
