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
  /** 物理下界 (单次): 通常 = decomp 最后一行的 T。手填可覆盖 */
  t_phys_single?: number;
  /** 物理下界 (Ao5 / Mo3 平均). T_phys_single 加上执行噪声残差 (Ao5 SD ≈ 0.13, Mo3 SD ≈ 0.17) */
  t_phys_avg?: number;
  /** 当前 Ao5/Mo3 WR 持有者 — WCA dump 没抽这个,手维护 */
  current_wr_avg_holder?: string;
  /** 当前 Ao5/Mo3 WR 数值 (显示单位) — 本地 dump 滞后于真实最新记录时,用此覆盖 */
  current_wr_avg_value?: number;
  /** 当前 WR 单次值 (显示单位) — 本地 dump 滞后时覆盖 */
  current_wr_single_value?: number;
  /** 当前 WR 单次持有者 + 上下文 */
  current_wr_single_holder?: string;
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
      'The 2026 frontier is the full ZB method = ZBLS (Zborowski-Bruchem Last Slot, ~302 cases — orient edges during the last F2L pair so the cube enters last-layer with cross + corners + EO already done) + ZBLL (493 cases — 1-alg LL given EO). Combined effect: a ZB solve is "F2L → 1 alg → done", saving ~5 STM and ~0.4 s of recognition vs CFOP\'s 2-step OLL+PLL. Xuanyi Geng (耿暄一) holds the current WR average 3.71 (Deqing Short-Time 2026-04-26, includes a 2.80 single — AsR / WR2) using full ZB throughout — beating his own prior 3.84 (Beijing Winter 2026-01-11). Yiheng Wang holds the WR single 3.08 with vanilla CFOP + 2-look OLL — a non-maxed-out method, which is the strongest argument that CFOP-only still has room. Below ZB, full 1LLL (~3,668 cases, Eduardo Silva Damasceno first learned 2022) is the next step but requires recognition speed gains we have not yet seen. Roux caps at sub-4 single / sub-6 average (Alexey Tsvetkov 3.95 single, SPV / Tsvetkov / Cuares / Arradaza all sub-6 Ao5).',
    current_method_zh:
      '2026 年顶级前沿是**全 ZB 方法 = ZBLS (Zborowski-Bruchem Last Slot, ~302 cases — 在 F2L 最后一对就把 EO 控制好,使最后一层进入"cross + 角 + EO 全就绪"的状态) + ZBLL (493 cases — 给定 EO 后 1 算法解 LL)**。综合效果:ZB 解法 = "F2L → 一个算法 → 完成",比 CFOP 的两步 OLL+PLL 省 ~5 STM 和 ~0.4 秒识别。**耿暄一 (Xuanyi Geng) 当前持有 WR 平均 3.71 秒 (Deqing 短时赛 2026-04-26,五把里含 2.80 秒 AsR / WR2 单次),全程 ZB,改写自己 1 月 11 日北京冬季的 3.84**。王艺衡持有 WR 单次 3.08 用的还是 CFOP 朴素 + 2-look OLL,即"WR 单次仍是非极限方法在打",这恰好说明 CFOP 本身仍有空间。ZB 之下还有全 1LLL (~3668 cases,Eduardo Silva Damasceno 2022 首学完),但需要识别速度跟上。Roux 上限是 sub-4 单次 / sub-6 平均 (Tsvetkov 3.95 单次是 Roux 历史首破 4 秒)。',
    current_wr_avg_holder: 'Xuanyi Geng (耿暄一) — Deqing 2026-04-26',
    current_wr_avg_value: 3.71,
    t_phys_avg: 3.0,
    method_eras: [
      { start_year: 1981, method: 'Layer-by-layer / Beginner', method_zh: '逐层入门法', avg_stm: 130, notes_en: 'WC1982 era; ~22 s WR', notes_zh: 'WC1982 时代;~22 秒 WR' },
      { start_year: 1997, method: 'Fridrich / CFOP (proposed by Jessica Fridrich)', method_zh: 'Fridrich / CFOP (Jessica Fridrich 提出)', alg_count: 78, avg_stm: 62 },
      { start_year: 2003, method: 'CFOP + 4-look LL', method_zh: 'CFOP + 4-look LL', alg_count: 20, avg_stm: 62 },
      { start_year: 2007, method: 'CFOP + full OLL/PLL', method_zh: 'CFOP + 全 OLL/PLL', alg_count: 78, avg_stm: 58, notes_en: 'Feliks Zemdegs measured 58 STM / 62 ETM', notes_zh: 'Feliks Zemdegs 实测 58 STM / 62 ETM' },
      { start_year: 2017, method: 'CFOP + extended F2L lookahead (post-magnet era)', method_zh: 'CFOP + 扩展 F2L lookahead (磁铁时代后)', avg_stm: 56 },
      { start_year: 2022, method: 'CFOP + full ZBLL only (LL 1-alg, EO not pre-controlled)', method_zh: 'CFOP + 全 ZBLL (LL 1 alg,EO 未预控)', alg_count: 493, avg_stm: 52, notes_en: 'Tymon, Zajder use; Geng moved on', notes_zh: 'Tymon / Zajder 用;耿暄一已升级' },
      { start_year: 2024, method: 'High-TPS-driven CFOP (Yiheng Wang school)', method_zh: '高 TPS 驱动 CFOP (王艺衡流派)', avg_stm: 56, notes_en: 'Sustained 14+ TPS, 2-look OLL kept for recog speed', notes_zh: '持续 14+ TPS,保留 2-look OLL 换识别速度' },
      { start_year: 2026, method: 'Full ZB method = ZBLS + ZBLL (Xuanyi Geng, current WR avg)', method_zh: '全 ZB 方法 = ZBLS + ZBLL (耿暄一,现 WR 平均)', alg_count: 795, avg_stm: 49, notes_en: 'Geng 3.71 avg (Deqing 2026-04-26, includes 2.80 single AsR); EO controlled in last F2L pair → 1-alg LL', notes_zh: '耿暄一 3.71 平均 (Deqing 2026-04-26,含 2.80 秒 AsR 单次);最后一对 F2L 内控好 EO,LL 1 算法搞定' },
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
      { scenario_en: '20–30 year horizon (Wang TPS × Geng STM)', scenario_zh: '20–30 年内可达 (Wang TPS × Geng STM)', M: 28, TPS: 16, R: 0.1 },
      { scenario_en: '100-year asymptote (max method-found STM × biomech ceiling)', scenario_zh: '100 年渐近 (方法可达最少步 × 生物力学顶端)', M: 24, TPS: 17, R: 0.05 },
      { scenario_en: 'Absolute floor (God\'s number STM × dual-hand drum-roll bandwidth)', scenario_zh: '绝对下界 (God\'s number STM × 双手击鼓带宽)', M: 18, TPS: 22, R: 0.05 },
    ],
    t_phys_single: 1.46,
    best_reconstructions: [
      { person: 'Yusheng Du (杜宇生)', date: '2018-11-24', time: '3.47 s', M: 27, TPS: 7.78, method: 'CFOP, XX-cross + 1-look LL (lucky CP-OLL)', source_url: 'https://www.facebook.com/moyumagiccube/photos/reconstruction-of-yusheng-dus-347-33-wrscramble-f-u2-l2-b2-f-u-l2-u-r2-d2-l-b-l2/1922639067817044/' },
      { person: 'Max Park', date: '2023-06-11', time: '3.13 s', M: 33, TPS: 10.54, method: 'CFOP, double X-cross + PLL skip', source_url: 'https://ruwix.com/blog/max-park-rubik-single-record-313/' },
      { person: 'Yiheng Wang (王艺衡)', date: '2025', time: '3.08 s', M: 45, TPS: 14.61, method: 'CFOP, 2-look LL (OLL skip) — current WR single', source_url: 'https://speedcubing.org/blogs/news/yiheng-wang-breaks-world-record-3x3-single-with-3-08' },
      { person: 'Teodor Zajder', date: '2026-02-08', time: '2.76 s', M: 29, TPS: 10.50, method: 'CFOP, XXX-cross + ZBLL', source_url: 'https://ruwix.com/blog/first-sub-3-rubiks-cube-record-teodor-zajder-2_76/' },
      { person: 'Xuanyi Geng (耿暄一) WR avg 3.71', date: '2026-04-26', time: '3.71 avg', M: 49, TPS: 12.93, method: 'ZB (ZBLS + ZBLL) — Deqing Short-Time, includes 2.80 AsR single', source_url: 'https://www.speedsolving.com/threads/xuanyi-geng-3x3-3-71-average-and-2-80-asr-single.96768/' },
      { person: 'Xuanyi Geng (耿暄一) prior WR avg 3.84', date: '2026-01-11', time: '3.84 avg', M: 49, TPS: 12.4, method: 'ZB (ZBLS + ZBLL) — Beijing Winter, full reconstruction available', source_url: 'https://ruwix.com/blog/xuanyi-geng-3_84-seconds-average-record/' },
      { person: 'Ruihang Xu (unofficial)', date: '2021', time: '2.68 s', M: 26, TPS: 9.70, method: 'CFOP, lucky scramble (warmup, not WCA)', source_url: 'https://www.speedsolving.com/threads/reconstruction-2-68-3x3-world-best-single-ruihang-xu.80181/' },
    ],
    reasoning_en:
      'The single floor lives at three different levels — they are not the same number.\n\n' +
      'The mathematical wall sits near 0.78 s. Rokicki et al. proved in 2010 that any scramble has an optimal HTM solution of at most 20 moves; 67% of random scrambles are optimal at 18 HTM. Translated to STM (the metric used here, where slice = 1 move), the global optimum lies around 16–18 moves on the luckiest scrambles. Divide by the biomechanical ceiling — single-stroke drum-roll records hit 22 Hz with two-handed alternation, the same envelope a cube grip can address — add 0.05 s of release-trigger reaction and you arrive at ~0.78 s. This requires a perfect human meeting a sub-1-in-10⁵ scramble with zero execution drift. It is mathematically open but vanishingly rare in any 100-year window.\n\n' +
      'The 100-year asymptote sits near 1.5 s. Humans do not compute optimal solutions in 15 seconds — they follow methods (CFOP / ZB / Roux) and traverse near-optimal paths. The shortest WR-grade solutions on record are Xu\'s 26 STM (unofficial 2.68), Du\'s 27 STM (3.47), and Zajder\'s 29 STM (2.76). Compress the method ceiling once more to ~24 STM (a luckier 1-look ZBLL with two free F2L pairs), pair it with 17 TPS sustained — Wang already verified 16.6 on a full unofficial solve — and add 0.05 s of residual recognition. That yields ~1.46 s, which is the reasonable 100-year endpoint for the method-realisable lower tail.\n\n' +
      'The 20-30 year horizon sits near 1.85 s. Two living cubers each demonstrate one half of the equation: Wang on TPS, Geng on STM. Layer them — Geng\'s 28-STM ZB skeleton at Wang\'s 16 TPS, with 0.1 s residual recognition — and the answer is 28/16 + 0.1 = 1.85 s. Both inputs are independently observed today, so this is the "known-tools optimum", not a speculative ceiling.\n\n' +
      'Where Zajder\'s 2.76 sits in this scaffold: 29 STM is two moves above the 100-year STM floor; 10.5 TPS is six TPS below the verified Wang ceiling. The remaining headroom is almost entirely in TPS, which is consistent with the broader pattern that TPS evolves continuously while methods evolve in jumps. The two routes have different ceilings: Wang\'s TPS path saturates near the biomechanical wall, while Geng\'s ZB-step path can still extend through full 1LLL (~3,668 cases, Damasceno 2022).\n\n' +
      'Ao5 floors strictly above single. Within-cuber within-scramble execution noise has SD ≈ 0.3 s, which does not vanish under averaging — averaging shrinks SD by √5 to ~0.13 s, but you still need three middle solves at the lucky-tail. A defensible Ao5 floor is ~3.0 s; Geng\'s 3.71 sits at 81% of that.\n\n' +
      'Extreme-value framing for sanity check. Treating WR singles as Gumbel-tail draws of N independent attempts: WR ≈ μ − √(2 ln N)·σ. Current cumulative elite official solves N ≈ 4×10⁶ gives z ≈ 5.6; 100 years out, N ≈ 4×10⁸ gives z ≈ 6.5 with σ ≈ 0.8 s on a μ ≈ 5 s reference. The implied 100-year WR is ~0.2 s below μ − z·σ, which collapses onto the mathematical wall — i.e. by 100 years the Gumbel tail has been compressed enough that the next bottleneck is genuinely biomechanical.',
    reasoning_zh:
      '三阶单次的下界要分三层看,不是一条线。\n\n' +
      '数学硬墙在 0.78 秒附近。Rokicki 等 2010 年用穷举证明:任何 scramble 的全局最优 ≤ 20 HTM,67% 随机 scramble optimal = 18 HTM。换算到 STM (本页统一用的度量,slice 计 1 步),最优单次步数大约 16-18 步。除以生物力学带宽 — 单击鼓世界纪录单手 11 Hz、双手交替能撑 22 Hz,握 cube 的两手 4 指本质上是同一带宽 — 加 0.05 秒 StackMat 反应,得到约 0.78 秒。这要求"最优秀的人 + 1/10⁵ 量级幸运 scramble + 完美执行 + 计时设备零误差"四件事同时成立。数学上没有违反任何物理定律,但 100 年内出现概率近零。\n\n' +
      '现实渐近在 1.5 秒附近。人不会在 15 秒里推算 optimal,只能靠方法 (CFOP / ZB / Roux) 走一条次优但可执行的路径。已观测最少步数:Xu 非正式 2.68 用 26 步,Du 3.47 用 27 步,Zajder 2.76 用 29 步。把方法天花板再压一档到 24 步 (更幸运的 1-look ZBLL,两个 F2L 对自由),叠加王艺衡已经在 57 步非正式 3.43 秒解上验证过的 16.6 TPS 持续,加 0.05 秒残余识别,得到约 1.46 秒。这是 100 年外推的合理终点。\n\n' +
      '20-30 年内可达落在 1.85 秒。两个现役 cuber 各自验证了等式的一半 — Wang 验证 TPS,Geng 验证 STM。把两个组合:Geng 的 28 步 ZB 骨架跑在 Wang 的 16 TPS 上,加 0.1 秒残余识别,得 28/16 + 0.1 = 1.85 秒。两个输入都已被独立观测,这是"已知工具组合后的最优",不是推测。\n\n' +
      'Zajder 2.76 在这个坐标系里的位置:29 步比 100 年 STM 下界高 2 步;10.5 TPS 比 Wang 验证的 16.6 TPS 低 6 TPS。剩余空间几乎全在 TPS 这边,与"TPS 连续演化、方法阶跃式演化"的整体格局一致。两条路径上限不同:Wang 的 TPS 路接近生物力学硬墙,Geng 的 ZB 步数路下面还有全 1LLL (~3,668 cases,Damasceno 2022 首学完) 一档。\n\n' +
      'Ao5 严格高于单次。同 cuber 同 scramble 执行噪声 SD ≈ 0.3 秒,平均下不会消失 — 5 把 √5 缩到 0.13 秒,但仍需要中间 3 把命中幸运尾。Ao5 合理下界 ~3.0 秒,Geng 现 3.71 占 81%。\n\n' +
      '极值理论的反算 (Gumbel 尾): WR ≈ μ − √(2 ln N)·σ。现役精英官方解累计 N ≈ 4×10⁶,z ≈ 5.6;100 年后 N ≈ 4×10⁸,z ≈ 6.5,σ ≈ 0.8 秒,μ ≈ 5 秒。100 年外推 WR ≈ 5 − 6.5×0.8 = ~0.2 秒下穿 — 但 Gumbel 尾在 N 这么大时已经被压扁,下一个 binding 约束变成生物力学硬墙,与第一层 0.78 秒吻合。',
    why_fit_differs_en:
      'The curve fit lands at 2.70 s because it only sees the historical CFOP+OLL+PLL trajectory. It cannot see method discontinuities like the full-ZBLL transition (Geng vs Wang in 2026 was a step change, not a smooth trend), or hardware regime shifts like the 2017 magnet revolution and 2021 MagLev — each cut average solve time 10-15% in a single jump. Most importantly, WR singles are extreme-value statistics: the lower bound depends on sampling depth N, not on the visible asymptote of past records. The fit answers "where will the trend go under current methods" — not "what is the physical limit". They line up here only by accident.',
    why_fit_differs_zh:
      '曲线拟合给出 2.70 秒是因为它只见过 CFOP+OLL+PLL 的轨迹。它看不到方法断点 (2026 年 Geng 用全 ZB 改写 Wang 的平均 WR 是阶跃,不是平滑趋势),也看不到硬件 regime shift (2017 磁铁革命、2021 MagLev 各砍掉平均时间 10-15% 一次性)。更关键的是,WR 单次本质是极值统计 — 下界由采样深度 N 决定,不是历史记录渐近线。拟合回答的是"现行方法下趋势会去哪",不是"物理极限是什么"。二者在这里偶然接近,不代表因果。',
  },

  // ════════════════════════════════════════════════════════════
  //  222
  // ════════════════════════════════════════════════════════════
  '222': {
    current_method_en:
      'Full EG = CLL + EG-1 + EG-2 (126 algs total). Top cubers (Ziyu Ye 0.39 single Hefei 2025; Sujan Feist 0.86 Ao5; Zayn Khanani; Yiheng Wang) use full EG. Many WR singles are 4-5 STM lucky 1-look skips. Note: Yiheng\'s 0.78 average (2024) was revoked after frame-counting found timer sliding — WCA introduced framecount verification in response.',
    current_method_zh:
      '全 EG = CLL + EG-1 + EG-2 (126 算法)。顶级 (叶子瑜 0.39 单次 合肥 2025;Sujan Feist 0.86 Ao5;Zayn Khanani;王艺衡) 全用全 EG。多数 WR 单次是 4-5 步幸运 1-look skip。注:王艺衡 2024 年 0.78 平均被取消,因为帧分析发现"滑计时器"作弊,WCA 因此引入帧计数验证。',
    current_wr_avg_holder: 'Sujan Feist — 0.86 (Kids America Christmas OH 2025)',
    t_phys_single: 0.3,
    t_phys_avg: 0.65,
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
      { scenario_en: '20–30 year horizon', scenario_zh: '20–30 年内可达', M: 4, TPS: 12, R: 0.05 },
      { scenario_en: '100-year asymptote', scenario_zh: '100 年渐近', M: 4, TPS: 14, R: 0.05 },
      { scenario_en: 'Absolute floor (reaction-time wall + StackMat noise)', scenario_zh: '绝对下界 (反应时间 + StackMat 触发噪声)', M: 4, TPS: 18, R: 0.05 },
    ],
    best_reconstructions: [
      { person: 'Ziyu Ye (叶子瑜)', date: '2025-10-25', time: '0.39 s', M: 4, TPS: 10.26, method: 'EG-1 (R U2 R\' U\')', source_url: 'https://www.cubzor.com/news/ziyu-ye-sets-2x2-single-world-record-039-hefei-open-2025' },
    ],
    reasoning_en:
      'Two-by-two has only 3.67M states and optimal HTM ≤ 11, so the entire solve is plannable in 15-second inspection. That collapses recognition to zero, and what remains is the simplest physical equation in cubing: reaction time plus a few finger taps. Ye\'s 0.39 used a 4-move EG-1 skip on a 1-in-30 scramble — that is essentially the geometry of the problem.\n\n' +
      'The remaining headroom lives in the StackMat trigger envelope. Release-to-go reaction floors at 0.05 s; raw single-finger burst peaks near 18-22 Hz on a 50 mm cube, but sustained over 4 moves it averages 12-14 TPS in practice. Combine those: 4/14 + 0.05 = 0.34 s for the 100-year asymptote, 4/18 + 0.05 = 0.27 s for the absolute floor. Anything below 0.25 s starts colliding with the StackMat\'s own measurement noise — which is exactly why the WCA introduced frame-count verification after the 2024 Yiheng-Wang sliding incident.',
    reasoning_zh:
      '二阶状态空间仅 367 万,optimal ≤ 11 HTM,15 秒 inspection 足以全程规划完。识别因此归零,剩下的就是 cubing 里最简单的物理等式:反应时间 + 几次手指敲击。叶子瑜 0.39 用的是 4 步 EG-1 skip,大概 1/30 scramble 出现一次 — 本质上就是这个问题的几何形态。\n\n' +
      '剩余空间在 StackMat 触发包络里。release-to-go 反应底 ≈ 0.05 秒;50 毫米小立方上的单指突发峰 18-22 Hz,持续 4 步实际跑出 12-14 TPS。组合:4/14 + 0.05 = 0.34 秒是 100 年渐近,4/18 + 0.05 = 0.27 秒是绝对下界。低于 0.25 秒就开始撞 StackMat 自身的测量噪声 — 这也是 2024 年王艺衡"滑计时器"事件后 WCA 引入帧计数验证的根因。',
    why_fit_differs_en:
      '2x2 is the rare case where the curve fit L is roughly correct, because the event is already at its physical floor and the trajectory is tracking scramble-luck distribution rather than method or hardware gains. The agreement is coincidence, not insight.',
    why_fit_differs_zh:
      '二阶是少数拟合 L 大致对的项目 — 因为它早已逼近物理下界,轨迹反映的是幸运 scramble 分布而非方法 / 硬件演进。这里曲线碰巧接近真实下界,是巧合不是因果。',
  },

  // ════════════════════════════════════════════════════════════
  //  444
  // ════════════════════════════════════════════════════════════
  '444': {
    current_method_en:
      'Yau (Robert Yau, 2009) is universal at WR level: cross dedges first, then centers + last cross dedge, then 3-2-3 chain edge pairing, then 3x3 stage. Tymon Kolasiński (current WR 15.18 single + 18.56 Ao5 = first sub-19) and Max Park (prior WR holder, 19.38 → 19.71 Ao5 history) both use Yau. Reduction is the intermediate fallback. Parity (50% OLL + 50% PLL independently): OLL parity ~15 STM alg, PLL parity ~12 STM alg.',
    current_method_zh:
      'Yau (Robert Yau, 2009 提出) 是 WR 级普世标准:先 cross 边棱 → 中心 + 最后 cross 边棱 → 3-2-3 链棱配对 → 三阶阶段。Tymon (现 WR 15.18 单 + 18.56 Ao5 = 史上首破 19 秒) 和 Max Park (前 WR) 都用 Yau。Reduction 是中级备选。Parity (50% OLL + 50% PLL 独立):OLL parity ~15 步算法,PLL parity ~12 步。',
    current_wr_avg_holder: 'Tymon Kolasiński — 18.56 (Seoul Winter 2026, first sub-19)',
    t_phys_single: 12,
    t_phys_avg: 14,
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
      { scenario_en: '20–30 year horizon (parity-dodge + 11 TPS)', scenario_zh: '20–30 年 (parity 预跟踪 + 11 TPS)', M: 125, TPS: 11, R: 0.5 },
      { scenario_en: '100-year asymptote (no parity scramble + 12 TPS)', scenario_zh: '100 年渐近 (无 parity + 12 TPS)', M: 110, TPS: 12, R: 0.5 },
      { scenario_en: 'Absolute floor (optimal-route human + biomech ceiling)', scenario_zh: '绝对下界 (人类最优路径 + 生物力学顶端)', M: 90, TPS: 14, R: 0.3 },
    ],
    best_reconstructions: [
      { person: 'Tymon Kolasiński', date: '2025-12', time: '15.18 s', M: 140, TPS: 9.2, method: 'Yau + freeslice', source_url: 'https://speedcubing.org/blogs/news/tymon-kolasinski-breaks-4x4-world-record-single' },
    ],
    reasoning_en:
      'Four-by-four\'s binding constraint is wide-turn inertia. Rw, Uw and 3Rw moves involve 8-12 cubies each — physically heavier than a 3x3 face turn — and elite TPS drops about 15% accordingly. Tymon\'s 15.18 averages 9.2 TPS over an estimated 140 STM, well below 3x3 sustained TPS even though the cubes are fully magnetic. The other binding constraint is parity: OLL parity (~15 STM, 50% probability, independent of PLL parity ~12 STM) adds 1.5-3 s in expected value alone.\n\n' +
      'There are no public WR-grade move-count reconstructions for 4x4 — estimates are derived from method-design (Yau cross dedges + centers + edge pairing + 3x3 + parity) and the 7x7 reconstruction thread. The achievable phases are visible: a 16-second elite solve breaks roughly as F2C 1.5 s, three cross dedges 1.8 s, last four centers + cross dedge 3.0 s, edge pairing 4.0 s, 3x3 stage 5.7 s. Compress each phase 20% via better tracking + slight TPS gain — that\'s 12-13 s with both parities, ~10 s on a no-parity scramble. The absolute floor falls when wide-turn hardware breaks past current MoYu AoSu V7 / GAN 460M friction, plausibly at 90 STM on luckier routing.',
    reasoning_zh:
      '四阶的主要约束是 wide-turn 惯性。Rw / Uw / 3Rw 每步动 8-12 个块,物理上比 3x3 面转重,顶级 TPS 因此低约 15%。Tymon 15.18 跑出 9.2 TPS 持续 (140 STM 估计),即便 cube 全磁也比 3x3 慢一档。第二个约束是 parity:OLL parity (~15 STM,50% 概率,与 PLL parity ~12 STM 独立),期望值就吃掉 1.5-3 秒。\n\n' +
      '4x4 没有公开 WR 级复盘数据库,步数靠方法设计 (Yau: cross 边棱 + 中心 + 棱配对 + 三阶 + parity) 和 7x7 thread 反推。16 秒级顶级解的阶段拆分大致是: F2C 1.5 秒、3 个 cross 边棱 1.8 秒、后 4 中心 + 最后 cross 边棱 3.0 秒、棱配对 4.0 秒、三阶阶段 5.7 秒。每阶段靠更好的跟踪 + 微涨 TPS 压 20%,得到 12-13 秒含双 parity,约 10 秒在无 parity scramble。绝对下界要等 wide-turn 硬件突破现有 MoYu AoSu V7 / GAN 460M 的摩擦上限,加上更幸运 routing 把步数降到 90 STM。',
  },

  // ════════════════════════════════════════════════════════════
  //  555
  // ════════════════════════════════════════════════════════════
  '555': {
    current_method_en:
      'Yau5 (extended Yau for 5x5) and Reduction split the elite. Tymon Kolasiński (WR 30.45 single 2024 + 34.31 Ao5 2025 — first non-Park average WR holder in ~7 years) uses Yau5. Park uses Reduction. 5x5 has NO parity (odd-layered, no algorithmic OLL/PLL parity case).',
    current_method_zh:
      'Yau5 (Yau 在 5x5 的扩展) 和 Reduction 在顶级各占一半。Tymon (WR 30.45 单 2024 + 34.31 Ao5 2025 — Park 之外 ~7 年来首个) 用 Yau5。Park 用 Reduction。5x5 无 parity (奇数层,不存在算法级 OLL/PLL parity)。',
    current_wr_avg_holder: 'Tymon Kolasiński — 34.31 (WCA World Champ 2025)',
    t_phys_single: 19.5,
    t_phys_avg: 22,
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
      { scenario_en: '20–30 year horizon (Yau5 + tracking gains)', scenario_zh: '20–30 年 (Yau5 + 跟踪改进)', M: 205, TPS: 8.5, R: 1.5 },
      { scenario_en: '100-year asymptote (efficient route + 10 TPS)', scenario_zh: '100 年渐近 (高效路径 + 10 TPS)', M: 180, TPS: 10, R: 1.5 },
      { scenario_en: 'Absolute floor (optimal-route human + 12 TPS sustained)', scenario_zh: '绝对下界 (人类最优路径 + 12 TPS 持续)', M: 150, TPS: 12, R: 1.0 },
    ],
    best_reconstructions: [
      { person: 'Tymon Kolasiński', date: '2024-11', time: '30.45 s', M: 220, TPS: 7.2, method: 'Yau5', source_url: 'https://www.speedsolving.com/wiki/index.php/List_of_World_Records/5x5x5' },
    ],
    reasoning_en:
      'Five-by-five differs from four-by-four in two important ways. First, it has no algorithmic parity — odd-layer puzzles cannot produce the dedge-flip / dedge-swap cases that cost 4x4 solvers a combined 1.5-3 s in expected value. Second, the inner-edge tracking cost is superlinear: 12 midges plus 24 wing-edges create a working memory load during reduction that dwarfs 4x4. Tymon\'s 30.45 averaged 7.2 TPS over an estimated 220 STM, materially slower than 4x4 (9.2 TPS) — the bottleneck is mental tracking during edge pairing, not finger speed.\n\n' +
      'Phase splits for a 35-second elite solve estimate roughly: first 2 centers 3.5 s, three cross edges in Yau5 3.0 s, last 4 centers + final cross edge 6.5 s, edge pairing 10 s, 3x3 stage 12 s. Edge pairing is where the gains live — better look-ahead training cuts that phase ~20%. Push the route to ~180 STM and TPS to a sustained 10, residual recognition to 1.5 s, and you get 19.5 s — that is the realistic 100-year floor. Zemdegs\' 2017 prediction of "sub-40 imminent" was annihilated by 2024, and his "sub-45 mean" was passed in 2018.',
    reasoning_zh:
      '5x5 与 4x4 有两处关键差别。一是没有算法 parity — 奇数层拼图不会出 dedge-flip / dedge-swap 那种期望吃 1.5-3 秒的 case。二是内层跟踪代价超线性:12 个 midge + 24 个 wing edge 在 reduction 阶段产生的工作记忆压力比 4x4 大得多。Tymon 30.45 跑出 7.2 TPS / 220 STM,比 4x4 (9.2 TPS) 明显慢,瓶颈在棱配对阶段的心智跟踪,不在手指。\n\n' +
      '35 秒级顶级解的阶段大致是: 前 2 中心 3.5 秒、Yau5 三 cross 棱 3.0 秒、后 4 中心 + 最后 cross 棱 6.5 秒、棱配对 10 秒、三阶阶段 12 秒。增量空间主要在棱配对 — 更好的 look-ahead 训练能压 ~20%。把路径压到 180 STM、持续 10 TPS、残余识别 1.5 秒,得到 19.5 秒,这是 100 年现实下界。Zemdegs 2017 预言 "sub-40 临近" 2024 被砸穿,"sub-45 平均" 2018 就过线了。',
  },

  // ════════════════════════════════════════════════════════════
  //  666
  // ════════════════════════════════════════════════════════════
  '666': {
    current_method_en:
      'Reduction universal at WR level — Yau6 offers diminishing returns due to dilute cross-edge advantage. Max Park dominates (current single 57.69 in Burbank 2025-04 — third-ever sub-1:00 single; Mo3 1:05.04). 6x6 has full parity (50% × 15-STM OLL + 50% × 12-STM PLL). Hardware unresolved: inner-layer slipping affects "every 6x6 including the big three" (Cubeskills).',
    current_method_zh:
      'Reduction 在 WR 级普世 — Yau6 在 6x6 收益递减,cross 边棱优势被稀释。Max Park 垄断 (现单次 57.69, Burbank 2025-04, 史上第三个 sub-1:00 单次;Mo3 1:05.04)。6x6 有完整 parity (50% × 15-STM OLL + 50% × 12-STM PLL)。硬件未解决:内层打滑影响"所有 6x6,包括三大牌"(Cubeskills)。',
    current_wr_avg_holder: 'Max Park — 1:05.04 Mo3 (Nub Open Trabuco Hills Fall 2025)',
    t_phys_single: 36,
    t_phys_avg: 42,
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
      { scenario_en: '20–30 year horizon (parity dodging + 6.5 TPS)', scenario_zh: '20–30 年 (parity 闪避 + 6.5 TPS)', M: 300, TPS: 6.5, R: 2.5 },
      { scenario_en: '100-year asymptote (better hardware + 7.5 TPS)', scenario_zh: '100 年渐近 (更优硬件 + 7.5 TPS)', M: 280, TPS: 7.5, R: 2.0 },
      { scenario_en: 'Absolute floor (slip-free inner layers + 9 TPS)', scenario_zh: '绝对下界 (内层零打滑 + 9 TPS)', M: 250, TPS: 9, R: 1.5 },
    ],
    reasoning_en:
      'Six-by-six is the WCA event most bottlenecked by hardware. Cubeskills documented "every 6x6 out there, including the big three, has unresolved inner-layer slipping" — the moment a wide turn brushes against an inner layer that did not commit, the solver loses 0.2-0.5 s recovering alignment. Park\'s 57.69 averaged 5.5 TPS over an estimated 315 STM; the gap to 5x5\'s 7.2 TPS is almost entirely physical, not mental.\n\n' +
      'The 58-second elite breakdown is roughly: centers 22 s, edges 20 s, 3x3 stage 16 s. 6x6 has full parity (50% × 15-STM OLL parity, 50% × 12-STM PLL parity, independent), adding ~1.5-3 s in expected value. The 100-year asymptote requires (a) inner-layer slip eliminated by hardware redesign, (b) sustained 7.5 TPS reachable on the deepest slices, (c) phase transitions compressed to 2 s of total recognition cost. Reaching 280 STM on a no-parity scramble, that yields 280/7.5 + 2 = 39.3 s. The absolute floor falls when 9 TPS becomes feasible on a 6x6 — roughly the speed of current 5x5 — which depends on a generation of hardware not yet on the market.',
    reasoning_zh:
      '6x6 是 WCA 中最受硬件瓶颈拖累的项目。Cubeskills 明确指出"包括三大牌在内,所有 6x6 都有未解决的内层打滑问题" — wide turn 一旦扫到没跟上的内层,solver 要花 0.2-0.5 秒重新对齐。Park 57.69 跑出 5.5 TPS / 315 STM;与 5x5 的 7.2 TPS 之差几乎全来自物理摩擦,不是脑算速度。\n\n' +
      '58 秒级顶级解:中心 22 秒、棱 20 秒、三阶阶段 16 秒。6x6 有完整 parity (50% × 15-STM OLL parity,50% × 12-STM PLL parity,独立),期望值多吃 1.5-3 秒。100 年渐近需要三件事:(a) 硬件重做消除内层打滑、(b) 最深 slice 上 7.5 TPS 可持续、(c) 阶段切换的累计识别压到 2 秒。280 STM 无 parity scramble 跑这套,得 280/7.5 + 2 = 39.3 秒。绝对下界要等 6x6 跑出 9 TPS — 接近现役 5x5 的速度 — 这取决于尚未上市的下一代硬件。',
  },

  // ════════════════════════════════════════════════════════════
  //  777
  // ════════════════════════════════════════════════════════════
  '777': {
    current_method_en:
      'Reduction universal (Yau7 used by Tymon). Max Park dominates (current single 1:33.48, Mo3 1:36.86 both at Nub Open Trabuco Hills Fall 2025). 7x7 has NO parity (odd-layered). Best primary STM data of any big cube — multiple solver reconstructions on speedsolving.com show 446-524 STM (mean ~470).',
    current_method_zh:
      'Reduction 普世 (Yau7 Tymon 用)。Max Park 垄断 (现单次 1:33.48,Mo3 1:36.86,均 Nub Open Trabuco Hills Fall 2025)。7x7 无 parity (奇数层)。是大魔方中唯一有公开复盘数据库的项目 — speedsolving 多人复盘显示 446-524 STM (均值 ~470)。',
    current_wr_avg_holder: 'Max Park — 1:36.86 Mo3 (Nub Open Trabuco Hills Fall 2025)',
    t_phys_single: 75,
    t_phys_avg: 80,
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
      { scenario_en: '20–30 year horizon', scenario_zh: '20–30 年', M: 430, TPS: 5.2, R: 3.5 },
      { scenario_en: '100-year asymptote', scenario_zh: '100 年渐近', M: 410, TPS: 6, R: 3.0 },
      { scenario_en: 'Absolute floor (deep-slice 7 TPS + slip-free)', scenario_zh: '绝对下界 (深 slice 7 TPS + 零打滑)', M: 380, TPS: 7, R: 2.0 },
    ],
    best_reconstructions: [
      { person: 'Max Park', date: '2025-10-04', time: '1:33.48', M: 440, TPS: 4.7, method: 'Reduction + freeslice', source_url: 'https://www.speedsolving.com/threads/max-park-1-33-48-7x7-single-and-1-36-86-average.95542/' },
    ],
    reasoning_en:
      'Seven-by-seven is the only big cube with public WR-grade move-count data — multiple speedsolving.com solvers have published reductions in the 446-524 STM range (Hays 501, Kirjava 446, uberCuber 455, vcuber13 455). Park\'s class likely lands around 430-450 with strong tracking and freeslice efficiency; 1:33.48 ÷ 440 STM = 4.7 TPS sustained, matched against centers ~46 s, edges ~33 s, 3x3 stage ~14 s.\n\nThere is no parity (odd-layer cubes lack the dedge cases) but deep-slice physics dominates. 3Rw, 4Rw and 3Lw moves move 21-28 cubies each — the cube has weight and angular inertia, and elite TPS on these specific moves rarely exceeds 4 even with the latest GAN 778 / MoYu HuaShi WR M. The path to ~80 s floor requires the deep-slice TPS bottleneck to break, plus phase-transition recognition pushed under 2 s. Hardware has improved fastest in the last five years among big cubes — quasi-magnet stabilisation of 17 visible layers per face is now solved — and the next bottleneck is human cognitive tracking on 200+ moves of edge pairing, not finger speed.',
    reasoning_zh:
      '7x7 是大魔方中唯一有公开 WR 级复盘数据的项目。speedsolving.com 多人 reduction 步数 446-524 STM (Hays 501、Kirjava 446、uberCuber 455、vcuber13 455)。Park 级别约 430-450,跟踪好 + freeslice 高效。1:33.48 ÷ 440 STM = 4.7 TPS 持续,对应中心 ~46 秒、棱 ~33 秒、三阶 ~14 秒。\n\n无 parity (奇数层无 dedge 类),但深 slice 物理主导。3Rw / 4Rw / 3Lw 每步动 21-28 个块,有重量和角惯性 — 这些动作上即便用最新 GAN 778 / MoYu HuaShi WR M,顶级 TPS 也很难超 4。压到 80 秒下界需要深 slice TPS 瓶颈被突破,加阶段切换识别压到 2 秒以下。大魔方里 7x7 硬件改进最快 — 每面 17 层可见的准磁稳定已经基本解决 — 下一个瓶颈是人类在 200+ 步棱配对上的认知跟踪,不是手指速度。',
  },

  // ════════════════════════════════════════════════════════════
  //  333oh
  // ════════════════════════════════════════════════════════════
  '333oh': {
    current_method_en:
      'CFOP adapted for OH dominates the elite. Dhruva Sai Meruva (Switzerland, current WR single 5.66 at Swiss Nationals 2024-10-06 — tied to digit with Feliks\'s 2H 5.66 from 2011), Luke Garrett (USA, current WR Ao5 7.72, Chicagoland Newcomers 2025), Yiheng Wang. Top solvers use OH-friendly OLL/PLL subsets (RU-heavy algs, often 2-look OLL kept for ergonomics). Roux-OH is more move-efficient (~45-50 STM vs CFOP-OH ~55-60) and dominant in OH single Ao5 records (Sean Patrick Villanueva, Nicholas Archer, Kian Mansour) but the top of the WR Ao5 standings still uses CFOP-OH because recognition speed wins.',
    current_method_zh:
      '顶级以 OH 改良 CFOP 为主。Dhruva Sai Meruva (瑞士,现 WR 单次 5.66, Swiss Nationals 2024-10-06 — 与 Feliks 2011 双手 5.66 同位)、Luke Garrett (美国,现 WR Ao5 7.72, Chicagoland 2025)、王艺衡。OH 版优选 RU-heavy OLL / PLL,部分保留 2-look OLL 节省手指扭曲。Roux-OH 步数更省 (~45-50 vs CFOP-OH ~55-60),在 OH Ao5 历史上有 SPV / Archer / Mansour 等持有人,但当前 WR 仍是 CFOP-OH — 识别速度赢了。',
    current_wr_avg_holder: 'Luke Garrett — 7.72 (Chicagoland Newcomers 2025)',
    t_phys_single: 3.6,
    t_phys_avg: 5,
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
      { scenario_en: '20–30 year horizon (10 TPS sustained)', scenario_zh: '20–30 年 (10 TPS 持续)', M: 52, TPS: 10, R: 0.3 },
      { scenario_en: '100-year asymptote (Roux-OH + 11 TPS)', scenario_zh: '100 年渐近 (Roux-OH + 11 TPS)', M: 48, TPS: 11, R: 0.25 },
      { scenario_en: 'Absolute floor (single-hand drum-roll 12 TPS biomech)', scenario_zh: '绝对下界 (单手击鼓 12 TPS 生理)', M: 42, TPS: 12, R: 0.15 },
    ],
    reasoning_en:
      'One-handed is constrained by single-hand TPS biomechanics. With one hand, only 4 fingers participate in finger-tricks (vs 8 two-handed), and the regrip overhead — reorienting the cube without a second hand to stabilise it — adds 0.3-0.5 s of cumulative pause that two-handed solvers eliminate. Meruva\'s 5.66 averaged 9.7 TPS over an estimated 56 STM with 0.2 s recognition; Wang two-handed 16.6 TPS demonstrates the gap is genuinely physical, not technique.\n\n' +
      'Method has a counterintuitive sub-plot. Roux-OH is move-count superior (45-50 STM vs CFOP-OH 55-60) because it is rotationless and uses RrUM exclusively, but the global elite has not switched. The reason: CFOP\'s recognition speed and algorithm familiarity beat Roux\'s move-count advantage in single-handed timing. Whether that holds long-term is open — if the next generation grows up on Roux-OH from age 8, the picture flips.\n\n' +
      'Floors: 100-year asymptote at 48 STM × 11 TPS + 0.25 s = 4.6 s, absolute biomechanical floor at 42 STM × 12 TPS + 0.15 s = 3.65 s. The 12 TPS ceiling matches single-hand drum-roll records (Hattori 22 Hz / two-hand). Below that requires either two-handed-equivalent grip stability or a method that drastically cuts moves — neither has a credible path today.',
    reasoning_zh:
      'OH 受限于单手 TPS 生物力学。一只手只有 4 指参与手指动作 (vs 双手 8 指),且换握开销 — 没有第二只手稳定 cube — 累计加 0.3-0.5 秒停顿,双手解法没有这部分。Meruva 5.66 跑出 9.7 TPS / 56 STM / 0.2 秒识别;Wang 双手 16.6 TPS 表明差距是物理,不是技术。\n\n' +
      '方法上有个反直觉的细节。Roux-OH 步数明显更省 (45-50 STM vs CFOP-OH 55-60),因为它无旋转、纯 RrUM,但全球顶级没有切换 — 因为 CFOP 的识别速度 + 算法熟练度在单手计时下战胜了 Roux 的步数优势。是否长期成立未知:如果下一代从 8 岁就练 Roux-OH,格局可能翻转。\n\n' +
      '下界: 100 年渐近 = 48 STM × 11 TPS + 0.25 s = 4.6 秒;绝对生物力学下界 = 42 STM × 12 TPS + 0.15 s = 3.65 秒。12 TPS 上限对应单手击鼓世界纪录 (Hattori 双手 22 Hz / 2)。再低需要双手等效的握持稳定,或者方法砍步数 — 二者目前都没有可行路径。',
  },

  // ════════════════════════════════════════════════════════════
  //  333bf
  // ════════════════════════════════════════════════════════════
  '333bf': {
    current_method_en:
      'Full 3-Style commutators (corners + edges) is universal at the elite level. Charlie Eggins (Australia, WR single 11.67 + Mo3 14.05, Cubing at The Cube 2026-01-10, Sydney) holds both records. Tommy Cherry held the 12.x band before Eggins\'s January 2026 sub-12 breakthrough. M2/OP is teaching-only. Floating buffers + LTCT (Last-Target Corner Twist) + per-special algs cut setup moves. Note: Tymon Kolasiński does NOT hold a 3BLD record — he holds 4x4 single, 5x5 single, 5x5 mean.',
    current_method_zh:
      '顶级全跑 corner + edge 全 3-Style。Charlie Eggins (澳洲) 2026-01-10 在 Sydney "Cubing at The Cube" 同场拿下 WR 单次 11.67 + Mo3 14.05。Tommy Cherry 之前持有 12.x 段。M2/OP 仅教学。浮动 buffer + LTCT (Last-Target Corner Twist) + 特例算法削减 setup。注:Tymon Kolasiński 不持有 3BLD 记录,他持有的是 4x4 单 / 5x5 单 / 5x5 Ao5。',
    current_wr_avg_holder: 'Charlie Eggins — 14.05 Mo3 (Cubing at The Cube 2026-01-10)',
    t_phys_single: 6.5,
    t_phys_avg: 8,
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
      { scenario_en: '20–30 year horizon (sub-3s memo)', scenario_zh: '20–30 年 (memo sub-3s)', M: 55, TPS: 8.5, R: 3.0 },
      { scenario_en: '100-year asymptote (compressed memo + perfect 3-Style)', scenario_zh: '100 年渐近 (压缩 memo + 完美 3-Style)', M: 48, TPS: 9, R: 2.0 },
      { scenario_en: 'Absolute floor (1.5s memo + 10 TPS execution)', scenario_zh: '绝对下界 (1.5s memo + 10 TPS 执行)', M: 45, TPS: 10, R: 1.5 },
    ],
    reasoning_en:
      'Blindfold time decomposes into two distinct phases — memorisation and execution — and they have independent floors. Memo cannot be eliminated: 22 stickers (12 edges + 8 corners + 2 buffers) at compressed audio letter-pair speed of ~1.5 s/loop is a hard biological floor for short-term auditory encoding. Execution at full 3-Style with floating buffers and LTCT runs ~50 moves at 10 TPS, giving 5 s of pure execution. The sum is ~6.5 s for a lucky scramble where the letter pairs themselves are easy ones the solver has rehearsed.\n\n' +
      'Eggins\' 11.67 likely splits as 3-4 s memo + 7-8 s execution, well above the floor on both halves. The 100-year asymptote — sub-7 single — requires memo compression to roughly 2 s on lucky letter pairs, plus execution at 9 TPS through a particularly clean commutator chain. A new memo system entirely (spatial mind-palace replacing letter-pair audio loops) could halve memo time in a single jump, which is why this floor is more uncertain than 3x3 sighted: regime change is plausible.',
    reasoning_zh:
      'BLD 时间分两阶段 — 记忆与执行 — 各有独立下界。记忆不可消除:22 色块 (12 棱 + 8 角 + 2 buffer) 走压缩音频字母对,~1.5 秒/循环 是短期听觉编码的生物下界。执行用全 3-Style + 浮动 buffer + LTCT 跑 ~50 步 @ 10 TPS = 5 秒纯执行。幸运 scramble (字母对都是熟悉的) 综合 ~6.5 秒。\n\n' +
      'Eggins 11.67 大致是 3-4 秒 memo + 7-8 秒执行,两半都明显高于下界。100 年渐近 sub-7 秒需要 memo 在幸运字母对上压到 ~2 秒,加上 9 TPS 跑流畅 commutator 链。换记忆系统 (空间 mind-palace 取代字母对音频) 可一次性砍掉 memo 一半 — 这是 BLD 比 3x3 视拧更不确定的原因:范式变更可能。',
    why_fit_differs_en:
      'BLD curve fit cannot capture memo-system regime shifts. A switch from letter-pair audio to spatial mind-palace would drop memo time 30-50% in a single year, which the historical trajectory has no way to anticipate.',
    why_fit_differs_zh:
      'BLD 拟合无法捕捉记忆系统的范式切换。从字母对音频换到空间 mind-palace,memo 时间能一次性砍 30-50%,历史轨迹完全看不到这种突变。',
  },

  // ════════════════════════════════════════════════════════════
  //  333fm
  // ════════════════════════════════════════════════════════════
  '333fm': {
    current_method_en:
      'Modern FMC = blockbuilding + EO + Domino Reduction (DR, reduce to <U,D,R2,L2,F2,B2> subgroup, optimal DR-to-solved averages 13.58 moves) + insertions + NISS (Normal-Inverse Scramble Switch). WR single = 16 moves shared by 5 holders: Sebastiano Tronto (2019), Aedan Bryant + Levi Gibson (2024), Jacob Sherwen Brown (2024). Mean WR = 19.33 (Wong Chong Wen 2026, first sub-20 mean). Sebastiano Tronto authored the DR revolution.',
    current_method_zh:
      '现代 FMC = blockbuilding + EO + Domino Reduction (DR,把状态降到 <U,D,R2,L2,F2,B2> 子群,DR→solved optimal 平均 13.58 步) + 插入法 + NISS (正逆 scramble 互换搜)。WR 单次 = 16 步,5 人持有:Sebastiano Tronto (2019)、Aedan Bryant + Levi Gibson (2024)、Jacob Sherwen Brown (2024)。Mo3 WR = 19.33 (Wong Chong Wen 2026,首破 20)。Tronto 是 DR 革命主笔。',
    current_wr_avg_holder: 'Wong Chong Wen — FMCanton Nansha 2026-03-21 (first sub-20)',
    current_wr_avg_value: 19.33,
    t_phys_single: 17,
    t_phys_avg: 17.5,
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
      'FMC is the only WCA event with a mathematically proven lower bound. Rokicki, Kociemba, Davidson and Dethridge proved in 2010 that any 3x3 state can be solved in ≤ 20 HTM, and the random-scramble HTM-optimal distribution is heavily concentrated at 18 (67%) and 17 (27%) moves. Only 2.6% of scrambles need exactly 16 HTM, and below 16 is essentially measure-zero (≤ 14 moves: ~10⁻⁵).\n\n' +
      'A 16-move WR single is therefore not below the absolute lower bound — it sits inside it, on a scramble that happened to admit a 16-move optimal AND was found by a human in 60 minutes. Five cubers have now tied this mark: Tronto 2019, Bryant + Gibson 2024, Brown 2024. The achievable single floor under the current rules is ~16, with sub-16 requiring sub-2.6% scramble luck combined with finding optimal under hand search — possible but not on schedule.\n\n' +
      'Mean WR is now Wong Chong Wen 19.33 (FMCanton Nansha 2026, first sub-20). The Mo3 floor is bounded by needing three solves all near optimum; with most scrambles HTM-optimal at 18 moves and DR techniques routinely finding 17-19, sub-19 mean is on track in 5-10 years. Below 17.5 mean would require either every scramble admitting ≤17 hand-finds in an hour, or a search-time breakthrough — neither has visible mechanism.',
    reasoning_zh:
      'FMC 是 WCA 中唯一一个绝对下界数学证明过的项目。Rokicki / Kociemba / Davidson / Dethridge 2010 年证明任何 3x3 态可 ≤ 20 HTM 解出,随机 scramble HTM optimal 分布集中在 18 步 (67%) 和 17 步 (27%);只有 2.6% scramble 恰好需要 16 HTM,≤ 14 步基本是测度零 (~10⁻⁵)。\n\n' +
      '16 步单次 WR 因此不是低于绝对下界,而是落在下界尾部 — 一个恰好 admit 16 步 optimal 的 scramble + 人类在 60 分钟内找到。5 人持平这个数:Tronto 2019、Bryant + Gibson 2024、Brown 2024。当前规则下单次可达下界 ~16,sub-16 需要 sub-2.6% scramble 运气叠加手搜索找到 optimal — 可能但无确定时程。\n\n' +
      'Mo3 WR 现在是 Wong Chong Wen 19.33 (FMCanton Nansha 2026,首破 20)。Mo3 下界受"3 把都接近 optimal"约束;大多数 scramble HTM optimal 是 18 步,DR 技术常找到 17-19 步,sub-19 平均 5-10 年内在线。低于 17.5 平均需要每把 scramble 都 admit ≤17 步手搜或者搜索时间技术突破,目前没有可见机制。',
    why_fit_differs_en:
      'FMC is the only event where the curve fit is structurally inappropriate. The fit treats trajectory as continuous; FMC is integer-valued with a proven mathematical lower bound. Curve L is meaningless here — use the integer floor (16 single, ~17.5 mean) instead.',
    why_fit_differs_zh:
      'FMC 是唯一一个曲线拟合在结构上不合适的项目。拟合把轨迹当连续值,但 FMC 是整数取值且有已证明的数学下界。L 在这里没有意义,直接用整数下界 (16 单次, ~17.5 平均)。',
  },

  // ════════════════════════════════════════════════════════════
  //  444bf
  // ════════════════════════════════════════════════════════════
  '444bf': {
    current_method_en:
      'Full 3-Style across centers + wings + edges + corners + parity. Stanley Chapel (51.96 single 2023, 59.39 Mo3 2025 — first sub-1:00 mean ever) uses floating buffers across all four orbits.',
    current_method_zh:
      '中心 + 翼棱 + 棱 + 角 + parity 全 3-Style。Stanley Chapel (51.96 单 2023,59.39 Mo3 2025 — 史上首破 1 分钟 Mo3) 在四种 piece 都用浮动 buffer。',
    current_wr_avg_holder: 'Stanley Chapel — 59.39 Mo3 (NY Multimate PBQ II 2025, first sub-1:00)',
    t_phys_single: 30,
    t_phys_avg: 38,
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
      { scenario_en: '20–30 year horizon', scenario_zh: '20–30 年', M: 130, TPS: 5.5, R: 22 },
      { scenario_en: '100-year asymptote', scenario_zh: '100 年渐近', M: 120, TPS: 6, R: 18 },
      { scenario_en: 'Absolute floor (12s memo + 18s exec)', scenario_zh: '绝对下界 (memo 12s + exec 18s)', M: 110, TPS: 7, R: 12 },
    ],
    reasoning_en:
      'Four-by-four blindfold has the same two-phase structure as 3BLD but with five orbits instead of two. Centers, wings, edges, corners and parity each need to be tracked through letter pairs (~28 total) and executed through commutators (~140 STM at WR level). Memo dominates: 25-30 s for elite vs 25-30 s execution at 5 TPS through commutators. Chapel\'s 51.96 splits roughly memo 22 s + exec 30 s.\n\n' +
      'Memo and execution have different floor sources. Memo floors at ~12 s on a lucky scramble (28 letter pairs × 0.4 s minimum encoding); execution floors at ~18 s (140 STM at 7 TPS using the cleanest possible commutator routing, no setup waste). Combined 30 s is the absolute single floor, 38-42 s is the realistic Mo3 floor. Chapel\'s monopoly across 4BLD + 5BLD reflects how rare the dual skill — fast memo + dexterous execution — actually is.',
    reasoning_zh:
      '4BLD 与 3BLD 同样是两阶段结构,但 piece orbit 从 2 种扩到 5 种。中心、翼、棱、角、parity 各自要走字母对 (共 ~28) 跟 commutator 执行 (~140 STM 顶级)。记忆主导:顶级 25-30 秒 vs 5 TPS commutator 执行 25-30 秒。Chapel 51.96 大致是 memo 22 秒 + exec 30 秒。\n\n' +
      '记忆与执行下界来源不同。Memo 在幸运 scramble 上 ~12 秒 (28 字母对 × 0.4 秒最低编码);执行 ~18 秒 (140 STM @ 7 TPS,纯 commutator 无 setup)。综合 30 秒是单次绝对下界,38-42 秒是 Mo3 现实下界。Chapel 在 4BLD + 5BLD 双项目垄断,反映出"快 memo + 灵活执行"双技能稀有度。',
  },

  // ════════════════════════════════════════════════════════════
  //  555bf
  // ════════════════════════════════════════════════════════════
  '555bf': {
    current_method_en:
      'Full floating-buffer 3-Style across five orbits: corners, wings, midges, +centers, X-centers. Stanley Chapel monopolizes (1:58.59 single 2026 — first-ever sub-2:00; 2:27.63 Mo3 2019 — most enduring active BLD record). Midge memo is the recognition bottleneck.',
    current_method_zh:
      '五种 piece (角 / 翼 / midge / +中心 / X 中心) 全浮动 buffer 3-Style。Chapel 垄断 (1:58.59 单次 2026 — 史上首破 2 分钟;2:27.63 Mo3 2019 — 现役 BLD 最久未破)。midge 识别是瓶颈。',
    current_wr_avg_holder: 'Stanley Chapel — 2:27.63 Mo3 (Michigan Cubing Club Epsilon 2019)',
    t_phys_single: 80,
    t_phys_avg: 95,
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
      { scenario_en: '20–30 year horizon', scenario_zh: '20–30 年', M: 270, TPS: 5.5, R: 50 },
      { scenario_en: '100-year asymptote', scenario_zh: '100 年渐近', M: 250, TPS: 6, R: 40 },
      { scenario_en: 'Absolute floor (30s memo + 40s exec)', scenario_zh: '绝对下界 (memo 30s + exec 40s)', M: 220, TPS: 7, R: 30 },
    ],
    reasoning_en:
      'Five-by-five blindfold pushes the memo bottleneck past biological limits of comfortable short-term retention. 92 stickers across 5 orbits ≈ 46 letter pairs; even at 1.2 s/pair compressed audio, memo alone is 55 s — and the recall accuracy on the 40th-50th letter pair drops adversarially because earlier pairs interfere with later ones in working memory.\n\n' +
      'The Mo3 record stagnation since 2019 (Chapel 2:27.63, untouched for 7 years) is the single most informative data point in BLD analysis. It says the binding constraint is not execution speed (Chapel\'s singles have improved) but accuracy — three consecutive error-free 92-sticker memos exceeds the 5BLD-trained working memory ceiling. Sub-1:30 single is plausible by 2030 (memo 35 + exec 50); sub-2:00 mean requires either a memo-system replacement (mind-palace) or sustained cognitive training that improves working memory itself.',
    reasoning_zh:
      '5BLD 把 memo 瓶颈推过了短期工作记忆的生物舒适区。92 色块跨 5 种 orbit ≈ 46 字母对;即便压到 1.2 秒 / 对的音频速率,光 memo 就 55 秒 — 而且第 40-50 个字母对的回忆准确率会非线性下降,因为前段的字母对在工作记忆里会干扰后段。\n\n' +
      'Mo3 记录自 2019 至今未破 (Chapel 2:27.63,7 年),是 BLD 分析里信息量最大的单点。它说明 binding 约束不是执行速度 (Chapel 单次在改进) 而是准确率 — 连续 3 次无错的 92 色块记忆超出了 5BLD 训练能达到的工作记忆天花板。Sub-1:30 单次在 2030 年左右可达 (memo 35 + exec 50);sub-2:00 平均需要换 memo 系统 (mind-palace) 或持续认知训练抬高工作记忆本身。',
  },

  // ════════════════════════════════════════════════════════════
  //  pyram
  // ════════════════════════════════════════════════════════════
  'pyram': {
    current_method_en:
      'V-first (one V = 3 edges + 3 centers, then last 4 edges) + intuitive last layer is universal. Top cubers (Simon Kellum 0.73 single 2023, Lingkun Jiang 1.14 Ao5 2025, Dominik Górny, Akira Hattori) plan the entire ≤11-move solution during 15s inspection. Pyraminx is the only WCA event where "inspection-optimal" is human-achievable.',
    current_method_zh:
      'V-first (一个 V 块 = 3 棱 + 3 中心,再解后 4 棱) + 直觉 LL。顶级 (Kellum 0.73 单 2023, Jiang 1.14 Ao5 2025, Górny, Hattori) 在 15 秒 inspection 内全程规划 ≤11 步解。金字塔是唯一一个"inspection-optimal" 人类可达的 WCA 项目。',
    current_wr_avg_holder: 'Lingkun Jiang — 1.14 (Zhengzhou Zest 2025)',
    t_phys_single: 0.43,
    t_phys_avg: 0.85,
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
      { scenario_en: '20–30 year horizon', scenario_zh: '20–30 年', M: 8, TPS: 17, R: 0.13 },
      { scenario_en: '100-year asymptote', scenario_zh: '100 年渐近', M: 8, TPS: 19, R: 0.13 },
      { scenario_en: 'Absolute floor (lucky 6-move + 22 TPS finger-tap)', scenario_zh: '绝对下界 (幸运 6 步 + 22 TPS 手指敲击)', M: 6, TPS: 22, R: 0.10 },
    ],
    best_reconstructions: [
      { person: 'Simon Kellum', date: '2023', time: '0.73 s', M: 8, TPS: 14.5, method: 'V-first / inspection-optimal', source_url: 'https://www.speedsolving.com/wiki/index.php?title=List_of_World_Records/Pyraminx' },
    ],
    reasoning_en:
      'Pyraminx is the only WCA event where "inspection-optimal" is human-achievable. The state space is just 933,120 non-trivial positions and God\'s number is 11 HTM with average optimal 8.36 moves. Top cubers — Kellum, Górny, Hattori, Brads, Jiang — fully plan the entire ≤11-move solution during the 15-second inspection. Recognition during execution is therefore zero, and what remains is pure physical execution against the StackMat envelope.\n\n' +
      'The remaining headroom is bounded by two things: scramble luck (a 6-move optimal is rare, perhaps 1 in 200) and finger-tap biomechanics (20-22 Hz upper band on the lightweight Pyraminx). Combine: 6-move scramble × 22 TPS + 0.1 s reaction = 0.37 s absolute floor. The 100-year asymptote is closer to 0.55 s on an 8-move solve. Pyraminx is essentially "solved" from a method standpoint — further WR drops will come from luckier scrambles plus marginal hardware gains, not new techniques.',
    reasoning_zh:
      '金字塔是唯一一个 "inspection-optimal" 人类可达的 WCA 项目。状态空间仅 93 万 (非平凡态),God\'s number 11 HTM,平均 optimal 8.36 步。顶级 — Kellum、Górny、Hattori、Brads、Jiang — 在 15 秒 inspection 内规划完整 ≤11 步解。执行期识别归零,剩下的就是 StackMat 包络下的纯物理执行。\n\n' +
      '剩余空间由两件事框定:scramble 运气 (6 步 optimal 大约 1/200 概率) 和手指敲击生物力学 (轻量金字塔上 20-22 Hz 上限)。组合:6 步 scramble × 22 TPS + 0.1 秒反应 = 0.37 秒绝对下界。100 年渐近更接近 0.55 秒 (基于 8 步解)。金字塔从方法角度本质已"解决",再降 WR 靠更幸运的 scramble + 微小硬件收益,不靠新技术。',
  },

  // ════════════════════════════════════════════════════════════
  //  skewb
  // ════════════════════════════════════════════════════════════
  'skewb': {
    current_method_en:
      'Sarah\'s Advanced (134 L2L cases) was orthodox until ~2023. The new frontier is TCLL (Twisted Corner Last Layer, ~1080 cases / ~360 algs after pseudo handling). Vojtěch Grohmann used TCLL for the WR single 0.73 (Głuszyca Open 2026-01). Average WR 1.37 (Ignacy Samselski 2025) typically still uses Sarah\'s.',
    current_method_zh:
      'Sarah\'s Advanced (134 L2L cases) 是 ~2023 之前的正统。新前沿是 TCLL (Twisted Corner Last Layer,~1080 cases / 假态合并后 ~360 algs)。Vojtěch Grohmann 用 TCLL 创下 WR 单次 0.73 (Głuszyca Open 2026-01)。Ao5 WR 1.37 (Samselski 2025) 多用 Sarah\'s。',
    current_wr_avg_holder: 'Ignacy Samselski — 1.37 (Cube Factory League Justynów 2025)',
    t_phys_single: 0.55,
    t_phys_avg: 1.10,
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
      { scenario_en: '20–30 year horizon (TCLL widespread)', scenario_zh: '20–30 年 (TCLL 普及)', M: 9, TPS: 16, R: 0.13 },
      { scenario_en: '100-year asymptote', scenario_zh: '100 年渐近', M: 9, TPS: 18, R: 0.10 },
      { scenario_en: 'Absolute floor (TCLL skip + 20 TPS)', scenario_zh: '绝对下界 (TCLL skip + 20 TPS)', M: 7, TPS: 20, R: 0.10 },
    ],
    best_reconstructions: [
      { person: 'Vojtěch Grohmann', date: '2026-01', time: '0.73 s', M: 10, TPS: 14.2, method: 'TCLL', source_url: 'https://www.speedsolving.com/threads/0-73-skewb-wr-single-by-vojt%C4%9Bch-grohmann.96474/' },
    ],
    reasoning_en:
      'Skewb has 3.15M states with God\'s number 11 STM and average optimal 8.36 moves — slightly larger state space than Pyraminx but the same "fully plannable in inspection" property for first layer. The novel structural feature is TCLL (Twisted Corner Last Layer, ~1080 cases reduced to ~360 algs after pseudo-handling), which Grohmann used for the WR single 0.73 in January 2026 — the first method-driven WR drop in years.\n\n' +
      'Scramble luck dominates the variance. A TCLL skip case is 7 STM; a 5-fold case is 13 STM. That 6-move spread translates to 0.3-0.4 s of solve time, which is more than the entire remaining headroom. The 100-year asymptote at 9 STM × 18 TPS + 0.1 = 0.6 s is achievable on average lucky scrambles; the absolute floor at 7 STM × 20 TPS + 0.1 = 0.45 s requires the rare TCLL skip to coincide with peak biomechanics. Like Pyraminx, Skewb is approaching the regime where further drops come from luck, not technique.',
    reasoning_zh:
      '斜转状态空间 315 万,God\'s number 11 STM,平均 optimal 8.36 步 — 比金字塔略大但同样 "第一层 inspection 内可全规划" 的特性。结构上的新东西是 TCLL (Twisted Corner Last Layer,~1080 cases,假态合并后 ~360 algs),Grohmann 2026 年 1 月用它创下 0.73 WR — 多年来首个方法驱动的 WR 下降。\n\n' +
      'Scramble 运气主导方差。TCLL skip case 是 7 STM,5-fold case 是 13 STM,6 步差对应 0.3-0.4 秒,比剩余空间还大。100 年渐近 = 9 STM × 18 TPS + 0.1 = 0.6 秒,在普通幸运 scramble 上可达;绝对下界 = 7 STM × 20 TPS + 0.1 = 0.45 秒,需要 TCLL skip 与峰值生物力学同时发生。和金字塔一样,斜转正进入"再降只能靠运气,不靠技术"的阶段。',
  },

  // ════════════════════════════════════════════════════════════
  //  sq1
  // ════════════════════════════════════════════════════════════
  'sq1': {
    current_method_en:
      'Vandenbergh (Cubeshape → CO → CP → EO → EP) is universal foundation. Top cubers add CSP (Cubeshape Parity, Brandon Lin ~2015) to predict slice parity in inspection, then Lin Method + PLL+1 / 1LLL fragments. Hassan Khanani 3.40 single (Steel City Sprint 2026), Sameer Aggarwal 4.63 Ao5 (2025).',
    current_method_zh:
      'Vandenbergh (cubeshape → CO → CP → EO → EP) 普世基础。顶级叠加 CSP (Cubeshape Parity, Brandon Lin ~2015,inspection 预判 slice parity),进一步用 Lin + PLL+1 / 1LLL 局部。Hassan Khanani 3.40 单 (Steel City Sprint 2026),Aggarwal 4.63 Ao5 (2025)。',
    current_wr_avg_holder: 'Sameer Aggarwal — 4.63 (Cubing in Southern Oregon 2025)',
    t_phys_single: 1.80,
    t_phys_avg: 3.5,
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
      { scenario_en: '20–30 year horizon (full 1LLL adoption)', scenario_zh: '20–30 年 (全 1LLL 普及)', M: 18, TPS: 9, R: 0.5 },
      { scenario_en: '100-year asymptote (slice mechanics solved)', scenario_zh: '100 年渐近 (切片机构解决)', M: 16, TPS: 11, R: 0.4 },
      { scenario_en: 'Absolute floor (lucky CSP+PLL skip + ideal cube)', scenario_zh: '绝对下界 (幸运 CSP+PLL skip + 理想 cube)', M: 14, TPS: 12, R: 0.3 },
    ],
    reasoning_en:
      'Square-1 is unique in the WCA event family: it is slice-bound, not face-bound. Every move is /, U, or D — and the slash requires precise alignment of two halves before it can rotate. A misaligned slice costs 0.1-0.2 s to recover, which limits sustained TPS to ~10 even on the best magnetic SQ1 (X-Man Volt V2 UD). Compare to face-turn puzzles where 15-18 TPS is achievable; the 50% gap is mechanical, not biomechanical.\n\n' +
      'Method is still developing. Vandenbergh + CSP (Brandon Lin\'s 2015 cubeshape-parity prediction) brought averages from ~6 s to sub-5 s; the next jump is full 1LLL — the ~400-algorithm last-layer alg set that Khanani and Aggarwal use fragments of. Once 1LLL becomes universal, average move count drops from ~22 to ~18 STM, which combined with marginal slice-mechanism gains lands at ~2.5 s realistic single. The absolute floor at 14 STM × 12 TPS + 0.3 = 1.47 s requires both cubeshape skip and PLL skip on the same scramble — about 1 in 10⁴.',
    reasoning_zh:
      'Square-1 在 WCA 项目家族里独特:它是 slice-bound 而非 face-bound。每一步 /、U、D 都需要两半精准对齐才能旋转,错位要 0.1-0.2 秒回正,即便最好的磁铁 SQ1 (X-Man Volt V2 UD) 持续 TPS 也只到 ~10。对比面转拼图 15-18 TPS,50% 差距是机械而非生理。\n\n' +
      '方法上仍在演进。Vandenbergh + CSP (Brandon Lin 2015 提出的 cubeshape-parity 预判) 把平均从 ~6 秒压到 sub-5;下一档跳是全 1LLL — Khanani / Aggarwal 当前用其碎片的 ~400 算法 LL 库。1LLL 全面普及后平均步数从 ~22 降到 ~18 STM,叠加切片机构小幅改进,得到 ~2.5 秒现实下界。绝对下界 14 STM × 12 TPS + 0.3 = 1.47 秒需要 cubeshape skip + PLL skip 同时,大约 1/10⁴ 概率。',
  },

  // ════════════════════════════════════════════════════════════
  //  clock
  // ════════════════════════════════════════════════════════════
  'clock': {
    current_method_en:
      '7-SIMUL (bpaul, ~2023) — memorize back-side state in inspection, execute both sides essentially simultaneously. Lachlan Gibson 1.53 single (Sep 2025), Brendyn Dunagan 2.24 Ao5 (2025). The flip is one indivisible ~0.3s motion. Note: prior method "Lou" (Yunhao Lou 2.87 WR May 2021) was flip-efficient but sequential.',
    current_method_zh:
      '7-SIMUL (bpaul ~2023) — inspection 期间记忆背面,正背两面几乎同时执行。Gibson 1.53 单 (2025-09), Dunagan 2.24 Ao5 (2025)。翻面动作不可分,~0.3 秒。前代方法 Lou (Yunhao Lou 2.87 WR 2021-05) 减翻面但仍顺序执行。',
    current_wr_avg_holder: 'Brendyn Dunagan — 2.24 (Temecula Valley Winter 2025)',
    t_phys_single: 1.30,
    t_phys_avg: 1.85,
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
      { scenario_en: '20–30 year horizon (7-SIMUL refined)', scenario_zh: '20–30 年 (7-SIMUL 精修)', M: 13, TPS: 7.5, R: 0.35 },
      { scenario_en: '100-year asymptote (faster flip mechanism)', scenario_zh: '100 年渐近 (更快翻面机构)', M: 12, TPS: 8.5, R: 0.25 },
      { scenario_en: 'Absolute floor (flip-eliminated method)', scenario_zh: '绝对下界 (消除翻面方法)', M: 11, TPS: 9, R: 0.2 },
    ],
    reasoning_en:
      'Clock is the most hardware-bottlenecked WCA event in a literal sense: a ~0.3-second flip motion is required by the puzzle\'s mechanism, and it eats 15-20% of WR time as a single indivisible action. The 7-SIMUL method (bpaul, ~2023) replaces sequential pin-flips with simultaneous-side execution by memorising the back-side state during the 15-second inspection — which is why Gibson 1.53 (Sep 2025) and Dunagan 2.24 Ao5 (2025) collapsed the trajectory.\n\n' +
      'Recognition is essentially gone — the clock state is fully visible and 7-SIMUL converts execution-time recognition into inspection-time memorisation. What remains is atomic movement count (~14 movements for 7-SIMUL) and finger frequency on the dials (~7-8 movements/s practical). The 100-year asymptote at 12 movements × 8.5 + 0.25 = 1.66 s is achievable with hardware refinement; the absolute floor at 11 × 9 + 0.2 = 1.42 s requires a method that eliminates the flip entirely (some 7-SIMUL variants do, but reliability has not been proven). Below 1.4 s would require a fundamentally new clock mechanism — which the current QiYi Magnetic + 208-magnet design has not motivated.',
    reasoning_zh:
      '魔表在字面意义上是 WCA 中机械瓶颈最严重的项目:~0.3 秒翻面是拼图机构强制要求的不可分动作,占 WR 时间 15-20%。7-SIMUL 方法 (bpaul, ~2023) 把顺序拨钉换成"双面同时执行" — inspection 期间记忆背面状态,这就是 Gibson 1.53 (2025-09) 和 Dunagan 2.24 Ao5 (2025) 把曲线砸下来的原因。\n\n' +
      '识别基本消失 — 魔表状态完全可见,7-SIMUL 把执行期识别换成 inspection 期记忆。剩下的是原子动作数 (~14 次,7-SIMUL) 和拨钉手指频率 (~7-8 次/秒可达)。100 年渐近 = 12 × 8.5 + 0.25 = 1.66 秒可达,需要硬件精修;绝对下界 = 11 × 9 + 0.2 = 1.42 秒需要消除翻面的新方法 (有些 7-SIMUL 变种已尝试,但稳定性未验证)。低于 1.4 秒需要根本性的新魔表机构 — 当前 QiYi 磁铁 + 208 磁铁设计并未给出这种动力。',
  },

  // ════════════════════════════════════════════════════════════
  //  minx
  // ════════════════════════════════════════════════════════════
  'minx': {
    current_method_en:
      'Westlund (Star + F2L + S2L + Last2Layers) remains universal at the top — Zemdegs, Huanqui, Ziyu Wu, Tarasenko all use it. Modern variants (Yu Da-Hyung S2L, Bálint S2L) differ in last-pair insertion. Timofei Tarasenko 21.99 single + 24.38 Ao5 (Tashkent Open 2025-12) used Westlund + heavy LL alg base.',
    current_method_zh:
      'Westlund (Star + F2L + S2L + Last2Layers) 仍是顶级普世标准 — Zemdegs / Huanqui / 吴子语 / Tarasenko 都用。现代变种 (Yu Da-Hyung S2L、Bálint S2L) 差别在最后一对的插入。Tarasenko 21.99 单 + 24.38 Ao5 (Tashkent Open 2025-12) 用 Westlund + 厚 LL 算法库。',
    current_wr_avg_holder: 'Timofei Tarasenko — 24.38 (Tashkent Open 2025-12-06)',
    t_phys_single: 9.0,
    t_phys_avg: 18,
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
      { scenario_en: '20–30 year horizon (improved S2L lookahead)', scenario_zh: '20–30 年 (S2L lookahead 改进)', M: 125, TPS: 8, R: 0.9 },
      { scenario_en: '100-year asymptote (lucky route + 10 TPS)', scenario_zh: '100 年渐近 (高效路径 + 10 TPS)', M: 110, TPS: 10, R: 0.7 },
      { scenario_en: 'Absolute floor (efficient solver + 12 TPS biomech)', scenario_zh: '绝对下界 (高效路径 + 12 TPS 生物力学)', M: 95, TPS: 12, R: 0.5 },
    ],
    best_reconstructions: [
      { person: 'Timofei Tarasenko', date: '2025-12-06', time: '21.99 s', M: 130, TPS: 6.8, method: 'Westlund', source_url: 'https://speedcubing.org/blogs/news/timofei-tarasenko-breaks-megaminx-world-record-single' },
    ],
    reasoning_en:
      'Megaminx has 12 faces but only 6 are addressable in finger-trick rotation (R, U, F, BL, BR, L on each side). The remaining 6 faces require cube rotation, which costs time. Inspection covers Star + 1-2 stars (about 6-8 moves); the rest of the S2L (Second-2-Layers) is pure look-ahead similar in flavour to 3x3 cross+F2L but stretched across 12 faces with 50 cubies. Tarasenko\'s 21.99 / 24.38 leap (Tashkent Open 2025-12) used Westlund + heavy LL alg base.\n\n' +
      'Move count anchors the analysis. Westlund typical solve is ~110-160 STM (lower than the often-cited 200, which counts redundant rotations); Tarasenko\'s 21.99 ÷ 130 STM = 6.8 TPS counting only finger-trick moves. The 100-year asymptote at 110 STM × 10 TPS + 0.7 = 11.7 s requires push-through on S2L lookahead training and a generation of hardware that lets 12 TPS sustain on Megaminx faces (currently 12 TPS is achievable in burst, not sustained). The absolute floor at 95 STM × 12 TPS + 0.5 = 8.4 s is what the puzzle structure permits — getting there requires a solver who fully trains on Yu Da-Hyung S2L variants from a young age.',
    reasoning_zh:
      '五魔方有 12 面但只有 6 个可手指动作 (R, U, F, BL, BR, L);其余 6 面需要 cube rotation,要花时间。Inspection 覆盖 Star + 1-2 星 (约 6-8 步);剩余 S2L 是类似 3x3 cross+F2L 的纯 look-ahead,但拉到 12 面 50 块的尺度。Tarasenko 21.99 / 24.38 (Tashkent Open 2025-12) 用 Westlund + 厚 LL 算法库。\n\n' +
      '步数是分析锚点。Westlund 典型解 ~110-160 STM (低于常引用的 200,后者把多余 rotation 计入);Tarasenko 21.99 ÷ 130 STM = 6.8 TPS (只计手指动作)。100 年渐近 = 110 STM × 10 TPS + 0.7 = 11.7 秒,需要 S2L lookahead 训练突破 + 一代支持 Megaminx 面持续 12 TPS 的硬件 (目前 12 TPS 可突发不可持续)。绝对下界 = 95 STM × 12 TPS + 0.5 = 8.4 秒,这是拼图结构允许的极限,需要从小专攻 Yu Da-Hyung S2L 变种的 solver 才能达到。',
  },

};
