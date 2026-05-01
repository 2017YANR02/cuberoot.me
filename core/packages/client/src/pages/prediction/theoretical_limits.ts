// 每个 WCA 项目的物理极限分解 + 方法 / 硬件演进时间线
// 用于 EventSection 里的 "方法 + 硬件演进 + 物理极限" 章节
//
// 数据来源 (核心):
//  - WCA 官方 rankings + person profiles (worldcubeassociation.org)
//  - speedsolving.com wiki / WR threads / 选手 profile
//  - speedcubing.org news, ruwix.com, cubzor.com
//  - Cubeskills (Zemdegs "What Are The Limits?"), TheCubicle, Cubelelo
//  - 选手访谈 / 复盘 (MoYu reco, GANCUBE blog)
//  - Wikipedia "Optimal solutions for the Rubik's Cube", cube20.org (God's number)
//  - PMC / Guinness (生物力学对照: 手指敲击, 击鼓, 速记打字)
//
// 标注约定:
//  - WR 数字 / 复盘 STM&TPS 都是 verified by 2+ sources (V2+)
//  - "现实下界" / "物理下界" 是 first-principles 推导
//  - 反映方法 / 硬件 / 步数 / TPS / 识别 五因素

export interface MethodEra {
  start_year: number;
  method: string;
  method_zh: string;
  alg_count?: number;
  avg_stm?: number;
  notes_en?: string;
  notes_zh?: string;
}

export interface HardwareEra {
  year: number;
  milestone_en: string;
  milestone_zh: string;
}

export interface DecompRow {
  scenario_en: string;
  scenario_zh: string;
  M: number;
  TPS: number;
  R: number;
  T?: number;
  note_en?: string;
  note_zh?: string;
}

export interface TheoreticalLimit {
  current_method_en: string;
  current_method_zh: string;
  method_eras: MethodEra[];
  hardware_eras: HardwareEra[];
  decomp: DecompRow[];
  best_reconstructions?: Array<{
    person: string;
    date: string;
    time: string;
    M: number;
    TPS: number;
    method: string;
    source_url?: string;
  }>;
  reasoning_en: string;
  reasoning_zh: string;
  why_fit_differs_en?: string;
  why_fit_differs_zh?: string;
}

export const THEORETICAL_LIMITS: Record<string, TheoreticalLimit> = {

  // ════════════════════════════════════════════════════════════
  //  333 — 三阶 (核心样板, 最详尽)
  // ════════════════════════════════════════════════════════════
  '333': {
    current_method_en:
      'The 2026 frontier is the full ZB method = ZBLS (Zborowski-Bruchem Last Slot, ~302 cases — orient edges during the last F2L pair so the cube enters last-layer with cross + corners + EO already done) + ZBLL (493 cases — 1-alg LL given EO). Combined effect: a ZB solve is "F2L → 1 alg → done", saving ~5 STM and ~0.4 s of recognition vs CFOP\'s 2-step OLL+PLL. Xuanyi Geng (耿暄一) holds the current WR average 3.84 (Beijing Winter 2026-01-11, GAN 16 MagLev MAX UV) with all five solves using xcross/pseudo-cross + ZBLS + ZBLL — beating Yiheng Wang\'s prior 3.91. Wang holds the WR single 3.08 with vanilla CFOP + 2-look OLL — a non-maxed-out method, which is the strongest argument that CFOP-only still has room. Below ZB, full 1LLL (~3,668 cases, Eduardo Silva Damasceno first learned 2022) is the next step but requires recognition speed gains we have not yet seen. Roux caps at sub-4 single / sub-6 average (Alexey Tsvetkov 3.95 single, SPV / Tsvetkov / Cuares / Arradaza all sub-6 Ao5).',
    current_method_zh:
      '2026 年顶级前沿是**全 ZB 方法 = ZBLS (Zborowski-Bruchem Last Slot, ~302 cases — 在 F2L 最后一对就把 EO 控制好,使最后一层进入"cross + 角 + EO 全就绪"的状态) + ZBLL (493 cases — 给定 EO 后 1 算法解 LL)**。综合效果:ZB 解法 = "F2L → 一个算法 → 完成",比 CFOP 的两步 OLL+PLL 省 ~5 STM 和 ~0.4 秒识别。**耿暄一 (Xuanyi Geng) 当前持有 WR 平均 3.84 秒 (北京冬季 2026-01-11,GAN 16 MagLev MAX UV),5 把全部用 xcross / pseudo-cross + ZBLS + ZBLL —— 把王艺衡之前的 3.91 改写**。王艺衡持有 WR 单次 3.08 用的还是 CFOP 朴素 + 2-look OLL,即"WR 单次仍是非极限方法在打",这恰好说明 CFOP 本身仍有空间。ZB 之下还有全 1LLL (~3668 cases,Eduardo Silva Damasceno 2022 首学完),但需要识别速度跟上。Roux 上限是 sub-4 单次 / sub-6 平均 (Tsvetkov 3.95 单次是 Roux 历史首破 4 秒)。',
    method_eras: [
      { start_year: 1981, method: 'Layer-by-layer / Beginner', method_zh: '逐层入门法', avg_stm: 130, notes_en: 'WC1982 era; ~22 s WR', notes_zh: 'WC1982 时代;~22 秒 WR' },
      { start_year: 1997, method: 'Fridrich / CFOP (proposed by Jessica Fridrich)', method_zh: 'Fridrich / CFOP (Jessica Fridrich 提出)', alg_count: 78, avg_stm: 62 },
      { start_year: 2003, method: 'CFOP + 4-look LL', method_zh: 'CFOP + 4-look LL', alg_count: 20, avg_stm: 62 },
      { start_year: 2007, method: 'CFOP + full OLL/PLL', method_zh: 'CFOP + 全 OLL/PLL', alg_count: 78, avg_stm: 58, notes_en: 'Feliks Zemdegs measured 58 STM / 62 ETM', notes_zh: 'Feliks Zemdegs 实测 58 STM / 62 ETM' },
      { start_year: 2017, method: 'CFOP + extended F2L lookahead (post-magnet era)', method_zh: 'CFOP + 扩展 F2L lookahead (磁铁时代后)', avg_stm: 56 },
      { start_year: 2022, method: 'CFOP + full ZBLL only (LL 1-alg, EO not pre-controlled)', method_zh: 'CFOP + 全 ZBLL (LL 1 alg,EO 未预控)', alg_count: 493, avg_stm: 52, notes_en: 'Tymon, Zajder use; Geng moved on', notes_zh: 'Tymon / Zajder 用;耿暄一已升级' },
      { start_year: 2024, method: 'High-TPS-driven CFOP (Yiheng Wang school)', method_zh: '高 TPS 驱动 CFOP (王艺衡流派)', avg_stm: 56, notes_en: 'Sustained 14+ TPS, 2-look OLL kept for recog speed', notes_zh: '持续 14+ TPS,保留 2-look OLL 换识别速度' },
      { start_year: 2026, method: 'Full ZB method = ZBLS + ZBLL (Xuanyi Geng, current WR avg)', method_zh: '全 ZB 方法 = ZBLS + ZBLL (耿暄一,现 WR 平均)', alg_count: 795, avg_stm: 49, notes_en: 'Geng 3.84 avg (Beijing Winter 2026); EO controlled in last F2L pair → 1-alg LL', notes_zh: '耿暄一 3.84 平均 (北京冬季 2026);最后一对 F2L 内控好 EO,LL 1 算法搞定' },
    ],
    hardware_eras: [
      { year: 2011, milestone_en: 'DaYan ZhanChi — torpedoes, end of "core lock-up" era', milestone_zh: 'DaYan 展逸 — 防卡死结构,核心锁死时代终结' },
      { year: 2013, milestone_en: 'MoYu WeiLong / QiYi AoLong — first sub-6 era cube', milestone_zh: 'MoYu 威龙 / QiYi 傲龙 — sub-6 时代主力' },
      { year: 2016, milestone_en: 'First magnet retrofits (TheCubicle / Chris Tran). Magnetic Valk 3 used by Mats Valk for 4.74 WR.', milestone_zh: '首批磁铁后装 (TheCubicle / Chris Tran)。Mats Valk 用磁铁 Valk 3 创 4.74 WR' },
      { year: 2017, milestone_en: 'GAN 356 Air UM — first mass-produced factory-magnetized flagship (Jan 2017)', milestone_zh: 'GAN 356 Air UM — 首批量产出厂磁铁旗舰 (2017-01)' },
      { year: 2020, milestone_en: 'GAN 11 M Pro — first core-magnet flagship (2020-09-30)', milestone_zh: 'GAN 11 M Pro — 首批核心磁铁旗舰 (2020-09-30)' },
      { year: 2021, milestone_en: 'GAN 12 MagLev — first mass-produced magnetic-suspension (no spring)', milestone_zh: 'GAN 12 MagLev — 首批量产磁悬浮 (无弹簧)' },
      { year: 2022, milestone_en: 'MoYu Super RS3M — early ball-core consumer flagship', milestone_zh: 'MoYu Super RS3M — 早期 ball-core 量产旗舰' },
      { year: 2024, milestone_en: 'GAN 14 / GAN 16 Max — refined MagLev + 8-magnet ball-core', milestone_zh: 'GAN 14 / 16 Max — 精修 MagLev + 8 磁铁 ball-core' },
    ],
    decomp: [
      { scenario_en: 'Yusheng Du 3.47 (2018, lucky CP-OLL skip)', scenario_zh: 'Yusheng Du 3.47 (2018, 幸运 CP-OLL skip)', M: 27, TPS: 7.78, R: 0.0 },
      { scenario_en: 'Max Park 3.13 (2023, double X-cross + PLL skip)', scenario_zh: 'Max Park 3.13 (2023, 双 X-cross + PLL skip)', M: 33, TPS: 10.54, R: 0.0 },
      { scenario_en: 'Yiheng Wang 3.08 (2025, highest WR TPS)', scenario_zh: 'Yiheng Wang 3.08 (2025, WR 中最高 TPS)', M: 45, TPS: 14.61, R: 0.0 },
      { scenario_en: 'Teodor Zajder 2.76 (2026, ZBLL on XXX-cross)', scenario_zh: 'Teodor Zajder 2.76 (2026, ZBLL on XXX-cross)', M: 29, TPS: 10.50, R: 0.0 },
      { scenario_en: 'Realistic future floor (lucky scramble + Wang-class TPS + ZBLL)', scenario_zh: '现实下界 (幸运 scramble + Wang 级 TPS + ZBLL)', M: 30, TPS: 14, R: 0.1 },
      { scenario_en: 'Physical floor (28 STM + 16 TPS biomech ceiling + zero pause)', scenario_zh: '物理下界 (28 STM + 16 TPS 生理上限 + 零停顿)', M: 28, TPS: 16, R: 0.05, note_en: 'User-stated 1.8 s, verified achievable in principle', note_zh: '用户提出的 1.8 秒,原理上可达' },
    ],
    best_reconstructions: [
      { person: 'Yusheng Du (杜宇生)', date: '2018-11-24', time: '3.47 s', M: 27, TPS: 7.78, method: 'CFOP, XX-cross + 1-look LL (lucky CP-OLL)', source_url: 'https://www.facebook.com/moyumagiccube/photos/reconstruction-of-yusheng-dus-347-33-wrscramble-f-u2-l2-b2-f-u-l2-u-r2-d2-l-b-l2/1922639067817044/' },
      { person: 'Max Park', date: '2023-06-11', time: '3.13 s', M: 33, TPS: 10.54, method: 'CFOP, double X-cross + PLL skip', source_url: 'https://ruwix.com/blog/max-park-rubik-single-record-313/' },
      { person: 'Yiheng Wang (王艺衡)', date: '2025', time: '3.08 s', M: 45, TPS: 14.61, method: 'CFOP, 2-look LL (OLL skip) — current WR single', source_url: 'https://speedcubing.org/blogs/news/yiheng-wang-breaks-world-record-3x3-single-with-3-08' },
      { person: 'Teodor Zajder', date: '2026-02-08', time: '2.76 s', M: 29, TPS: 10.50, method: 'CFOP, XXX-cross + ZBLL', source_url: 'https://ruwix.com/blog/first-sub-3-rubiks-cube-record-teodor-zajder-2_76/' },
      { person: 'Xuanyi Geng (耿暄一) avg solve 5', date: '2026-01-11', time: '3.37 s', M: 43, TPS: 12.76, method: 'pseudo-cross + ZBLS + ZBLL (WR avg 3.84)', source_url: 'https://ruwix.com/blog/xuanyi-geng-3_84-seconds-average-record/' },
      { person: 'Xuanyi Geng (耿暄一) avg solve 3', date: '2026-01-11', time: '3.71 s', M: 50, TPS: 13.48, method: 'pseudo-cross + ZBLS + ZBLL', source_url: 'https://ruwix.com/blog/xuanyi-geng-3_84-seconds-average-record/' },
      { person: 'Ruihang Xu (unofficial)', date: '2021', time: '2.68 s', M: 26, TPS: 9.70, method: 'CFOP, lucky scramble (warmup, not WCA)', source_url: 'https://www.speedsolving.com/threads/reconstruction-2-68-3x3-world-best-single-ruihang-xu.80181/' },
    ],
    reasoning_en:
      'A 3x3 solve decomposes as T = M / TPS_eff + R (move count / effective TPS + recognition pauses). Verified data anchors:\n\n' +
      '(1) STM: God\'s number = 20 HTM (proven 2010 by Rokicki et al.); ~67% of random scrambles are optimally 18 HTM. CFOP elite hits 55-60 STM on random scrambles, 26-33 STM on the luckiest WR scrambles. Geng\'s WR average (Beijing Winter 2026) shows the ZB advantage: all 5 solves at 43-53 STM (mean ~49), well below CFOP\'s 56 baseline — the savings come from absorbing EO into the last F2L pair, leaving a 1-alg LL.\n\n' +
      '(2) TPS: Wang sustained 16.62 TPS on a 57-move unofficial 3.43 s solve — the highest documented sustained TPS. Geng\'s 3.84 average had four solves at 12-13.5 TPS sustained while running ZB algorithms (more finger-trick non-trivial than CFOP); this is arguably more impressive per-move-difficulty. Biomechanical ceiling: musculoskeletal models give 6 Hz / finger; with 4 active fingers alternating + auditory pacing, 15-24 TPS is the raw upper band. Wang is at this band — further TPS gain requires hardware revolution or new biomechanical adaptation.\n\n' +
      '(3) Recognition: ZB has the lowest recognition cost — EO + corners are read during the last F2L pair, then LL is one alg with R ≈ 0 (vs CFOP\'s ~0.4 s for OLL → PLL handover). This is why Geng beats Wang on average even with lower TPS: Wang\'s mind switches OLL → PLL → execute (two stages), Geng\'s is read LL → one alg (one stage).\n\n' +
      '(4) Current landscape: Wang holds WR single 3.08 (CFOP + 2-look OLL, won by TPS), Geng holds WR average 3.84 (ZB method, won by stability + STM efficiency). Two paths: Wang = "brute-force TPS to biomech ceiling"; Geng = "method-driven STM reduction + simpler recognition". Geng\'s path has higher ceiling because TPS is near limit while methods can still evolve to full 1LLL.\n\n' +
      'Combining: single physical floor = M / TPS + R = 28 / 16 + 0.05 ≈ 1.80 s. This is a "lucky-scramble + peak-biomech" lower bound, not a sustainable average. Realistic future WR singles will trend to 2.0-2.2 s as elite cohort grows (EVT: WR ≈ μ - z·σ with z = √(2 ln N); reaching 2.0 s requires ~10⁸ elite official solves, ~100 years at current rates). Ao5 floor ~3.0-3.5 s (assuming full 1LLL + mature ZB-EO control), bounded by execution noise (within-run SD ≈ 0.3 s).',
    reasoning_zh:
      '三阶解算 T = M / TPS_eff + R (步数 / 有效 TPS + 识别停顿)。已验证锚点:\n\n' +
      '(1) 步数:God\'s number = 20 HTM (Rokicki 等 2010 证明);~67% 随机 scramble 的 optimal = 18 HTM。CFOP 顶级随机 scramble 55-60 STM,WR 级幸运 scramble (XX/XXX-cross + LL skip) 26-33 STM。**耿暄一 WR 平均 5 把全部 43-53 STM**(平均 ~49),远低于 CFOP 普通 56,这就是 ZB 方法 (ZBLS + ZBLL) 的步数红利:在 F2L 最后一对就消化掉 EO,LL 一个算法就完。"幸运 1-look ZBLL" 步数下界 ~28 STM。\n\n' +
      '(2) TPS:王艺衡在 57 步非正式 3.43 秒解上跑出 16.62 TPS 持续 — 公开记录中最高的全程持续 TPS。**耿暄一 WR 平均的 5 把里有 4 把 12-13.5 TPS 持续**,在用更复杂算法的同时仍跑高 TPS,意义比单纯王艺衡的 14 TPS 更大 — 因为 ZB 算法手指动作更非平凡。生物力学上限:肌肉骨骼模型给出 6 Hz / 指;4 指交替 + 听觉节拍下,15-24 TPS 是原始上限带宽。王已基本进入该带宽,继续提速要么靠硬件革命,要么靠新生物力学适应。\n\n' +
      '(3) 识别:**ZB 方法识别成本最低** — F2L 最后一对就开始读 EO + 角态,inspection 多花 1-2 秒预看就能换 LL 阶段 R ≈ 0。CFOP-OLL+PLL 两阶段累计识别 ~0.4 秒。这就是为什么 Geng 比 Wang 平均更稳:Wang 还要切换到"OLL → 找 PLL → 执行"两段思维,Geng 是"看 LL → 一个 alg"一段思维。\n\n' +
      '(4) 当前格局:Wang 持有 WR **单次** 3.08 (CFOP 朴素 + 2-look OLL,胜在 TPS),Geng 持有 WR **平均** 3.84 (ZB 方法,胜在稳定 + 步数效率)。两人代表两条路径:Wang = "暴力 TPS 推到生理上限";Geng = "方法降步数 + 简化识别"。**Geng 路径上限更高**,因为 TPS 已近上限,而方法仍可进化到 1LLL。\n\n' +
      '综合:单次物理下界 = M / TPS + R = 28 / 16 + 0.05 ≈ 1.80 秒 — 即用户所说的数。这是"幸运 scramble + 峰值生物力学"下界,不是可持续平均。未来 WR 单次会渐近 2.0-2.2 秒 (极值理论:WR ≈ μ - z·σ,z = √(2 ln N);触达 2.0 秒需 ~10⁸ 个精英官方单次,按现有速率约 100 年)。Ao5 平均下界 ~3.0-3.5 秒 (假设全 1LLL + ZB-EO 控制成熟),因执行噪声 (同一 cuber 同 scramble 单次 SD ≈ 0.3 秒)。',
    why_fit_differs_en:
      'Curve fit gives L ≈ 2.70 because it sees only the historical CFOP+OLL+PLL trajectory; it cannot see (a) Method discontinuities — full ZBLL adoption was a step change, not a gradual trend; (b) Lucky-scramble distribution tail — WR singles are extreme-value statistics where lower bound depends on sampling depth N, not on incremental method gains; (c) Hardware regime shifts — magnet revolution (2017) and MagLev (2021) each cut average solve time ~10-15% in single jumps. The fit asymptote is the "30-year extrapolation under current methods", not the "physical lower bound" — they coincide only by accident.',
    why_fit_differs_zh:
      '曲线拟合给出 L ≈ 2.70,因为它只见过 CFOP+OLL+PLL 的历史轨迹,看不见:(a) 方法断点 — 全 ZBLL 被采用是阶跃,不是连续趋势;(b) 幸运 scramble 分布尾部 — WR 单次是极值统计,下界依赖采样深度 N,不是渐进方法改良;(c) 硬件 regime shift — 2017 磁铁革命、2021 MagLev 各砍掉平均时间 10-15% 一次性。拟合渐近线是"现行方法下 30 年外推",不是"物理下界" — 二者偶然接近不代表因果。',
  },

  // ════════════════════════════════════════════════════════════
  //  222
  // ════════════════════════════════════════════════════════════
  '222': {
    current_method_en:
      'Full EG = CLL + EG-1 + EG-2 (126 algs total). Top cubers (Ziyu Ye 0.39 single Hefei 2025; Sujan Feist 0.86 Ao5; Zayn Khanani; Yiheng Wang) use full EG. Many WR singles are 4-5 STM lucky 1-look skips. Note: Yiheng\'s 0.78 average (2024) was revoked after frame-counting found timer sliding — WCA introduced framecount verification in response.',
    current_method_zh:
      '全 EG = CLL + EG-1 + EG-2 (126 算法)。顶级 (叶子瑜 0.39 单次 合肥 2025;Sujan Feist 0.86 Ao5;Zayn Khanani;王艺衡) 全用全 EG。多数 WR 单次是 4-5 步幸运 1-look skip。注:王艺衡 2024 年 0.78 平均被取消,因为帧分析发现"滑计时器"作弊,WCA 因此引入帧计数验证。',
    method_eras: [
      { start_year: 2003, method: 'Beginner / LBL', method_zh: '逐层入门', avg_stm: 25 },
      { start_year: 2008, method: 'Ortega (= EG-0)', method_zh: 'Ortega (即 EG-0)', alg_count: 12, avg_stm: 18 },
      { start_year: 2012, method: 'CLL (face permuted)', method_zh: 'CLL (面已置换)', alg_count: 42, avg_stm: 14.78 },
      { start_year: 2016, method: 'EG-1 (face oriented but not permuted)', method_zh: 'EG-1', alg_count: 42, avg_stm: 14.14 },
      { start_year: 2018, method: 'Full EG (CLL + EG-1 + EG-2)', method_zh: '全 EG (CLL + EG-1 + EG-2)', alg_count: 126, avg_stm: 14.41 },
    ],
    hardware_eras: [
      { year: 2017, milestone_en: 'X-Man Flare M — first widely magnetic 2x2', milestone_zh: 'X-Man Flare M — 首批主流磁铁二阶' },
      { year: 2019, milestone_en: 'YJ MGC 2x2 — cheap competitive flagship', milestone_zh: 'YJ MGC 2x2 — 平价竞速旗舰' },
      { year: 2023, milestone_en: 'GAN 251 M Pro / MoYu RS2 M Evolution — current top', milestone_zh: 'GAN 251 M Pro / MoYu RS2 M Evolution — 现役顶级' },
    ],
    decomp: [
      { scenario_en: 'Ziyu Ye 0.39 (lucky 4-move skip)', scenario_zh: '叶子瑜 0.39 (幸运 4 步 skip)', M: 4, TPS: 10.26, R: 0.0 },
      { scenario_en: 'Realistic future floor', scenario_zh: '现实下界', M: 5, TPS: 11, R: 0.05 },
      { scenario_en: 'Physical floor (lucky scramble + reaction time)', scenario_zh: '物理下界 (幸运 + 反应时间)', M: 4, TPS: 12, R: 0.0 },
    ],
    best_reconstructions: [
      { person: 'Ziyu Ye (叶子瑜)', date: '2025-10-25', time: '0.39 s', M: 4, TPS: 10.26, method: 'EG-1 (R U2 R\' U\')', source_url: 'https://www.cubzor.com/news/ziyu-ye-sets-2x2-single-world-record-039-hefei-open-2025' },
    ],
    reasoning_en:
      '2x2 has 3.67M states with optimal solutions ≤ 11 face-turn-metric. Top cubers fully plan the solve in 15s inspection on lucky scrambles, eliminating R completely. The limit is reaction-time + raw burst TPS (11-12 sustained, briefly higher). Physical floor ~0.30-0.35 s on a 4-move skip; sub-0.30 lives at the edge of credibility (and triggered the WCA frame-count verification rule).',
    reasoning_zh:
      '二阶 367 万态,optimal ≤ 11 HTM。顶级在幸运 scramble 上 inspection 内全程规划,R 直接归零。极限就是反应时间 + 原始突发 TPS (11-12 持续,短瞬更高)。4 步 skip 物理下界 ~0.30-0.35 秒;sub-0.30 已进入可信度边缘 (并触发了 WCA 帧计数规则)。',
    why_fit_differs_en:
      '2x2 fit L tracks the lucky-scramble distribution, not method/biomech. Already at the floor; fit asymptote is essentially the truth here.',
    why_fit_differs_zh:
      '二阶拟合 L 跟踪幸运 scramble 分布,而非方法 / 生物力学。已在地板上,拟合渐近 ≈ 真实下界。',
  },

  // ════════════════════════════════════════════════════════════
  //  444
  // ════════════════════════════════════════════════════════════
  '444': {
    current_method_en:
      'Yau (Robert Yau, 2009) is universal at WR level: cross dedges first, then centers + last cross dedge, then 3-2-3 chain edge pairing, then 3x3 stage. Tymon Kolasiński (current WR 15.18 single + 18.56 Ao5 = first sub-19) and Max Park (prior WR holder, 19.38 → 19.71 Ao5 history) both use Yau. Reduction is the intermediate fallback. Parity (50% OLL + 50% PLL independently): OLL parity ~15 STM alg, PLL parity ~12 STM alg.',
    current_method_zh:
      'Yau (Robert Yau, 2009 提出) 是 WR 级普世标准:先 cross 边棱 → 中心 + 最后 cross 边棱 → 3-2-3 链棱配对 → 三阶阶段。Tymon (现 WR 15.18 单 + 18.56 Ao5 = 史上首破 19 秒) 和 Max Park (前 WR) 都用 Yau。Reduction 是中级备选。Parity (50% OLL + 50% PLL 独立):OLL parity ~15 步算法,PLL parity ~12 步。',
    method_eras: [
      { start_year: 2003, method: 'Reduction (basic redux)', method_zh: 'Reduction (基础)', avg_stm: 200 },
      { start_year: 2009, method: 'Yau (Robert Yau)', method_zh: 'Yau (Robert Yau)', avg_stm: 150 },
      { start_year: 2014, method: 'Yau + freeslice edge-pairing', method_zh: 'Yau + freeslice 棱配对', avg_stm: 145 },
      { start_year: 2020, method: 'Yau + heavy parity-aware pre-tracking', method_zh: 'Yau + 重度 parity 预跟踪', avg_stm: 140 },
    ],
    hardware_eras: [
      { year: 2014, milestone_en: 'MoYu AoSu — first "good" 4x4', milestone_zh: 'MoYu AoSu — 首个真正好用的 4x4' },
      { year: 2018, milestone_en: 'YJ MGC 4x4 M, Valk 4x4 M — first quality magnetic', milestone_zh: 'YJ MGC 4x4 M / Valk 4x4 M — 首批磁铁四阶' },
      { year: 2019, milestone_en: 'MoYu AoSu WR M (59mm) — Park-era WR cube', milestone_zh: 'MoYu AoSu WR M (59mm) — Park 时代 WR 用具' },
      { year: 2024, milestone_en: 'MoYu AoSu V7 (ball-core, 58mm) — Tymon\'s 15.18', milestone_zh: 'MoYu AoSu V7 (ball-core, 58mm) — Tymon 15.18 用具' },
    ],
    decomp: [
      { scenario_en: 'Tymon 15.18 (current WR)', scenario_zh: 'Tymon 15.18 (现 WR)', M: 140, TPS: 9.2, R: 0.0 },
      { scenario_en: 'Realistic future floor (no parity, 11 TPS)', scenario_zh: '现实下界 (无 parity, 11 TPS)', M: 120, TPS: 11, R: 1.0 },
      { scenario_en: 'Physical floor', scenario_zh: '物理下界', M: 110, TPS: 12, R: 0.5 },
    ],
    best_reconstructions: [
      { person: 'Tymon Kolasiński', date: '2025-12', time: '15.18 s', M: 140, TPS: 9.2, method: 'Yau + freeslice', source_url: 'https://speedcubing.org/blogs/news/tymon-kolasinski-breaks-4x4-world-record-single' },
    ],
    reasoning_en:
      '4x4 = wide-turn inertia (Rw / Uw / 3Rw on 5x5) + parity costs + 5 phases (cross dedges → centers → edge pairing → 3x3 + parity). Move-count ~140 STM at WR level (no published reconstruction database; estimate from method-design + 7x7 thread breakdowns). Wide-turn TPS ~15% lower than 3x3. Floor: 120 / 11 + 1.0 ≈ 12.0 s lucky single, ~14 s with both parities. Realistic Ao5 floor 16-17 s.',
    reasoning_zh:
      '四阶 = wide-turn 惯性 (Rw/Uw 等) + parity 代价 + 5 阶段 (cross 边棱 → 中心 → 棱配对 → 三阶 + parity)。WR 级步数 ~140 STM (无公开复盘数据库,按方法设计 + 7x7 thread 推算)。Wide-turn TPS 比 3x3 低 ~15%。下界:120 / 11 + 1.0 ≈ 12 秒幸运单次,~14 秒含双 parity。Ao5 现实下界 16-17 秒。',
  },

  // ════════════════════════════════════════════════════════════
  //  555
  // ════════════════════════════════════════════════════════════
  '555': {
    current_method_en:
      'Yau5 (extended Yau for 5x5) and Reduction split the elite. Tymon Kolasiński (WR 30.45 single 2024 + 34.31 Ao5 2025 — first non-Park average WR holder in ~7 years) uses Yau5. Park uses Reduction. 5x5 has NO parity (odd-layered, no algorithmic OLL/PLL parity case).',
    current_method_zh:
      'Yau5 (Yau 在 5x5 的扩展) 和 Reduction 在顶级各占一半。Tymon (WR 30.45 单 2024 + 34.31 Ao5 2025 — Park 之外 ~7 年来首个) 用 Yau5。Park 用 Reduction。5x5 无 parity (奇数层,不存在算法级 OLL/PLL parity)。',
    method_eras: [
      { start_year: 2003, method: 'Reduction (basic)', method_zh: 'Reduction (基础)', avg_stm: 280 },
      { start_year: 2010, method: 'Reduction + freeslice edge-pairing', method_zh: 'Reduction + freeslice', avg_stm: 240 },
      { start_year: 2014, method: 'Yau5 (Robert Yau, 5x5 extension)', method_zh: 'Yau5 (Robert Yau)', avg_stm: 220 },
      { start_year: 2022, method: 'Yau5 + advanced cross-edge tracking', method_zh: 'Yau5 + 进阶 cross 边追踪', avg_stm: 210 },
    ],
    hardware_eras: [
      { year: 2017, milestone_en: 'MoYu AoChuang GTS M — first competitive magnetic 5x5', milestone_zh: 'MoYu AoChuang GTS M — 首批磁铁五阶' },
      { year: 2020, milestone_en: 'MoYu AoChuang WR M', milestone_zh: 'MoYu AoChuang WR M' },
      { year: 2024, milestone_en: 'GAN 562 M — Tymon\'s WR cube', milestone_zh: 'GAN 562 M — Tymon WR 用具' },
    ],
    decomp: [
      { scenario_en: 'Tymon 30.45 (current WR)', scenario_zh: 'Tymon 30.45 (现 WR)', M: 220, TPS: 7.2, R: 0.0 },
      { scenario_en: 'Realistic future floor', scenario_zh: '现实下界', M: 200, TPS: 9, R: 2.0 },
      { scenario_en: 'Physical floor', scenario_zh: '物理下界', M: 180, TPS: 10, R: 1.5 },
    ],
    best_reconstructions: [
      { person: 'Tymon Kolasiński', date: '2024-11', time: '30.45 s', M: 220, TPS: 7.2, method: 'Yau5', source_url: 'https://www.speedsolving.com/wiki/index.php/List_of_World_Records/5x5x5' },
    ],
    reasoning_en:
      '5x5 has 4 inner layers + 5 outer-face turns. No parity reduces variance. Centers + edges have superlinear tracking cost vs 4x4. Realistic floor: 180 / 10 + 1.5 ≈ 19.5 s single. Zemdegs 2017 prediction "sub-40 imminent, sub-45 mean" both demolished — Tymon at 30.45 / 34.31 in 2025.',
    reasoning_zh:
      '5x5 有 4 个内层 + 5 个外层面。无 parity 降低方差。中心 + 棱跟踪代价比 4x4 超线性。现实下界:180 / 10 + 1.5 ≈ 19.5 秒单次。Zemdegs 2017 预言 "sub-40 临近,sub-45 平均" 已双双被砸 — Tymon 2025 已是 30.45 / 34.31。',
  },

  // ════════════════════════════════════════════════════════════
  //  666
  // ════════════════════════════════════════════════════════════
  '666': {
    current_method_en:
      'Reduction universal at WR level — Yau6 offers diminishing returns due to dilute cross-edge advantage. Max Park dominates (current single 57.69 in Burbank 2025-04 — third-ever sub-1:00 single; Mo3 1:05.04). 6x6 has full parity (50% × 15-STM OLL + 50% × 12-STM PLL). Hardware unresolved: inner-layer slipping affects "every 6x6 including the big three" (Cubeskills).',
    current_method_zh:
      'Reduction 在 WR 级普世 — Yau6 在 6x6 收益递减,cross 边棱优势被稀释。Max Park 垄断 (现单次 57.69, Burbank 2025-04, 史上第三个 sub-1:00 单次;Mo3 1:05.04)。6x6 有完整 parity (50% × 15-STM OLL + 50% × 12-STM PLL)。硬件未解决:内层打滑影响"所有 6x6,包括三大牌"(Cubeskills)。',
    method_eras: [
      { start_year: 2008, method: 'V-Cube 6 era — slow Reduction', method_zh: 'V-Cube 6 时代 — 慢速 Reduction' },
      { start_year: 2014, method: 'MoYu AoShi era + freeslice', method_zh: 'MoYu AoShi 时代 + freeslice' },
      { start_year: 2019, method: 'Reduction + parity-aware tracking', method_zh: 'Reduction + parity 预跟踪' },
    ],
    hardware_eras: [
      { year: 2008, milestone_en: 'V-Cube 6 — first 6x6', milestone_zh: 'V-Cube 6 — 首个 6x6' },
      { year: 2016, milestone_en: 'QiYi WuHua', milestone_zh: 'QiYi WuHua' },
      { year: 2019, milestone_en: 'YJ MGC 6x6 M — first competitive cheap magnetic', milestone_zh: 'YJ MGC 6x6 M — 首批平价磁铁' },
      { year: 2023, milestone_en: 'MoYu AoShi WR M', milestone_zh: 'MoYu AoShi WR M' },
    ],
    decomp: [
      { scenario_en: 'Park 57.69 (current WR)', scenario_zh: 'Park 57.69 (现 WR)', M: 315, TPS: 5.5, R: 0.0 },
      { scenario_en: 'Realistic future floor', scenario_zh: '现实下界', M: 290, TPS: 7, R: 3.0 },
      { scenario_en: 'Physical floor (no parity, hardware solved)', scenario_zh: '物理下界 (无 parity, 硬件解决)', M: 270, TPS: 8, R: 2.0 },
    ],
    reasoning_en:
      '6x6 = 4 inner + outer + parity. Tracking cost across 84 visible pieces is the dominant time sink. Centers ~22 s, edges ~20 s, 3x3 stage ~16 s for a 58 s solve. Floor: 280 / 7 + 3 ≈ 43 s single. Hardware ceiling looms larger here than for 5x5/7x7.',
    reasoning_zh:
      '6x6 = 4 内 + 外 + parity。84 块可见跟踪代价是主导时间开销。58 秒解法分:中心 ~22 秒、棱 ~20 秒、三阶阶段 ~16 秒。下界:280 / 7 + 3 ≈ 43 秒单次。硬件天花板在此比 5x5 / 7x7 更突出。',
  },

  // ════════════════════════════════════════════════════════════
  //  777
  // ════════════════════════════════════════════════════════════
  '777': {
    current_method_en:
      'Reduction universal (Yau7 used by Tymon). Max Park dominates (current single 1:33.48, Mo3 1:36.86 both at Nub Open Trabuco Hills Fall 2025). 7x7 has NO parity (odd-layered). Best primary STM data of any big cube — multiple solver reconstructions on speedsolving.com show 446-524 STM (mean ~470).',
    current_method_zh:
      'Reduction 普世 (Yau7 Tymon 用)。Max Park 垄断 (现单次 1:33.48,Mo3 1:36.86,均 Nub Open Trabuco Hills Fall 2025)。7x7 无 parity (奇数层)。是大魔方中唯一有公开复盘数据库的项目 — speedsolving 多人复盘显示 446-524 STM (均值 ~470)。',
    method_eras: [
      { start_year: 2008, method: 'V-Cube 7 era', method_zh: 'V-Cube 7 时代' },
      { start_year: 2014, method: 'MoYu AoFu era + Reduction', method_zh: 'MoYu AoFu 时代 + Reduction' },
      { start_year: 2021, method: 'Reduction + freeslice + Yau7 (Tymon)', method_zh: 'Reduction + freeslice + Yau7 (Tymon)' },
    ],
    hardware_eras: [
      { year: 2008, milestone_en: 'V-Cube 7', milestone_zh: 'V-Cube 7' },
      { year: 2017, milestone_en: 'YuXin Huanglong M — early magnetic 7x7', milestone_zh: 'YuXin 黄龙 M — 早期磁铁 7x7' },
      { year: 2021, milestone_en: 'MoYu AoFu WR M', milestone_zh: 'MoYu AoFu WR M' },
      { year: 2025, milestone_en: 'GAN 778 M / MoYu HuaShi WR M', milestone_zh: 'GAN 778 M / MoYu HuaShi WR M' },
    ],
    decomp: [
      { scenario_en: 'Park 1:33.48 (current WR)', scenario_zh: 'Park 1:33.48 (现 WR)', M: 440, TPS: 4.7, R: 0.0 },
      { scenario_en: 'Realistic future floor', scenario_zh: '现实下界', M: 420, TPS: 5.5, R: 4.0 },
      { scenario_en: 'Physical floor (hardware ceiling)', scenario_zh: '物理下界 (硬件天花板)', M: 400, TPS: 6, R: 3.0 },
    ],
    best_reconstructions: [
      { person: 'Max Park', date: '2025-10-04', time: '1:33.48', M: 440, TPS: 4.7, method: 'Reduction + freeslice', source_url: 'https://www.speedsolving.com/threads/max-park-1-33-48-7x7-single-and-1-36-86-average.95542/' },
    ],
    reasoning_en:
      '7x7 = 5 inner + outer, no parity. STM 440 / TPS 4.7 = 93.5 s matches Park\'s WR (computed from primary speedsolving thread breakdowns: Hays 501, Kirjava 446, uberCuber 455). Centers ~46 s, edges ~33 s, 3x3 ~14 s. Floor: 420 / 5.5 + 4 ≈ 80 s.',
    reasoning_zh:
      '7x7 = 5 内 + 外,无 parity。STM 440 / TPS 4.7 = 93.5 秒匹配 Park 现 WR (源自 speedsolving 复盘:Hays 501、Kirjava 446、uberCuber 455)。中心 ~46 秒、棱 ~33 秒、三阶 ~14 秒。下界:420 / 5.5 + 4 ≈ 80 秒。',
  },

  // ════════════════════════════════════════════════════════════
  //  333oh
  // ════════════════════════════════════════════════════════════
  '333oh': {
    current_method_en:
      'CFOP adapted for OH dominates the elite. Dhruva Sai Meruva (Switzerland, current WR single 5.66 at Swiss Nationals 2024-10-06 — tied to digit with Feliks\'s 2H 5.66 from 2011), Luke Garrett (USA, current WR Ao5 7.72, Chicagoland Newcomers 2025), Yiheng Wang. Top solvers use OH-friendly OLL/PLL subsets (RU-heavy algs, often 2-look OLL kept for ergonomics). Roux-OH is more move-efficient (~45-50 STM vs CFOP-OH ~55-60) and dominant in OH single Ao5 records (Sean Patrick Villanueva, Nicholas Archer, Kian Mansour) but the top of the WR Ao5 standings still uses CFOP-OH because recognition speed wins.',
    current_method_zh:
      '顶级以 OH 改良 CFOP 为主。Dhruva Sai Meruva (瑞士,现 WR 单次 5.66, Swiss Nationals 2024-10-06 — 与 Feliks 2011 双手 5.66 同位)、Luke Garrett (美国,现 WR Ao5 7.72, Chicagoland 2025)、王艺衡。OH 版优选 RU-heavy OLL / PLL,部分保留 2-look OLL 节省手指扭曲。Roux-OH 步数更省 (~45-50 vs CFOP-OH ~55-60),在 OH Ao5 历史上有 SPV / Archer / Mansour 等持有人,但当前 WR 仍是 CFOP-OH — 识别速度赢了。',
    method_eras: [
      { start_year: 2003, method: 'Beginner / LBL (OH)', method_zh: '逐层 OH', avg_stm: 130 },
      { start_year: 2010, method: 'CFOP-OH (basic)', method_zh: 'CFOP-OH 基础版', alg_count: 78, avg_stm: 62 },
      { start_year: 2017, method: 'CFOP-OH + RU-heavy alg subset (post-magnet)', method_zh: 'CFOP-OH + RU 优选 (磁铁后)', alg_count: 78, avg_stm: 58 },
      { start_year: 2020, method: 'Roux-OH challenge (SPV / Mansour)', method_zh: 'Roux-OH 冲击 (SPV / Mansour)', avg_stm: 50 },
      { start_year: 2023, method: 'CFOP-OH + partial ZBLL fragments', method_zh: 'CFOP-OH + 局部 ZBLL', alg_count: 200, avg_stm: 56 },
    ],
    hardware_eras: [
      { year: 2017, milestone_en: 'GAN 356 Air SM — magnet revolution', milestone_zh: 'GAN 356 Air SM — 磁铁革命' },
      { year: 2020, milestone_en: 'GAN 11 M Pro — torque-friendly for OH', milestone_zh: 'GAN 11 M Pro — OH 单手扭矩友好' },
      { year: 2023, milestone_en: 'GAN 12 / 13 UltraM', milestone_zh: 'GAN 12 / 13 UltraM' },
    ],
    decomp: [
      { scenario_en: 'Meruva 5.66 (current WR)', scenario_zh: 'Meruva 5.66 (现 WR)', M: 56, TPS: 9.7, R: 0.2 },
      { scenario_en: 'Realistic future floor (Roux-OH adoption)', scenario_zh: '现实下界 (Roux-OH 普及)', M: 48, TPS: 10, R: 0.3 },
      { scenario_en: 'Physical floor (single-hand 12 TPS biomech)', scenario_zh: '物理下界 (单手 12 TPS 生理)', M: 42, TPS: 12, R: 0.15 },
    ],
    reasoning_en:
      'OH ceiling is single-hand TPS (~9 sustained, ~12 burst) vs 14-16 two-handed. Single-hand finger-tap biomechanics: 4 active fingers × 6 Hz / finger = 12-15 TPS theoretical. Floor: 42 / 12 + 0.15 ≈ 3.6 s single.',
    reasoning_zh:
      'OH 天花板是单手 TPS (~9 持续, ~12 突发) vs 双手 14-16。单手手指敲击生物力学:4 指 × 6 Hz / 指 = 12-15 TPS 理论。下界:42 / 12 + 0.15 ≈ 3.6 秒单次。',
  },

  // ════════════════════════════════════════════════════════════
  //  333bf
  // ════════════════════════════════════════════════════════════
  '333bf': {
    current_method_en:
      'Full 3-Style commutators (corners + edges) is universal at the elite level. Charlie Eggins (Australia, WR single 11.67 + Mo3 14.05, Cubing at The Cube 2026-01-10, Sydney) holds both records. Tommy Cherry held the 12.x band before Eggins\'s January 2026 sub-12 breakthrough. M2/OP is teaching-only. Floating buffers + LTCT (Last-Target Corner Twist) + per-special algs cut setup moves. Note: Tymon Kolasiński does NOT hold a 3BLD record — he holds 4x4 single, 5x5 single, 5x5 mean.',
    current_method_zh:
      '顶级全跑 corner + edge 全 3-Style。Charlie Eggins (澳洲) 2026-01-10 在 Sydney "Cubing at The Cube" 同场拿下 WR 单次 11.67 + Mo3 14.05。Tommy Cherry 之前持有 12.x 段。M2/OP 仅教学。浮动 buffer + LTCT (Last-Target Corner Twist) + 特例算法削减 setup。注:Tymon Kolasiński 不持有 3BLD 记录,他持有的是 4x4 单 / 5x5 单 / 5x5 Ao5。',
    method_eras: [
      { start_year: 2003, method: 'Pochmann (OP / M2)', method_zh: 'Pochmann (OP / M2)', avg_stm: 110 },
      { start_year: 2010, method: 'M2 (edges) + OP (corners)', method_zh: 'M2 + OP', avg_stm: 90 },
      { start_year: 2015, method: '3-Style (TUL / Hinemos system)', method_zh: '3-Style 换位子', avg_stm: 70, alg_count: 378 },
      { start_year: 2022, method: 'Floating-buffer 3-Style + LTCT + per-specials', method_zh: '浮动 buffer 3-Style + LTCT + 特例', avg_stm: 60, alg_count: 600 },
    ],
    hardware_eras: [
      { year: 2017, milestone_en: 'Magnetic cubes — clicky tactile feedback', milestone_zh: '磁铁速拧 — 盲拧触觉定位' },
      { year: 2022, milestone_en: 'GAN 12 UltraM stickerless — preferred BLD setup', milestone_zh: 'GAN 12 UltraM 无贴 — BLD 主流' },
    ],
    decomp: [
      { scenario_en: 'Eggins 11.67 (current WR)', scenario_zh: 'Eggins 11.67 (现 WR)', M: 60, TPS: 8, R: 4.0, note_en: 'R = memo + recall pauses', note_zh: 'R = 记忆 + 回忆停顿' },
      { scenario_en: 'Realistic future floor', scenario_zh: '现实下界', M: 50, TPS: 9, R: 2.5 },
      { scenario_en: 'Physical floor (lucky scramble + perfect 3-Style)', scenario_zh: '物理下界 (幸运 + 完美 3-Style)', M: 45, TPS: 10, R: 1.5 },
    ],
    reasoning_en:
      'BLD time = memo + execution. 22 stickers @ audio-loop 1.5s memo floor. 50 moves @ 10 TPS = 5s execution floor. Combined absolute floor ~6.5-7.0s on lucky scramble. Sub-10 mean achievable; sub-7 single is asymptote.',
    reasoning_zh:
      'BLD 时间 = 记忆 + 执行。22 色块音频循环记忆下界 ~1.5 秒。50 步 @ 10 TPS = 5 秒执行下界。综合幸运 scramble 物理下界 ~6.5-7 秒。Sub-10 Mo3 可达;Sub-7 单次是渐近。',
    why_fit_differs_en:
      'BLD curve fit cannot capture memo-system regime shifts (e.g., spatial mind-palace → letter-pair audio).',
    why_fit_differs_zh:
      'BLD 拟合无法捕捉记忆系统的范式切换 (如 mind-palace → 字母对音频)。',
  },

  // ════════════════════════════════════════════════════════════
  //  333fm
  // ════════════════════════════════════════════════════════════
  '333fm': {
    current_method_en:
      'Modern FMC = blockbuilding + EO + Domino Reduction (DR, reduce to <U,D,R2,L2,F2,B2> subgroup, optimal DR-to-solved averages 13.58 moves) + insertions + NISS (Normal-Inverse Scramble Switch). WR single = 16 moves shared by 5 holders: Sebastiano Tronto (2019), Aedan Bryant + Levi Gibson (2024), Jacob Sherwen Brown (2024). Mean WR = 19.33 (Wong Chong Wen 2026, first sub-20 mean). Sebastiano Tronto authored the DR revolution.',
    current_method_zh:
      '现代 FMC = blockbuilding + EO + Domino Reduction (DR,把状态降到 <U,D,R2,L2,F2,B2> 子群,DR→solved optimal 平均 13.58 步) + 插入法 + NISS (正逆 scramble 互换搜)。WR 单次 = 16 步,5 人持有:Sebastiano Tronto (2019)、Aedan Bryant + Levi Gibson (2024)、Jacob Sherwen Brown (2024)。Mo3 WR = 19.33 (Wong Chong Wen 2026,首破 20)。Tronto 是 DR 革命主笔。',
    method_eras: [
      { start_year: 2003, method: 'Blockbuilding + intuition', method_zh: 'Blockbuilding + 直觉', avg_stm: 35 },
      { start_year: 2010, method: 'Blockbuilding + insertions', method_zh: 'Blockbuilding + 插入法', avg_stm: 28 },
      { start_year: 2015, method: 'NISS (Normal-Inverse Scramble Switch)', method_zh: '加入 NISS', avg_stm: 25 },
      { start_year: 2019, method: 'Domino Reduction (DR) — Tronto era', method_zh: 'Domino Reduction (DR) — Tronto 时代', avg_stm: 22 },
      { start_year: 2024, method: 'DR + EO + insertions + heavy alg DB', method_zh: 'DR + EO + 插入 + 厚算法库', avg_stm: 19.33 },
    ],
    hardware_eras: [],
    decomp: [
      { scenario_en: 'Current elite single', scenario_zh: '现役顶级单次', M: 18, TPS: 0, R: 3600, T: 18 },
      { scenario_en: 'Realistic future floor', scenario_zh: '现实下界', M: 17, TPS: 0, R: 3600, T: 17 },
      { scenario_en: 'God\'s number HTM (proven 2010)', scenario_zh: 'God\'s number HTM (2010 证明)', M: 20, TPS: 0, R: 3600, T: 20 },
    ],
    reasoning_en:
      'FMC is move-count limited (1 hour, paper). Lower bound = God\'s number = 20 HTM (Rokicki et al. 2010). Random scramble HTM optimal: 18 moves 67%, 17 moves 27%, 19 moves 3%, 16 moves 2.6%. 16-move WR sits below 20 because easy scrambles need 16. Practical 1-hour floor for elite human ~17-18 single, ~18-19 mean.',
    reasoning_zh:
      'FMC 是步数限定 (1 小时纸笔)。下界 = God\'s number = 20 HTM (Rokicki 等 2010 证明)。随机 scramble HTM optimal 分布:18 步 67%、17 步 27%、19 步 3%、16 步 2.6%。WR 16 步低于 20,是因为简单 scramble 本身 ≤16。人类 1 小时实际下界 ~17-18 单次, ~18-19 平均。',
    why_fit_differs_en:
      'FMC is the only event with mathematically proven absolute lower bound (20 HTM). Curve-fit L is meaningless here.',
    why_fit_differs_zh:
      'FMC 是唯一一个绝对下界 (20 HTM) 数学证明的项目。曲线拟合 L 在这里没有意义。',
  },

  // ════════════════════════════════════════════════════════════
  //  444bf
  // ════════════════════════════════════════════════════════════
  '444bf': {
    current_method_en:
      'Full 3-Style across centers + wings + edges + corners + parity. Stanley Chapel (51.96 single 2023, 59.39 Mo3 2025 — first sub-1:00 mean ever) uses floating buffers across all four orbits.',
    current_method_zh:
      '中心 + 翼棱 + 棱 + 角 + parity 全 3-Style。Stanley Chapel (51.96 单 2023,59.39 Mo3 2025 — 史上首破 1 分钟 Mo3) 在四种 piece 都用浮动 buffer。',
    method_eras: [
      { start_year: 2009, method: 'Reduction + 3BLD on 3x3 stage', method_zh: 'Reduction + 顶层 3BLD' },
      { start_year: 2015, method: '3-Style on edges/corners; comm-by-comm on big pieces', method_zh: '棱角 3-Style;大块逐 comm', avg_stm: 200 },
      { start_year: 2020, method: 'Full floating-buffer 3-Style on all orbits', method_zh: '四 orbit 全浮动 buffer 3-Style', avg_stm: 140 },
    ],
    hardware_eras: [
      { year: 2018, milestone_en: 'MGC 4x4 / Valk 4x4 M — first quality magnetic 4x4', milestone_zh: 'MGC 4x4 / Valk 4x4 M — 首批磁铁四阶' },
      { year: 2022, milestone_en: 'MoYu Aosu WRM / GAN 460M — current top BLD', milestone_zh: 'MoYu Aosu WRM / GAN 460M — 现役 BLD 主流' },
    ],
    decomp: [
      { scenario_en: 'Chapel 51.96 (current WR)', scenario_zh: 'Chapel 51.96 (现 WR)', M: 140, TPS: 5, R: 25.0 },
      { scenario_en: 'Realistic future floor', scenario_zh: '现实下界', M: 120, TPS: 6, R: 18.0 },
      { scenario_en: 'Physical floor', scenario_zh: '物理下界', M: 110, TPS: 7, R: 12.0 },
    ],
    reasoning_en:
      'Memo dominates: ~25-30s for 28 letter pairs across centers / wings / edges / corners. Execution ~25-30s @ 5 TPS. Floor: memo 12-15s + exec 18-22s = 30-35s single, 38-42s Mo3.',
    reasoning_zh:
      '记忆主导:~25-30 秒 (28 字母对 × 中心 / 翼 / 棱 / 角)。5 TPS 执行 ~25-30 秒。下界:记忆 12-15 + 执行 18-22 = 30-35 秒单次, 38-42 秒 Mo3。',
  },

  // ════════════════════════════════════════════════════════════
  //  555bf
  // ════════════════════════════════════════════════════════════
  '555bf': {
    current_method_en:
      'Full floating-buffer 3-Style across five orbits: corners, wings, midges, +centers, X-centers. Stanley Chapel monopolizes (1:58.59 single 2026 — first-ever sub-2:00; 2:27.63 Mo3 2019 — most enduring active BLD record). Midge memo is the recognition bottleneck.',
    current_method_zh:
      '五种 piece (角 / 翼 / midge / +中心 / X 中心) 全浮动 buffer 3-Style。Chapel 垄断 (1:58.59 单次 2026 — 史上首破 2 分钟;2:27.63 Mo3 2019 — 现役 BLD 最久未破)。midge 识别是瓶颈。',
    method_eras: [
      { start_year: 2010, method: 'M2 / Pochmann + Reduction', method_zh: 'M2 / Pochmann + Reduction' },
      { start_year: 2015, method: '3-Style on corners + edges', method_zh: '角棱 3-Style' },
      { start_year: 2020, method: 'Full 3-Style on all 5 orbits + advanced midge memo', method_zh: '五 orbit 全 3-Style + 进阶 midge 记忆' },
    ],
    hardware_eras: [
      { year: 2019, milestone_en: 'MoYu MF5S / Aochuang GTS M', milestone_zh: 'MoYu MF5S / Aochuang GTS M' },
      { year: 2023, milestone_en: 'GAN 14 / MoYu RS5M MagLev', milestone_zh: 'GAN 14 / MoYu RS5M MagLev' },
    ],
    decomp: [
      { scenario_en: 'Chapel 1:58.59 (current WR)', scenario_zh: 'Chapel 1:58.59 (现 WR)', M: 280, TPS: 5, R: 60.0 },
      { scenario_en: 'Realistic future floor', scenario_zh: '现实下界', M: 250, TPS: 6, R: 40.0 },
      { scenario_en: 'Physical floor', scenario_zh: '物理下界', M: 220, TPS: 7, R: 30.0 },
    ],
    reasoning_en:
      'Memo bottleneck severe: 92 stickers ≈ 46 letter pairs × 1.2s/pair audio = 55s memo. Mean WR stagnant since 2019 reflects memo-accuracy ceiling — sub-2:00 Mo3 requires three error-free 92-sticker memos.',
    reasoning_zh:
      '记忆瓶颈剧烈:92 色块 ≈ 46 字母对 × 1.2 秒 / 对 = 55 秒。Mo3 自 2019 至今未破,反映记忆准确率天花板 — sub-2:00 Mo3 需连续 3 次无错的 92 色块记忆。',
  },

  // ════════════════════════════════════════════════════════════
  //  pyram
  // ════════════════════════════════════════════════════════════
  'pyram': {
    current_method_en:
      'V-first (one V = 3 edges + 3 centers, then last 4 edges) + intuitive last layer is universal. Top cubers (Simon Kellum 0.73 single 2023, Lingkun Jiang 1.14 Ao5 2025, Dominik Górny, Akira Hattori) plan the entire ≤11-move solution during 15s inspection. Pyraminx is the only WCA event where "inspection-optimal" is human-achievable.',
    current_method_zh:
      'V-first (一个 V 块 = 3 棱 + 3 中心,再解后 4 棱) + 直觉 LL。顶级 (Kellum 0.73 单 2023, Jiang 1.14 Ao5 2025, Górny, Hattori) 在 15 秒 inspection 内全程规划 ≤11 步解。金字塔是唯一一个"inspection-optimal" 人类可达的 WCA 项目。',
    method_eras: [
      { start_year: 2003, method: 'LBL / Top-First', method_zh: '逐层 / 顶层优先', avg_stm: 18 },
      { start_year: 2008, method: 'OKA (Yohei Oka)', method_zh: 'OKA (Yohei Oka)', avg_stm: 13 },
      { start_year: 2014, method: 'Keyhole / V-first hybrids', method_zh: 'Keyhole / V-first 混合', avg_stm: 11 },
      { start_year: 2018, method: 'V-first / L4E (intuitive last 4 edges)', method_zh: 'V-first / L4E', avg_stm: 9 },
      { start_year: 2022, method: 'Inspection-optimal (full plan in 15s)', method_zh: 'Inspection-optimal (15s 全规划)', avg_stm: 8 },
    ],
    hardware_eras: [
      { year: 2014, milestone_en: 'ShengShou Pyraminx — first speed-friendly mass-market', milestone_zh: 'ShengShou — 首批量产竞速金字塔' },
      { year: 2018, milestone_en: 'MoYu Magnetic / X-Man Bell — sub-2 Ao5 enabled', milestone_zh: 'MoYu Magnetic / X-Man Bell — sub-2 Ao5 推动' },
      { year: 2022, milestone_en: 'QiYi MS / X-Man Bell V2', milestone_zh: 'QiYi MS / X-Man Bell V2' },
    ],
    decomp: [
      { scenario_en: 'Kellum 0.73 (current WR)', scenario_zh: 'Kellum 0.73 (现 WR)', M: 8, TPS: 14.5, R: 0.13 },
      { scenario_en: 'Realistic future floor', scenario_zh: '现实下界', M: 8, TPS: 18, R: 0.13 },
      { scenario_en: 'Physical floor (lucky 6-move + 20 TPS)', scenario_zh: '物理下界 (幸运 6 步 + 20 TPS)', M: 6, TPS: 20, R: 0.13 },
    ],
    best_reconstructions: [
      { person: 'Simon Kellum', date: '2023', time: '0.73 s', M: 8, TPS: 14.5, method: 'V-first / inspection-optimal', source_url: 'https://www.speedsolving.com/wiki/index.php?title=List_of_World_Records/Pyraminx' },
    ],
    reasoning_en:
      'Pyraminx state space 933,120 positions; God\'s number 11 HTM, 8.36 average optimal. 15s inspection enables full optimal plan. Limit: StackMat reaction (~0.13s) + execution at finger-tap rate (~18-20 TPS). Floor 0.5-0.65s; essentially "solved".',
    reasoning_zh:
      '金字塔状态空间 93 万,God\'s number 11 HTM,平均 optimal 8.36 步。15 秒 inspection 足以找最优 V-first 解。极限:StackMat 反应 ~0.13 秒 + 执行 ~18-20 TPS (接近手指敲击频率)。下界 0.5-0.65 秒,本质已"解决"。',
  },

  // ════════════════════════════════════════════════════════════
  //  skewb
  // ════════════════════════════════════════════════════════════
  'skewb': {
    current_method_en:
      'Sarah\'s Advanced (134 L2L cases) was orthodox until ~2023. The new frontier is TCLL (Twisted Corner Last Layer, ~1080 cases / ~360 algs after pseudo handling). Vojtěch Grohmann used TCLL for the WR single 0.73 (Głuszyca Open 2026-01). Average WR 1.37 (Ignacy Samselski 2025) typically still uses Sarah\'s.',
    current_method_zh:
      'Sarah\'s Advanced (134 L2L cases) 是 ~2023 之前的正统。新前沿是 TCLL (Twisted Corner Last Layer,~1080 cases / 假态合并后 ~360 algs)。Vojtěch Grohmann 用 TCLL 创下 WR 单次 0.73 (Głuszyca Open 2026-01)。Ao5 WR 1.37 (Samselski 2025) 多用 Sarah\'s。',
    method_eras: [
      { start_year: 2014, method: 'Beginner LBL', method_zh: '逐层入门', avg_stm: 18 },
      { start_year: 2014, method: 'Sarah\'s Intermediate', method_zh: 'Sarah\'s 中级', alg_count: 10, avg_stm: 14 },
      { start_year: 2016, method: 'Sarah\'s Advanced (L2L)', method_zh: 'Sarah\'s 高级 (L2L)', alg_count: 134, avg_stm: 12 },
      { start_year: 2018, method: 'Hedgeslayer (Andrew Huang)', method_zh: 'Hedgeslayer (Andrew Huang)', avg_stm: 12 },
      { start_year: 2023, method: 'TCLL (Twisted Corner Last Layer)', method_zh: 'TCLL', alg_count: 360, avg_stm: 10 },
    ],
    hardware_eras: [
      { year: 2014, milestone_en: 'MoYu Skewb — first competitive', milestone_zh: 'MoYu Skewb — 首批竞速' },
      { year: 2017, milestone_en: 'MoYu Magnetic — first magnetic', milestone_zh: 'MoYu Magnetic — 首批磁铁' },
      { year: 2022, milestone_en: 'GAN Skewb (Maglev) — current top', milestone_zh: 'GAN Skewb (Maglev) — 现役顶级' },
    ],
    decomp: [
      { scenario_en: 'Grohmann 0.73 (current WR, TCLL)', scenario_zh: 'Grohmann 0.73 (现 WR, TCLL)', M: 10, TPS: 14.2, R: 0.15 },
      { scenario_en: 'Realistic future floor', scenario_zh: '现实下界', M: 10, TPS: 14, R: 0.15 },
      { scenario_en: 'Physical floor (lucky TCLL skip + reaction)', scenario_zh: '物理下界 (幸运 TCLL skip + 反应)', M: 7, TPS: 18, R: 0.13 },
    ],
    best_reconstructions: [
      { person: 'Vojtěch Grohmann', date: '2026-01', time: '0.73 s', M: 10, TPS: 14.2, method: 'TCLL', source_url: 'https://www.speedsolving.com/threads/0-73-skewb-wr-single-by-vojt%C4%9Bch-grohmann.96474/' },
    ],
    reasoning_en:
      'Skewb has 3.15M states, God\'s number 11 STM, 8.36 avg optimal. First-layer planned in inspection. Floor 0.6-0.75s. Scramble luck dominant: TCLL skip vs 5-fold case = 4-6 STM = 0.3-0.4s.',
    reasoning_zh:
      '斜转 315 万态,God\'s number 11 STM,平均 optimal 8.36。第一层 inspection 规划。下界 0.6-0.75 秒。Scramble 运气主导:TCLL skip vs 5-fold case 差 4-6 STM = 0.3-0.4 秒。',
  },

  // ════════════════════════════════════════════════════════════
  //  sq1
  // ════════════════════════════════════════════════════════════
  'sq1': {
    current_method_en:
      'Vandenbergh (Cubeshape → CO → CP → EO → EP) is universal foundation. Top cubers add CSP (Cubeshape Parity, Brandon Lin ~2015) to predict slice parity in inspection, then Lin Method + PLL+1 / 1LLL fragments. Hassan Khanani 3.40 single (Steel City Sprint 2026), Sameer Aggarwal 4.63 Ao5 (2025).',
    current_method_zh:
      'Vandenbergh (cubeshape → CO → CP → EO → EP) 普世基础。顶级叠加 CSP (Cubeshape Parity, Brandon Lin ~2015,inspection 预判 slice parity),进一步用 Lin + PLL+1 / 1LLL 局部。Hassan Khanani 3.40 单 (Steel City Sprint 2026),Aggarwal 4.63 Ao5 (2025)。',
    method_eras: [
      { start_year: 2003, method: 'Vandenbergh (intuitive)', method_zh: 'Vandenbergh (直觉)', avg_stm: 35 },
      { start_year: 2010, method: 'Vandenbergh + full alg-driven', method_zh: 'Vandenbergh + 全算法化', avg_stm: 26, alg_count: 100 },
      { start_year: 2015, method: 'Vandenbergh + CSP', method_zh: 'Vandenbergh + CSP', avg_stm: 23 },
      { start_year: 2020, method: 'Lin + CSP + PLL+1', method_zh: 'Lin + CSP + PLL+1', avg_stm: 20, alg_count: 250 },
      { start_year: 2024, method: 'Lin + CSP + 1LLL fragments', method_zh: 'Lin + CSP + 1LLL 局部', avg_stm: 18, alg_count: 400 },
    ],
    hardware_eras: [
      { year: 2017, milestone_en: 'X-Man Volt — first magnetic SQ1', milestone_zh: 'X-Man Volt — 首磁铁 SQ1' },
      { year: 2019, milestone_en: 'X-Man Volt V2 M — long-running standard', milestone_zh: 'X-Man Volt V2 M — 长期主流' },
      { year: 2020, milestone_en: 'X-Man Volt V2 UD (Fully Magnetic)', milestone_zh: 'X-Man Volt V2 UD (全磁铁)' },
    ],
    decomp: [
      { scenario_en: 'Khanani 3.40 (current WR)', scenario_zh: 'Khanani 3.40 (现 WR)', M: 22, TPS: 8, R: 0.6 },
      { scenario_en: 'Realistic future floor (full 1LLL)', scenario_zh: '现实下界 (全 1LLL)', M: 18, TPS: 9, R: 0.5 },
      { scenario_en: 'Physical floor (lucky CSP+PLL skip)', scenario_zh: '物理下界 (幸运 CSP+PLL skip)', M: 14, TPS: 10, R: 0.4 },
    ],
    reasoning_en:
      'SQ1 is slice-bound: every move /, U, or D requires precise slice alignment. TPS ceiling ~10 (vs 15-18 for face-turn puzzles). Slice misalignment costs 0.1-0.2s recovery. Floor 2.5-3.0s; 1LLL alg-set expansion is the main lever.',
    reasoning_zh:
      'SQ1 是 slice-bound:每步 /、U、D 都需精准切片对齐。TPS 上限 ~10 (vs 面转拼图 15-18)。切片错位代价 0.1-0.2 秒。下界 2.5-3.0 秒;1LLL 算法库扩展是主要杠杆。',
  },

  // ════════════════════════════════════════════════════════════
  //  clock
  // ════════════════════════════════════════════════════════════
  'clock': {
    current_method_en:
      '7-SIMUL (bpaul, ~2023) — memorize back-side state in inspection, execute both sides essentially simultaneously. Lachlan Gibson 1.53 single (Sep 2025), Brendyn Dunagan 2.24 Ao5 (2025). The flip is one indivisible ~0.3s motion. Note: prior method "Lou" (Yunhao Lou 2.87 WR May 2021) was flip-efficient but sequential.',
    current_method_zh:
      '7-SIMUL (bpaul ~2023) — inspection 期间记忆背面,正背两面几乎同时执行。Gibson 1.53 单 (2025-09), Dunagan 2.24 Ao5 (2025)。翻面动作不可分,~0.3 秒。前代方法 Lou (Yunhao Lou 2.87 WR 2021-05) 减翻面但仍顺序执行。',
    method_eras: [
      { start_year: 2003, method: 'Sequential pin-flip (front, then back)', method_zh: '顺序拨钉 (先前后)', avg_stm: 18 },
      { start_year: 2010, method: 'Pochmann / Stefan-style categorized algs', method_zh: 'Pochmann / Stefan 分类算法' },
      { start_year: 2018, method: 'Lou (Yunhao Lou) — flip-efficient sequence', method_zh: 'Lou (Yunhao Lou) — 减翻面' },
      { start_year: 2023, method: '7-SIMUL — simultaneous-side execution', method_zh: '7-SIMUL — 双面并行' },
    ],
    hardware_eras: [
      { year: 2013, milestone_en: 'LingAo Clock — first speed clock', milestone_zh: 'LingAo Clock — 首批速拧魔表' },
      { year: 2017, milestone_en: 'Mr. M (modded magnetic pins)', milestone_zh: 'Mr. M (改装磁铁拨钉)' },
      { year: 2020, milestone_en: 'QiYi Magnetic Clock — 208 magnets, eliminated lockups', milestone_zh: 'QiYi 磁铁魔表 — 208 磁铁,根除卡顿' },
    ],
    decomp: [
      { scenario_en: 'Gibson 1.53 (current WR, 7-SIMUL)', scenario_zh: 'Gibson 1.53 (现 WR, 7-SIMUL)', M: 14, TPS: 7, R: 0.4, note_en: 'M = atomic movements; flip = 0.3 s anchor', note_zh: 'M = 原子动作;翻面 0.3 秒' },
      { scenario_en: 'Realistic future floor', scenario_zh: '现实下界', M: 12, TPS: 8, R: 0.3 },
      { scenario_en: 'Flip-eliminated method (hypothetical)', scenario_zh: '消除翻面 (假设新方法)', M: 11, TPS: 9, R: 0.2 },
    ],
    reasoning_en:
      'Clock is the most hardware-bottlenecked WCA event. The ~0.3s flip eats 15-20% of WR time. Recognition is replaced by inspection memorization (7-SIMUL). Floor 1.3-1.6s; further drops require flip-eliminating methods, not human dexterity.',
    reasoning_zh:
      '魔表是 WCA 中机械瓶颈最严重的项目。~0.3 秒翻面占 WR 时间 15-20%。识别被 inspection 记忆 (7-SIMUL) 取代。下界 1.3-1.6 秒;再压缩靠"消除翻面"的新方法。',
  },

  // ════════════════════════════════════════════════════════════
  //  minx
  // ════════════════════════════════════════════════════════════
  'minx': {
    current_method_en:
      'Westlund (Star + F2L + S2L + Last2Layers) remains universal at the top — Zemdegs, Huanqui, Ziyu Wu, Tarasenko all use it. Modern variants (Yu Da-Hyung S2L, Bálint S2L) differ in last-pair insertion. Timofei Tarasenko 21.99 single + 24.38 Ao5 (Tashkent Open 2025-12) used Westlund + heavy LL alg base.',
    current_method_zh:
      'Westlund (Star + F2L + S2L + Last2Layers) 仍是顶级普世标准 — Zemdegs / Huanqui / 吴子语 / Tarasenko 都用。现代变种 (Yu Da-Hyung S2L、Bálint S2L) 差别在最后一对的插入。Tarasenko 21.99 单 + 24.38 Ao5 (Tashkent Open 2025-12) 用 Westlund + 厚 LL 算法库。',
    method_eras: [
      { start_year: 2003, method: 'Beginner / LBL face-by-face', method_zh: '逐层 / 逐面入门', avg_stm: 280 },
      { start_year: 2011, method: 'Westlund (Simon Westlund) — Star + F2L + S2L + LL', method_zh: 'Westlund (Simon Westlund) — Star + F2L + S2L + LL', avg_stm: 160 },
      { start_year: 2018, method: 'Westlund + Yu Da-Hyung / Bálint S2L variants', method_zh: 'Westlund + Yu Da-Hyung / Bálint S2L 变种', avg_stm: 140 },
      { start_year: 2024, method: 'Westlund + heavy LL (full PLL + extended OLL)', method_zh: 'Westlund + 厚 LL (全 PLL + 扩展 OLL)', avg_stm: 130 },
    ],
    hardware_eras: [
      { year: 2008, milestone_en: 'MF8 Megaminx — first competitive', milestone_zh: 'MF8 — 首批竞速' },
      { year: 2014, milestone_en: 'X-Man Galaxy V1 — sub-40 era', milestone_zh: 'X-Man Galaxy V1 — sub-40 时代' },
      { year: 2018, milestone_en: 'X-Man Galaxy V2 (Sculpted) — long-running standard', milestone_zh: 'X-Man Galaxy V2 (Sculpted) — 长期主流' },
      { year: 2022, milestone_en: 'GAN Megaminx — premium tunable', milestone_zh: 'GAN Megaminx — 高端可调' },
    ],
    decomp: [
      { scenario_en: 'Tarasenko 21.99 (current WR)', scenario_zh: 'Tarasenko 21.99 (现 WR)', M: 130, TPS: 6.8, R: 1.0 },
      { scenario_en: 'Realistic future floor', scenario_zh: '现实下界', M: 120, TPS: 9, R: 0.8 },
      { scenario_en: 'Physical floor', scenario_zh: '物理下界', M: 100, TPS: 12, R: 0.6 },
    ],
    best_reconstructions: [
      { person: 'Timofei Tarasenko', date: '2025-12-06', time: '21.99 s', M: 130, TPS: 6.8, method: 'Westlund', source_url: 'https://speedcubing.org/blogs/news/timofei-tarasenko-breaks-megaminx-world-record-single' },
    ],
    reasoning_en:
      'Megaminx 12 faces but locked to 6 finger-trick faces. Inspection covers Star + 1-2 stars; remaining S2L is pure look-ahead. Floor 16-19s single, 19-22s avg. Tarasenko 22 leaves 4-6s headroom over 5-10 years.',
    reasoning_zh:
      '五魔方 12 面,但锁定为 6 个手指动作面。Inspection 覆盖 Star + 1-2 星;剩余 S2L 纯 look-ahead。下界 16-19 秒单 / 19-22 秒平均。Tarasenko 22 留 4-6 秒空间,5-10 年内若 S2L 训练继续可压。',
  },

};
