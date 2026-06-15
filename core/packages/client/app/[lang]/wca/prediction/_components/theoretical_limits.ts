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

export interface ExtendedSection {
  title_en: string;
  title_zh: string;
  body_en: string;     // markdown-ish: paragraphs separated by \n\n; **bold** rendered inline
  body_zh: string;
}

export interface TheoreticalLimit {
  current_method_en: string;
  current_method_zh: string;
  method_eras: MethodEra[];
  hardware_eras: HardwareEra[];
  decomp: DecompRow[];
  /** 可选深度补充章节 (里程碑 / 顶级选手 / 训练阶梯 / 项目特性 / 预测) */
  extended_sections?: ExtendedSection[];
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
      'The 2026 frontier is the full ZB method = ZBLS (Zborowski-Bruchem Last Slot, ~302 cases — orient edges during the last F2L pair so the cube enters last-layer with cross + corners + EO already done) + ZBLL (493 cases — 1-alg LL given EO). Combined effect: a ZB solve is "F2L → 1 alg → done", saving ~5 STM and ~0.4 s of recognition vs CFOP\'s 2-step OLL+PLL. Xuanyi Geng (耿暄一) holds the current WR average 3.71 (Deqing Small & Special 2026-04-26, includes a 2.80 single — AsR / WR2) using full ZB throughout — beating his own prior 3.84 (Beijing Winter 2026-01-11). Teodor Zajder holds the current WR single 2.76 (GLS Big Cubes Gdańsk 2026-02-07, ZBLL on XXX-cross). Yiheng Wang previously held the WR single at 3.08 (XMUM Cube Open 2025-02-15) using vanilla CFOP + 2-look OLL — a non-maxed-out method, which remains the strongest argument that CFOP-only still has room. Below ZB, full 1LLL (~3,668 cases, Eduardo Silva Damasceno first learned 2022) is the next step but requires recognition speed gains we have not yet seen. Roux caps at sub-4 single / sub-6 average (Alexey Tsvetkov 3.95 single, SPV / Tsvetkov / Cuares / Arradaza all sub-6 Ao5).',
    current_method_zh:
      '2026 年顶级前沿是**全 ZB 方法 = ZBLS (Zborowski-Bruchem Last Slot, ~302 cases — 在 F2L 最后一对就把 EO 控制好,使最后一层进入"cross + 角 + EO 全就绪"的状态) + ZBLL (493 cases — 给定 EO 后 1 算法解 LL)**。综合效果:ZB 解法 = "F2L → 一个算法 → 完成",比 CFOP 的两步 OLL+PLL 省 ~5 STM 和 ~0.4 秒识别。**耿暄一 (Xuanyi Geng) 当前持有 WR 平均 3.71 秒 (Deqing Small & Special 2026-04-26,五把里含 2.80 秒 AsR / WR2 单次),全程 ZB,改写自己 1 月 11 日北京冬季的 3.84**。Teodor Zajder 持有 WR 单次 2.76 秒 (GLS Big Cubes Gdańsk 2026-02-07,XXX-cross + ZBLL)。王艺衡之前的 WR 单次 3.08 (XMUM Cube Open 2025-02-15) 用的还是 CFOP 朴素 + 2-look OLL,这仍能说明 CFOP 本身仍有空间。ZB 之下还有全 1LLL (~3668 cases,Eduardo Silva Damasceno 2022 首学完),但需要识别速度跟上。Roux 上限是 sub-4 单次 / sub-6 平均 (Tsvetkov 3.95 单次是 Roux 历史首破 4 秒)。',
    current_wr_avg_holder: 'Xuanyi Geng (耿暄一) — Deqing Small & Special 2026-04-26',
    current_wr_avg_value: 3.71,
    current_wr_single_holder: 'Teodor Zajder — GLS Big Cubes Gdańsk 2026-02-07',
    current_wr_single_value: 2.76,
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
      { scenario_en: 'Yiheng Wang 3.08 (2025, former WR single — highest WR-grade TPS)', scenario_zh: 'Yiheng Wang 3.08 (2025, 前 WR 单次 — WR 级最高 TPS)', M: 45, TPS: 14.61, R: 0.0 },
      { scenario_en: 'Teodor Zajder 2.76 (2026, current WR single — ZBLL on XXX-cross)', scenario_zh: 'Teodor Zajder 2.76 (2026, 现 WR 单次 — XXX-cross + ZBLL)', M: 29, TPS: 10.50, R: 0.0 },
      { scenario_en: '20–30 year horizon (Wang TPS × Geng STM)', scenario_zh: '20–30 年内可达 (Wang TPS × Geng STM)', M: 28, TPS: 16, R: 0.1 },
      { scenario_en: '100-year asymptote (max method-found STM × biomech ceiling)', scenario_zh: '100 年渐近 (方法可达最少步 × 生物力学顶端)', M: 24, TPS: 17, R: 0.05 },
      { scenario_en: 'Absolute floor (God\'s number STM × dual-hand drum-roll bandwidth)', scenario_zh: '绝对下界 (God\'s number STM × 双手击鼓带宽)', M: 18, TPS: 22, R: 0.05 },
    ],
    t_phys_single: 1.46,
    best_reconstructions: [
      { person: 'Yusheng Du (杜宇生)', date: '2018-11-24', time: '3.47 s', M: 27, TPS: 7.78, method: 'CFOP, XX-cross + 1-look LL (lucky CP-OLL)', source_url: 'https://www.facebook.com/moyumagiccube/photos/reconstruction-of-yusheng-dus-347-33-wrscramble-f-u2-l2-b2-f-u-l2-u-r2-d2-l-b-l2/1922639067817044/' },
      { person: 'Max Park', date: '2023-06-11', time: '3.13 s', M: 33, TPS: 10.54, method: 'CFOP, double X-cross + PLL skip', source_url: 'https://ruwix.com/blog/max-park-rubik-single-record-313/' },
      { person: 'Yiheng Wang (王艺衡)', date: '2025-02-15', time: '3.08 s', M: 45, TPS: 14.61, method: 'CFOP, 2-look LL (OLL skip) — XMUM Cube Open, former WR single', source_url: 'https://speedcubing.org/blogs/news/yiheng-wang-breaks-world-record-3x3-single-with-3-08' },
      { person: 'Teodor Zajder', date: '2026-02-07', time: '2.76 s', M: 29, TPS: 10.50, method: 'CFOP, XXX-cross + ZBLL — GLS Big Cubes Gdańsk, current WR single', source_url: 'https://ruwix.com/blog/first-sub-3-rubiks-cube-record-teodor-zajder-2_76/' },
      { person: 'Xuanyi Geng (耿暄一) WR avg 3.71', date: '2026-04-26', time: '3.71 avg', M: 49, TPS: 12.93, method: 'ZB (ZBLS + ZBLL) — Deqing Small & Special, includes 2.80 AsR single', source_url: 'https://www.speedsolving.com/threads/xuanyi-geng-3x3-3-71-average-and-2-80-asr-single.96768/' },
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
      '三阶单次的下界要分三层看, 不是一条线。\n\n' +
      '数学硬墙在 0.78 秒附近。Rokicki 等 2010 年穷举证明: 任意打乱的全局最优 ≤ 20 HTM, 67% 的随机打乱 optimal = 18 HTM。换算到 STM (本页统一用的度量, slice 计 1 步), 最优单次步数大约 16-18 步。除以生物力学带宽 — 单击鼓世界纪录单手 11 Hz、双手交替能撑 22 Hz, 两手 4 指握魔方本质上是同一带宽 — 加 0.05 秒 StackMat 反应, 得到约 0.78 秒。这要求「最优秀的人 + 1/10⁵ 量级幸运打乱 + 完美执行 + 计时设备零误差」四件事同时成立。数学上没有违反任何物理定律, 但 100 年内出现概率近零。\n\n' +
      '现实渐近在 1.5 秒附近。人不会在 15 秒里推算最优解, 只能靠方法 (CFOP / ZB / Roux) 走一条次优但可执行的路径。已观测最少步数: Xu 非正式 2.68 用 26 步, Du 3.47 用 27 步, Zajder 2.76 用 29 步。把方法天花板再压一档到 24 步 (更幸运的 1-look ZBLL, 两个 F2L 对自由), 叠加王艺衡已经在 57 步非正式 3.43 秒解上验证过的 16.6 TPS 持续, 加 0.05 秒残余识别, 得到约 1.46 秒。这是 100 年外推的合理终点。\n\n' +
      '20-30 年内可达落在 1.85 秒。两位现役选手各自验证了等式的一半 — Wang 验证 TPS, Geng 验证 STM。把两人合到一块儿: 用 Geng 的 28 步 ZB 框架配 Wang 的 16 TPS, 加 0.1 秒残余识别, 得 28/16 + 0.1 = 1.85 秒。两个输入都已被独立观测, 这是「已知工具组合后的最优」, 不是推测。\n\n' +
      'Zajder 2.76 在这个坐标系里的位置: 29 步比 100 年 STM 下界高 2 步; 10.5 TPS 比 Wang 验证的 16.6 TPS 低 6 TPS。剩余空间几乎全在 TPS 这边, 与「TPS 连续演化, 方法阶跃式演化」的整体格局一致。两条路径上限不同: Wang 的 TPS 路接近生物力学硬墙, Geng 的 ZB 步数路下面还有全 1LLL (~3,668 cases, Damasceno 2022 首学完) 一档。\n\n' +
      'Ao5 严格高于单次。同一选手同一打乱的执行噪声 SD ≈ 0.3 秒, 平均下不会消失 — 5 把开平方, SD 收到 0.13 秒, 但中间三把还得各自落在幸运尾巴上。Ao5 合理下界 ~3.0 秒, Geng 现 3.71 占 81%。\n\n' +
      '极值理论的反算 (Gumbel 尾): WR ≈ μ − √(2 ln N)·σ。现役精英官方解累计 N ≈ 4×10⁶, z ≈ 5.6; 100 年后 N ≈ 4×10⁸, z ≈ 6.5, σ ≈ 0.8 秒, μ ≈ 5 秒。100 年外推 WR ≈ 5 − 6.5×0.8 = ~0.2 秒下穿 — 但 Gumbel 尾在 N 这么大时已经被压扁, 下一个约束就变成生物力学硬墙, 与第一层 0.78 秒吻合。',
    why_fit_differs_en:
      'The curve fit lands at 2.70 s because it only sees the historical CFOP+OLL+PLL trajectory. It cannot see method discontinuities like the full-ZBLL transition (Geng vs Wang in 2026 was a step change, not a smooth trend), or hardware regime shifts like the 2017 magnet revolution and 2021 MagLev — each cut average solve time 10-15% in a single jump. Most importantly, WR singles are extreme-value statistics: the lower bound depends on sampling depth N, not on the visible asymptote of past records. The fit answers "where will the trend go under current methods" — not "what is the physical limit". They line up here only by accident.',
    why_fit_differs_zh:
      '曲线拟合给出 2.70 秒, 是因为它只见过 CFOP+OLL+PLL 的轨迹。它看不到方法断点 (2026 年 Geng 用全 ZB 改写 Wang 的平均 WR 是阶跃, 不是平滑趋势), 也看不到硬件的代际跳变 (2017 磁铁革命、2021 MagLev 各砍掉平均时间 10-15% 一次性)。更关键的是, WR 单次本质是极值统计 — 下界由采样深度 N 决定, 不是历史记录渐近线。拟合回答的是「现行方法下趋势会去哪」, 不是「物理极限是什么」。二者在这里碰巧接近, 仅此而已。',
  },

  // ════════════════════════════════════════════════════════════
  //  222
  // ════════════════════════════════════════════════════════════
  '222': {
    current_method_en:
      'Full EG = CLL + EG-1 + EG-2 (126 algs total). Top cubers (Ziyu Ye 0.39 single Hefei 2025; Sujan Feist 0.86 Ao5; Zayn Khanani; Yiheng Wang) use full EG. Many WR singles are 4-5 STM lucky 1-look skips. Note: Yiheng\'s 0.78 average (2024) was revoked after frame-counting found timer sliding — WCA introduced framecount verification in response.',
    current_method_zh:
      '全 EG = CLL + EG-1 + EG-2 (126 算法)。顶级 (叶子瑜 0.39 单次 合肥 2025; Sujan Feist 0.86 Ao5; Zayn Khanani; 王艺衡) 全用全 EG。多数 WR 单次是 4-5 步幸运 1-look skip。注: 王艺衡 2024 的 0.78 平均被判无效, 帧分析显示存在「滑计时器」动作, WCA 随后引入帧计数复核。',
    current_wr_avg_holder: 'Sujan Feist — 0.86 (Kids America Christmas Clash OH 2025-12-13)',
    current_wr_avg_value: 0.86,
    current_wr_single_holder: 'Ziyu Ye (叶子瑜) — 0.39 (Hefei Open 2025-10-25)',
    current_wr_single_value: 0.39,
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
      '二阶状态空间仅 367 万, 最优解 ≤ 11 HTM, 15 秒观察足以全程规划完。识别因此归零, 剩下的就是速拧里最简单的物理等式: 反应时间 + 几次手指敲击。叶子瑜 0.39 用的是 4 步 EG-1 skip, 大概 1/30 的打乱出现一次 — 本质上就是这个问题的几何形态。\n\n' +
      '剩余空间在 StackMat 触发包络里。松手到启动的反应底 ≈ 0.05 秒; 50 mm 小立方上的单指突发峰 18-22 Hz, 持续 4 步实际跑出 12-14 TPS。组合: 4/14 + 0.05 = 0.34 秒是 100 年渐近, 4/18 + 0.05 = 0.27 秒是绝对下界。低于 0.25 秒就开始撞 StackMat 自身的测量噪声 — 这也是 2024 年王艺衡「滑计时器」事件后 WCA 引入帧计数复核的根因。',
    why_fit_differs_en:
      '2x2 is the rare case where the curve fit L is roughly correct, because the event is already at its physical floor and the trajectory is tracking scramble-luck distribution rather than method or hardware gains. The agreement is coincidence, not insight.',
    why_fit_differs_zh:
      '二阶是少数拟合 L 大致对的项目 — 因为它早已逼近物理下界, 轨迹反映的是「幸运打乱」分布, 不是方法 / 硬件演进。这里曲线碰巧接近真实下界, 仅此而已。',
    extended_sections: [
      {
        title_en: `Why 2x2 Is the Most "Solved" WCA Event`,
        title_zh: `为什么 2x2 是 WCA 里最「已解决」的项目`,
        body_en: `Two-by-two has 3,674,160 reachable states and a God's number of 11 HTM (Tomas Rokicki proved this in 2006 — the cube was the first one fully optimal-solved). The average optimal HTM is 4.0, and the entire state graph fits in roughly 4 MB. That makes 2x2 the **only WCA event with a full optimal lookup feasible on a phone**.\n\nThe consequence is that the speedcubing question on 2x2 is no longer **which method**, it is **which scramble luck**. EG-2 (the full 126-algorithm set covering CLL + EG-1 + EG-2) covers every reachable last-layer case in one algorithm; cubeshape skips and 4-move skips dominate the WR tail. Below 0.5 s, scramble distribution shape — not technique — controls the next 0.1 s.`,
        body_zh: `二阶有 3,674,160 个可达态, God's number = 11 HTM (Rokicki 2006 完整证明 — 二阶是第一个被完整最优求解的 WCA 项目)。平均最优 HTM = 4.0, 整张状态图压成 ~4 MB, **手机上就能塞下一个完整的最优解器**。WCA 里唯一一个能这样「穷举式求解」的项目。\n\n后果就是 2x2 的核心问题不再是「用什么方法」, 而是「抽到什么打乱」。EG-2 (全 126 算法, CLL + EG-1 + EG-2) 把每个最后一层情况都收敛到 1 个算法; cubeshape skip + 4 步 skip 占据 WR 尾部。低于 0.5 秒之后, 主导下一个 0.1 秒的是打乱分布, 不是技术。`,
      },
      {
        title_en: `The 2024 Frame-Count Incident and Regulation 11f1`,
        title_zh: `2024 帧分析事件与 11f1 新规`,
        body_en: `Yiheng Wang briefly held a 0.78 s 2x2 average in June 2024 at Johor Bahru, Malaysia, but the result was annulled after frame-by-frame review of the timer revealed a **timer-sliding pattern** (the hand depresses the StackMat pad with enough horizontal motion that the trigger fires before the cube settles). WCA Regulation 11f1, in force from 2025-01-01, requires frame-count review for any WR-class 2x2 result below ~1.0 s. Several 2024-2025 results were retroactively voided.\n\nThe regulation has a long-term effect: it puts a soft floor on 2x2 WRs at approximately the optical-tracking confidence threshold of consumer cameras (~30 fps = 33 ms per frame). Ye Ziyu's 0.39 s WR has been frame-verified and stands; future sub-0.4 averages will need verifiable triggering on every solve.`,
        body_zh: `王艺衡 2024 年 6 月在马来西亚柔佛巴鲁一度持有 0.78 秒 2x2 平均, 但帧分析复盘揭示**滑计时器**模式 — 手压 StackMat 时带横向位移, 触发在魔方真正放稳之前先发生 — 成绩取消。WCA Regulation 11f1 自 2025-01-01 起, 对任何 WR 级 2x2 < ~1.0 秒结果强制帧分析复核。多个 2024-2025 成绩被回溯撤销。\n\n规则的长期效应是给 2x2 WR 设了一个「软底」: 大致是消费级摄像机的光学跟踪置信阈值 (~30 fps = 33 ms/帧)。叶子瑜 0.39 秒 WR 已帧验证, 将来 sub-0.4 平均都需要每把可验证触发。`,
      },
      {
        title_en: `2x2 Training Ladder: Sub-3 → Sub-2 → Sub-1 → WR`,
        title_zh: `二阶训练阶梯: sub-3 → sub-2 → sub-1 → WR`,
        body_en: `**Sub-3 average**: learn Ortega (EG-0, 12 algs), get a magnetic 2x2 (YJ MGC suffices), drill cubeshape recognition. The wall here is recognising the 5 OLL cases × 5 PLL cases in <0.5 s.\n\n**Sub-2 average**: learn full CLL (42 algs). The shift here is **plan first layer in inspection** — every WR-class 2x2 has the first layer fully planned, often executed in 0.2 s before recognition of the LL begins.\n\n**Sub-1 average**: add EG-1 + EG-2 (84 more algs). The work is no longer learning algs, it is **fingertrick optimisation** — the difference between 0.4 s and 0.7 s on a 5-move LL is RU regrip overhead, not move count.\n\n**WR territory (sub-0.6 single, sub-0.9 average)**: scramble luck dominates. Top cubers train for ~6 hours/day and accumulate 50-100 attempts per session; the WR-class scramble appears in ~0.1% of attempts.`,
        body_zh: `**Sub-3 平均**: 学 Ortega (EG-0, 12 算法), 买个磁铁二阶 (YJ MGC 即可), 练 cubeshape 识别。墙在 5 OLL × 5 PLL 识别压到 < 0.5 秒。\n\n**Sub-2 平均**: 学全 CLL (42 算法)。核心变化是 **观察期全规划第一层** — 任何 WR 级二阶, 第一层都在观察期内规划完, 常常 0.2 秒就敲完, LL 识别才开始。\n\n**Sub-1 平均**: 加 EG-1 + EG-2 (再 84 算法)。工作不再是背算法, 而是**手指动作优化** — 5 步 LL 上 0.4 秒和 0.7 秒的差, 来自 RU 换握开销, 不是步数。\n\n**WR 区域 (sub-0.6 单 / sub-0.9 平均)**: 打乱运气主导。顶级选手每天练 ~6 小时, 单次训练 50-100 次尝试, WR 级打乱出现率 ~0.1%。`,
      },
    ],
  },

  // ════════════════════════════════════════════════════════════
  //  444
  // ════════════════════════════════════════════════════════════
  '444': {
    current_method_en:
      'Yau (Robert Yau, 2009) is universal at WR level: cross dedges first, then centers + last cross dedge, then 3-2-3 chain edge pairing, then 3x3 stage. Tymon Kolasiński (current WR 15.18 single, Spanish Championship 2025-12-06 + 18.56 Ao5, Seoul Winter 2026-01-17) and Max Park (prior Ao5 WR holder — including the first-ever sub-19 Ao5 18.74 at Mission Viejo Fall 2025-10-12) both use Yau. Reduction is the intermediate fallback. Parity (50% OLL + 50% PLL independently): OLL parity ~15 STM alg, PLL parity ~12 STM alg.',
    current_method_zh:
      'Yau (Robert Yau, 2009 提出) 是 WR 级通用标准: 先 cross 边棱 → 中心 + 最后 cross 边棱 → 3-2-3 链棱配对 → 三阶收尾。Tymon (现 WR 15.18 单, Spanish Championship 2025-12-06 + 18.56 Ao5, Seoul Winter 2026-01-17) 和 Max Park (前 Ao5 WR 持有 — 含史上首破 19 秒的 18.74 Ao5, Mission Viejo Fall 2025-10-12) 都用 Yau。Reduction 是中级备选。Parity (50% OLL + 50% PLL 独立): OLL parity ~15 步算法, PLL parity ~12 步。',
    current_wr_avg_holder: 'Tymon Kolasiński — 18.56 Ao5 (Seoul Winter 2026-01-17)',
    current_wr_avg_value: 18.56,
    current_wr_single_holder: 'Tymon Kolasiński — 15.18 (Spanish Championship 2025-12-06)',
    current_wr_single_value: 15.18,
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
      { person: 'Tymon Kolasiński', date: '2025-12-06', time: '15.18 s', M: 140, TPS: 9.2, method: 'Yau + freeslice — Spanish Championship 2025', source_url: 'https://speedcubing.org/blogs/news/tymon-kolasinski-breaks-4x4-world-record-single' },
    ],
    reasoning_en:
      'Four-by-four\'s binding constraint is wide-turn inertia. Rw, Uw and 3Rw moves involve 8-12 cubies each — physically heavier than a 3x3 face turn — and elite TPS drops about 15% accordingly. Tymon\'s 15.18 averages 9.2 TPS over an estimated 140 STM, well below 3x3 sustained TPS even though the cubes are fully magnetic. The other binding constraint is parity: OLL parity (~15 STM, 50% probability, independent of PLL parity ~12 STM) adds 1.5-3 s in expected value alone.\n\n' +
      'There are no public WR-grade move-count reconstructions for 4x4 — estimates are derived from method-design (Yau cross dedges + centers + edge pairing + 3x3 + parity) and the 7x7 reconstruction thread. The achievable phases are visible: a 16-second elite solve breaks roughly as F2C 1.5 s, three cross dedges 1.8 s, last four centers + cross dedge 3.0 s, edge pairing 4.0 s, 3x3 stage 5.7 s. Compress each phase 20% via better tracking + slight TPS gain — that\'s 12-13 s with both parities, ~10 s on a no-parity scramble. The absolute floor falls when wide-turn hardware breaks past current MoYu AoSu V7 / GAN 460M friction, plausibly at 90 STM on luckier routing.',
    reasoning_zh:
      '四阶的主要约束是宽转惯性。Rw / Uw / 3Rw 每步动 8-12 个块, 物理上比 3x3 面转重, 顶级 TPS 因此低约 15%。Tymon 15.18 跑出 9.2 TPS 持续 (140 STM 估计), 即便魔方全磁也比 3x3 慢一档。第二个约束是 parity: OLL parity (~15 STM, 50% 概率, 与 PLL parity ~12 STM 独立), 期望值就吃掉 1.5-3 秒。\n\n' +
      '4x4 没有公开 WR 级复盘资料库, 步数靠方法设计 (Yau: cross 边棱 + 中心 + 棱配对 + 三阶 + parity) 和 7x7 复盘帖反推。16 秒级顶级解的阶段拆分大致是: F2C 1.5 秒、3 个 cross 边棱 1.8 秒、后 4 中心 + 最后 cross 边棱 3.0 秒、棱配对 4.0 秒、三阶收尾 5.7 秒。每阶段靠更好的跟踪 + 微涨 TPS 压 20%, 得到 12-13 秒含双 parity, 约 10 秒在无 parity 打乱。绝对下界要等宽转硬件突破现有 MoYu AoSu V7 / GAN 460M 的摩擦上限, 加上更幸运的路径规划把步数降到 90 STM。',
    extended_sections: [
      {
        title_en: `WR Single Lineage: Akkersdijk → Weyer → Zemdegs → Park → Tymon`,
        title_zh: `WR 单次谱系: Akkersdijk → Weyer → Zemdegs → Park → Tymon`,
        body_en: `The 4x4 single record has cycled between a handful of solvers over two decades. **Erik Akkersdijk** held it in 2007 with 47.36 s on a Rubik's brand cube (no magnets, no MoYu). **Sebastian Weyer** brought it under 23 s in 2017. **Sebastian Weyer**'s 18.84 s at German Open 2018 was the first sub-19; **Max Park** then took it to 18.42 at SacCubing IV 2018-05-27. Park dominated through 17.42 (2021), 16.79 (2022), 15.83 (Nub Open Yucaipa 2024-04-20), and finally 15.71 s at Colorado Mountain Tour - Evergreen 2024 (2024-06-08). **Tymon Kolasiński** broke that to 15.18 s at the Spanish Championship 2025-12-06 — his first 4x4 single WR despite holding the 4x4 Ao5 record since 2022.\n\nThe pattern is informative: 4x4 WRs cluster around magnet-flagship releases. The 16-second band held for two years until ball-core hardware (MoYu AoSu V7) reset the floor in 2024. The next WR will need either a sub-9.5 TPS sustained run on existing hardware or another hardware generation.`,
        body_zh: `二十年来 4x4 单次 WR 在少数选手之间轮转。**Erik Akkersdijk** 2007 年用初代 Rubik's brand (无磁铁、无 MoYu) 短暂持有 47.36 秒。**Sebastian Weyer** 2017 年带入 23 秒以内。**Sebastian Weyer** 2018 年 German Open 18.84 秒首破 19, **Max Park** 紧接着 SacCubing IV 2018-05-27 用 18.42 从他手里接过。Park 一路 17.42 (2021) → 16.79 (2022) → 15.83 (Nub Open Yucaipa 2024-04-20) → 15.71 秒 (Colorado Mountain Tour - Evergreen 2024-06-08)。**Tymon Kolasiński** 2025-12-06 西班牙锦标 15.18 秒打破 Park, 这是他首个 4x4 单次 WR — 尽管 Ao5 WR 自 2022 起就一直是他。\n\n这个模式很说明问题: 4x4 WR 都集中在磁铁旗舰发布期。16 秒带卡了两年, 直到 ball-core 硬件 (MoYu AoSu V7) 2024 年重置底线。下一个 WR 要么需要现役硬件上持续 sub-9.5 TPS, 要么再等一代硬件。`,
      },
      {
        title_en: `The Parity Tax: a Hidden 1.5-3 s Per Solve`,
        title_zh: `Parity 税: 每把隐藏的 1.5-3 秒`,
        body_en: `Every 4x4 scramble independently encounters two parity conditions:\n\n- **OLL parity** (50% probability, ~15 STM algorithm) — flips a single dedge during the final OLL.\n- **PLL parity** (50% probability, ~12 STM algorithm) — swaps two adjacent dedges during PLL.\n\nThe two are independent, giving four equally likely scenarios: no parity (25%), single parity (50%), double parity (25%). In **expected value** that adds 50% × 1.5 s + 50% × 1.0 s = ~1.25 s per solve regardless of skill — and elite solvers experience the variance directly: a double-parity solve at the WR level can lose 2-3 s vs a no-parity equivalent.\n\nAdvanced solvers (Tymon, Park) **track parity during edge pairing** — if they know parity is coming, they can fold the parity correction into the algorithm-stage moves and save ~0.5 s on each. The 100-year floor at 9.9 s assumes near-perfect parity prediction.`,
        body_zh: `每个 4x4 打乱都独立面对两个 parity:\n\n- **OLL parity** (50% 概率, ~15 步算法) — 最后 OLL 时单个 dedge 翻转\n- **PLL parity** (50% 概率, ~12 步算法) — PLL 时相邻两个 dedge 互换\n\n两者独立, 四种等概率场景: 无 parity (25%)、单 parity (50%)、双 parity (25%)。**期望值**上每把多花 1.25 秒, 与水平无关。顶级选手直接感受方差: WR 级双 parity 比无 parity 慢 2-3 秒。\n\n进阶选手 (Tymon、Park) 在**棱配对阶段就跟踪 parity** — 知道 parity 要来, 就把 parity 修正折进算法步骤里, 每个 parity 省 ~0.5 秒。100 年下界 9.9 秒预设了近完美的 parity 预判。`,
      },
      {
        title_en: `Yau vs Reduction: Why Top Cubers All Use Yau`,
        title_zh: `Yau vs Reduction: 为什么顶级都用 Yau`,
        body_en: `Reduction (= centers, then edges, then 3x3) is the intuitive first method. **Yau** (proposed by Robert Yau in 2009) reorders the phases: 1 center first, three cross dedges, last 3 centers + last cross dedge, edge pairing, 3x3 stage. The reordering costs nothing in moves but **enables full cross planning before edge pairing starts** — and the cross dedges sit through the entire pairing phase, free for tracking.\n\nReduction is faster to learn (one fewer phase ordering to memorise) and accounts for most sub-30 averages worldwide. But every WR-class solver above sub-22 average uses Yau, because the cross-edge tracking advantage compounds: by the time pairing finishes, a Yau solver already has the cross planned and just inserts it, while a Reduction solver has to plan cross from scratch on the now-paired-but-just-revealed state.\n\nThe sub-1% of solvers on Yau5 (5x5) face the same trade-off; the sub-1% on Yau6/7 face diminishing returns because cross-edge tracking attenuates over 12-17 layers.`,
        body_zh: `Reduction (中心 → 棱 → 三阶) 是上手最自然的方法。**Yau** (Robert Yau 2009 提出) 调整阶段顺序: 1 中心 → 3 cross 棱 → 后 3 中心 + 最后 cross 棱 → 棱配对 → 三阶收尾。重排步数零增, 但**棱配对动手前就能把 cross 规划好**, 且 cross 棱在整个配对阶段都摆在那让你跟踪。\n\nReduction 学起来更快 (少记一个阶段顺序), 全球 sub-30 平均多数靠它。但 sub-22 平均以上的 WR 级选手全用 Yau, 因为 cross 跟踪优势会复利: 配对结束时 Yau 玩家已经把 cross 规划好直接插入, Reduction 玩家还要在刚露出的状态从零规划 cross。\n\nYau5 (5x5) 的少数派同理; Yau6/7 收益递减, 因为 cross 棱跟踪在 12-17 层尺度上被稀释。`,
      },
      {
        title_en: `Training Ladder: Sub-40 → Sub-30 → Sub-20 → WR`,
        title_zh: `训练阶梯: sub-40 → sub-30 → sub-20 → WR`,
        body_en: `**Sub-40 Ao5**: pick Reduction, learn the two parity algorithms, get a decent magnetic 4x4 (YJ MGC M4 / MoYu Aosu Lite). Centers via simple commutators, edges by pairing one at a time. Bottleneck: parity hesitation and slow centers.\n\n**Sub-30 Ao5**: switch to 3-2-3 edge pairing, start full F2L from 3x3 muscle memory. Most cubers spend 6-12 months here learning to track parity through edge pairing.\n\n**Sub-20 Ao5**: switch to Yau, drill freeslice edge pairing (pair 2 edges per F2L slot), train parity-prediction during the last 4 centers phase. Hardware matters here: upgrade to AoSu WRM or AoSu V7.\n\n**WR territory (sub-18 Ao5)**: requires sustained 8+ TPS on wide moves, < 0.5 s pauses between phases, and parity-prediction accuracy >80%. Only ~30 cubers worldwide are here.`,
        body_zh: `**Sub-40 Ao5**: 选 Reduction, 背两个 parity 算法, 买个像样的磁铁四阶 (YJ MGC M4 / MoYu Aosu Lite)。中心简单 commutator, 棱一对一配。瓶颈在 parity 犹豫和慢中心。\n\n**Sub-30 Ao5**: 改 3-2-3 棱配对, F2L 用 3x3 肌肉记忆。多数选手在这阶段花 6-12 个月, 学棱配对阶段同时跟踪 parity。\n\n**Sub-20 Ao5**: 换 Yau, 练 freeslice 配对 (每个 F2L 槽配 2 棱), 后 4 中心阶段练 parity 预判。硬件开始重要: 升级 AoSu WRM 或 AoSu V7。\n\n**WR 区 (sub-18 Ao5)**: 宽转持续 8+ TPS, 阶段切换停顿 < 0.5 秒, parity 预判准确率 > 80%。全球约 30 人到这一档。`,
      },
    ],
  },

  // ════════════════════════════════════════════════════════════
  //  555
  // ════════════════════════════════════════════════════════════
  '555': {
    current_method_en:
      'Yau5 (extended Yau for 5x5) and Reduction split the elite. Tymon Kolasiński (current WR 29.49 single + 33.73 Ao5, both at All Rounders Katowice I 2026-05-01 — first non-Park average WR holder in ~7 years, originally took the Ao5 at WC 2025 with 34.31) uses Yau5. Park uses Reduction. 5x5 has NO parity (odd-layered, no algorithmic OLL/PLL parity case).',
    current_method_zh:
      'Yau5 (Yau 在 5x5 的扩展) 和 Reduction 在顶级各占一半。Tymon (现 WR 单次 29.49 / Ao5 33.73, 同场 All Rounders Katowice I 2026-05-01 — 七年来第一个不是 Park 的持有者, Ao5 最初在 WC 2025 以 34.31 拿下) 用 Yau5。Park 用 Reduction。5x5 没有 parity (奇数层, 不存在算法级 OLL/PLL parity)。',
    current_wr_avg_holder: 'Tymon Kolasiński — 33.73 Ao5 (All Rounders Katowice I 2026-05-01)',
    current_wr_avg_value: 33.73,
    current_wr_single_holder: 'Tymon Kolasiński — 29.49 single (All Rounders Katowice I 2026-05-01)',
    current_wr_single_value: 29.49,
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
      { scenario_en: 'Tymon 29.49 (current WR single)', scenario_zh: 'Tymon 29.49 (现 WR 单次)', M: 215, TPS: 7.3, R: 0.0 },
      { scenario_en: '20–30 year horizon (Yau5 + tracking gains)', scenario_zh: '20–30 年 (Yau5 + 跟踪改进)', M: 205, TPS: 8.5, R: 1.5 },
      { scenario_en: '100-year asymptote (efficient route + 10 TPS)', scenario_zh: '100 年渐近 (高效路径 + 10 TPS)', M: 180, TPS: 10, R: 1.5 },
      { scenario_en: 'Absolute floor (optimal-route human + 12 TPS sustained)', scenario_zh: '绝对下界 (人类最优路径 + 12 TPS 持续)', M: 150, TPS: 12, R: 1.0 },
    ],
    best_reconstructions: [
      { person: 'Tymon Kolasiński', date: '2026-05-01', time: '29.49 s', M: 215, TPS: 7.3, method: 'Yau5 — All Rounders Katowice I, current WR single', source_url: 'https://www.speedsolving.com/wiki/index.php/List_of_World_Records/5x5x5' },
    ],
    reasoning_en:
      'Five-by-five differs from four-by-four in two important ways. First, it has no algorithmic parity — odd-layer puzzles cannot produce the dedge-flip / dedge-swap cases that cost 4x4 solvers a combined 1.5-3 s in expected value. Second, the inner-edge tracking cost is superlinear: 12 midges plus 24 wing-edges create a working memory load during reduction that dwarfs 4x4. Tymon\'s 29.49 WR averages roughly 7.3 TPS over an estimated 215 STM, materially slower than 4x4 (9.2 TPS) — the bottleneck is mental tracking during edge pairing, not finger speed.\n\n' +
      'Phase splits for a 35-second elite solve estimate roughly: first 2 centers 3.5 s, three cross edges in Yau5 3.0 s, last 4 centers + final cross edge 6.5 s, edge pairing 10 s, 3x3 stage 12 s. Edge pairing is where the gains live — better look-ahead training cuts that phase ~20%. Push the route to ~180 STM and TPS to a sustained 10, residual recognition to 1.5 s, and you get 19.5 s — that is the realistic 100-year floor. Zemdegs\' 2017 prediction of "sub-40 imminent" was annihilated by 2024, and his "sub-45 mean" was passed in 2018.',
    reasoning_zh:
      '5x5 与 4x4 有两处关键差别。一是没有算法 parity — 奇数层拼图不会出 dedge-flip / dedge-swap 那种期望吃 1.5-3 秒的情况。二是内层跟踪代价超线性: 12 个 midge + 24 个 wing edge 在 reduction 阶段产生的工作记忆压力比 4x4 大得多。Tymon 29.49 WR 大致 7.3 TPS / 215 STM, 比 4x4 (9.2 TPS) 明显慢, 瓶颈在棱配对阶段的心智跟踪, 不在手指。\n\n' +
      '35 秒级顶级解的阶段大致是: 前 2 中心 3.5 秒、Yau5 三 cross 棱 3.0 秒、后 4 中心 + 最后 cross 棱 6.5 秒、棱配对 10 秒、三阶收尾 12 秒。增量空间主要在棱配对 — 更好的预读训练能压 ~20%。把路径压到 180 STM、持续 10 TPS、残余识别 1.5 秒, 得到 19.5 秒, 这是 100 年现实下界。Zemdegs 2017 预言「sub-40 临近」2024 被砸穿, 「sub-45 平均」2018 就过线了。',
    extended_sections: [
      {
        title_en: `The End of Park's Six-Year Streak`,
        title_zh: `Park 六年垄断的终结`,
        body_en: `Max Park held the 5x5 single WR from October 2018 (39.65 s) continuously until September 2024 — almost six years of dominance, the longest active streak of any non-BLD WCA event in the modern era. He progressively dropped the WR through 36.06 (2019), 34.92 (2020), 33.95 (2021), 32.04 (2022), 31.78 (2023). **Tymon Kolasiński** ended the streak with 31.60 s at DuPage Fall 2024-09-28, then 30.45 s at WCA Asian Championship 2024-11-01, then **29.49 s** at All Rounders Katowice I 2026-05-01 — the first official sub-30 single. He took the Ao5 from Park at WCA World Championship 2025 with 34.31, since improved to 33.73 at the same Katowice event.\n\nThe streak's end was hardware-coincident. Park used MoYu AoChuang WR M and refined Reduction; Tymon switched to **Yau5** plus a GAN 562 M flagship released in late 2023. The hardware made Yau5's specific cross-edge tracking advantage actionable for the first time at the WR scale.`,
        body_zh: `Max Park 自 2018 年 10 月 (39.65 秒) 起连续持有 5x5 单次 WR 直到 2024 年 9 月 — 近六年, WCA 现代史上非 BLD 项目的最长有效垄断。一路 36.06 (2019) → 34.92 (2020) → 33.95 (2021) → 32.04 (2022) → 31.78 (2023)。**Tymon Kolasiński** 在 2024 亚锦赛跑出 31.60 终结垄断, 同年再砍到 30.45, 2025 跑到 **29.49**, 首次官方破 30。Ao5 在 2025 世锦赛以 34.31 从 Park 手中接过, 在同场 Katowice 再改写到 33.73。\n\n垄断终结和硬件同步。Park 用 MoYu AoChuang WR M + 精修 Reduction; Tymon 切到 **Yau5** + 2023 末发布的 GAN 562 M 旗舰。新硬件第一次让 Yau5 的 cross 跟踪优势在 WR 尺度上变现。`,
      },
      {
        title_en: `Why 5x5 Has No Parity (and Why That Matters)`,
        title_zh: `为什么 5x5 没有 parity (以及为什么这很重要)`,
        body_en: `Odd-layered cubes (3x3, 5x5, 7x7) have a fixed center orientation per face, which means edges are paired with deterministic chirality. The dedge-flip and dedge-swap states that bedevil even-layered cubes are **mathematically impossible** on 5x5 — there is no way for a single midge to end up flipped relative to the surrounding pairing.\n\nThe result is that the **distribution of solve times is dramatically tighter on 5x5 than on 4x4**. A 4x4 average is computed across 5 solves with binary independent parity dice (25% double, 50% single, 25% none); a 5x5 average has no such variance. This is why 5x5 averages improve faster than 5x5 singles in the historical data — the variance reduction makes consistent 35-second solves attainable, even when the single floor is dictated by edge-tracking accuracy.\n\nThe consequence for the physical floor: 5x5's gap between Ao5 and single (currently ~4.5 s) is essentially execution noise, while 4x4's gap (~3.5 s) is execution noise *minus* lucky parity escape.`,
        body_zh: `奇数层魔方 (3x3 / 5x5 / 7x7) 每个面有固定中心朝向, 因此棱配对的手性是确定的。让偶数层魔方头疼的 dedge-flip / dedge-swap 状态在 5x5 上**数学上不可能** — 单个 midge 不可能相对配对反向。\n\n后果是 5x5 的成绩分布**显著比 4x4 集中**。4x4 平均跑 5 把, 每把独立投 parity 骰子 (25% 双 / 50% 单 / 25% 无); 5x5 平均没有这种方差。这就是历史数据中 5x5 平均改进比单次更快的原因 — 方差降低让「稳定 35 秒」可实现, 即使单次下界受棱跟踪准确率限制。\n\n对物理下界的意义: 5x5 的 Ao5 - single 差距 (现 ~4.5 秒) 几乎是纯执行噪声, 而 4x4 的差距 (~3.5 秒) 是执行噪声**减掉**「侥幸没遇上 parity」的部分。`,
      },
      {
        title_en: `Edge Pairing Is the Whole Game`,
        title_zh: `棱配对就是全部`,
        body_en: `Across 35-second elite 5x5 solves, **edge pairing consumes 10-12 seconds — roughly one-third of total time**. By comparison, 4x4 edge pairing is 4-5 s of a 16-s solve (also ~30%), but the underlying difficulty is non-linear: 4x4 pairs 12 dedges (1 of 2 pieces per slot), while 5x5 pairs 24 wing edges around 12 midges, and the wings have to match midge orientation per side.\n\nThe technique inflection point at the elite level is **freeslice pairing**: pair 3 edges per slice in one continuous motion, rotating the cube only when the slice is full. This pulls 5x5 edge pairing from ~140 STM down to ~100 STM with concomitant TPS gains because there are fewer regrips. Yu Da-Hyung's S2L variant from Korea (2018) and Bálint's variant (Hungary) both extend freeslice into the second 2 layers; both work but require ~6 months of dedicated drilling to stick.\n\nFurther gains require **edge-pairing look-ahead during the centers phase** — solvers like Tymon plan the first 2-3 edge pairings during the last centers, eliminating up to 1.5 s of recognition pause. This is the boundary where the 100-year floor sits.`,
        body_zh: `35 秒级 5x5 中, **棱配对消耗 10-12 秒 — 约总时长的三分之一**。对比 4x4 棱配对 4-5 秒 / 16 秒总时 (也 ~30%), 但底层难度非线性: 4x4 配 12 dedge (每槽 2 个块), 5x5 配 24 wing edge 围绕 12 midge, 且 wing 必须匹配 midge 朝向。\n\n顶级技术转折点是 **freeslice 配对**: 一次连续动作配每个 slice 3 棱, 只在 slice 满时旋转魔方。把 5x5 棱配对从 ~140 STM 砍到 ~100 STM, 且因换握减少 TPS 提升。Yu Da-Hyung (韩国 2018) 和 Bálint (匈牙利) 的 S2L 变种都把 freeslice 扩展到第二批 2 层, 有效但要 ~6 个月专项练习才稳。\n\n再上一层需要 **中心阶段就预读棱配对** — Tymon 等选手在最后中心阶段就规划前 2-3 个棱配对, 消除 ~1.5 秒识别停顿。这是 100 年下界的边界。`,
      },
    ],
  },

  // ════════════════════════════════════════════════════════════
  //  666
  // ════════════════════════════════════════════════════════════
  '666': {
    current_method_en:
      'Reduction universal at WR level — Yau6 offers diminishing returns due to dilute cross-edge advantage. Max Park holds the current single 57.69 (Burbank Big Cubes 2025-04-26 — third-ever sub-1:00 single). Lim Hung (Malaysia) holds the current Mo3 WR 1:04.94 at UniKL MIAT Cube Open 2026-05-10, breaking Park\'s 1:05.04. 6x6 has full parity (50% × 15-STM OLL + 50% × 12-STM PLL). Hardware unresolved: inner-layer slipping affects "every 6x6 including the big three" (Cubeskills).',
    current_method_zh:
      'WR 级别人人用 Reduction — Yau6 在 6x6 上收益递减, cross 边棱的优势被稀释。Max Park 持有现单次 57.69 (Burbank Big Cubes 2025-04-26, 史上第三个 sub-1:00 单次)。Lim Hung (马) 在 UniKL MIAT Cube Open 2026-05-10 用 1:04.94 拿下 Mo3 WR, 打破 Park 的 1:05.04。6x6 有完整 parity (50% × 15-STM OLL + 50% × 12-STM PLL)。硬件层面有个老问题没解决: Cubeskills 直接讲过『市面上所有 6x6, 包括三大牌, 都有内层打滑』。',
    current_wr_avg_holder: 'Lim Hung — 1:04.94 Mo3 (UniKL MIAT Cube Open 2026-05-10)',
    current_wr_avg_value: 64.94,
    current_wr_single_holder: 'Max Park — 57.69 (Burbank Big Cubes 2025-04-26)',
    current_wr_single_value: 57.69,
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
      '6x6 是 WCA 中最受硬件瓶颈拖累的项目。Cubeskills 明确指出「包括三大牌在内, 所有 6x6 都有未解决的内层打滑问题」 — 宽转一旦扫到没跟上的内层, 选手要花 0.2-0.5 秒重新对齐。Park 57.69 跑出 5.5 TPS / 315 STM; 与 5x5 的 7.2 TPS 之差几乎全来自物理摩擦, 不是脑算速度。\n\n' +
      '58 秒级顶级解: 中心 22 秒、棱 20 秒、三阶收尾 16 秒。6x6 有完整 parity (50% × 15-STM OLL parity, 50% × 12-STM PLL parity, 独立), 期望值多吃 1.5-3 秒。100 年渐近需要三件事: (a) 硬件重做消除内层打滑、(b) 最深 slice 上 7.5 TPS 可持续、(c) 阶段切换的累计识别压到 2 秒。280 STM 无 parity 打乱跑这套, 得 280/7.5 + 2 = 39.3 秒。绝对下界要等 6x6 跑出 9 TPS — 接近现役 5x5 的速度 — 这取决于尚未上市的下一代硬件。',
    extended_sections: [
      {
        title_en: `Why 6x6 Is the Hardware-Saddest WCA Event`,
        title_zh: `为什么 6x6 是 WCA 里硬件最不省心的项目`,
        body_en: `Six-by-six occupies an uncomfortable niche: too many layers for the magnet density of even-layered cubes to fully stabilise (compare 4x4 with 8 magnets per face vs 6x6 with ~12 magnets per face spread thin), and too large in diameter (~67 mm) for a single-hand grip during edge pairing. Inner-layer slipping — where a wide turn brushes a layer that has not committed its previous rotation — is unresolved across every brand including MoYu AoShi WRM, GAN 660 M, and YJ MGC 6x6 M.\n\nThe consequence is that 6x6 WR progression closely tracks hardware releases more visibly than any other event. Park's 57.69 WR uses MoYu AoShi WRM (2023 release). The 2008-2014 V-Cube 6 era was characterised by long flats in the curve because the puzzle was barely solvable at speed; the curve dropped sharply only when QiYi WuHua (2016) and YJ MGC (2019) restored mechanical viability.`,
        body_zh: `6x6 在尴尬区间: 层数太多, 偶数层的磁铁密度不足以充分稳定 (4x4 每面 ~8 磁铁 vs 6x6 每面 ~12 磁铁但摊薄); 直径太大 (~67 mm), 棱配对阶段单手握持困难。内层打滑 — 宽转扫到上一步未稳定的内层 — 在每个牌子 (MoYu AoShi WRM / GAN 660 M / YJ MGC) 都未解决。\n\n后果是 6x6 WR 进展比任何其他项目都明显跟硬件发布走。Park 57.69 用 MoYu AoShi WRM (2023 发布)。2008-2014 V-Cube 6 时代曲线长期持平 — 拼图在速拧下勉强可用; QiYi WuHua (2016) 和 YJ MGC (2019) 恢复机械可行性后曲线才大幅下降。`,
      },
      {
        title_en: `The Park Era and Beyond`,
        title_zh: `Park 时代及之后`,
        body_en: `**Max Park** has held the 6x6 single WR continuously since 2020. His progression: 1:14.86 (2020), 1:09.51 (2022), 1:04.52 (2023, first sub-1:05), 0:59.74 (2024, first sub-1:00), 0:57.69 (Burbank Big Cubes 2025-04-26). He held Mo3 1:05.04 until 2026-05-10, when **Lim Hung** (Malaysia) lowered it to 1:04.94 at UniKL MIAT Cube Open 2026 — the first non-Park 6x6 record in five years. **Feliks Zemdegs** held the WR previously (2017-2020) but moved focus away from big cubes after his 2019 retirement-comeback.\n\nThe competitive landscape outside Park is thin: until 2026, only Tymon Kolasiński, Bence Barát, and Sebastian Weyer had produced top-3 finishes since 2022. Lim Hung\'s 2026-05 Mo3 breakthrough at the same competition where he also took the 7x7 single WR signals a possible new contender. The Tymon-Park rivalry that dominates 4x4 and 5x5 has not extended to 6x6 because Tymon\'s training focus on Yau5 does not extend efficiently to Yau6 (where cross-edge tracking attenuates over 12 visible layers per face).`,
        body_zh: `**Max Park** 自 2020 年起连续持有 6x6 单次 WR。一路: 1:14.86 (2020) → 1:09.51 (2022) → 1:04.52 (2023, 首破 1:05) → 0:59.74 (2024, 首破 1 分) → 0:57.69 (Burbank Big Cubes 2025-04-26)。Mo3 1:05.04 在手直到 2026-05-10, **Lim Hung** (马) 在 UniKL MIAT Cube Open 2026 用 1:04.94 改写, 是五年来首个非 Park 的 6x6 记录。**Feliks Zemdegs** 之前持有 (2017-2020), 2019 年宣布「退役-回归」后逐渐离开大魔方。\n\nPark 之外赛道空旷: 直到 2026 年, 2022 年以来只有 Tymon Kolasiński / Bence Barát / Sebastian Weyer 进过 top-3。Lim Hung 2026-05 在同场拿下 Mo3 + 7x7 单次双 WR, 可能是新挑战者。Tymon 与 Park 在 4x4 / 5x5 上的对抗未延伸到 6x6, 因为 Tymon 的 Yau5 训练不能高效扩到 Yau6 (每面 12 层可见, cross 跟踪稀释)。`,
      },
    ],
  },

  // ════════════════════════════════════════════════════════════
  //  777
  // ════════════════════════════════════════════════════════════
  '777': {
    current_method_en:
      'Reduction universal (Yau7 used by Tymon). Lim Hung (Malaysia) holds the current single WR 1:32.92 at UniKL MIAT Cube Open 2026-05-10, breaking Park\'s long-standing 1:33.48. Max Park still holds the Mo3 WR 1:36.86 at Nub Open Trabuco Hills Fall 2025-10-04. 7x7 has NO parity (odd-layered). Best primary STM data of any big cube — multiple solver reconstructions on speedsolving.com show 446-524 STM (mean ~470).',
    current_method_zh:
      '人人用 Reduction (Yau7 只有 Tymon 用)。Lim Hung (马) 在 UniKL MIAT Cube Open 2026-05-10 用 1:32.92 改写 Park 长期持有的单次 1:33.48。Max Park 仍持 Mo3 WR 1:36.86 (Nub Open Trabuco Hills Fall 2025-10-04)。7x7 没有 parity (奇数层)。在大魔方里, 只有 7x7 有公开的复盘资料库 — speedsolving 多人复盘显示 446-524 STM (均值 ~470)。',
    current_wr_avg_holder: 'Max Park — 1:36.86 Mo3 (Nub Open Trabuco Hills Fall 2025-10-04)',
    current_wr_avg_value: 96.86,
    current_wr_single_holder: 'Lim Hung — 1:32.92 (UniKL MIAT Cube Open 2026-05-10)',
    current_wr_single_value: 92.92,
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
      { scenario_en: 'Lim Hung 1:32.92 (current WR single)', scenario_zh: 'Lim Hung 1:32.92 (现 WR 单次)', M: 440, TPS: 4.7, R: 0.0 },
      { scenario_en: '20–30 year horizon', scenario_zh: '20–30 年', M: 430, TPS: 5.2, R: 3.5 },
      { scenario_en: '100-year asymptote', scenario_zh: '100 年渐近', M: 410, TPS: 6, R: 3.0 },
      { scenario_en: 'Absolute floor (deep-slice 7 TPS + slip-free)', scenario_zh: '绝对下界 (深 slice 7 TPS + 零打滑)', M: 380, TPS: 7, R: 2.0 },
    ],
    best_reconstructions: [
      { person: 'Max Park', date: '2025-10-04', time: '1:33.48', M: 440, TPS: 4.7, method: 'Reduction + freeslice — Nub Open Trabuco Hills Fall 2025, former WR single, current WR Mo3 1:36.86 same comp', source_url: 'https://www.speedsolving.com/threads/max-park-1-33-48-7x7-single-and-1-36-86-average.95542/' },
    ],
    reasoning_en:
      'Seven-by-seven is the only big cube with public WR-grade move-count data — multiple speedsolving.com solvers have published reductions in the 446-524 STM range (Hays 501, Kirjava 446, uberCuber 455, vcuber13 455). WR-class solves (Park 1:33.48, Lim Hung 1:32.92) likely land around 430-450 STM with strong tracking and freeslice efficiency; ~93 s ÷ 440 STM = ~4.7 TPS sustained, matched against centers ~46 s, edges ~33 s, 3x3 stage ~14 s.\n\nThere is no parity (odd-layer cubes lack the dedge cases) but deep-slice physics dominates. 3Rw, 4Rw and 3Lw moves move 21-28 cubies each — the cube has weight and angular inertia, and elite TPS on these specific moves rarely exceeds 4 even with the latest GAN 778 / MoYu HuaShi WR M. The path to ~80 s floor requires the deep-slice TPS bottleneck to break, plus phase-transition recognition pushed under 2 s. Hardware has improved fastest in the last five years among big cubes — quasi-magnet stabilisation of 17 visible layers per face is now solved — and the next bottleneck is human cognitive tracking on 200+ moves of edge pairing, not finger speed.',
    reasoning_zh:
      '7x7 是大魔方中唯一有公开 WR 级复盘数据的项目。speedsolving.com 多人 reduction 步数 446-524 STM (Hays 501、Kirjava 446、uberCuber 455、vcuber13 455)。WR 级 (Park 1:33.48 / Lim Hung 1:32.92) 步数约 430-450, 跟踪好 + freeslice 高效。~93 秒 ÷ 440 STM = ~4.7 TPS 持续, 对应中心 ~46 秒、棱 ~33 秒、三阶 ~14 秒。\n\n没有 parity (奇数层不存在 dedge 类), 但深 slice 的物理特性占主导。3Rw / 4Rw / 3Lw 每步动 21-28 个块, 有重量和角惯性 — 这些动作上即便用最新 GAN 778 / MoYu HuaShi WR M, 顶级 TPS 也很难超 4。压到 80 秒下界需要深 slice TPS 瓶颈被突破, 加阶段切换识别压到 2 秒以下。大魔方里 7x7 硬件改进最快 — 每面 17 层可见的准磁稳定已经基本解决 — 下一个瓶颈是人类在 200+ 步棱配对上的认知跟踪, 不是手指速度。',
    extended_sections: [
      {
        title_en: `The Only Big Cube with Public Move-Count Data`,
        title_zh: `唯一有公开步数数据的大魔方`,
        body_en: `7x7 is the rare big cube where the speedcubing community has invested in **complete move-count reconstruction**. Multiple solvers on speedsolving.com have published full per-phase analyses: Kit Clement (Hays) at 501 STM, Conrad Rider (Kirjava) at 446, "uberCuber" at 455, "vcuber13" at 455. These cluster between 446 and 524 with mean ~470, dominated by edge pairing (~165 STM) and centers (~140 STM with Reduction).\n\nWR-class solves (Park 1:33.48, Lim Hung 1:32.92) are estimated at 430-450 STM with strong tracking and freeslice efficiency. Roughly 93 s ÷ 440 = ~4.7 TPS sustained matches the bottleneck of 3Rw/4Rw/3Lw inner-slice moves, each displacing 21-28 cubies. The community's move-count data makes 7x7 the only big-cube event where the physical floor analysis is grounded in observed solves rather than pure derivation.`,
        body_zh: `7x7 是少有的、社区投入做了**完整步数复盘**的大魔方。speedsolving.com 上多人发表过分阶段分析: Kit Clement (Hays) 501 STM, Conrad Rider (Kirjava) 446, 「uberCuber」 455, 「vcuber13」 455。聚簇在 446-524 区间, 均值 ~470, 主要由棱配对 (~165 STM) 和中心 (~140 STM Reduction) 主导。\n\nWR 级 (Park 1:33.48 / Lim Hung 1:32.92) 步数约 430-450, 强跟踪 + freeslice 高效。~93 秒 ÷ 440 = ~4.7 TPS 持续, 符合 3Rw / 4Rw / 3Lw 深 slice 每步动 21-28 块的瓶颈。这是大魔方里唯一一个物理下界分析基于实际复盘而非纯推导的项目。`,
      },
      {
        title_en: `Hardware: 17 Visible Layers Per Face`,
        title_zh: `硬件: 每面 17 可见层`,
        body_en: `Seven-by-seven asks the cube mechanism to stabilise 17 layers per face (3 visible per slice × 6 directions, plus shared centers). The challenge for early V-Cube 7 (2008) was simply not collapsing during a turn. By 2017 (YuXin Huanglong M) magnetic feedback per layer became feasible. The 2021 MoYu AoFu WR M is the cube that drove the 1:40-1:35 era, and the 2025 GAN 778 / MoYu HuaShi WR M release coincided with Park's 1:33.48 and the subsequent Lim Hung 1:32.92 — same hardware-driven WR cluster pattern as 4x4 and 6x6.\n\nThe remaining hardware question is **deep-slice TPS**: even on the best 2025 hardware, 3Rw / 4Rw moves cap at ~4 TPS sustained because of layer mass × angular velocity. A radically lighter material (carbon fibre tiles? hollow plastic with reinforced internal frame?) could break this, but no manufacturer has shipped such a design at consumer prices.`,
        body_zh: `7x7 要求魔方机构稳定每面 17 层 (每方向 3 可见 slice × 6 方向 + 共享中心)。早期 V-Cube 7 (2008) 的挑战只是「转的时候不散架」。2017 (YuXin 黄龙 M) 单层磁反馈才可行。2021 MoYu AoFu WR M 驱动了 1:40-1:35 时代, 2025 GAN 778 / MoYu HuaShi WR M 发布与 Park 1:33.48 及后续 Lim Hung 1:32.92 同步 — 与 4x4 / 6x6 同样的硬件驱动 WR 簇模式。\n\n硬件遗留问题是 **深 slice TPS**: 2025 顶级硬件上, 3Rw / 4Rw 持续 TPS 仍 ~4 上限, 受层质量 × 角速度约束。激进的轻质材料 (碳纤维贴片? 中空 + 加固内框?) 可能突破, 但目前没有量产价格的产品。`,
      },
    ],
  },

  // ════════════════════════════════════════════════════════════
  //  333oh
  // ════════════════════════════════════════════════════════════
  '333oh': {
    current_method_en:
      'CFOP adapted for OH dominates the elite. Dhruva Sai Meruva (Switzerland, current WR single 5.66 at Swiss Nationals 2024-10-04 — tied to digit with Feliks\'s 2H 5.66 from 2011), Luke Garrett (USA, current WR Ao5 7.72, Chicagoland Newcomers 2025-03-09), Yiheng Wang. Top solvers use OH-friendly OLL/PLL subsets (RU-heavy algs, often 2-look OLL kept for ergonomics). Roux-OH is more move-efficient (~45-50 STM vs CFOP-OH ~55-60) and dominant in OH single Ao5 records (Sean Patrick Villanueva, Nicholas Archer, Kian Mansour) but the top of the WR Ao5 standings still uses CFOP-OH because recognition speed wins.',
    current_method_zh:
      '顶级用 OH 改良过的 CFOP 为主。Dhruva Sai Meruva (瑞士, 现 WR 单次 5.66, Swiss Nationals 2024-10-04 — 与 Feliks 2011 双手 5.66 同位)、Luke Garrett (美国, 现 WR Ao5 7.72, Chicagoland Newcomers 2025-03-09)、王艺衡。OH 版优选 RU-heavy OLL / PLL, 部分保留 2-look OLL 节省手指扭曲。Roux-OH 步数更少 (~45-50 vs CFOP-OH ~55-60), 在 OH Ao5 历史上有 SPV / Archer / Mansour 等持有人, 但当前 WR 仍是 CFOP-OH — 识别速度赢了。',
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
      'OH 的瓶颈在单手 TPS 的生物力学。一只手只有 4 指参与手指动作 (vs 双手 8 指), 且换握开销 — 没有第二只手稳定魔方 — 累计加 0.3-0.5 秒停顿, 双手解法没有这部分。Meruva 5.66 跑出 9.7 TPS / 56 STM / 0.2 秒识别; Wang 双手能跑 16.6 TPS, 说明这个差距是生理性的, 不是技术问题。\n\n' +
      '方法上有个反直觉的细节。Roux-OH 步数更少 (45-50 STM vs CFOP-OH 55-60), 因为它无旋转、纯 RrUM, 但全球顶级没有切换 — 因为 CFOP 的识别速度 + 算法熟练度在单手计时下战胜了 Roux 的步数优势。是否长期成立未知: 如果下一代从 8 岁就练 Roux-OH, 格局可能翻转。\n\n' +
      '下界: 100 年渐近 = 48 STM × 11 TPS + 0.25 s = 4.6 秒; 绝对生物力学下界 = 42 STM × 12 TPS + 0.15 s = 3.65 秒。12 TPS 上限对应单手击鼓世界纪录 (Hattori 双手 22 Hz / 2)。再低需要双手等效的握持稳定, 或者方法砍步数 — 二者目前都没有可行路径。',
    extended_sections: [
      {
        title_en: `The 5.66 Symmetry: 2H = OH After Nine Years`,
        title_zh: `5.66 的对称: 双手 = 单手, 隔 9 年`,
        body_en: `**Dhruva Sai Meruva**'s OH single 5.66 s at Swiss Nationals 2024 happens to equal **Feliks Zemdegs**'s 2-handed 3x3 single WR of 5.66 from 2011. That moment — OH catching up to 13-year-old 2-handed WR — captures the trajectory of the event better than any forecast. In 2011 Feliks's 5.66 used CFOP at 9 TPS sustained on a non-magnetic cube. In 2024 Meruva's 5.66 used CFOP at 9.7 TPS sustained on a GAN 12 / 13 UltraM magnetic flagship.\n\nThe symmetry is not coincidence — it is the OH biomechanical floor catching up to where 2-handed CFOP was before magnets revolutionised it. The OH floor will continue to drop as a generation grows up on magnetic-OH-trained 12-13 TPS single-hand bursts, but it will never reach Wang's 16+ TPS 2-handed sustained because the 4-finger constraint is anatomical.`,
        body_zh: `**Dhruva Sai Meruva** 2024 瑞士锦标的 OH 单次 5.66 秒恰好等于 **Feliks Zemdegs** 2011 年的双手 3x3 单次 WR 5.66。这一刻 — OH 追上 13 年前的双手 WR — 比任何预测都更能反映项目轨迹。2011 Feliks 5.66 是非磁铁魔方上跑出来的, 持续 9 TPS, CFOP; Meruva 5.66 是在 GAN 12/13 UltraM 磁铁旗舰上跑出来的, 持续 9.7 TPS, CFOP。\n\n对称不是巧合 — 是 OH 生物力学下界追上了「磁铁革命之前」的双手 CFOP 水平。OH 下界还会随磁铁 OH 训练的一代成长 (12-13 TPS 单手突发) 继续下降, 但永远到不了 Wang 的 16+ TPS 双手持续, 因为 4 指约束是解剖学限制。`,
      },
      {
        title_en: `Why Roux-OH Is Better on Paper but Loses in Practice`,
        title_zh: `Roux-OH 纸面更优但实战落败的原因`,
        body_en: `Roux-OH solves average **45-50 STM** vs CFOP-OH's **55-60 STM** — a ~15% move-count advantage. Roux is rotationless (no z' / y2 cube-flips needed mid-solve) and uses RrUM almost exclusively, which is biomechanically ideal for single-hand operation. A pure move-count analysis says Roux-OH should be 0.5-0.7 s faster at the WR scale.\n\nReality: every current top-5 OH cuber uses CFOP-OH. **Sean Patrick Villanueva** (Philippines) is the highest-ranked Roux-OH solver and holds historical Ao5 records, but the current single WR (Meruva 5.66) and current Ao5 WR (Luke Garrett 7.72) both use CFOP. The reason is **recognition speed**: CFOP's 2-look or 1-look LL is recognised in 0.15-0.25 s with millions of hours of community training data, while Roux's CMLL + LSE has 1/10th the corpus and 2x the recognition latency.\n\nThe long-term question: if a younger generation trains exclusively on Roux-OH from age 8, the recognition gap might close and the move-count advantage would dominate. As of 2026 no such cohort has emerged.`,
        body_zh: `Roux-OH 平均 **45-50 STM** vs CFOP-OH 的 **55-60 STM** — 约 15% 步数优势。Roux 无旋转 (中途无需 z' / y2 翻魔方), 几乎纯 RrUM, 生物力学上对单手最优。纯步数分析说 Roux-OH 应在 WR 尺度快 0.5-0.7 秒。\n\n现实: 当前 OH top-5 全用 CFOP-OH。**Sean Patrick Villanueva** (菲律宾) 是排名最高的 Roux-OH 选手, 持过历史 Ao5 记录, 但当前单 WR (Meruva 5.66) 和当前 Ao5 WR (Luke Garrett 7.72) 全是 CFOP。原因在**识别速度**: CFOP 的 2-look / 1-look LL 在 0.15-0.25 秒识别 (社区累积数百万小时训练), Roux 的 CMLL + LSE 训练语料只有 1/10, 识别延迟 2x。\n\n长远问题: 如果下一代从 8 岁专练 Roux-OH, 识别差距可能闭合, 步数优势会胜出。2026 年尚未出现这种同期组。`,
      },
      {
        title_en: `Training Ladder: Sub-30 → Sub-15 → Sub-10 → WR`,
        title_zh: `训练阶梯: sub-30 → sub-15 → sub-10 → WR`,
        body_en: `**Sub-30 Ao5**: master CFOP 2-handed first, then OH-adapt the OLL/PLL set. Don't try to learn OH-specific algs early — single-hand finger-trick muscles take 6 months to develop, and you'll re-learn algs anyway.\n\n**Sub-15 Ao5**: pick OH-friendly OLL (~10 cases need RU-only adaptation) and PLL (~5 cases need 2-gen alternative). Drill F2L on a single-hand grip; the cross is left-handed only. Hardware matters here — switch from a 3x3 main cube to a smaller (54-55mm) OH-specific magnetic flagship.\n\n**Sub-10 Ao5**: learn full RU-heavy OLL subset, optional partial ZBLL. Train left-hand-only F2L pairs in slot 3-4. The big gain is regrip elimination — sub-10 OH means <2 regrips per solve.\n\n**WR territory (sub-7 Ao5)**: requires sustained 9+ TPS single-hand, near-zero regrips, lookahead through OLL-to-PLL transitions. Only ~15 cubers worldwide are here.`,
        body_zh: `**Sub-30 Ao5**: 先用双手把 CFOP 练熟, 再 OH 适应 OLL / PLL。别早学 OH 专属算法 — 单手手指动作肌肉要 6 个月发育, 算法迟早重学。\n\n**Sub-15 Ao5**: 选 OH 友好 OLL (~10 个情况改 RU-only)、PLL (~5 个情况用 2-gen 替代)。单手 F2L 练熟, cross 只用左手。硬件开始重要 — 从 3x3 主用魔方换到 OH 专属磁铁旗舰 (54-55mm)。\n\n**Sub-10 Ao5**: 学全 RU-heavy OLL 子集, 选学局部 ZBLL。槽 3-4 练全左手 F2L。进步空间集中在减少换握上 — sub-10 OH 意味着每把 < 2 次换握。\n\n**WR 区 (sub-7 Ao5)**: 单手持续 9+ TPS、近零换握、OLL → PLL 切换预读。全球约 15 人到这一档。`,
      },
    ],
  },

  // ════════════════════════════════════════════════════════════
  //  333bf
  // ════════════════════════════════════════════════════════════
  '333bf': {
    current_method_en:
      'Full 3-Style commutators (corners + edges) is universal at the elite level. Charlie Eggins (Australia, WR single 11.67 + Mo3 14.05, Cubing at The Cube 2026-01-10, Sydney) holds both records. Tommy Cherry held the 12.x band before Eggins\'s January 2026 sub-12 breakthrough. M2/OP is teaching-only. Floating buffers + LTCT (Last-Target Corner Twist) + per-special algs cut setup moves. Note: Tymon Kolasiński does NOT hold a 3BLD record — he holds 4x4 single, 5x5 single, 5x5 mean.',
    current_method_zh:
      '顶级全跑 corner + edge 全 3-Style。Charlie Eggins (澳洲) 2026-01-10 在 Sydney 「Cubing at The Cube」同场拿下 WR 单次 11.67 + Mo3 14.05。Tommy Cherry 之前持有 12.x 段。M2/OP 仅教学。浮动 buffer + LTCT (Last-Target Corner Twist) + 特例算法削减中转步。注: Tymon Kolasiński 不持有 3BLD 记录, 他持有的是 4x4 单 / 5x5 单 / 5x5 Ao5。',
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
      'BLD 时间分两阶段 — 记忆与执行 — 各有独立下界。记忆环节砍不掉: 22 个色块 (12 棱 + 8 角 + 2 个 buffer) 用压缩音频的字母对编码, ~1.5 秒/循环 是短期听觉编码的生物下界。执行用全 3-Style + 浮动 buffer + LTCT 跑 ~50 步 @ 10 TPS = 5 秒纯执行。幸运打乱 (字母对都是熟悉的) 综合 ~6.5 秒。\n\n' +
      'Eggins 11.67 大致是 3-4 秒 memo + 7-8 秒执行, 两半都明显高于下界。100 年渐近 sub-7 秒需要 memo 在幸运字母对上压到 ~2 秒, 加上 9 TPS 跑流畅 commutator 链。换记忆系统 (空间 mind-palace 取代字母对音频) 可一次性砍掉 memo 一半 — 这是 BLD 比 3x3 视拧更不确定的原因: 记忆系统可能换代。',
    why_fit_differs_en:
      'BLD curve fit cannot capture memo-system regime shifts. A switch from letter-pair audio to spatial mind-palace would drop memo time 30-50% in a single year, which the historical trajectory has no way to anticipate.',
    why_fit_differs_zh:
      'BLD 拟合无法预见记忆系统的迭代。从字母对音频换到空间 mind-palace, memo 时间能一次性砍 30-50%, 历史轨迹完全看不到这种突变。',
    extended_sections: [
      {
        title_en: `From Pochmann to 3-Style: Two Decades of Compression`,
        title_zh: `从 Pochmann 到 3-Style: 二十年的压缩`,
        body_en: `**Stefan Pochmann** authored the original blindfolded method (now called OP/Old Pochmann) in 2003 — a 110-STM-average approach that solved corners and edges via cycle-tracking through a single setup buffer. The WR in that era was Macky Aliaga's 1:28.82 (2003). The first major compression was **M2 for edges** (M2 / R2 / Pochmann hybrid, ~2010), which used the M-slice as an implicit buffer for edge pieces, dropping the per-target cost from ~9 STM to ~6 STM.\n\n**3-Style commutators** (~2015) replaced single-buffer setup-execute-undo with three-piece cycles, halving setup overhead and pushing average STM from ~90 to ~70. The current frontier — **floating-buffer 3-Style + LTCT (Last Target Corner Twist) + per-special algorithms** — adds buffer-choice-by-scramble plus specialised algorithms for the ~50 most common 2-cycle and 3-cycle patterns, dropping average STM to ~60.\n\nTommy Cherry's 2024 sub-12 single and Charlie Eggins's 2026 11.67 single + 14.05 Mo3 (Cubing at The Cube, Sydney, January 10) reflect this compounding — twenty years took 3BLD from 1:28 to 11.67, a 7.6× ratio.`,
        body_zh: `**Stefan Pochmann** 2003 年提出最早的盲拧方法 (现称 OP/Old Pochmann) — 平均 110 STM, 通过单 setup buffer 追踪角棱循环。当年 WR 是 Macky Aliaga 1:28.82 (2003)。第一次重大压缩是 **M2 棱法** (M2 / R2 / Pochmann 混合, ~2010), M slice 当 edge piece 的隐式 buffer, 把每 target 从 ~9 STM 砍到 ~6 STM。\n\n**3-Style commutator** (~2015) 把「单 buffer + setup-execute-undo」换成 3-piece 循环, setup 开销减半, 平均 STM 从 ~90 降到 ~70。当前前沿 — **浮动 buffer 3-Style + LTCT (Last Target Corner Twist) + 特例算法** — 加上「打乱决定 buffer 选择」和最常见 50 个 2-cycle / 3-cycle 模式的专门算法, 平均 STM 降到 ~60。\n\nTommy Cherry 2024 sub-12 单次和 Charlie Eggins 2026 双 WR (11.67 单 + 14.05 Mo3, 2026-01-10 Sydney Cubing at The Cube) 是这个复利的体现 — 20 年 3BLD 从 1:28 到 11.67, 7.6 倍压缩。`,
      },
      {
        title_en: `Why 3BLD Memo Floors at ~2 Seconds, Not Zero`,
        title_zh: `为什么 3BLD memo 下界在 ~2 秒,不到零`,
        body_en: `Memorisation in 3BLD encodes **22 stickers (12 edges + 8 corners + 2 buffers)** as letter pairs in a chosen audio code (most often Speffz, an ABC...XYZ system that maps each sticker to a fixed letter). The encoding rate floor is bounded by **short-term auditory rehearsal speed** — psycholinguistic studies on phonological loops (Baddeley 1986 onward) put compressed-speech inner rehearsal at ~1.5-2 syllables per second. A letter pair is 2 syllables = 1 s minimum per pair.\n\n3BLD memo encodes ~11 letter pairs (5-6 for edges, 4-5 for corners), giving a hard floor of ~11-12 s of pure encoding even with maximum compression. Lucky scrambles (familiar letter pairs already mentally chunked into nouns or images) cut this to ~3 s; an entirely fresh, unfortunate letter-pair sequence can push memo to 8-10 s.\n\nThe sub-2-second memo on truly lucky scrambles (Cherry's 11.84 single allegedly had memo near 2 s) is the asymptotic floor. **Below 2 s requires a completely different memo system** — spatial mind-palace mapped to fixed locations, or direct visual encoding without intermediate letter-pair translation. Neither has reached production speed-cubing maturity, though both have advocates in the long-form 5BLD community.`,
        body_zh: `3BLD 记忆把 **22 色块 (12 棱 + 8 角 + 2 buffer)** 编码成字母对存进选定的音频码 (常用 Speffz: 每色块固定一个字母, ABC...XYZ 系统)。编码速度下界受 **短期听觉复述速度** 约束 — 心理语言学研究 (Baddeley 1986+) 把压缩语音内复述定在 ~1.5-2 音节/秒。一对字母 = 2 音节 = 1 秒/对最低。\n\n3BLD memo 大约 ~11 对 (棱 5-6 + 角 4-5), 纯编码硬下界 ~11-12 秒。幸运打乱 (字母对已被习惯性 chunked 成名词或图像) 砍到 ~3 秒; 全新且不顺的字母对序列可能推到 8-10 秒。\n\n真正幸运打乱上的 sub-2 秒 memo (Cherry 11.84 单次据传 memo ~2 秒) 是渐近下界。**低于 2 秒需要完全不同的记忆系统** — 空间 mind-palace 映射到固定位置、或不经字母对中介的直接视觉编码。两者都尚未在速拧产线成熟, 但在长格式 5BLD 社区有支持者。`,
      },
      {
        title_en: `The Cherry-Eggins Era and the Australia Cluster`,
        title_zh: `Cherry-Eggins 时代与澳洲群`,
        body_en: `Modern 3BLD WR holders cluster geographically. **Tommy Cherry** (USA) broke 12 in February 2024 at Triton Tricubealon, then traded the Mo3 with Charlie Eggins in 2024-2025. **Charlie Eggins** (Australia) took the single WR to 11.67 at Cubing at The Cube 2026 in Sydney — the first sub-12 single — and now shares the Mo3 record (14.05) with Cherry. Both are sub-20 years old and use floating-buffer 3-Style.\n\nAustralia has become a 3BLD hub disproportionate to its size: in addition to Eggins, **Jeff Park** (held WR singles 2018-2022), **Graham Siggins** (record holder in 4BLD/MBLD), and **Stanley Chapel** (record holder in 4BLD/5BLD Mo3, US but trained alongside Australian solvers) form a tight coaching network. The cluster effect — when peer competitive solvers train together, results compound — is unmistakable in the 2024-2026 record movement.`,
        body_zh: `现代 3BLD WR 持有者地理上聚集。**Tommy Cherry** (美) 2024 年 2 月 Triton Tricubealon 破 12, 2024-2025 与 Eggins 互换 Mo3。**Charlie Eggins** (澳) 2026-01-10 Sydney Cubing at The Cube 把单次推到 11.67 (首破 12), Mo3 14.05 与 Cherry 共持。两人都不到 20 岁, 都用浮动 buffer 3-Style。\n\n澳大利亚撑起了 3BLD 的一个中心 — 跟它的人口规模严重不成比例: 除 Eggins 外, **Jeff Park** (2018-2022 持单 WR)、**Graham Siggins** (4BLD/MBLD 记录) 和 **Stanley Chapel** (4BLD/5BLD Mo3 记录, 美国但与澳洲社区紧密训练) 形成紧密的训练网络。集群效应 — 顶级选手一起训练, 产出复利 — 在 2024-2026 记录变动中清晰可见。`,
      },
    ],
  },

  // ════════════════════════════════════════════════════════════
  //  333fm
  // ════════════════════════════════════════════════════════════
  '333fm': {
    current_method_en:
      'Modern FMC = blockbuilding + EO + Domino Reduction (DR, reduce to <U,D,R2,L2,F2,B2> subgroup, optimal DR-to-solved averages 13.58 moves) + insertions + NISS (Normal-Inverse Scramble Switch). WR single = 16 moves shared by 5 holders: Sebastiano Tronto (2019), Aedan Bryant + Levi Gibson (2024), Jacob Sherwen Brown (2024). Mean WR = 19.00 (Brian Johnson, Evanston FMC Spring 2026-05-02). Wong Chong Wen broke the first sub-20 barrier at FMCanton Nansha 2026-03-21 with 19.33. Sebastiano Tronto authored the DR revolution.',
    current_method_zh:
      '现代 FMC = blockbuilding + EO + Domino Reduction (DR, 把状态降到 <U,D,R2,L2,F2,B2> 子群, DR→solved optimal 平均 13.58 步) + 插入法 + NISS (正逆打乱互换搜)。WR 单次 = 16 步, 5 人持有: Sebastiano Tronto (2019)、Aedan Bryant + Levi Gibson (2024)、Jacob Sherwen Brown (2024)。Mo3 WR = 19.00 (Brian Johnson, Evanston FMC Spring 2026-05-02); Wong Chong Wen 在 FMCanton Nansha 2026-03-21 以 19.33 首破 20。Tronto 是 DR 革命主笔。',
    current_wr_avg_holder: 'Brian Johnson — Evanston FMC Spring 2026-05-02',
    current_wr_avg_value: 19.00,
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
      'Mean WR is now Brian Johnson 19.00 (Evanston FMC Spring 2026-05-02), with Wong Chong Wen having broken the first sub-20 mean (19.33) at FMCanton Nansha 2026-03-21. The Mo3 floor is bounded by needing three solves all near optimum; with most scrambles HTM-optimal at 18 moves and DR techniques routinely finding 17-19, sub-19 mean has now been touched and sub-18 is the next horizon. Below 17.5 mean would require either every scramble admitting ≤17 hand-finds in an hour, or a search-time breakthrough — neither has visible mechanism.',
    reasoning_zh:
      'FMC 是 WCA 中唯一一个绝对下界数学证明过的项目。Rokicki / Kociemba / Davidson / Dethridge 2010 年证明任何 3x3 态可 ≤ 20 HTM 解出, 随机打乱 HTM optimal 分布集中在 18 步 (67%) 和 17 步 (27%); 只有 2.6% 的打乱恰好需要 16 HTM, ≤ 14 步基本是测度零 (~10⁻⁵)。\n\n' +
      '16 步单次 WR 因此不是低于绝对下界, 而是落在下界尾部 — 一个恰好允许 16 步 optimal 的打乱 + 人类在 60 分钟内找到。5 人持平这个数: Tronto 2019、Bryant + Gibson 2024、Brown 2024。当前规则下单次可达下界 ~16, sub-16 需要 sub-2.6% 打乱运气叠加手搜索找到 optimal — 可能但无确定时程。\n\n' +
      'Mo3 WR 现在是 Brian Johnson 19.00 (Evanston FMC Spring 2026-05-02); Wong Chong Wen 在 FMCanton Nansha 2026-03-21 用 19.33 首破 20。Mo3 下界受「3 把都接近 optimal」约束; 大多数打乱 HTM optimal 是 18 步, DR 技术常找到 17-19 步, sub-19 已被触达, 下一个目标是 sub-18。低于 17.5 平均需要每把打乱都允许 ≤17 步手搜或者搜索时间技术突破, 目前没有可见机制。',
    why_fit_differs_en:
      'FMC is the only event where the curve fit is structurally inappropriate. The fit treats trajectory as continuous; FMC is integer-valued with a proven mathematical lower bound. Curve L is meaningless here — use the integer floor (16 single, ~17.5 mean) instead.',
    why_fit_differs_zh:
      'FMC 是唯一一个曲线拟合在结构上不合适的项目。拟合把轨迹当连续值, 但 FMC 是整数取值且有已证明的数学下界。L 在这里没有意义, 直接用整数下界 (16 单次, ~17.5 平均)。',
    extended_sections: [
      {
        title_en: `God's Number, Proven: 20 HTM Is the Wall`,
        title_zh: `God's Number 已证明: 20 HTM 是墙`,
        body_en: `Tomas Rokicki, Herbert Kociemba, Morley Davidson, and John Dethridge proved in 2010 that every reachable 3x3 state is solvable in **≤ 20 HTM** (face-turn metric). The proof exhausted the 43 quintillion-state graph using 35 CPU-years donated by Google, partitioning by cosets of a 16-million-state subgroup. The result: God's number is exactly 20 HTM; the proof is computer-assisted but verifiable.\n\nThe HTM-optimal distribution is heavily concentrated at the upper end:\n\n- **18 HTM**: 67.4% of scrambles\n- **17 HTM**: 27.1%\n- **19 HTM**: 4.8%\n- **20 HTM**: 0.0006% (only ~300 trillion of 4.3 × 10^19 states)\n- **16 HTM**: 0.5%\n- **≤ 15 HTM**: ~10^-5 (vanishingly rare)\n\nThe current FMC WR single is **16 moves**, shared by 5 holders. This is not below the math floor — it sits inside the 0.5% tail of scrambles that admit a 16-HTM optimal AND was found by a human in 60 minutes of search. Below 16 requires both rare scramble luck and a search-time breakthrough.`,
        body_zh: `Tomas Rokicki / Herbert Kociemba / Morley Davidson / John Dethridge 2010 年证明每个可达 3x3 态可 **≤ 20 HTM** 解出 (face-turn metric)。证明枚举 4.3 × 10^19 态图, 用 Google 捐赠的 35 CPU 年算力, 按 1600 万态子群陪集划分。God's number 恰为 20 HTM, 计算机辅助证明可验证。\n\nHTM optimal 分布高度集中在上端:\n\n- **18 HTM**: 67.4% 的打乱\n- **17 HTM**: 27.1%\n- **19 HTM**: 4.8%\n- **20 HTM**: 0.0006% (4.3 × 10^19 态中仅 ~3 × 10^14 个)\n- **16 HTM**: 0.5%\n- **≤ 15 HTM**: ~10^-5 (基本不存在)\n\n当前 FMC WR 单次 **16 步**, 5 人共持。这不是低于数学下界, 而是落在 0.5% 尾部 — 允许 16 步 optimal 的打乱 + 人类 60 分钟内找到 optimal 的双重幸运。低于 16 既需要罕见的打乱运气, 又需要搜索时间突破。`,
      },
      {
        title_en: `The Five-Holder Pile-Up at 16`,
        title_zh: `16 步 5 人共持的堆积`,
        body_en: `The current FMC single WR of **16 moves** is shared by:\n\n- **Sebastiano Tronto** (Italy) — 2019, the original holder, used Domino Reduction (DR) which he authored\n- **Aedan Bryant** (USA) — 2024\n- **Levi Gibson** (USA) — 2024\n- **Jacob Sherwen Brown** (UK) — 2024\n- (One additional holder tied during 2024-2025; total 5 cubers at 16)\n\nThe fact that **three new ties appeared in 2024 after five years of Tronto-only standing** is the cleanest signal of method maturity: when a record can suddenly be tied by multiple solvers in one year, the bottleneck has moved from method to scramble luck. DR plus NISS (Normal-Inverse Scramble Switch, dual-direction search) plus per-cuber insertion alg databases have converged.\n\nThe Mo3 WR is now Brian Johnson 19.00 at Evanston FMC Spring 2026-05-02, after Wong Chong Wen broke the first sub-20 Mo3 (19.33 at FMCanton Nansha 2026-03-21) just six weeks earlier. Both show the same pattern: averaged across three scrambles, even an elite solver hits 18-21 HTM per scramble, and 19-mean territory is realistically the lower 80% of method-applied search outcomes. Sub-19 Mo3 has now been hit; sub-18 requires three sub-19 outcomes in succession, with at least one ~17-HTM lucky scramble.`,
        body_zh: `当前 FMC 单次 WR **16 步** 5 人共持:\n\n- **Sebastiano Tronto** (意) — 2019 原始持有, 用他本人主笔的 Domino Reduction (DR)\n- **Aedan Bryant** (美) — 2024\n- **Levi Gibson** (美) — 2024\n- **Jacob Sherwen Brown** (英) — 2024\n- (2024-2025 期间再有一人持平; 总数 5)\n\n2024 一年里就有 3 人新平了 Tronto 独持五年的记录, 这是方法已经成熟的最明确信号: 一个记录突然能被多名选手在同年持平, 瓶颈就从方法转到打乱运气。DR + NISS (正逆打乱互换搜) + 每位选手的插入算法库已经收敛。\n\nMo3 WR 现在是 Brian Johnson 19.00 (Evanston FMC Spring 2026-05-02), Wong Chong Wen 早六周以 19.33 在 FMCanton Nansha 2026-03-21 首破 20。两者同样模式: 3 把平均, 顶级选手每把 18-21 HTM, 19 mean 是方法应用下 80% 分位结果。Sub-19 已达成; sub-18 需要 3 把连续 sub-19, 且至少 1 把 ~17 HTM 幸运打乱。`,
      },
      {
        title_en: `Domino Reduction: Why DR Changed Everything`,
        title_zh: `Domino Reduction: 为什么 DR 改变一切`,
        body_en: `**Domino Reduction** (DR) reduces a 3x3 to the subgroup <U, D, R2, L2, F2, B2> — equivalent to a Square-1 cubeshape where only U/D quarter turns and R2/L2/F2/B2 half-turns are allowed. Once in DR, optimal-to-solved averages **13.58 STM** with a max of 18 STM (proven exhaustively).\n\nThe FMC trick is: searching from scramble to DR with arbitrary HTM (typically 7-11 STM), then DR-to-solved optimal (12-14 STM), often gives a 16-20 HTM solution depending on how lucky the DR phase entered. NISS (Normal-Inverse Scramble Switch) doubles the search space by running the same DR search on the inverse scramble — a 16-HTM solution found on either side counts. **Block-building + EO** before DR adds another layer: a clean EO state can shrink the DR phase to 7-8 STM with optimal-route advantage.\n\nThe modern FMC competitor's hour-long search session looks like: 10 min on scramble notation + EO direction + initial blockbuilding; 30 min on DR finding with NISS; 20 min on insertion optimisation. The integer floor of 16 emerges naturally from this pipeline; below it requires the ≤15-HTM scramble (1-in-20,000) plus optimal find under time pressure.`,
        body_zh: `**Domino Reduction** (DR) 把 3x3 降到子群 <U, D, R2, L2, F2, B2> — 等价于 Square-1 cubeshape, 只允许 U/D 1/4 转和 R2/L2/F2/B2 半转。一旦进入 DR, DR → solved optimal 平均 **13.58 STM**, 最大 18 STM (穷举证明)。\n\nFMC 的诀窍是: 打乱 → DR 用任意 HTM (通常 7-11 STM) 搜索, DR → solved optimal (12-14 STM), 根据 DR 进入的幸运程度合计 16-20 HTM。NISS (正逆打乱互换搜) 把搜索空间翻倍 — 同一 DR 搜索在逆打乱上跑一遍, 任一侧找到 16 HTM 都算。**Block-building + EO** 在 DR 之前再加一层: 干净 EO 状态能把 DR 阶段缩到 7-8 STM。\n\n现代 FMC 选手 1 小时回合看起来是: 10 分钟打乱解读 + EO 方向 + 初始 blockbuilding; 30 分钟带 NISS 找 DR; 20 分钟优化插入。16 步整数下界从这个流水线自然涌现, 低于它需要 ≤15 HTM 打乱 (1/20000) + 时间压力下找 optimal。`,
      },
    ],
  },

  // ════════════════════════════════════════════════════════════
  //  444bf
  // ════════════════════════════════════════════════════════════
  '444bf': {
    current_method_en:
      'Full 3-Style across centers + wings + edges + corners + parity. Stanley Chapel (51.96 single 2023, 59.39 Mo3 2025 — first sub-1:00 mean ever) uses floating buffers across all four orbits.',
    current_method_zh:
      '中心 + 翼棱 + 棱 + 角 + parity 全 3-Style。Stanley Chapel (51.96 单 2023, 59.39 Mo3 2025 — 史上首破 1 分钟 Mo3) 在四种 piece 都用浮动 buffer。',
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
      '4BLD 与 3BLD 同样是两阶段结构, 但 piece orbit 从 2 种扩到 5 种。中心、翼、棱、角、parity 各自要走字母对 (共 ~28) 跟 commutator 执行 (~140 STM 顶级)。记忆主导: 顶级 25-30 秒 vs 5 TPS commutator 执行 25-30 秒。Chapel 51.96 大致是 memo 22 秒 + exec 30 秒。\n\n' +
      '记忆与执行下界来源不同。Memo 在幸运打乱上 ~12 秒 (28 字母对 × 0.4 秒最低编码); 执行 ~18 秒 (140 STM @ 7 TPS, 纯 commutator 无中转步)。综合 30 秒是单次绝对下界, 38-42 秒是 Mo3 现实下界。Chapel 在 4BLD + 5BLD 双项目垄断, 反映出「快 memo + 灵活执行」双技能稀有度。',
    extended_sections: [
      {
        title_en: `Stanley Chapel's Cross-Cube Monopoly`,
        title_zh: `Stanley Chapel 的跨项目垄断`,
        body_en: `**Stanley Chapel** (USA, born 2002) holds both the 4BLD single (51.96 s, 2023) and the 4BLD Mo3 (59.39 s, NY Multimate PBQ II 2025 — the first sub-1:00 4BLD mean ever). He also holds 5BLD records — 1:58.59 single 2026 and 2:27.63 Mo3 2019 (the latter has stood unbroken since). He is the only solver in history with simultaneous 4BLD + 5BLD single + Mo3 WRs.\n\nThe explanation is structural. 4BLD and 5BLD share execution technique (full floating-buffer 3-Style across 5 piece orbits) and memo system (Speffz extended to wings/centers/midges). A solver who masters one transfers ~80% of the technical preparation to the other; what remains is event-specific working-memory training — keeping 28 letter pairs (4BLD) or 46 letter pairs (5BLD) ordered for retrieval during execution. Chapel has trained both simultaneously since ~2018 and the dual monopoly reflects a training-volume moat that no current competitor matches.`,
        body_zh: `**Stanley Chapel** (美, 2002 年生) 同时持 4BLD 单次 (51.96 秒, 2023) 和 4BLD Mo3 (59.39 秒, NY Multimate PBQ II 2025 — 史上首破 1 分钟 4BLD 平均)。5BLD 记录也是他 — 单 1:58.59 (2026) 和 Mo3 2:27.63 (2019, 至今未破)。是历史上唯一一个同时持有 4BLD + 5BLD 单 + Mo3 全部 WR 的选手。\n\n解释是结构性的。4BLD 与 5BLD 共享执行技术 (五种 piece orbit 全浮动 buffer 3-Style) 和记忆系统 (Speffz 扩展到 wing / center / midge)。掌握一项的选手, ~80% 技术准备可迁移到另一项, 剩下的是项目专属工作记忆训练 — 让 28 字母对 (4BLD) 或 46 对 (5BLD) 在执行期间保持有序可调用。Chapel 自 2018 同时训练两项, 双垄断反映了当前无人匹敌的训练量护城河。`,
      },
      {
        title_en: `The Five-Orbit Problem`,
        title_zh: `五 orbit 问题`,
        body_en: `4BLD requires tracking pieces across **five orbits**: corners (8 pieces), edges (24 wings + 24 midges grouped as 12 dedges), centers (24), wings (24), and parity. Compared to 3BLD's two orbits (corners + edges), the cognitive load is not 2.5× but ~4× because letter-pair encoding interferes between orbits — a U-sticker that means "B" on a corner and "F" on a wing creates cross-orbit confusion that pure 3BLD never has.\n\nThe technical answer is **per-orbit letter schemes**. Top 4BLD solvers use Speffz for corners but switch to position-based or visual-relative schemes for wings and centers. Memo phase order matters: solvers typically encode corners first (most error-prone, simplest), then wings (most numerous), then centers, then edges last (most familiar). Execution order is inverted — edges first while the corner-encoded loop is still fresh.\n\nThis layered architecture took ~15 years (2010-2025) to converge on the current Chapel-style approach. The next plausible compression is a **unified visual scheme** that encodes the whole cube as one mind-palace rather than five overlaid letter sets; if it works, memo could drop 30%.`,
        body_zh: `4BLD 要跟踪 **五种 orbit**: 角 (8 块)、棱 (24 wing + 24 midge, 组成 12 dedge)、中心 (24)、wing (24)、parity。相对 3BLD 两种 orbit (角 + 棱), 认知负荷不是 2.5x 而是 ~4x, 因为字母对编码在 orbit 间干扰 — 同一张 U 贴在角上是「B」在 wing 上是「F」, 纯 3BLD 永远没有这种跨 orbit 混乱。\n\n技术答案是 **per-orbit 字母方案**。顶级 4BLD 用 Speffz 给角, wing / 中心改用位置或视觉相对方案。记忆阶段顺序也重要: 通常先编码角 (最易错, 最简单)、然后 wing (数量最多)、然后中心、最后棱 (最熟)。执行顺序相反 — 棱先, 趁角编码 loop 还鲜活。\n\n这种分层架构花了 ~15 年 (2010-2025) 才收敛到当前 Chapel 风格。下一个可能的压缩是 **统一视觉方案**: 整个魔方当一个 mind-palace 而非五重叠字母集; 如果走通, memo 能砍 30%。`,
      },
    ],
  },

  // ════════════════════════════════════════════════════════════
  //  555bf
  // ════════════════════════════════════════════════════════════
  '555bf': {
    current_method_en:
      'Full floating-buffer 3-Style across five orbits: corners, wings, midges, +centers, X-centers. Stanley Chapel monopolizes (1:58.59 single 2026 — first-ever sub-2:00; 2:27.63 Mo3 2019 — most enduring active BLD record). Midge memo is the recognition bottleneck.',
    current_method_zh:
      '五种 piece (角 / 翼 / midge / +中心 / X 中心) 全浮动 buffer 3-Style。Chapel 垄断 (1:58.59 单次 2026 — 史上首破 2 分钟; 2:27.63 Mo3 2019 — 现役 BLD 最久未破)。midge 识别是瓶颈。',
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
      '5BLD 把 memo 瓶颈推过了短期工作记忆的生物舒适区。92 色块跨 5 种 orbit ≈ 46 字母对; 即便压到 1.2 秒 / 对的音频速率, 光 memo 就 55 秒 — 而且第 40-50 个字母对的回忆准确率会非线性下降, 因为前段的字母对在工作记忆里会干扰后段。\n\n' +
      'Mo3 自 2019 至今没破过 (Chapel 2:27.63, 已 7 年), 是 BLD 分析里最值得看的一个数据点。约束他的不是执行速度 (Chapel 单次在改进), 而是准确率 — 连续 3 次无错的 92 色块记忆超出了 5BLD 训练能达到的工作记忆天花板。Sub-1:30 单次在 2030 年左右可达 (memo 35 + exec 50); sub-2:00 平均需要换 memo 系统 (mind-palace) 或持续认知训练抬高工作记忆本身。',
    extended_sections: [
      {
        title_en: `The 7-Year-Stagnant Mean: A Cognitive Ceiling`,
        title_zh: `7 年未破的 Mo3: 一个认知天花板`,
        body_en: `Chapel's **5BLD Mo3 of 2:27.63** set at Michigan Cubing Club Epsilon in 2019 has stood unbroken for 7 years — the longest active record stagnation in any non-FMC WCA event. During the same 7 years his **single** has improved from ~2:30 to 1:58.59 (the first-ever sub-2:00 5BLD single, 2026), a 22% drop. The gap is informative.\n\nThe explanation: **5BLD memo of 92 stickers exceeds reliable working-memory capacity**. A single attempt has ~85% accuracy at Chapel's speed; the cube state needs all 92 letter pairs correctly encoded, mid-execution recall stays accurate, and no slip in the 280-STM commutator chain. A Mo3 requires three such attempts in succession — joint accuracy ~85%^3 = 61%. Push for faster memo and accuracy drops further; pull back for safety and time inflates.\n\nThe ceiling will break either by (a) **dual-cube training** with planted distractor memos (proven to expand working memory ~20% in psycholinguistic studies) or (b) a **method change** that reduces letter-pair count via direct spatial encoding. Neither has produced a competitive solver yet.`,
        body_zh: `Chapel **5BLD Mo3 2:27.63** (Michigan Cubing Club Epsilon 2019) 7 年未破 — WCA 非 FMC 项目最长有效停滞。同期他**单次**从 ~2:30 改进到 1:58.59 (2026 史上首破 5BLD 2 分钟), 压缩 22%。差距有信息量。\n\n解释: **5BLD 记忆 92 色块超出可靠工作记忆容量**。单次尝试 Chapel 速度下 ~85% 准确率: 92 个色块字母对全编码正确、执行期回忆准确、280 STM commutator 链不出错。Mo3 要 3 把连续都做到, 联合准确率 ~85%³ = 61%。memo 加速 → 准确率更降; 为安全减速 → 时间膨胀。\n\n要捅破这个天花板, 要么 (a) **双魔方训练** 加上人为的干扰记忆 (心理语言学研究证明能扩展工作记忆 ~20%), 要么 (b) **方法改变** 通过直接空间编码减少字母对数量。两条路都还没出过具竞争力的选手。`,
      },
      {
        title_en: `What "First Sub-2" Actually Means`,
        title_zh: `「首破 2 分钟」到底意味着什么`,
        body_en: `5BLD's first-ever sub-2:00 single (Chapel 1:58.59 in 2026) is structurally similar to 3x3's first-ever sub-3:00 single (Zajder 2.76 in 2026 — same year, different magnitude). Both happen when **decades of incremental compression converge with one optimal attempt**.\n\nFor 5BLD specifically, the milestone signals that **execution can outpace memo** — Chapel's 1:58.59 reportedly had memo ~50 s and execution ~70 s, where as recently as 2022 execution alone took 80-90 s. The commutator chains are now efficient enough that the bottleneck is unambiguously memo speed × memo reliability.\n\nNext milestones: sub-1:50 single (achievable if Chapel finds a lucky-letter-pair scramble, ~2027); sub-1:40 single (requires sub-40 s memo, plausible by 2030); sub-1:30 single (asymptotic — requires either memo-system breakthrough or working-memory training transfer from cognitive-science research, decade-scale).`,
        body_zh: `5BLD 史上首次单次破 2:00 (Chapel 2026 年 1:58.59) 在结构上类似 3x3 史上首次单次破 3:00 (Zajder 2026 年 2.76 — 同年, 不同量级)。两者都发生在 **数十年增量压缩与一次最优尝试汇合**。\n\n对 5BLD 来说, 这个里程碑说明 **执行已能跑过记忆** — Chapel 1:58.59 据传 memo ~50 秒, 执行 ~70 秒; 而 2022 年执行单独就要 80-90 秒。Commutator 链已经够高效, 瓶颈明确是 memo 速度 × memo 可靠性。\n\n下个里程碑: sub-1:50 单 (Chapel 抽到幸运字母对打乱, ~2027); sub-1:40 单 (要求 sub-40 秒 memo, 2030 前后可达); sub-1:30 单 (渐近 — 需要 memo 系统突破或从认知科学研究迁移工作记忆训练, 十年尺度)。`,
      },
    ],
  },

  // ════════════════════════════════════════════════════════════
  //  pyram
  // ════════════════════════════════════════════════════════════
  'pyram': {
    current_method_en:
      'V-first (one V = 3 edges + 3 centers, then last 4 edges) + intuitive last layer is universal. Top cubers (Simon Kellum 0.73 single 2023, Lingkun Jiang 1.14 Ao5 2025, Dominik Górny, Akira Hattori) plan the entire ≤11-move solution during 15s inspection. Pyraminx is the only WCA event where "inspection-optimal" is human-achievable.',
    current_method_zh:
      'V-first (一个 V 块 = 3 棱 + 3 中心, 再解后 4 棱) + 直觉 LL。顶级 (Kellum 0.73 单 2023, Jiang 1.14 Ao5 2025, Górny, Hattori) 在 15 秒观察内全程规划 ≤11 步解。金字塔是唯一一个「观察-最优」人类可达的 WCA 项目。',
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
      '金字塔是唯一一个「观察-最优」人类可达的 WCA 项目。状态空间仅 93 万 (非平凡态), God\'s number 11 HTM, 平均 optimal 8.36 步。顶级 — Kellum、Górny、Hattori、Brads、Jiang — 在 15 秒观察内规划完整 ≤11 步解。执行期识别归零, 剩下的就是 StackMat 包络下的纯物理执行。\n\n' +
      '剩余空间由两件事框定: 打乱运气 (6 步 optimal 大约 1/200 概率) 和手指敲击生物力学 (轻量金字塔上 20-22 Hz 上限)。组合: 6 步打乱 × 22 TPS + 0.1 秒反应 = 0.37 秒绝对下界。100 年渐近更接近 0.55 秒 (基于 8 步解)。从方法层面看, 金字塔已经基本走到头, 后续 WR 要降只能靠更幸运的打乱 + 些微硬件提升, 不会再有新技术拐点。',
    extended_sections: [
      {
        title_en: `The Inspection-Optimal Phenomenon`,
        title_zh: `Inspection-optimal 现象`,
        body_en: `Pyraminx is **the only WCA event where humans can routinely plan the entire optimal solution during the 15-second inspection**. The state space has just 933,120 non-trivial positions (a few orders of magnitude smaller than 2x2's 3.67 million), God's number is 11 HTM, and the average optimal is 8.36 moves — a tractable number to enumerate visually.\n\nElite Pyraminx solvers (Kellum, Drew Brads, Dominik Górny, Lingkun Jiang) train inspection-vision: scanning a Pyraminx and producing a ≤9-move solution sequence within ~10 seconds, leaving 5 seconds of buffer for execution priming. The technique is closer to chess tactics-puzzle solving than to typical scrambling — it requires pattern recognition libraries (build "V" + 4 remaining edges) that the solver consults consciously.\n\nThis structural feature means **scramble luck is the entire game**. A 6-move optimal appears ~1-in-200 attempts; a 7-move optimal ~1-in-30. Below 0.7 s WR solves, the variance source is "did the inspection produce a 6-or-7-move plan AND did execution have no fumble" — pure compound luck.`,
        body_zh: `金字塔是 **WCA 中唯一一个人类可以常规在 15 秒观察内规划全 optimal 解**的项目。状态空间仅 933,120 个非平凡态 (比 2x2 367 万小几个数量级), God's number 11 HTM, 平均 optimal 8.36 步 — 视觉可枚举的量级。\n\n顶级金字塔选手 (Kellum / Drew Brads / Dominik Górny / Lingkun Jiang) 训练观察视觉: 扫一遍 Pyraminx, ~10 秒内产出 ≤9 步解, 留 5 秒缓冲准备执行。这种技术更像国际象棋战术题求解, 而非典型打乱 — 需要模式识别库 (建「V」+ 剩 4 棱), 选手主动调用。\n\n这种结构特性意味着 **打乱运气就是全部**。6 步 optimal ~1/200 出现; 7 步 ~1/30。低于 0.7 秒 WR, 方差来自「观察产出了 6-7 步方案 AND 执行无失误」复合运气。`,
      },
      {
        title_en: `Hardware-Driven Hardware Endgame`,
        title_zh: `硬件主导的硬件终局`,
        body_en: `Pyraminx hardware has converged on a small set of magnetic flagships: MoYu Magnetic / X-Man Bell V2 / QiYi MS. The MoYu **Weilong Magnetic Pyraminx** (used in Kellum's 0.73 s WR) and the **X-Man Bell V2** represent the current mass-market peak. Each generation since 2018 has dropped the unsprung mass by ~5-8% and added more refined magnet positioning.\n\nThe next hardware question is whether a **rigid-tip variant** (eliminate the 3 trivial corner-flip moves that humans currently dismiss as "free") could appear in WCA-legal form. Today's Pyraminx allows free tip rotation that contributes to the 933,120-state space; if tips were locked, the effective state space drops by 81 and average optimal HTM might fall to ~7.5 — a 10% time reduction at the WR scale. WCA legality is the bottleneck: such a variant would require a regulation amendment.\n\nLacking that, the path forward is incremental hardware tuning to push sustained TPS from 14 to 18, and continued scramble-luck hunting. Sub-0.5 s singles are mathematically possible (5-move scramble × 22 TPS + 0.1 = 0.33 s) but require ~1-in-1000 scrambles.`,
        body_zh: `金字塔硬件收敛在少数磁铁旗舰: MoYu Magnetic / X-Man Bell V2 / QiYi MS。MoYu **威龙磁铁金字塔** (Kellum 0.73 WR 用) 和 **X-Man Bell V2** 是当前量产顶级。2018 以来每代未带簧质量降 ~5-8%, 磁铁位置更精细。\n\n下一个硬件问题是 **刚性顶角变种** (把现在被视作「白送」的三个 tip 旋转锁死) 能不能被 WCA 收编。现有金字塔允许 tip 自由旋转, 贡献了 933,120 状态; tip 锁死后有效状态空间砍 81 倍, 平均 optimal HTM 可能降到 ~7.5 — WR 尺度上 10% 时间减少。WCA 合法性是瓶颈: 这种变种要规则修订。\n\n没有规则改变, 前进路径是硬件渐进调优把持续 TPS 从 14 推到 18, 加持续打乱运气狩猎。Sub-0.5 秒单次数学上可能 (5 步打乱 × 22 TPS + 0.1 = 0.33 秒) 但需 ~1/1000 的打乱。`,
      },
    ],
  },

  // ════════════════════════════════════════════════════════════
  //  skewb
  // ════════════════════════════════════════════════════════════
  'skewb': {
    current_method_en:
      'Sarah\'s Advanced (134 L2L cases) was orthodox until ~2023. The new frontier is TCLL (Twisted Corner Last Layer, ~1080 cases / ~360 algs after pseudo handling). Vojtěch Grohmann used TCLL for the WR single 0.73 (Głuszyca Open 2026-03-07). Average WR 1.37 (Ignacy Samselski 2025) typically still uses Sarah\'s.',
    current_method_zh:
      'Sarah\'s Advanced (134 L2L cases) 是 ~2023 之前的正统。新前沿是 TCLL (Twisted Corner Last Layer, ~1080 cases / 假态合并后 ~360 algs)。Vojtěch Grohmann 用 TCLL 创下 WR 单次 0.73 (Głuszyca Open 2026-03-07)。Ao5 WR 1.37 (Samselski 2025) 多用 Sarah\'s。',
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
      { person: 'Vojtěch Grohmann', date: '2026-03-07', time: '0.73 s', M: 10, TPS: 14.2, method: 'TCLL — Głuszyca Open 2026', source_url: 'https://www.speedsolving.com/threads/0-73-skewb-wr-single-by-vojt%C4%9Bch-grohmann.96474/' },
    ],
    reasoning_en:
      'Skewb has 3.15M states with God\'s number 11 STM and average optimal 8.36 moves — slightly larger state space than Pyraminx but the same "fully plannable in inspection" property for first layer. The novel structural feature is TCLL (Twisted Corner Last Layer, ~1080 cases reduced to ~360 algs after pseudo-handling), which Grohmann used for the WR single 0.73 in March 2026 — the first method-driven WR drop in years.\n\n' +
      'Scramble luck dominates the variance. A TCLL skip case is 7 STM; a 5-fold case is 13 STM. That 6-move spread translates to 0.3-0.4 s of solve time, which is more than the entire remaining headroom. The 100-year asymptote at 9 STM × 18 TPS + 0.1 = 0.6 s is achievable on average lucky scrambles; the absolute floor at 7 STM × 20 TPS + 0.1 = 0.45 s requires the rare TCLL skip to coincide with peak biomechanics. Like Pyraminx, Skewb is approaching the regime where further drops come from luck, not technique.',
    reasoning_zh:
      '斜转状态空间 315 万, God\'s number 11 STM, 平均 optimal 8.36 步 — 比金字塔略大但同样「第一层观察内可全规划」的特性。结构上的新东西是 TCLL (Twisted Corner Last Layer, ~1080 cases, 假态合并后 ~360 algs), Grohmann 2026 年 3 月用它创下 0.73 WR — 多年来首个方法驱动的 WR 下降。\n\n' +
      '打乱运气主导方差。TCLL skip 情况是 7 STM, 5-fold 情况是 13 STM, 6 步差对应 0.3-0.4 秒, 比剩余空间还大。100 年渐近 = 9 STM × 18 TPS + 0.1 = 0.6 秒, 在普通幸运打乱上可达; 绝对下界 = 7 STM × 20 TPS + 0.1 = 0.45 秒, 需要 TCLL skip 与峰值生物力学同时发生。和金字塔一样, 斜转正进入「再降只能靠运气, 不靠技术」的阶段。',
    extended_sections: [
      {
        title_en: `The TCLL Revolution`,
        title_zh: `TCLL 革命`,
        body_en: `**Twisted Corner Last Layer (TCLL)** is the first method-driven Skewb WR improvement in years. The premise: instead of Sarah's Advanced's 134 L2L (last 2 layers) cases starting from a "centers + 1 face" state, TCLL handles a more general "centers + face possibly with twisted corner" state that arises ~50% of the time. The full set is ~1080 cases, reduced to ~360 algorithms after pseudo-corner handling (recognising that twisted-corner cases up to a y rotation share execution).\n\n**Vojtěch Grohmann** (Czechia) used TCLL for the 0.73 s WR single at Głuszyca Open 2026-03-07. Before TCLL, Skewb had been stuck in a Sarah's Advanced plateau since ~2018, with WR drops driven by hardware (X-Man Wingy / GAN Skewb MagLev) rather than method. TCLL's 0.5-1 s saving on the 50% of scrambles where it applies is the largest method-driven improvement on Skewb since Sarah's Advanced itself.\n\nThe trade-off: TCLL requires ~6 months to learn the 360-algorithm set and another 3 months to gain reliable recognition. As of 2026 only a handful of solvers have committed; expect Skewb top-10 to convert over 2026-2028.`,
        body_zh: `**Twisted Corner Last Layer (TCLL)** 是多年来第一个方法驱动的 Skewb WR 改进。前提: 不是 Sarah's Advanced 那 134 个 L2L (后 2 层) 情况从「中心 + 1 面」开始, TCLL 处理更广义的「中心 + 面可能含扭角」状态 (~50% 概率出现)。完整集 ~1080 情况, 经假角处理 (识别 y 旋转下扭角情况共享执行) 简化到 ~360 算法。\n\n**Vojtěch Grohmann** (捷克) 2026-03-07 Głuszyca Open 用 TCLL 创下 0.73 秒 WR 单次。TCLL 之前, Skewb 自 ~2018 起卡在 Sarah's Advanced 平台, WR 改写靠硬件 (X-Man Wingy / GAN Skewb MagLev) 而非方法。TCLL 在 50% 适用打乱上省 0.5-1 秒, 是 Skewb 自 Sarah's Advanced 以来最大的方法驱动改进。\n\n代价: TCLL 要 ~6 个月学完 360 算法, 再 ~3 个月练到稳定识别。2026 年只有少数选手转过来; 预计 2026-2028 期间 Skewb top-10 普遍切换。`,
      },
      {
        title_en: `Why Skewb Looks Like Pyraminx but Solves Differently`,
        title_zh: `Skewb 长得像金字塔但解法不一样`,
        body_en: `Both Skewb and Pyraminx are 3D corner-twist puzzles with similar state-space scale (3.15M vs 933K) and similar God's number (11 vs 11 HTM). Both reward inspection-first solving. But the two **diverge sharply on first-layer planning**:\n\n- **Pyraminx** has a "V" structure (3 edges + 3 centers in one face's neighbourhood) that admits an intuitive ≤4-move first layer. Inspection-optimal is feasible because the first 4 moves are visually obvious.\n- **Skewb** has corner-twist semantics — every move rotates 4 corners in a coupled cycle. There's no intuitive "first 4 moves" because every move affects 4 of the 8 corners. Inspection planning is more like 3x3 cross planning: a ~6-move first-face solution requires algorithm recognition, not pure visual scanning.\n\nThe result is that Skewb sub-1 second territory is governed by **TCLL recognition speed**, not inspection-optimal planning. A solver can have a perfect first-face plan but still hit 1.5 s if recognition of the 1080 LL states is slow. This is why TCLL hasn't yet matched the 100% adoption that V-first achieved in Pyraminx by 2022.`,
        body_zh: `Skewb 和金字塔都是 3D 扭角拼图, 状态空间相近 (315 万 vs 93 万), God's number 都是 11 HTM, 都奖励观察优先解法。但 **第一层规划上两者大不同**:\n\n- **金字塔** 有「V」结构 (一个面附近 3 棱 + 3 中心), 允许直觉式 ≤4 步第一层。观察-最优可行, 因为前 4 步视觉显而易见。\n- **Skewb** 是扭角语义 — 每步同时转 4 个角的耦合循环。没有直觉的「前 4 步」, 每步都影响 8 角中的 4 个。观察规划更像 3x3 cross 规划: ~6 步第一面要靠算法识别, 不是纯视觉扫描。\n\nSkewb 想破 1 秒, **TCLL 识别速度** 才是关键, 不是观察-最优规划。选手即便第一面规划完美, 1080 个 LL 状态识别慢, 也会到 1.5 秒。这就是为什么 TCLL 没像金字塔的 V-first 那样到 2022 年达到 100% 普及。`,
      },
    ],
  },

  // ════════════════════════════════════════════════════════════
  //  sq1
  // ════════════════════════════════════════════════════════════
  'sq1': {
    current_method_en:
      'Vandenbergh (Cubeshape → CO → CP → EO → EP) is universal foundation. Top cubers add CSP (Cubeshape Parity, Brandon Lin ~2015) to predict slice parity in inspection, then Lin Method + PLL+1 / 1LLL fragments. Hassan Khanani 3.40 single (Steel City Sprint 2026), Sameer Aggarwal 4.63 Ao5 (2025).',
    current_method_zh:
      'Vandenbergh (cubeshape → CO → CP → EO → EP) 是通用基础。顶级叠加 CSP (Cubeshape Parity, Brandon Lin ~2015, 观察期间预判 slice parity), 进一步用 Lin + PLL+1 / 1LLL 局部。Hassan Khanani 3.40 单 (Steel City Sprint 2026), Aggarwal 4.63 Ao5 (2025)。',
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
      'Square-1 在 WCA 项目家族里独特: 它是切片绑定而非面绑定。每一步 /、U、D 都需要两半精准对齐才能旋转, 错位要 0.1-0.2 秒回正, 即便最好的磁铁 SQ1 (X-Man Volt V2 UD) 持续 TPS 也只到 ~10。对比面转拼图 15-18 TPS, 50% 差距是机械而非生理。\n\n' +
      '方法上仍在演进。Vandenbergh + CSP (Brandon Lin 2015 提出的 cubeshape-parity 预判) 把平均从 ~6 秒压到 sub-5; 下一档跳是全 1LLL — Khanani / Aggarwal 当前用其碎片的 ~400 算法 LL 库。1LLL 全面普及后平均步数从 ~22 降到 ~18 STM, 叠加切片机构小幅改进, 得到 ~2.5 秒现实下界。绝对下界 14 STM × 12 TPS + 0.3 = 1.47 秒需要 cubeshape skip + PLL skip 同时, 大约 1/10⁴ 概率。',
    extended_sections: [
      {
        title_en: `The Only Slice-Bound Puzzle in WCA`,
        title_zh: `WCA 里唯一 slice-bound 的拼图`,
        body_en: `Square-1 (officially Cube 21, designed by Karel Hršel and Vojtěch Kopský in 1992) is the only WCA puzzle where the movement primitive is not a **face turn** but a **slice cut**. The cube exists in three layers — top, middle, bottom — separated by a horizontal slice that can only rotate when both halves are aligned (the cubeshape is "flat" at the equator). The U and D moves rotate top and bottom independently; the / move flips left and right halves around the equatorial slice.\n\nThis has consequences. **Cubeshape** changes between states — the cube can be flat, kite-shaped, scallop-shaped, etc., and reaching the next slice-flip requires aligning to a flat shape first. Cubeshape recognition is the first phase of every Square-1 solve, and Brandon Lin's 2015 **Cubeshape Parity (CSP)** technique — predicting whether the cubeshape phase will end with parity already-resolved or not — is the most distinctive Square-1 method advance of the modern era.\n\nThe slice-bound primitive caps TPS at ~10 because every cut requires sub-millimetre alignment. Face-turn puzzles achieve 15-18 TPS because face rotations are forgiving — a face can rotate even when the next move's grip is wrong; a Square-1 slice cannot.`,
        body_zh: `Square-1 (官方名 Cube 21, Karel Hršel + Vojtěch Kopský 1992 设计) 是 WCA 中唯一一个动作原语不是 **面转** 而是 **切片** 的拼图。整体分三层 — 上 / 中 / 下, 中层是水平切片, 只有两半对齐 (赤道处 cubeshape 为「扁平」) 时才能转。U 和 D 独立转上下, / 沿赤道翻转左右半。\n\n后果有两面。**Cubeshape** 在不同态间变化 — 整体可以扁平 / 风筝 / 扇贝形, 到下一次切片必须先回到扁平态。Cubeshape 识别是每把 SQ1 的第一阶段, Brandon Lin 2015 年的 **Cubeshape Parity (CSP)** 技术 — 预测 cubeshape 阶段结束时 parity 是否已经被解决 — 是现代 SQ1 最显著的方法进步。\n\n切片绑定原语让 TPS 上限 ~10, 因为每次切都需要亚毫米对齐。面转拼图能到 15-18 TPS, 因为面旋转有容差 — 面可以旋转即使下一个握法准备错; SQ1 切片不行。`,
      },
      {
        title_en: `Hassan Khanani and the 1LLL Frontier`,
        title_zh: `Hassan Khanani 与 1LLL 前沿`,
        body_en: `**Hassan Khanani** (USA, current single WR 3.40 s at Steel City Sprint 2026) is the highest-profile 1LLL practitioner. Full 1LLL on Square-1 covers all ~400+ last-layer permutation cases in one algorithm (vs Vandenbergh's two-step CO → CP / EO → EP). Khanani has not memorised the full set; he uses ~150-200 algorithms covering the most common LL states with Vandenbergh fallback.\n\n**Sameer Aggarwal** (USA, current Ao5 WR 4.63 s at Cubing in Southern Oregon 2025) uses a similar partial 1LLL approach. The two together represent the current Square-1 frontier.\n\nFull 1LLL adoption is the long-horizon question. With 400+ algorithms and Square-1's relatively low scramble-throughput on practice (slice mechanics slow finger-trick repetitions), full 1LLL might take 18-24 months to learn vs CFOP's 12 months for ZBLL. That economic friction is why Square-1 is the **lowest-T_phys WR ratio** in the WCA family — there is method-known headroom (sub-3 single, sub-4 Ao5) that no solver has invested in.`,
        body_zh: `**Hassan Khanani** (美, 当前单 WR 3.40 秒, Steel City Sprint 2026) 是 1LLL 最高知名度实践者。Square-1 全 1LLL 覆盖所有 ~400+ 后层 permutation 情况用 1 个算法 (vs Vandenbergh 的 CO → CP / EO → EP 两步)。Khanani 没全背完, 他用 ~150-200 算法覆盖最常见 LL 状态, 剩下 Vandenbergh 兜底。\n\n**Sameer Aggarwal** (美, 当前 Ao5 WR 4.63 秒, Cubing in Southern Oregon 2025) 用类似的局部 1LLL 思路。两人一起代表当前 SQ1 前沿。\n\n全 1LLL 普及是长期问题。400+ 算法 + SQ1 实操中打乱吞吐相对低 (切片机械慢, 手指动作重复慢), 全 1LLL 可能要 18-24 个月学完 vs CFOP ZBLL 的 12 个月。这种经济摩擦是为什么 SQ1 是 WCA 中 **最低 T_phys/WR 比** — 方法已知有空间 (sub-3 单 / sub-4 Ao5) 但没人投入。`,
      },
    ],
  },

  // ════════════════════════════════════════════════════════════
  //  clock
  // ════════════════════════════════════════════════════════════
  'clock': {
    current_method_en:
      '7-SIMUL (bpaul, ~2023) — memorize back-side state in inspection, execute both sides essentially simultaneously. Lachlan Gibson 1.53 single (Sep 2025), Brendyn Dunagan 2.24 Ao5 (2025). The flip is one indivisible ~0.3s motion. Note: prior method "Lou" (Yunhao Lou 2.87 WR May 2021) was flip-efficient but sequential.',
    current_method_zh:
      '7-SIMUL (bpaul ~2023) — 观察期间记忆背面, 正背两面几乎同时执行。Gibson 1.53 单 (2025-09), Dunagan 2.24 Ao5 (2025)。翻面动作不可分, ~0.3 秒。前代方法 Lou (Yunhao Lou 2.87 WR 2021-05) 减翻面但仍顺序执行。',
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
      '魔表在字面意义上是 WCA 中机械瓶颈最严重的项目: ~0.3 秒翻面是拼图机构强制要求的不可分动作, 占 WR 时间 15-20%。7-SIMUL 方法 (bpaul, ~2023) 把顺序拨钉换成「双面同时执行」 — 观察期间记忆背面状态, 这就是 Gibson 1.53 (2025-09) 和 Dunagan 2.24 Ao5 (2025) 把曲线砸下来的原因。\n\n' +
      '识别基本消失 — 魔表状态完全可见, 7-SIMUL 把执行期识别换成观察期记忆。剩下的是原子动作数 (~14 次, 7-SIMUL) 和拨钉手指频率 (~7-8 次/秒可达)。100 年渐近 = 12 × 8.5 + 0.25 = 1.66 秒可达, 需要硬件精修; 绝对下界 = 11 × 9 + 0.2 = 1.42 秒需要消除翻面的新方法 (有些 7-SIMUL 变种已尝试, 但稳定性未验证)。低于 1.4 秒需要根本性的新魔表机构 — 当前 QiYi 磁铁 + 208 磁铁设计并未给出这种动力。',
    extended_sections: [
      {
        title_en: `Why Clock Looks Nothing Like the Rest of WCA`,
        title_zh: `为什么魔表跟其他 WCA 完全不像`,
        body_en: `Clock is the only WCA event without **permutation** — there are no piece positions to track. The state is 18 dial angles (9 per side, each 0-11 corresponding to clock-hour positions) plus 4 pin states (in/out per corner, 16 combinations). Total reachable states: ~5.9 × 10^8, which is solvable optimally in ~14 atomic moves but typically takes more because the move primitives (pin toggles + dial rotations) cannot be reordered freely.\n\nThe puzzle was created by Christopher C. Wiggs and Christopher J. Taylor in 1988 and was a WCA event briefly in 2007-2008 (the original "Rubik's Clock" by Hungarian designer Pavel Bartoš). It returned in 2014 after community advocacy and the LingAo Clock (first reasonably speed-friendly mass-market clock) made it viable.\n\nBecause there's no permutation, **Clock has no algorithm count in the conventional sense**. Methods are sequences of pin-flip + dial-rotation patterns. The 2023 7-SIMUL method (bpaul) optimises by overlapping front and back execution — once flips are memorised from inspection, both sides rotate simultaneously.`,
        body_zh: `Clock 是唯一一个没有 **permutation** 的 WCA 项目 — 没有块位置要追踪。状态是 18 个 dial 角度 (每侧 9 个, 各 0-11 对应钟点) + 4 个 pin 状态 (每角 in/out, 16 组合)。总可达态 ~5.9 × 10^8, optimal ~14 步原子动作可解, 但实际通常更多, 因为动作原语 (pin 切换 + dial 旋转) 不能自由重排。\n\n拼图由 Christopher C. Wiggs 和 Christopher J. Taylor 1988 设计, 2007-2008 短暂作为 WCA 项目 (匈牙利设计师 Pavel Bartoš 的「Rubik's Clock」)。2014 在社区推动下回归, LingAo Clock (第一款合理快速友好的量产魔表) 让它再次可行。\n\n因为没有 permutation, **Clock 没有传统意义上的算法数**。方法是 pin 翻 + dial 转的模式序列。2023 年 7-SIMUL 方法 (bpaul) 通过重叠正背执行优化 — 观察期间记完背面, 正背同时转。`,
      },
      {
        title_en: `The QiYi Magnetic Clock and the 208-Magnet Era`,
        title_zh: `QiYi 磁铁魔表与 208 磁铁时代`,
        body_en: `Clock hardware has only had three major generations:\n\n1. **LingAo Clock (2013)** — first speed-friendly mass-market; ~7-8 s averages possible.\n2. **Modded Mr. M (2017)** — community-installed magnets on each pin and dial; ~5-6 s averages.\n3. **QiYi Magnetic Clock (2020)** — the first factory-magnetic clock with **208 magnets total** (per QiYi marketing). Eliminated nearly all dial / pin lockups. Current WR-era hardware.\n\nThe QiYi design uses small bipolar magnets at every dial-to-frame interface, eliminating the slop that caused the LingAo era's "dial drag" — the unpredictable resistance that made 1-second WR territory implausible. With QiYi Magnetic, **pin flips and dial rotations have determined inertia**, and the cube's response is exactly as designed. This is the engineering precondition for 7-SIMUL: synchronous bi-side execution requires that both sides respond predictably to identical force.\n\nNo subsequent clock has replaced QiYi Magnetic at the WR scale. The next plausible generation might integrate **rapid-flip cores** that reduce the 0.3 s flip envelope; until then, the floor analysis assumes QiYi-class hardware.`,
        body_zh: `魔表硬件只有 3 个主要世代:\n\n1. **LingAo Clock (2013)** — 第一款速拧友好量产; ~7-8 秒平均可行。\n2. **Modded Mr. M (2017)** — 社区给每 pin 和 dial 装磁铁; ~5-6 秒平均。\n3. **QiYi 磁铁魔表 (2020)** — 第一款出厂磁铁, **共 208 个磁铁** (QiYi 营销数据)。基本消除 dial / pin 卡顿。当前 WR 时代硬件。\n\nQiYi 设计在每个 dial-frame 接合处用小双极磁铁, 消除了 LingAo 时代的「dial 拖滞」 — 让 1 秒 WR 区不可能的不可预测阻力。QiYi 磁铁让 **pin 翻和 dial 转有确定惯量**, 整体响应与设计一致。这是 7-SIMUL 的工程前提: 正背同步执行要求两面对相同力响应可预测。\n\n后续没有魔表在 WR 尺度上替代 QiYi 磁铁。下一代可能集成 **快速翻面核心** 把 0.3 秒翻面包络缩小; 在那之前, 下界分析以 QiYi 级硬件为前提。`,
      },
    ],
  },

  // ════════════════════════════════════════════════════════════
  //  minx
  // ════════════════════════════════════════════════════════════
  'minx': {
    current_method_en:
      'Westlund (Star + F2L + S2L + Last2Layers) remains universal at the top — Zemdegs, Huanqui, Ziyu Wu, Tarasenko all use it. Modern variants (Yu Da-Hyung S2L, Bálint S2L) differ in last-pair insertion. Timofei Tarasenko holds the current WR single 21.85 (Start of Summer Beijing 2026-05-01) and Ao5 24.38 (Tashkent Open 2025-12-06); both use Westlund + heavy LL alg base.',
    current_method_zh:
      'Westlund (Star + F2L + S2L + Last2Layers) 仍是顶级通用标准 — Zemdegs / Huanqui / 吴子语 / Tarasenko 都用。现代变种 (Yu Da-Hyung S2L、Bálint S2L) 差别在最后一对的插入。Tarasenko 持有现 WR 单次 21.85 (Start of Summer Beijing 2026-05-01) 和 Ao5 24.38 (Tashkent Open 2025-12-06), 都用 Westlund + 厚 LL 算法库。',
    current_wr_avg_holder: 'Timofei Tarasenko — 24.38 Ao5 (Tashkent Open 2025-12-06)',
    current_wr_single_holder: 'Timofei Tarasenko — 21.85 (Start of Summer Beijing 2026-05-01)',
    current_wr_single_value: 21.85,
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
      { scenario_en: 'Tarasenko 21.85 (current WR single)', scenario_zh: 'Tarasenko 21.85 (现 WR 单次)', M: 128, TPS: 6.9, R: 1.0 },
      { scenario_en: '20–30 year horizon (improved S2L lookahead)', scenario_zh: '20–30 年 (S2L lookahead 改进)', M: 125, TPS: 8, R: 0.9 },
      { scenario_en: '100-year asymptote (lucky route + 10 TPS)', scenario_zh: '100 年渐近 (高效路径 + 10 TPS)', M: 110, TPS: 10, R: 0.7 },
      { scenario_en: 'Absolute floor (efficient solver + 12 TPS biomech)', scenario_zh: '绝对下界 (高效路径 + 12 TPS 生物力学)', M: 95, TPS: 12, R: 0.5 },
    ],
    best_reconstructions: [
      { person: 'Timofei Tarasenko', date: '2026-05-01', time: '21.85 s', M: 128, TPS: 6.9, method: 'Westlund — Start of Summer Beijing 2026, current WR single', source_url: 'https://speedcubing.org/blogs/news/timofei-tarasenko-breaks-megaminx-world-record-single' },
    ],
    reasoning_en:
      'Megaminx has 12 faces but only 6 are addressable in finger-trick rotation (R, U, F, BL, BR, L on each side). The remaining 6 faces require cube rotation, which costs time. Inspection covers Star + 1-2 stars (about 6-8 moves); the rest of the S2L (Second-2-Layers) is pure look-ahead similar in flavour to 3x3 cross+F2L but stretched across 12 faces with 50 cubies. Tarasenko\'s 21.99 single + 24.38 Ao5 leap at Tashkent Open 2025-12-06 (single since lowered to 21.85 at Start of Summer Beijing 2026-05-01) used Westlund + heavy LL alg base.\n\n' +
      'Move count anchors the analysis. Westlund typical solve is ~110-160 STM (lower than the often-cited 200, which counts redundant rotations); Tarasenko\'s 21.99 ÷ 130 STM = 6.8 TPS counting only finger-trick moves. The 100-year asymptote at 110 STM × 10 TPS + 0.7 = 11.7 s requires push-through on S2L lookahead training and a generation of hardware that lets 12 TPS sustain on Megaminx faces (currently 12 TPS is achievable in burst, not sustained). The absolute floor at 95 STM × 12 TPS + 0.5 = 8.4 s is what the puzzle structure permits — getting there requires a solver who fully trains on Yu Da-Hyung S2L variants from a young age.',
    reasoning_zh:
      '五魔方有 12 面但只有 6 个可手指动作 (R, U, F, BL, BR, L); 其余 6 面需要整体旋转, 要花时间。观察覆盖 Star + 1-2 星 (约 6-8 步); 剩余 S2L 是类似 3x3 cross+F2L 的纯预读, 但拉到 12 面 50 块的尺度。Tarasenko 在 Tashkent Open 2025-12-06 用 21.99 单 + 24.38 Ao5 跃迁 (单次后续在 Start of Summer Beijing 2026-05-01 降到 21.85), 全用 Westlund + 厚 LL 算法库。\n\n' +
      '步数是分析锚点。Westlund 典型解 ~110-160 STM (低于常引用的 200, 后者把多余整体旋转计入); Tarasenko 21.99 ÷ 130 STM = 6.8 TPS (只计手指动作)。100 年渐近 = 110 STM × 10 TPS + 0.7 = 11.7 秒, 需要 S2L 预读训练突破 + 一代支持 Megaminx 面持续 12 TPS 的硬件 (目前 12 TPS 可突发不可持续)。绝对下界 = 95 STM × 12 TPS + 0.5 = 8.4 秒, 这是拼图结构允许的极限, 需要从小专攻 Yu Da-Hyung S2L 变种的选手才能达到。',
    extended_sections: [
      {
        title_en: `Megaminx Has More Faces Than Fingers Can Reach`,
        title_zh: `五魔方面数多过手指能够到的`,
        body_en: `Megaminx has 12 pentagonal faces, but at any given hand position only **6 are addressable via finger-trick rotation** — typically R, U, F, BL, BR, L. The other 6 faces (D, the four back-side faces, and one of L/BL depending on grip) require **cube rotation** mid-solve, which costs 0.3-0.6 s per rotation including the grip recovery.\n\nThis means a typical 21-second elite solve includes **3-6 cube rotations**, eating 1-3 seconds of pure non-productive time. Yu Da-Hyung's S2L variant (Korea, ~2018) and Bálint's S2L (Hungary) both reduce rotation count by reorganising the second-2-layer phase to keep more pieces in the addressable hemisphere. Even with these optimisations, Megaminx is the WCA event where **rotation cost is most visible** — bigger than any other puzzle in the family.\n\nThe long-term mitigation might be **larger-hands solvers** or **smaller Megaminx (~62mm vs current ~67mm)**, both of which expand the addressable face count. Hardware has moved toward smaller (X-Man Galaxy V2 Sculpted is 67mm; rumours of 64mm prototypes exist), but reduction below 60mm hits a ergonomic limit where finger-trick discrimination between adjacent faces fails.`,
        body_zh: `五魔方有 12 个五边形面, 但任何手位下只有 **6 个可通过手指动作触达** — 通常 R / U / F / BL / BR / L。其余 6 面 (D、4 个背面、L/BL 之一视握法) 需要解题中 **整体旋转**, 每次旋转含握法恢复花 0.3-0.6 秒。\n\n21 秒级顶级解通常含 **3-6 次整体旋转**, 占 1-3 秒纯非生产时间。Yu Da-Hyung S2L 变种 (韩, ~2018) 和 Bálint S2L (匈) 通过重新组织 S2L 阶段、让更多块留在可触达半球, 减少旋转数。即便如此, 五魔方是 WCA 中 **旋转成本最显眼** 的项目 — 比家族里任何其他拼图都大。\n\n长期缓解可能是 **大手选手** 或 **更小的 Megaminx (~62mm vs 当前 ~67mm)**, 两者都能扩展可触达面数。硬件正向小型化走 (X-Man Galaxy V2 Sculpted 是 67mm, 有 64mm 原型流言), 但 60mm 以下会撞人体工学极限 — 手指无法区分相邻面。`,
      },
      {
        title_en: `From Zemdegs to Tarasenko: The 36-Year-Old Reset`,
        title_zh: `Zemdegs 到 Tarasenko: 36 年的重置`,
        body_en: `Megaminx WR singles cycled through Feliks Zemdegs (multiple 2009-2013), Yu Da-Hyung (2014-2017), Juan Pablo Huanqui (2017-2024), and now **Timofei Tarasenko** (Russia, 21.99 single + 24.38 Mo3 at Tashkent Open 2025-12, with single later lowered to 21.85 at Start of Summer Beijing 2026). Huanqui's seven-year dominance (Peru, first non-Australian and non-Korean Megaminx WR holder) was broken by Tarasenko's Tashkent run — the first WR average improvement of over 1 second in a decade.\n\nTarasenko's solve uses Westlund + an expanded LL alg base (full PLL + extended OLL beyond the standard ~64 cases). The 24.38 Mo3 = 23.81 + 25.65 + 23.67 reflects the consistency that comes from never needing 2-look LL — every LL state is recognised and executed in one algorithm.\n\nWhat the WR transition signals: a new generation of Megaminx solvers (Tarasenko is 17 in 2026) is investing in **heavier LL alg memorisation than Zemdegs or Huanqui ever did**, much like Geng's ZB approach on 3x3. The next 5 years will likely see continued WR drops from this method-investment cohort.`,
        body_zh: `Megaminx 单次 WR 历经 Feliks Zemdegs (2009-2013 多次)、Yu Da-Hyung (2014-2017)、Juan Pablo Huanqui (2017-2024), 现在是 **Timofei Tarasenko** (俄, 21.99 单 + 24.38 Mo3 @ Tashkent Open 2025-12, 单次后续 2026 北京 Start of Summer 砍到 21.85)。Huanqui 的 7 年垄断 (秘鲁, 首位非澳非韩 Megaminx WR 持有者) 被 Tarasenko Tashkent 之战终结 — 10 年来首次 WR 平均改进超 1 秒。\n\nTarasenko 用 Westlund + 扩展 LL 算法库 (全 PLL + 标准 ~64 之外的扩展 OLL)。24.38 Mo3 = 23.81 + 25.65 + 23.67 反映了「从不需要 2-look LL」带来的稳定性 — 每个 LL 状态识别 + 1 个算法搞定。\n\nWR 切换的信号: 新一代 Megaminx 选手 (Tarasenko 2026 年 17 岁) 投入 **比 Zemdegs / Huanqui 时代更重的 LL 算法记忆**, 类似 Geng 在 3x3 的 ZB 路线。未来 5 年这种「方法投资同期组」会继续带来 WR 下降。`,
      },
    ],
  },

};
