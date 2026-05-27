// 单次 / Ao5 WR 进程的手写注释 — STM / TPS / method / hardware / 备注.
// 主表 (date + holder + value) 由 stats-build/src/bin/wr333_history_build.ts 自动生成,
// 这里只补不能从 WCA dump 抽出来的人工信息.
//
// Key 形式: `${date}-${holder}` (date = ISO yyyy-mm-dd 和 JSON 主表一致).

export interface WrAnnotation {
  method?: string;
  hardware?: string;
  stm?: number;
  tps?: number;
  feature?: string;
  source?: string;
  feature_zh?: string;
}

export const SINGLE_ANNOTATIONS: Record<string, WrAnnotation> = {
  '2003-08-23-Jess Bonde': {
    method: 'CFOP',
    feature: 'first WCA-era single; Dan Knights briefly held 16.71 same day before Bonde broke it',
    feature_zh: '首个 WCA 时代单次; 同日 Dan Knights 先以 16.71 取得 WR, 当天被 Bonde 改写',
  },
  '2008-07-12-Erik Akkersdijk': {
    method: 'CFOP',
    hardware: "modified Type-A Rubik's",
    stm: 49,
    tps: 6.92,
    feature: 'famous lucky scramble — XCross + PLL skip; stood 854 days',
    feature_zh: '著名幸运打乱 — XCross + PLL skip, WR 站了 854 天',
    source: 'https://www.speedsolving.com/wiki/index.php/Erik_Akkersdijk',
  },
  '2010-11-13-Feliks Zemdegs': {
    method: 'CFOP',
    hardware: 'DaYan GuHong',
    feature: 'Feliks era begins (age 15)',
    feature_zh: 'Feliks 时代开端 (15 岁)',
  },
  '2011-06-25-Feliks Zemdegs': {
    method: 'CFOP',
    hardware: 'DaYan ZhanChi',
    stm: 50,
    tps: 8.83,
    feature: 'first sub-6 single',
    feature_zh: '首次单次 sub-6',
  },
  '2013-03-02-Mats Valk': {
    method: 'CFOP',
    hardware: 'MoYu HuanYing',
    stm: 45,
    tps: 8.11,
  },
  '2015-04-25-Collin Burns': {
    method: 'CFOP',
    hardware: 'YuXin',
    feature: 'first US single WR in modern era',
    feature_zh: '现代 WR 时期美国首个单次',
  },
  '2015-11-21-Lucas Etter': {
    method: 'CFOP',
    hardware: 'MoYu Weilong',
    stm: 41,
    tps: 8.37,
    feature: 'first sub-5 single',
    feature_zh: '首次单次 sub-5',
  },
  '2016-11-05-Mats Valk': {
    method: 'CFOP + VLS',
    hardware: 'magnetic Valk 3 (TheCubicle retrofit)',
    stm: 40,
    tps: 8.44,
    feature: 'first WR with factory-style magnets',
    feature_zh: '首个用工厂级磁铁的 WR',
  },
  '2016-12-11-Feliks Zemdegs': {
    method: 'CFOP',
    hardware: 'GAN 356 Air UM',
    stm: 49,
    tps: 10.4,
  },
  '2017-09-02-Patrick Ponce': {
    method: 'CFOP',
    hardware: 'GAN 356 Air UM',
  },
  '2017-10-28-SeungBeom Cho': {
    method: 'CFOP',
    feature: 'standing ovation',
    feature_zh: '现场起立鼓掌',
  },
  '2018-05-06-Feliks Zemdegs': {
    method: 'CFOP',
    hardware: 'Angstrom-modded GAN Air SM',
    stm: 40,
    tps: 9.5,
    feature: 'X-cross + EPLL skip',
    feature_zh: 'X-cross + EPLL skip',
  },
  '2018-11-24-Yusheng Du': {
    method: 'CFOP',
    hardware: 'GAN 356 X',
    stm: 27,
    tps: 7.78,
    feature: 'XX-cross + COLL with PLL skip; stood 4y 7m',
    feature_zh: 'XX-cross + COLL + PLL skip, WR 站 4 年 7 个月',
    source: 'https://ruwix.com/blog/yusheng-du-record-347/',
  },
  '2023-06-11-Max Park': {
    method: 'CFOP',
    hardware: 'QiYi X-Man Tornado V3 Pioneer',
    stm: 41,
    tps: 13.1,
    feature: 'first WR with double-digit sustained TPS',
    feature_zh: '首个持续 TPS 破 10 的 WR',
    source: 'https://ruwix.com/blog/max-park-rubik-single-record-313/',
  },
  '2025-02-15-Yiheng Wang': {
    method: 'CFOP (ZZ-influenced)',
    hardware: 'MoYu Super WeiLong V2',
    stm: 45,
    tps: 14.61,
    feature: 'highest TPS WR ever; Wang age 11',
    feature_zh: 'WR 级别历来最高 TPS; Wang 11 岁',
    source: 'https://speedcubing.org/blogs/news/yiheng-wang-breaks-world-record-3x3-single-with-3-08',
  },
  '2025-04-13-Xuanyi Geng': {
    method: 'CFOP + ZBLL',
    hardware: 'GAN 16 MagLev MAX',
    stm: 33,
    tps: 10.81,
    feature: 'Geng age 7; full ZBLL',
    feature_zh: 'Geng 7 岁; 全 ZBLL',
    source: 'https://ruwix.com/blog/xuanyi-geng-3_05-rubiks-cube-record-single/',
  },
  '2026-02-07-Teodor Zajder': {
    method: 'CFOP + ZBLL',
    hardware: 'GAN 12 MagLev (Signature)',
    stm: 29,
    tps: 10.50,
    feature: 'first sub-3 ever; XXX-cross + ZBLL; Zajder age 9',
    feature_zh: '人类首次单次 sub-3; XXX-cross + ZBLL; Zajder 9 岁',
    source: 'https://ruwix.com/blog/first-sub-3-rubiks-cube-record-teodor-zajder-2_76/',
  },
};

export const AO5_ANNOTATIONS: Record<string, WrAnnotation & { solves?: number[] }> = {
  '2007-01-07-JeongMin Yu': { method: 'CFOP' },
  '2013-11-16-Feliks Zemdegs': {
    method: 'CFOP',
    solves: [6.18, 6.39, 7.06, 7.04, 6.18],
  },
  '2017-06-28-Feliks Zemdegs': {
    method: 'CFOP',
    feature: 'first sub-6 Ao5',
    feature_zh: '首次 Ao5 sub-6',
  },
  '2022-07-30-Tymon Kolasiński': {
    method: 'CFOP',
    feature: 'first sub-5 Ao5',
    feature_zh: '首次 Ao5 sub-5',
  },
  '2023-06-11-Max Park': {
    method: 'CFOP',
    solves: [3.13, 4.19, 5.55, 5.39, 5.62],
    feature: 'Ao5 + single 3.13 WR in same round',
    feature_zh: '同一轮拿下 Ao5 WR + 3.13 单次 WR',
  },
  '2025-05-25-Yiheng Wang': {
    method: 'CFOP',
    feature: 'first sub-4 Ao5 ever (3.91)',
    feature_zh: '首次 Ao5 sub-4 (3.91)',
  },
  '2026-01-10-Xuanyi Geng': {
    method: 'ZB',
    feature: '8-year-old; full ZB throughout',
    feature_zh: '8 岁; 全程 ZB',
  },
  '2026-04-26-Xuanyi Geng': {
    method: 'ZB',
    solves: [2.80, 3.45, 3.84, 4.51, 3.84],
    feature: 'includes 2.80 single AsR; full ZB throughout',
    feature_zh: '内含 2.80 单次亚洲纪录; 全程 ZB',
  },
};
