// 3x3 WR 单次 + Ao5 完整历史 (2003-2026 May) — 含复盘 STM / TPS / 方法 / 硬件
// 数据来源: WCA rankings, ruwix, speedsolving wiki, speedcubing.org, reconstruction wikis

export interface WrSingle {
  date: string;
  time: number;        // seconds
  holder: string;
  country: string;
  comp: string;
  method?: string;
  hardware?: string;
  stm?: number;
  tps?: number;
  feature?: string;
  source?: string;
}

export interface WrAo5 {
  date: string;
  time: number;
  holder: string;
  country: string;
  comp: string;
  method?: string;
  solves?: number[];
  feature?: string;
  source?: string;
}

/** 完整 333 单次 WR 进程 (2003-05-23 → 2026-02-08) */
export const WR_SINGLE_HISTORY: WrSingle[] = [
  { date: '2003-08-23', time: 16.71, holder: 'Dan Knights',       country: 'US', comp: 'World Championship 2003', method: 'CFOP', feature: 'first WCA-era single; broke Minh Thai 22.95 (1982)', source: 'https://www.speedsolving.com/wiki/index.php/Dan_Knights' },
  { date: '2003-08-24', time: 16.53, holder: 'Jess Bonde',        country: 'DK', comp: 'World Championship 2003', method: 'CFOP' },
  { date: '2004-10-17', time: 12.11, holder: 'Shotaro Makisumi',  country: 'JP', comp: 'Caltech Winter 2004', method: 'CFOP', feature: 'first sub-15 (and then sub-13)', source: 'https://www.speedsolving.com/wiki/index.php/Shotaro_Makisumi' },
  { date: '2005-10-30', time: 11.75, holder: 'Jean Pons',         country: 'FR', comp: 'Dutch Open 2005', method: 'CFOP' },
  { date: '2006-01-21', time: 11.13, holder: 'Leyan Lo',          country: 'US', comp: 'Caltech Winter 2006', method: 'CFOP' },
  { date: '2006-08-19', time: 10.48, holder: 'Toby Mao',          country: 'US', comp: 'US Nationals 2006', method: 'CFOP' },
  { date: '2007-05-12', time: 10.36, holder: 'Edouard Chambon',   country: 'FR', comp: 'Belgian Open 2007', method: 'CFOP' },
  { date: '2007-06-09', time: 9.86,  holder: 'Thibaut Jacquinot', country: 'FR', comp: 'Spanish Open 2007', method: 'CFOP', feature: 'first sub-10 single' },
  { date: '2007-09-15', time: 9.77,  holder: 'Erik Akkersdijk',   country: 'NL', comp: 'Dutch Open 2007', method: 'CFOP' },
  { date: '2007-10-28', time: 9.55,  holder: 'Ron van Bruchem',   country: 'NL', comp: 'Netherlands Open 2007', method: 'CFOP', feature: 'WCA co-founder takes the WR' },
  { date: '2008-05-05', time: 8.72,  holder: 'Yu Nakajima',       country: 'JP', comp: 'Kashiwa Open 2008', method: 'CFOP' },
  { date: '2008-07-13', time: 7.08,  holder: 'Erik Akkersdijk',   country: 'NL', comp: 'Czech Open 2008', method: 'CFOP', hardware: 'modified Type-A Rubik\'s', stm: 49, tps: 6.92, feature: 'famous lucky scramble — XCross + PLL skip; stood 854 days', source: 'https://www.speedsolving.com/wiki/index.php/Erik_Akkersdijk' },
  { date: '2010-11-13', time: 7.03,  holder: 'Feliks Zemdegs',    country: 'AU', comp: 'Melbourne Cube Day 2010', method: 'CFOP', hardware: 'DaYan GuHong', feature: 'Feliks era begins (age 15)' },
  { date: '2010-11-13', time: 6.77,  holder: 'Feliks Zemdegs',    country: 'AU', comp: 'Melbourne Cube Day 2010', method: 'CFOP', hardware: 'DaYan GuHong' },
  { date: '2011-01-29', time: 6.65,  holder: 'Feliks Zemdegs',    country: 'AU', comp: 'Kubaroo Open 2011', method: 'CFOP' },
  { date: '2011-04-09', time: 6.24,  holder: 'Feliks Zemdegs',    country: 'AU', comp: 'Melbourne Cube Day 2011', method: 'CFOP' },
  { date: '2011-06-19', time: 5.66,  holder: 'Feliks Zemdegs',    country: 'AU', comp: 'Melbourne Winter Open 2011', method: 'CFOP', hardware: 'DaYan ZhanChi', stm: 50, tps: 8.83, feature: 'first sub-6 single' },
  { date: '2013-03-02', time: 5.55,  holder: 'Mats Valk',         country: 'NL', comp: 'Zonhoven Open 2013', method: 'CFOP', hardware: 'MoYu HuanYing', stm: 45, tps: 8.11 },
  { date: '2015-04-25', time: 5.25,  holder: 'Collin Burns',      country: 'US', comp: 'Doylestown Spring 2015', method: 'CFOP', hardware: 'YuXin', feature: 'first US single WR in modern era' },
  { date: '2015-11-21', time: 5.09,  holder: 'Keaton Ellis',      country: 'US', comp: 'River Hill Fall 2015', method: 'CFOP', feature: 'held WR for ~30 minutes' },
  { date: '2015-11-21', time: 4.90,  holder: 'Lucas Etter',       country: 'US', comp: 'River Hill Fall 2015', method: 'CFOP', hardware: 'MoYu Weilong', stm: 41, tps: 8.37, feature: 'first sub-5 single' },
  { date: '2016-11-06', time: 4.74,  holder: 'Mats Valk',         country: 'NL', comp: 'Jawa Timur Open 2016', method: 'CFOP + VLS', hardware: 'magnetic Valk 3 (TheCubicle retrofit)', stm: 40, tps: 8.44, feature: 'first WR with factory-style magnets' },
  { date: '2016-12-11', time: 4.73,  holder: 'Feliks Zemdegs',    country: 'AU', comp: 'POPS Open 2016', method: 'CFOP', hardware: 'GAN 356 Air UM', stm: 49, tps: 10.4 },
  { date: '2017-08-26', time: 4.69,  holder: 'Patrick Ponce',     country: 'US', comp: 'Rally In The Valley 2017', method: 'CFOP', hardware: 'GAN 356 Air UM' },
  { date: '2017-10-28', time: 4.59,  holder: 'SeungBeom Cho',     country: 'KR', comp: 'ChicaGhosts 2017', method: 'CFOP', feature: 'standing ovation' },
  { date: '2018-05-06', time: 4.22,  holder: 'Feliks Zemdegs',    country: 'AU', comp: 'Cube for Cambodia 2018', method: 'CFOP', hardware: 'Angstrom-modded GAN Air SM', stm: 40, tps: 9.5, feature: 'X-cross + EPLL skip' },
  { date: '2018-11-24', time: 3.47,  holder: 'Yusheng Du',        country: 'CN', comp: 'Wuhu Open 2018', method: 'CFOP', hardware: 'GAN 356 X', stm: 29, tps: 8.36, feature: 'XX-cross + COLL with PLL skip; stood 4y 7m', source: 'https://ruwix.com/blog/yusheng-du-record-347/' },
  { date: '2023-06-11', time: 3.13,  holder: 'Max Park',          country: 'US', comp: 'Pride in Long Beach 2023', method: 'CFOP', hardware: 'QiYi X-Man Tornado V3 Pioneer', stm: 41, tps: 13.1, feature: 'first WR with double-digit sustained TPS', source: 'https://ruwix.com/blog/max-park-rubik-single-record-313/' },
  { date: '2025-02-16', time: 3.08,  holder: 'Yiheng Wang',       country: 'CN', comp: 'XMUM Cube Open 2025', method: 'CFOP (ZZ-influenced)', hardware: 'MoYu Super WeiLong V2', stm: 45, tps: 14.61, feature: 'highest TPS WR ever; Wang age 11', source: 'https://speedcubing.org/blogs/news/yiheng-wang-breaks-world-record-3x3-single-with-3-08' },
  { date: '2025-04-19', time: 3.05,  holder: 'Xuanyi Geng',       country: 'CN', comp: 'Shenyang Spring 2025', method: 'CFOP + ZBLL', hardware: 'GAN 16 MagLev MAX', stm: 33, tps: 10.81, feature: 'Geng age 7-8; ZBLL', source: 'https://ruwix.com/blog/xuanyi-geng-3_05-rubiks-cube-record-single/' },
  { date: '2026-02-08', time: 2.76,  holder: 'Teodor Zajder',     country: 'PL', comp: 'GLS Big Cubes Gdańsk 2026', method: 'CFOP + ZBLL', hardware: 'GAN 12 MagLev (Signature)', stm: 29, tps: 10.50, feature: 'first sub-3 ever; XX-cross + ZBLL; Zajder age 9', source: 'https://ruwix.com/blog/first-sub-3-rubiks-cube-record-teodor-zajder-2_76/' },
];

/** 完整 333 Ao5 WR 进程 (2007 起, WCA Ao5 引入) */
export const WR_AO5_HISTORY: WrAo5[] = [
  { date: '2007-08-01', time: 15.10, holder: 'Edouard Chambon',   country: 'FR', comp: 'French Championship 2007', method: 'CFOP' },
  { date: '2008-08-30', time: 11.48, holder: 'Erik Akkersdijk',   country: 'NL', comp: 'Czech Open 2008', method: 'CFOP' },
  { date: '2009-04-04', time: 10.07, holder: 'Tomasz Żołnowski',  country: 'PL', comp: 'Polish Open 2009', method: 'CFOP' },
  { date: '2010-05-01', time: 9.21,  holder: 'Feliks Zemdegs',    country: 'AU', comp: 'Melbourne Cube Day 2010', method: 'CFOP' },
  { date: '2011-11-13', time: 7.87,  holder: 'Feliks Zemdegs',    country: 'AU', comp: 'Melbourne Cube Day 2011', method: 'CFOP' },
  { date: '2013-03-08', time: 7.53,  holder: 'Mats Valk',         country: 'NL', comp: 'Zonhoven Open 2013', method: 'CFOP' },
  { date: '2014-04-26', time: 6.54,  holder: 'Feliks Zemdegs',    country: 'AU', comp: 'Kubaroo Open 2014', method: 'CFOP', solves: [6.18, 6.39, 7.06, 7.04, 6.18] },
  { date: '2017-09-23', time: 6.39,  holder: 'Feliks Zemdegs',    country: 'AU', comp: 'POPS Open 2017', method: 'CFOP' },
  { date: '2018-12-09', time: 5.97,  holder: 'Feliks Zemdegs',    country: 'AU', comp: 'Odd Day in Sydney 2018', method: 'CFOP', feature: 'first sub-6 Ao5' },
  { date: '2019-03-23', time: 5.80,  holder: 'Feliks Zemdegs',    country: 'AU', comp: 'Cube for Cambodia 2019', method: 'CFOP' },
  { date: '2022-04-23', time: 5.48,  holder: 'Tymon Kolasiński',  country: 'PL', comp: 'Cubing Spring Series 2022', method: 'CFOP', solves: [4.99, 4.79, 6.05, 6.65, 5.59] },
  { date: '2023-06-11', time: 4.86,  holder: 'Max Park',          country: 'US', comp: 'Pride in Long Beach 2023', method: 'CFOP', solves: [3.13, 4.19, 5.55, 5.39, 5.62], feature: 'WR ao5 + single 3.13 in same round' },
  { date: '2025-01-12', time: 4.48,  holder: 'Yiheng Wang',       country: 'CN', comp: 'Beijing Hopeful Winter 2025', method: 'CFOP' },
  { date: '2026-01-11', time: 3.84,  holder: 'Xuanyi Geng',       country: 'CN', comp: 'Beijing Winter 2026', method: 'ZB', feature: 'first sub-4 Ao5 ever' },
  { date: '2026-04-26', time: 3.71,  holder: 'Xuanyi Geng',       country: 'CN', comp: 'Deqing Short-Time 2026', method: 'ZB', solves: [2.80, 3.45, 3.84, 4.51, 3.84], feature: 'includes 2.80 single AsR; full ZB throughout' },
];

/** 三阶 sub-X 历史里程碑节点 — 给"突破时间轴"可视化 */
export const SUB_X_MILESTONES: Array<{ threshold: number; year: number; date?: string; holder: string; note_en?: string; note_zh?: string }> = [
  { threshold: 15, year: 2004, date: '2004-06-26', holder: 'Shotaro Makisumi', note_en: 'first sub-15 single', note_zh: '首次单次 sub-15' },
  { threshold: 10, year: 2007, date: '2007-08-31', holder: 'Thibaut Jacquinot', note_en: 'first sub-10 single', note_zh: '首次单次 sub-10' },
  { threshold: 8,  year: 2008, date: '2008-08-30', holder: 'Erik Akkersdijk',   note_en: 'first sub-8 single (lucky)', note_zh: '首次单次 sub-8 (幸运)' },
  { threshold: 7,  year: 2010, date: '2010-05-01', holder: 'Feliks Zemdegs',    note_en: 'first sub-7 single', note_zh: '首次单次 sub-7' },
  { threshold: 6,  year: 2011, date: '2011-11-13', holder: 'Feliks Zemdegs',    note_en: 'first sub-6.25 single', note_zh: '首次单次 sub-6.25' },
  { threshold: 5,  year: 2015, date: '2015-11-21', holder: 'Lucas Etter',       note_en: 'first sub-5 single', note_zh: '首次单次 sub-5' },
  { threshold: 4,  year: 2018, date: '2018-11-24', holder: 'Yusheng Du',        note_en: 'first sub-4 single (3.47, lucky)', note_zh: '首次单次 sub-4 (3.47, 幸运)' },
  { threshold: 3,  year: 2026, date: '2026-02-08', holder: 'Teodor Zajder',     note_en: 'first sub-3 single (2.76)', note_zh: '首次单次 sub-3 (2.76)' },
];

export const SUB_X_AO5: Array<{ threshold: number; year: number; date?: string; holder: string; note_en?: string; note_zh?: string }> = [
  { threshold: 15, year: 2007, date: '2007-08-01', holder: 'Edouard Chambon',   note_en: 'first sub-15 Ao5', note_zh: '首次 Ao5 sub-15' },
  { threshold: 12, year: 2008, date: '2008-08-30', holder: 'Erik Akkersdijk',   note_en: 'first sub-12 Ao5 (11.48)', note_zh: '首次 Ao5 sub-12 (11.48)' },
  { threshold: 10, year: 2010, date: '2010-05-01', holder: 'Feliks Zemdegs',    note_en: 'first sub-10 Ao5 (9.21)', note_zh: '首次 Ao5 sub-10 (9.21)' },
  { threshold: 8,  year: 2011, date: '2011-11-13', holder: 'Feliks Zemdegs',    note_en: 'first sub-8 Ao5 (7.87)', note_zh: '首次 Ao5 sub-8 (7.87)' },
  { threshold: 7,  year: 2014, date: '2014-04-26', holder: 'Feliks Zemdegs',    note_en: 'first sub-7 Ao5 (6.54)', note_zh: '首次 Ao5 sub-7 (6.54)' },
  { threshold: 6,  year: 2018, date: '2018-12-09', holder: 'Feliks Zemdegs',    note_en: 'first sub-6 Ao5 (5.97)', note_zh: '首次 Ao5 sub-6 (5.97)' },
  { threshold: 5,  year: 2023, date: '2023-06-11', holder: 'Max Park',          note_en: 'first sub-5 Ao5 (4.86)', note_zh: '首次 Ao5 sub-5 (4.86)' },
  { threshold: 4,  year: 2026, date: '2026-01-11', holder: 'Xuanyi Geng',       note_en: 'first sub-4 Ao5 (3.84)', note_zh: '首次 Ao5 sub-4 (3.84)' },
];

/** 著名复盘 — 每个都有 STM, TPS, method 注释 */
export const FAMOUS_RECONSTRUCTIONS = [
  {
    name: 'Erik Akkersdijk 7.08',
    date: '2008-08-30',
    time: 7.08,
    stm: 33,
    tps: 4.66,
    method: 'CFOP, X-cross + OLL skip + 1-look PLL',
    scramble: "R2 D B U F2 R' B U' R' L F2 R' U2 F2 R2 U2 F2 L2 D L'",
    solution: "y2 R' U F2 D2 L D R' U2 R // X-cross + 1st F2L\n(U) y R U R' // 2nd pair\nU' R U2 R' U R U' R' // 3rd pair\nU L' U L // 4th pair\nU' (LL skip = AUF only)",
    source: 'https://www.speedsolving.com/wiki/index.php/Erik_Akkersdijk',
    significance_en: 'Famous example of "8-year-old WR via luck" — 33 STM at 4.66 TPS stood as a benchmark single for nearly 10 years until Zemdegs got close in 2017.',
    significance_zh: '著名"8 年 WR 靠运气"案例 — 33 STM × 4.66 TPS 单次的标杆地位保持近 10 年, 直到 2017 年 Zemdegs 才接近.',
  },
  {
    name: 'Mats Valk 4.74',
    date: '2016-11-06',
    time: 4.74,
    stm: 35,
    tps: 7.38,
    method: 'CFOP, X-cross + lucky LL',
    scramble: "B2 D2 B2 U2 L2 D' F2 R2 D B2 D' B U' F U' L2 R F' L2 U'",
    hardware: 'magnetic Valk 3 (first WR with factory magnets in retrofit)',
    significance_en: 'First WR with magnetic 3x3. The Valk 3 was retrofitted by Chris Tran of TheCubicle.',
    significance_zh: '首个磁铁 3x3 WR. 该 Valk 3 是 TheCubicle 的 Chris Tran 手装磁铁.',
  },
  {
    name: 'Yusheng Du 3.47',
    date: '2018-11-24',
    time: 3.47,
    stm: 27,
    tps: 7.78,
    method: 'CFOP, XX-cross (2 pairs done with cross) + 1-look LL (lucky CP-OLL skip)',
    scramble: "F U2 L2 B2 F' U L2 U R2 D2 L' B L2 B' R2 U2",
    solution: "z2 F' R U' R2 U F // XX-cross\nU' R U' R' // 3rd pair\nU' R U R' U R U' R' // 4th pair\nU R U R' U R U2 R' // OLL\nU // AUF",
    source: 'https://www.facebook.com/moyumagiccube/posts/1922639067817044',
    hardware: 'GAN 356 X',
    significance_en: 'Most "lucky" WR by community consensus — 27 STM is extremely low. Stood 4.5 years until Park 3.13 (2023).',
    significance_zh: '社区公认最"幸运"的 WR — 27 STM 极低. 4.5 年标杆地位, 直到 2023 Park 3.13.',
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
    hardware: 'GAN 13 MagLev',
    significance_en: 'TPS jump from Du 7.78 → Park 10.54. Magnet era + smart-cube training era convergence.',
    significance_zh: 'TPS 跳跃 Du 7.78 → Park 10.54. 磁铁 + 智能魔方训练时代汇流.',
  },
  {
    name: 'Yiheng Wang 3.08',
    date: '2025-02-10',
    time: 3.08,
    stm: 45,
    tps: 14.61,
    method: 'CFOP, 2-look LL (OLL skip)',
    significance_en: 'Highest verified WR-grade sustained TPS. Pure CFOP throughout, suggests CFOP still has room.',
    significance_zh: 'WR 级最高持续 TPS. 全程 CFOP, 说明 CFOP 还有空间.',
  },
  {
    name: 'Teodor Zajder 2.76',
    date: '2026-02-08',
    time: 2.76,
    stm: 29,
    tps: 10.50,
    method: 'CFOP, XXX-cross + ZBLL (oriented LL in one alg)',
    significance_en: 'First sub-3 ever. XXX-cross = 3 F2L pairs in cross block. ZBLL replaces OLL+PLL with single alg.',
    significance_zh: '人类首次 sub-3. XXX-cross = cross 阶段顺手 3 个 F2L 对. ZBLL 一个算法替代 OLL+PLL.',
  },
];
