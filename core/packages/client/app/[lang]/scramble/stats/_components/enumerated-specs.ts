// Sampled distributions retain their existing JSON sources and metrics.
// Exact distributions use the static registry; no solver or enumeration helper
// is imported to construct this page's specs.

import type { EnumSpec, TrText } from './EnumeratedDistView';
import { PRECOMPUTED_EXACT_SPECS } from './precomputed-exact-specs';
import { PUBLISHED_EXACT_SPECS } from './published-exact-specs';

const DL_SAMPLE: TrText = { zh: '下载样本 (CSV)', en: 'Download sample (CSV)' };

// ---- JSON-fetched specs -------------------------------------------------


const crz3a: EnumSpec = {
  event: 'crz3a',
  color: '#16a34a',
  seriesName: { zh: '疯狂 3×3(采样,近最优)', en: 'Crazy 3×3 (sampled, near-optimal)' },
  spaceLabel: { zh: '随机态样本(离线预计算,等价于标准三阶,kociemba 两阶段近最优,非全空间)', en: 'random-state samples (precomputed offline — equivalent to a standard 3×3, kociemba two-phase near-optimal, not full-space)' },
  moveUnitLabel: { zh: '一个 token = 1 步(HTM,kociemba 两阶段解)', en: 'one token = 1 move (HTM, kociemba two-phase solution)' },
  meta: ({ stateCountStr, sampleCount }) => ({
    zh: `这是采样估计的【近最优】长度分布,既不是全空间精确分布,也不是可证最优:疯狂 3×3 机械上就是普通三阶魔方,约有 ${stateCountStr} 个状态(数量级 4.3×10¹⁹),无法整图枚举,所以 build 脚本离线生成并用站内 kociemba 两阶段求解器解了 ${sampleCount.toLocaleString()} 个随机态,把解的步数分桶。两阶段解长度接近最优但不保证最短(样本量越大分布越稳);页面只读取预计算结果,不在浏览器里求解。它不是 WCA 项目,示例即采样到的真实随机打乱。`,
    en: `This is a SAMPLED estimate of the NEAR-OPTIMAL solution-length distribution — neither the exact full-space curve nor a provably-optimal one: the Crazy 3×3 is mechanically an ordinary 3×3 cube with ≈ ${stateCountStr} states (order 4.3×10¹⁹), far too many to enumerate, so a build script generated and solved ${sampleCount.toLocaleString()} random states offline with the site's kociemba two-phase solver and bucketed them. Two-phase solutions are near-optimal but not guaranteed shortest (a larger sample stabilizes the curve); this page only reads the precomputed result and does no in-browser solving. It is not a WCA event; the examples are the actual sampled random scrambles.`,
  }),
  lengthNote: {
    zh: '疯狂 3×3 无打乱长度分布(打乱由 cstimer 生成,记号即标准三阶);整解近最优步数分布见「难度」',
    en: 'No scramble-length distribution for the Crazy 3×3 (cstimer generates standard 3×3 scrambles); see "Difficulty" for the near-optimal solution-length distribution',
  },
  source: { kind: 'json', url: '/stats/scramble/dist_crz3a.json', v: '20260621', fallbackStateCount: '43,252,003,274,489,856,000', downloadSampleName: 'crz3a_crz3a_sample.csv', sampleFormat: 'near_optimal', downloadSampleLabel: DL_SAMPLE },
};

const mpyr: EnumSpec = {
  event: 'mpyrso',
  color: '#16a34a',
  seriesName: { zh: '大金字塔(采样,近最优)', en: 'Master Pyraminx (sampled, near-optimal)' },
  spaceLabel: { zh: '随机态样本(离线预计算,近最优,非全空间)', en: 'random-state samples (precomputed offline, near-optimal, not full-space)' },
  moveUnitLabel: { zh: '一个 token = 1 步(cstimer 两阶段解)', en: 'one token = 1 move (cstimer two-phase solution)' },
  meta: ({ stateCountStr, sampleCount }) => ({
    zh: `这是采样估计的【近最优】长度分布,既不是全空间精确分布,也不是可证最优:大金字塔约有 ${stateCountStr} 个状态(数量级 4.6×10¹¹),无法整图枚举,所以 build 脚本离线生成并用 cstimer 自带两阶段求解器解了 ${sampleCount.toLocaleString()} 个随机态,把解的步数分桶。两阶段解长度接近最优但不保证最短(样本量越大分布越稳);页面只读取预计算结果,不在浏览器里求解。它不是 WCA 项目,示例即采样到的真实随机打乱。`,
    en: `This is a SAMPLED estimate of the NEAR-OPTIMAL solution-length distribution — neither the exact full-space curve nor a provably-optimal one: the Master Pyraminx has ≈ ${stateCountStr} states (order 4.6×10¹¹), far too many to enumerate, so a build script generated and solved ${sampleCount.toLocaleString()} random states offline with cstimer's own two-phase solver and bucketed them. Two-phase solutions are near-optimal but not guaranteed shortest (a larger sample stabilizes the curve); this page only reads the precomputed result and does no in-browser solving. It is not a WCA event; the examples are the actual sampled random scrambles.`,
  }),
  lengthNote: {
    zh: '大金字塔无打乱长度分布(打乱由 cstimer 随态生成);整解近最优步数分布见「难度」',
    en: 'No scramble-length distribution for the Master Pyraminx (cstimer generates random-state scrambles); see "Difficulty" for the near-optimal solution-length distribution',
  },
  source: { kind: 'json', url: '/stats/scramble/dist_mpyrso.json', v: '20260621', fallbackStateCount: '461,078,666,256', downloadSampleName: 'mpyr_mpyrso_sample.csv', sampleFormat: 'near_optimal', downloadSampleLabel: DL_SAMPLE },
};

const cuboid233: EnumSpec = {
  event: '233',
  color: '#0ea5e9',
  seriesName: { zh: '2×3×3 多米诺(采样,最优)', en: '2×3×3 Domino (sampled, optimal)' },
  spaceLabel: { zh: '随机态样本(离线预计算,IDA* 可证最优,非全空间)', en: 'random-state samples (precomputed offline, IDA* provably optimal, not full-space)' },
  moveUnitLabel: { zh: '一个 token = 1 步(IDA* 最优)', en: 'one token = 1 move (IDA* optimal)' },
  meta: ({ stateCountStr, sampleCount }) => ({
    zh: `这是采样估计的【最优】解长度分布:每条解都是可证最短(IDA* + max(角距离, 棱距离) 可采纳启发式),但整条曲线是抽样的、不是全空间精确分布 —— 2×3×3 多米诺有 ${stateCountStr} 个状态(8 角 × 8 棱,各自由排列,角棱奇偶独立),太大无法整图枚举,所以 build 脚本离线生成并解了 ${sampleCount.toLocaleString()} 个随机态,把解的步数分桶(样本量越大分布越稳);页面只读取预计算结果,不在浏览器里求解。它不是 WCA 项目,示例即采样到的真实随机打乱。`,
    en: `This is a SAMPLED estimate of the OPTIMAL solution-length distribution: every solution is a provable shortest path (IDA* with the admissible max(corner-distance, edge-distance) heuristic), but the whole curve is sampled, not the exact full-space distribution — the 2×3×3 Domino has ${stateCountStr} states (8 corners × 8 edges, each freely permuted with independent parities), far too many to enumerate, so a build script generated and solved ${sampleCount.toLocaleString()} random states offline and bucketed them (a larger sample stabilizes the curve); this page only reads the precomputed result and does no in-browser solving. It is not a WCA event; the examples are the actual sampled random scrambles.`,
  }),
  lengthNote: {
    zh: '2×3×3 多米诺无打乱长度分布(打乱由 cstimer 定长生成);整解最优步数分布(采样)见「难度」',
    en: 'No scramble-length distribution for the 2×3×3 Domino (cstimer generates fixed-form scrambles); see "Difficulty" for the (sampled) optimal-length distribution',
  },
  source: { kind: 'json', url: '/stats/scramble/dist_233.json', v: '20260621', fallbackStateCount: '1,625,702,400', downloadSampleName: '233_domino_sample.csv', sampleFormat: 'optimal', downloadSampleLabel: DL_SAMPLE },
};

const cuboid334: EnumSpec = {
  event: '334',
  color: '#0ea5e9',
  seriesName: { zh: '3×3×4(采样,近最优,非全空间)', en: '3×3×4 (sampled, near-optimal, not full-space)' },
  spaceLabel: { zh: '随机打乱样本(离线预计算,两阶段近最优,非全空间)', en: 'random-scramble samples (precomputed offline, two-phase near-optimal, not full-space)' },
  moveUnitLabel: { zh: '一个 token = 1 步', en: 'one token = 1 move' },
  meta: ({ stateCountStr, sampleCount, json }) => {
    const groupOrderStr = json?.groupOrderStr ?? '2,642,908,293,365,760,000';
    return {
      zh: `这是【随机态的返回解长度】采样分布,不是全空间最优分布:3×3×4 有 ${stateCountStr} 个状态(facelet 群阶 ${groupOrderStr},均为 Schreier-Sims 实算),太大无法整图枚举。求解器走两阶段约简(先把所有块归约进全 180° 子群,再只用 180° 转还原),任何随机态都能解出一条有界的近最优解;很浅的态另用可采纳启发式给出可证最优解(故「可证最优占比」一般较低)。所以 build 脚本离线对 ${sampleCount.toLocaleString()} 个 cstimer 同款随机打乱求解,把返回解的步数分桶 —— 主要是近最优、浅态为最优;页面只读取预计算结果,不在浏览器里求解。它不是 WCA 项目,示例即采样到的真实随机打乱;全空间精确最优分布算不出来。`,
      en: `This is a SAMPLED distribution of the RETURNED solution length on random states — not the full-space optimal distribution: the 3×3×4 has ${stateCountStr} states (facelet group order ${groupOrderStr}, both computed by Schreier-Sims), far too many to enumerate. The solver is a two-phase reduction (reduce every orbit into the all-180° subgroup, then finish with 180° turns only): ANY random state returns a bounded near-optimal solution, and very shallow states additionally get a provably optimal solution (so "proven-optimal %" is usually low). So a build script solves ${sampleCount.toLocaleString()} cstimer-style random scrambles offline and buckets their returned lengths — mostly near-optimal, optimal for shallow states; this page only reads the precomputed result and does no in-browser solving. It is not a WCA event; the examples are the actual sampled random scrambles; the exact full-space optimal distribution can't be computed.`,
    };
  },
  lengthNote: {
    zh: '3×3×4 无打乱长度分布(打乱由 cstimer 定长生成);整解步数采样分布见「难度」',
    en: 'No scramble-length distribution for the 3×3×4 (cstimer generates fixed-form scrambles); see "Difficulty" for the sampled solution-length distribution',
  },
  source: { kind: 'json', url: '/stats/scramble/dist_334.json', v: '20260621', fallbackStateCount: '165,181,768,335,360,000', downloadSampleName: '334_sample.csv', sampleFormat: 'bounded', downloadSampleLabel: DL_SAMPLE },
};

const cuboid335: EnumSpec = {
  event: '335',
  color: '#0ea5e9',
  seriesName: { zh: '3×3×5(采样,近最优,非全空间)', en: '3×3×5 (sampled, near-optimal, not full-space)' },
  spaceLabel: { zh: '随机打乱样本(离线预计算,两阶段近最优,非全空间)', en: 'random-scramble samples (precomputed offline, two-phase near-optimal, not full-space)' },
  moveUnitLabel: { zh: '一个 token = 1 步', en: 'one token = 1 move' },
  meta: ({ stateCountStr, sampleCount }) => ({
    zh: `这是【随机态的返回解长度】采样分布,不是全空间最优分布:3×3×5 有 ${stateCountStr} 个可达状态(由 Schreier-Sims 实算),太大无法整图枚举。这条曲线由 build 脚本离线对 ${sampleCount.toLocaleString()} 个 cstimer 同款随机打乱求解、把返回解步数分桶得到 —— 主要是近最优、浅态为最优;页面只读取预计算结果,不在浏览器里求解。求解器走两阶段约简(先把所有块归约进全 180° 子群,再只用 180° 转还原),任何随机态都能解出一条有界的近最优解;很浅的态另用可采纳启发式给出可证最优解(故「可证最优占比」一般较低)。它不是 WCA 项目,示例即采样到的真实随机打乱;全空间精确最优分布算不出来。cstimer 的 “/ 333” 速记在 3×3×5 上无刚体实现,这里只解刚体打乱部分。`,
    en: `This is a SAMPLED distribution of the RETURNED solution length on random states — not the full-space optimal distribution: the 3×3×5 has ${stateCountStr} reachable states (from Schreier-Sims), far too many to enumerate. The curve is precomputed offline by a build script that solves ${sampleCount.toLocaleString()} cstimer-style random scrambles and buckets the returned lengths — mostly near-optimal, optimal for shallow states; this page only reads the precomputed result and does no in-browser solving. The solver is a two-phase reduction (reduce every orbit into the all-180° subgroup, then finish with 180° turns only): ANY random state returns a bounded near-optimal solution, and very shallow states additionally get a provably optimal solution (so "proven-optimal %" is usually low). It is not a WCA event; the examples are the actual sampled random scrambles; the exact full-space optimal distribution can't be computed. cstimer's "/ 333" shorthand has no rigid realisation on a 3×3×5, so only the rigid scramble part is solved.`,
  }),
  lengthNote: {
    zh: '3×3×5 无打乱长度分布(打乱由 cstimer 定长生成);整解步数采样分布见「难度」',
    en: 'No scramble-length distribution for the 3×3×5 (cstimer generates fixed-form scrambles); see "Difficulty" for the sampled solution-length distribution',
  },
  source: { kind: 'json', url: '/stats/scramble/dist_335.json', v: '20260621', fallbackStateCount: '156,067,430,400', downloadSampleName: '335_sample.csv', sampleFormat: 'bounded', downloadSampleLabel: DL_SAMPLE },
};

const cuboid336: EnumSpec = {
  event: '336',
  color: '#0ea5e9',
  seriesName: { zh: '3×3×6(采样,近最优,非全空间)', en: '3×3×6 (sampled, near-optimal, not full-space)' },
  spaceLabel: { zh: '随机打乱样本(离线预计算,两阶段近最优,非全空间)', en: 'random-scramble samples (precomputed offline, two-phase near-optimal, not full-space)' },
  moveUnitLabel: { zh: '一个 token = 1 步', en: 'one token = 1 move' },
  meta: ({ stateCountStr, sampleCount, json }) => {
    const groupOrderStr = json?.groupOrderStr ?? '2,148,291,177,752,310,054,912,000,000';
    return {
      zh: `这是【随机态的返回解长度】采样分布,不是全空间最优分布:3×3×6 有 ${stateCountStr} 个状态(facelet 群阶 ${groupOrderStr},均为 Schreier-Sims 实算),太大无法整图枚举。求解器走两阶段约简(先把所有块归约进全 180° 子群,再只用 180° 转还原),任何随机态都能解出一条有界的近最优解;很浅的态另用可采纳启发式给出可证最优解(故「可证最优占比」一般较低)。所以 build 脚本离线对 ${sampleCount.toLocaleString()} 个 cstimer 同款随机打乱求解,把返回解的步数分桶 —— 主要是近最优、浅态为最优;页面只读取预计算结果,不在浏览器里求解。它不是 WCA 项目,示例即采样到的真实随机打乱;全空间精确最优分布算不出来。`,
      en: `This is a SAMPLED distribution of the RETURNED solution length on random states — not the full-space optimal distribution: the 3×3×6 has ${stateCountStr} states (facelet group order ${groupOrderStr}, both computed by Schreier-Sims), far too many to enumerate. The solver is a two-phase reduction (reduce every orbit into the all-180° subgroup, then finish with 180° turns only): ANY random state returns a bounded near-optimal solution, and very shallow states additionally get a provably optimal solution (so "proven-optimal %" is usually low). So a build script solves ${sampleCount.toLocaleString()} cstimer-style random scrambles offline and buckets their returned lengths — mostly near-optimal, optimal for shallow states; this page only reads the precomputed result and does no in-browser solving. It is not a WCA event; the examples are the actual sampled random scrambles; the exact full-space optimal distribution can't be computed.`,
    };
  },
  lengthNote: {
    zh: '3×3×6 无打乱长度分布(打乱由 cstimer 定长生成);整解步数采样分布见「难度」',
    en: 'No scramble-length distribution for the 3×3×6 (cstimer generates fixed-form scrambles); see "Difficulty" for the sampled solution-length distribution',
  },
  source: { kind: 'json', url: '/stats/scramble/dist_336.json', v: '20260621', fallbackStateCount: '8,391,762,413,094,961,152,000,000', downloadSampleName: '336_sample.csv', sampleFormat: 'bounded', downloadSampleLabel: DL_SAMPLE },
};

const cuboid337: EnumSpec = {
  event: '337',
  color: '#0ea5e9',
  seriesName: { zh: '3×3×7(采样,近最优,非全空间)', en: '3×3×7 (sampled, near-optimal, not full-space)' },
  spaceLabel: { zh: '随机打乱样本(离线预计算,两阶段近最优,非全空间)', en: 'random-scramble samples (precomputed offline, two-phase near-optimal, not full-space)' },
  moveUnitLabel: { zh: '一个 token = 1 步', en: 'one token = 1 move' },
  meta: ({ stateCountStr, sampleCount }) => ({
    zh: `这是【随机态的返回解长度】采样分布,不是全空间最优分布:3×3×7 有 ${stateCountStr} 个可达状态(轨道乘积 2,283,472,765,468,016,640,000 因 18× 奇偶耦合而过计,实际由 Schreier-Sims 实算),太大无法整图枚举。这条曲线由 build 脚本离线对 ${sampleCount.toLocaleString()} 个 cstimer 同款随机打乱求解、把返回解步数分桶得到 —— 主要是近最优、浅态为最优;页面只读取预计算结果,不在浏览器里求解。求解器走两阶段约简(先把所有块归约进全 180° 子群,再只用 180° 转还原),任何随机态都能解出一条有界的近最优解;很浅的态另用可采纳启发式给出可证最优解(故「可证最优占比」一般较低)。它不是 WCA 项目,示例即采样到的真实随机打乱;全空间精确最优分布算不出来。cstimer 的 “/ 333” 速记在 3×3×7 上无刚体实现,这里只解刚体打乱部分。`,
    en: `This is a SAMPLED distribution of the RETURNED solution length on random states — not the full-space optimal distribution: the 3×3×7 has ${stateCountStr} reachable states (the orbit product 2,283,472,765,468,016,640,000 over-counts it by an 18× parity coupling; the true count is from Schreier-Sims), far too many to enumerate. The curve is precomputed offline by a build script that solves ${sampleCount.toLocaleString()} cstimer-style random scrambles and buckets the returned lengths — mostly near-optimal, optimal for shallow states; this page only reads the precomputed result and does no in-browser solving. The solver is a two-phase reduction (reduce every orbit into the all-180° subgroup, then finish with 180° turns only): ANY random state returns a bounded near-optimal solution, and very shallow states additionally get a provably optimal solution (so "proven-optimal %" is usually low). It is not a WCA event; the examples are the actual sampled random scrambles; the exact full-space optimal distribution can't be computed. cstimer's "/ 333" shorthand has no rigid realisation on a 3×3×7, so only the rigid scramble part is solved.`,
  }),
  lengthNote: {
    zh: '3×3×7 无打乱长度分布(打乱由 cstimer 定长生成);整解步数采样分布见「难度」',
    en: 'No scramble-length distribution for the 3×3×7 (cstimer generates fixed-form scrambles); see "Difficulty" for the sampled solution-length distribution',
  },
  source: { kind: 'json', url: '/stats/scramble/dist_337.json', v: '20260621', fallbackStateCount: '126,859,598,081,556,480,000', downloadSampleName: '337_sample.csv', sampleFormat: 'bounded', downloadSampleLabel: DL_SAMPLE },
};

const bsq: EnumSpec = {
  event: 'bsq',
  color: '#a855f7',
  seriesName: { zh: '受限方块一(采样,有界,非全空间)', en: 'Bandaged Square-1 (sampled, bounded, not full-space)' },
  spaceLabel: { zh: '随机打乱样本(离线预计算,三阶段约简有界,非全空间)', en: 'random-scramble samples (precomputed offline, three-stage reduction, bounded, not full-space)' },
  moveUnitLabel: { zh: '一个切片 = 1 步', en: 'one slice = 1 move' },
  meta: ({ stateCountStr, sampleCount }) => ({
    zh: `这是【随机态的返回解长度】采样分布,不是全空间最优分布:受限方块一(Bandaged Square-1)是一只物理 Square-1,但记号限制成 < / , (1,0) >(只转顶层 + 切片,底层不直接转),可达状态是 Square-1 群的一个大子群(${stateCountStr}),太大无法整图枚举。这条曲线由 build 脚本离线对 ${sampleCount.toLocaleString()} 个 cstimer 同款随机打乱求解、把返回解步数分桶得到 —— 三阶段约简(形状 → 角排列 → 棱排列),只用合法的顶层转 + 切片,任何随机态都能解出一条有界解(非最优,故无「可证最优占比」)。它不是 WCA 项目,示例即采样到的真实随机打乱;全空间精确最优分布算不出来。`,
    en: `This is a SAMPLED distribution of the RETURNED solution length on random states — not the full-space optimal distribution: the Bandaged Square-1 is a physical Square-1 whose notation is restricted to < / , (1,0) > (top turns + slice only; the bottom never turns directly), and its reachable states form a LARGE SUBGROUP of the Square-1 group (${stateCountStr}), far too many to enumerate. The curve is precomputed offline by a build script that solves ${sampleCount.toLocaleString()} cstimer-style random scrambles and buckets the returned lengths — a three-stage reduction (shape → corner perm → edge perm) using only legal top-turns + slices, returning a bounded (not optimal) solution for any random state. It is not a WCA event; the examples are the actual sampled random scrambles; the exact full-space optimal distribution can't be computed.`,
  }),
  lengthNote: {
    zh: 'Bandaged Square-1 无打乱长度分布(打乱由 cstimer 定长生成);整解步数采样分布见「难度」',
    en: 'No scramble-length distribution for the Bandaged Square-1 (cstimer generates fixed-length scrambles); see "Difficulty" for the sampled solution-length distribution',
  },
  source: { kind: 'json', url: '/stats/scramble/dist_bsq.json', v: '20260622', fallbackStateCount: 'huge (large subgroup of the Square-1 group; cube-shape coset = 518,400 = 720²)', downloadSampleName: 'bsq_sample.csv', sampleFormat: 'bounded', downloadSampleLabel: DL_SAMPLE },
};

const cm3: EnumSpec = {
  event: 'cm3',
  color: '#a855f7',
  seriesName: { zh: 'Cmetrick(采样,有界,非最优)', en: 'Cmetrick (sampled, bounded, not optimal)' },
  spaceLabel: { zh: '随机打乱样本(离线预计算,构造式约简,有界非最优)', en: 'random-scramble samples (precomputed offline, constructive reduction, bounded not optimal)' },
  moveUnitLabel: { zh: '一个 token = 1 步', en: 'one token = 1 move' },
  meta: ({ stateCountStr, sampleCount }) => ({
    zh: `这是【随机态的返回解长度】采样分布,不是全空间最优分布:Cmetrick 有 ${stateCountStr} 个可达状态(= 24⁹/24,jaapsch.net),太大无法整图枚举。这条曲线由 build 脚本离线对 ${sampleCount.toLocaleString()} 个 cstimer 同款随机打乱求解、把返回解步数分桶得到;页面只读取预计算结果,不在浏览器里求解。求解器是从零构造式约简(cm2 的 3×3 放大):先用线翻转解 9 个球的符号位(旋转群的偶子群 H=A4,商 G/H=Z2),再用只动单个球的对易子 gadget 逐球归位 —— 任何随机态都能解出一条有界的有效解(非最优)。它不是 WCA 项目,示例即采样到的真实随机打乱;全空间精确最优分布算不出来。Cmetrick 的上帝之数为 15 个四分之一转(jaapsch.net),与此处的有界解长度口径不同。`,
    en: `This is a SAMPLED distribution of the RETURNED solution length on random states — not the full-space optimal distribution: the Cmetrick has ${stateCountStr} reachable states (= 24⁹/24, jaapsch.net), far too many to enumerate. The curve is precomputed offline by a build script that solves ${sampleCount.toLocaleString()} cstimer-style random scrambles and buckets the returned lengths; this page only reads the precomputed result and does no in-browser solving. The solver is a from-scratch constructive reduction (the 3×3 scaling of cm2): line-flips solve the 9 balls' sign bits (the rotation group's even subgroup H=A4, quotient G/H=Z2), then single-ball commutator gadgets fix each ball in turn — ANY random state returns a bounded VALID (not optimal) solution. It is not a WCA event; the examples are the actual sampled random scrambles; the exact full-space optimal distribution can't be computed. The Cmetrick's God's number is 15 quarter-turns (jaapsch.net), a different metric than the bounded lengths shown here.`,
  }),
  lengthNote: {
    zh: 'Cmetrick 无打乱长度分布(打乱由 cstimer 定长生成);整解步数采样分布见「难度」',
    en: 'No scramble-length distribution for the Cmetrick (cstimer generates fixed-form scrambles); see "Difficulty" for the sampled solution-length distribution',
  },
  source: { kind: 'json', url: '/stats/scramble/dist_cm3.json', v: '20260622', fallbackStateCount: '165,112,971,264', downloadSampleName: 'cm3_sample.csv', sampleFormat: 'bounded', downloadSampleLabel: DL_SAMPLE },
};

const ctico: EnumSpec = {
  event: 'ctico',
  color: '#8b5cf6',
  seriesName: { zh: '二十面体(采样, 有界, 非全空间)', en: 'Icosamate (sampled, bounded, not full-space)' },
  spaceLabel: { zh: '随机打乱样本(离线预计算,从零对易子约简,有界,非全空间)', en: 'random-scramble samples (precomputed offline, from-scratch commutator reduction, bounded, not full-space)' },
  moveUnitLabel: { zh: '一个 token = 1 步', en: 'one token = 1 move' },
  meta: ({ stateCountStr, sampleCount }) => ({
    zh: `这是【随机态的返回解长度】采样分布,不是全空间最优分布:二十面体魔方有 ${stateCountStr} 个可达状态(= 12!·5¹²·20!/80,由 Schreier-Sims 实算),太大无法整图枚举。这条曲线由 build 脚本离线对 ${sampleCount.toLocaleString()} 个 cstimer 同款随机打乱求解、把返回解步数分桶得到 —— 这是有界(非最优)的从零对易子约简,故步数偏长。页面只读取预计算结果,不在浏览器里求解。它是深切顶点转的二十面体:12 个角(Z5 取向,单一轨道)+ 20 个面心(1 个被所有转动固定);求解器先用 3-循环 + Z5 扭转归位角(角取向之和与步数耦合,用前缀调到 5 的倍数),再用保持角不变的面心 3-循环归位其余 19 个面心。它不是 WCA 项目,示例即采样到的真实随机打乱;cstimer 用 5 阶顶点转打乱(不 jumble),本求解器即覆盖该群。`,
    en: `This is a SAMPLED distribution of the RETURNED solution length on random states — not the full-space optimal distribution: the Icosamate has ${stateCountStr} reachable states (= 12!·5¹²·20!/80, from Schreier-Sims), far too many to enumerate. The curve is precomputed offline by a build script that solves ${sampleCount.toLocaleString()} cstimer-style random scrambles and buckets the returned lengths — this is a bounded (not optimal) from-scratch commutator reduction, so lengths run long. This page only reads the precomputed result and does no in-browser solving. It is a deep-cut vertex-turning icosahedron: 12 corners (Z5 orientation, a single orbit) + 20 face-centers (one fixed by every turn); the solver fixes the corners with 3-cycles + Z5 twists (the corner-orientation sum is coupled to the move count, neutralized with a prefix), then solves the other 19 face-centers with vertex-preserving face-center 3-cycles. It is not a WCA event; the examples are the actual sampled random scrambles; cstimer scrambles with order-5 vertex turns (no jumbling), which is exactly the group this solver covers.`,
  }),
  lengthNote: {
    zh: '二十面体魔方无打乱长度分布(打乱由 cstimer 定长生成);整解步数采样分布见「难度」',
    en: 'No scramble-length distribution for the Icosamate (cstimer generates fixed-length scrambles); see "Difficulty" for the sampled solution-length distribution',
  },
  source: { kind: 'json', url: '/stats/scramble/dist_ctico.json', v: '20260622', fallbackStateCount: '3,556,408,552,733,836,800,000,000,000,000,000', downloadSampleName: 'ctico_sample.csv', sampleFormat: 'bounded', downloadSampleLabel: DL_SAMPLE },
};

const heli: EnumSpec = {
  event: 'heli',
  color: '#0ea5e9',
  seriesName: { zh: '直升机(采样, 有界, 非全空间)', en: 'Helicopter (sampled, bounded, not full-space)' },
  spaceLabel: { zh: '随机打乱样本(离线预计算,从零对易子约简,有界,非全空间)', en: 'random-scramble samples (precomputed offline, from-scratch commutator reduction, bounded, not full-space)' },
  moveUnitLabel: { zh: '一个 token = 1 步', en: 'one token = 1 move' },
  meta: ({ stateCountStr, sampleCount }) => ({
    zh: `这是【随机态的返回解长度】采样分布,不是全空间最优分布:直升机魔方有 ${stateCountStr} 个可达状态(= 8!·3⁷·(6!)⁴/2,由 Schreier-Sims 实算),太大无法整图枚举。这条曲线由 build 脚本离线对 ${sampleCount.toLocaleString()} 个 cstimer 同款随机打乱求解、把返回解步数分桶得到 —— 这是有界(非最优)的从零对易子约简,故步数偏长。页面只读取预计算结果,不在浏览器里求解。求解器先用奇偶前缀清掉角与 4 个棱翼轨道的置换奇偶,再用角 3-循环 / 角扭转 / 按轨道缓冲的棱翼 3-循环逐件归位;任何随机态都能在硬上界内解出。它不是 WCA 项目,示例即采样到的真实随机打乱;cstimer 只用 180° 整转打乱(不 jumble),本求解器即覆盖该群。`,
    en: `This is a SAMPLED distribution of the RETURNED solution length on random states — not the full-space optimal distribution: the Helicopter Cube has ${stateCountStr} reachable states (= 8!·3⁷·(6!)⁴/2, from Schreier-Sims), far too many to enumerate. The curve is precomputed offline by a build script that solves ${sampleCount.toLocaleString()} cstimer-style random scrambles and buckets the returned lengths — this is a bounded (not optimal) from-scratch commutator reduction, so lengths run long. This page only reads the precomputed result and does no in-browser solving. The solver clears the corner and 4 wing-orbit permutation parities with a prefix, then fixes each piece with corner 3-cycles, corner twists, and per-orbit buffer wing 3-cycles; any random state solves within the hard cap. It is not a WCA event; the examples are the actual sampled random scrambles; cstimer only scrambles with 180° full turns (no jumbling), which is exactly the group this solver covers.`,
  }),
  lengthNote: {
    zh: '直升机魔方无打乱长度分布(打乱由 cstimer 定长生成);整解步数采样分布见「难度」',
    en: 'No scramble-length distribution for the Helicopter Cube (cstimer generates fixed-length scrambles); see "Difficulty" for the sampled solution-length distribution',
  },
  source: { kind: 'json', url: '/stats/scramble/dist_heli.json', v: '20260622', fallbackStateCount: '11,848,661,611,315,200,000', downloadSampleName: 'heli_sample.csv', sampleFormat: 'bounded', downloadSampleLabel: DL_SAMPLE },
};

const helicv: EnumSpec = {
  event: 'helicv',
  color: '#0ea5e9',
  seriesName: { zh: '弧面直升机(采样, 有界, 非全空间)', en: 'Curvy Copter (sampled, bounded, not full-space)' },
  spaceLabel: { zh: '随机打乱样本(离线预计算,从零对易子约简,有界,非全空间)', en: 'random-scramble samples (precomputed offline, from-scratch commutator reduction, bounded, not full-space)' },
  moveUnitLabel: { zh: '一个 token = 1 步', en: 'one token = 1 move' },
  meta: ({ stateCountStr, sampleCount }) => ({
    zh: `这是【随机态的返回解长度】采样分布,不是全空间最优分布:弧面直升机魔方有 ${stateCountStr} 个可达状态(= 8!·3⁷·(6!)⁴·2¹²/2⁵,由 Schreier-Sims 实算,是直升机魔方的 256 倍),太大无法整图枚举。这条曲线由 build 脚本离线对 ${sampleCount.toLocaleString()} 个 cstimer 同款随机打乱求解、把返回解步数分桶得到 —— 这是有界(非最优)的从零对易子约简,故步数偏长。页面只读取预计算结果,不在浏览器里求解。它和直升机魔方共用同一组打乱招式,但弧面切割多出 12 个棱块;求解器先用 17 位奇偶前缀同时清掉角与 4 个面块轨道的置换奇偶并把 12 个棱块全部归位,再用角 3-循环 / 角扭转 / 按轨道缓冲的面块 3-循环逐件归位;任何随机态都能在硬上界内解出。它不是 WCA 项目,示例即采样到的真实随机打乱;cstimer 只用 180° 整转打乱(不 jumble),本求解器即覆盖该群。`,
    en: `This is a SAMPLED distribution of the RETURNED solution length on random states — not the full-space optimal distribution: the Curvy Copter has ${stateCountStr} reachable states (= 8!·3⁷·(6!)⁴·2¹²/2⁵, from Schreier-Sims — 256× the Helicopter Cube), far too many to enumerate. The curve is precomputed offline by a build script that solves ${sampleCount.toLocaleString()} cstimer-style random scrambles and buckets the returned lengths — this is a bounded (not optimal) from-scratch commutator reduction, so lengths run long. This page only reads the precomputed result and does no in-browser solving. It shares its scramble moves with the Helicopter Cube, but the curvy cuts add 12 edge pieces; the solver clears the corner and 4 face-orbit permutation parities and solves all 12 edge pieces with a 17-bit prefix, then fixes each piece with corner 3-cycles, corner twists, and per-orbit buffer face-piece 3-cycles; any random state solves within the hard cap. It is not a WCA event; the examples are the actual sampled random scrambles; cstimer only scrambles with 180° full turns (no jumbling), which is exactly the group this solver covers.`,
  }),
  lengthNote: {
    zh: '弧面直升机魔方无打乱长度分布(打乱由 cstimer 定长生成);整解步数采样分布见「难度」',
    en: 'No scramble-length distribution for the Curvy Copter (cstimer generates fixed-length scrambles); see "Difficulty" for the sampled solution-length distribution',
  },
  source: { kind: 'json', url: '/stats/scramble/dist_helicv.json', v: '20260622', fallbackStateCount: '3,033,257,372,496,691,200,000', downloadSampleName: 'helicv_sample.csv', sampleFormat: 'bounded', downloadSampleLabel: DL_SAMPLE },
};

const sq2: EnumSpec = {
  event: 'sq2',
  color: '#c724b1',
  seriesName: { zh: 'Square-2(采样,近最优,非全空间)', en: 'Square-2 (sampled, near-optimal, not full-space)' },
  spaceLabel: { zh: '随机打乱样本(离线预计算,约简法有效有界,非最优)', en: 'random-scramble samples (precomputed offline, reduction valid+bounded, not optimal)' },
  moveUnitLabel: { zh: '一个 (u,d)/ 元组 = 1 步', en: 'one (u,d)/ tuple = 1 move' },
  meta: ({ stateCountStr, sampleCount }) => ({
    zh: `这是【随机态的返回解长度】采样分布,不是全空间最优分布:Square-2 在 (u,d)/ 记号下有 ${stateCountStr} 个可达状态(= 12·18!,由 Schreier-Sims 实算),太大无法整图枚举,单阶段 IDA* 在随机态上会爆。这条曲线由 build 脚本离线对 ${sampleCount.toLocaleString()} 个 cstimer 同款随机打乱求解、把返回解步数分桶得到 —— 求解器走构造式 3-循环约简(归正奇偶后逐个轨道归位),保证每条都能解且步数有界,但**不是近最优**(实测均值约 70 元组,远多于最短解);页面只读取预计算结果,不在浏览器里求解。它不是 WCA 项目,示例即采样到的真实随机打乱;全空间精确最优分布算不出来。步数按 cstimer 同款 (u,d)/ 元组计(每个元组 1 步)。`,
    en: `This is a SAMPLED distribution of the RETURNED solution length on random states — not the full-space optimal distribution: under the (u,d)/ notation the Square-2 has ${stateCountStr} reachable states (= 12·18!, from Schreier-Sims), far too many to enumerate, and single-phase IDA* explodes on random states. The curve is precomputed offline by a build script that solves ${sampleCount.toLocaleString()} cstimer-style random scrambles and buckets the returned lengths — the solver uses a constructive 3-cycle reduction (fix parity, then home each orbit), which guarantees every scramble solves with a bounded length but is NOT near-optimal (measured mean ≈ 70 tuples, far above the shortest solution); this page only reads the precomputed result and does no in-browser solving. It is not a WCA event; the examples are the actual sampled random scrambles; the exact full-space optimal distribution can't be computed. Length is counted in cstimer-style (u,d)/ tuples (one tuple = one move).`,
  }),
  lengthNote: {
    zh: 'Square-2 无打乱长度分布(打乱由 cstimer 定长生成);整解近最优步数采样分布见「难度」',
    en: 'No scramble-length distribution for the Square-2 (cstimer generates fixed-length scrambles); see "Difficulty" for the sampled near-optimal solution-length distribution',
  },
  source: { kind: 'json', url: '/stats/scramble/dist_sq2.json', v: '20260622', fallbackStateCount: '76,828,484,468,736,000', downloadSampleName: 'sq2_sample.csv', sampleFormat: 'bounded', downloadSampleLabel: DL_SAMPLE },
};

const ssq1: EnumSpec = {
  event: 'ssq1',
  color: '#0A84FF',
  seriesName: { zh: 'Super Square-1(采样,有界,非全空间)', en: 'Super Square-1 (sampled, bounded, not full-space)' },
  spaceLabel: { zh: '随机打乱样本(离线预计算,两阶段约简有效有界,非最优)', en: 'random-scramble samples (precomputed offline, two-phase reduction valid+bounded, not optimal)' },
  moveUnitLabel: { zh: '一个 (a,b,c,d)/ 元组 = 1 步', en: 'one (a,b,c,d)/ tuple = 1 move' },
  meta: ({ stateCountStr, sampleCount }) => ({
    zh: `这是【随机态的返回解长度】采样分布,不是全空间最优分布:Super Square-1 是两个耦合的 Square-1,可达状态 ${stateCountStr} 个,太大无法整图枚举,任何整图 BFS / 单阶段 IDA* 在随机态上都会爆。这条曲线由 build 脚本离线对 ${sampleCount.toLocaleString()} 个 cstimer 同款随机打乱求解、把返回解步数分桶得到 —— 求解器走**两阶段形状+排列约简**直接解实际状态(每面归方块形→解角排列→解棱排列,含奇偶校验),保证每条都能解且步数有界,但**不是最优**,解长度随打乱难度变化(故曲线呈双峰:约半数需要奇偶校验、更长);页面只读取预计算结果,不在浏览器里求解。它不是 WCA 项目,示例即采样到的真实随机打乱;全空间精确最优分布算不出来。步数按 cstimer 同款 (a,b,c,d)/ 元组计(每个元组 1 步)。`,
    en: `This is a SAMPLED distribution of the RETURNED solution length on random states — not the full-space optimal distribution: the Super Square-1 is two coupled Square-1 mechanisms with ${stateCountStr} reachable states, far too many to enumerate, and any full-graph BFS / single-phase IDA* explodes on random states. The curve is precomputed offline by a build script that solves ${sampleCount.toLocaleString()} cstimer-style random scrambles and buckets the returned lengths — the solver uses a genuine TWO-PHASE shape+permutation reduction of the actual state (each side: reduce to cube shape → solve corner permutation → solve edge permutation, with a parity fix), which guarantees every scramble solves with a bounded length but is NOT optimal, and the length VARIES with the scramble (hence the bimodal curve: ~half the states need the parity fix and run longer); this page only reads the precomputed result and does no in-browser solving. It is not a WCA event; the examples are the actual sampled random scrambles; the exact full-space optimal distribution can't be computed. Length is counted in cstimer-style (a,b,c,d)/ tuples (one tuple = one move).`,
  }),
  lengthNote: {
    zh: 'Super Square-1 无打乱长度分布(打乱由 cstimer 定长生成);整解步数采样分布见「难度」',
    en: 'No scramble-length distribution for the Super Square-1 (cstimer generates fixed-length scrambles); see "Difficulty" for the sampled solution-length distribution',
  },
  source: { kind: 'json', url: '/stats/scramble/dist_ssq1.json', v: '20260622', fallbackStateCount: '≈1.15×10²⁵ (two coupled Square-1 mechanisms)', downloadSampleName: 'ssq1_sample.csv', sampleFormat: 'bounded', downloadSampleLabel: DL_SAMPLE },
};

const sia123: EnumSpec = {
  event: 'sia123',
  color: '#3a86ff',
  seriesName: { zh: '联体 1×2×3(采样,最优)', en: 'Siamese 1×2×3 (sampled, optimal)' },
  spaceLabel: { zh: '随机打乱样本(离线预计算,按 z2 拆半 + 各半 IDA* 最优,拼接=全局最优)', en: 'random-scramble samples (precomputed offline, split at z2 + per-half optimal IDA*, concatenation is globally optimal)' },
  moveUnitLabel: { zh: '一个 token = 1 步', en: 'one token = 1 move' },
  meta: ({ stateCountStr, sampleCount }) => ({
    zh: `这是【随机打乱的最优解长度】采样分布:联体 1×2×3 是两个 3×3×3 沿共享 1×2×3 块粘成的一体,实测整个群是直积 G = G_A × G_B(A/B 招式作用于互不相交的块且两两对易),每半边都是受限 ⟨U,R,r⟩ 3×3×3(6 角 + 9 棱 + 5 中心,内层 r 4-循环 4 个面心)。因此解法 = 把打乱按 z2 拆成 A、B 两块,各半边用 IDA*(角剪枝表 + 两张互补 6 棱剪枝表 + 中心位置表)独立求最优解,再拼接 —— 由直积结构,拼接长度 = 两半最优之和 = 全局最优。中心单色实心面、自旋不可见,目标不约束其取向。整体可达状态约 ${stateCountStr} 个,无法整图枚举,所以这条曲线由 build 脚本离线对 ${sampleCount.toLocaleString()} 条 cstimer 同款随机打乱求解后分桶,页面只读取预计算结果。剪枝表两半各一份约 16MB 常驻,建议桌面端使用。`,
    en: `This is a SAMPLED distribution of the OPTIMAL solution length on random scrambles: the Siamese 1×2×3 is two 3×3×3 cubes glued at a shared 1×2×3 block. The whole group is a measured DIRECT PRODUCT G = G_A × G_B (cube-A and cube-B moves act on disjoint pieces and all commute); each half is a restricted ⟨U,R,r⟩ 3×3×3 (6 corners + 9 edges + 5 centers, the inner r slice 4-cycling four face-centers). Solving therefore splits the scramble at z2 into an A-block and a B-block, solves each half OPTIMALLY with IDA* (corner + two complementary 6-edge + center-position databases), and concatenates — by the direct-product structure the concatenation's length is the sum of the two half-optima and is GLOBALLY OPTIMAL. The face-centers are single solid stickers, so the goal does not constrain their spin. The bonded puzzle has ~${stateCountStr} reachable states, far too many to enumerate, so this curve is precomputed offline by solving ${sampleCount.toLocaleString()} cstimer-style random scrambles; the page only reads the result. The databases (one set per half) are ~16MB resident — desktop recommended.`,
  }),
  lengthNote: {
    zh: '联体 1×2×3 无打乱长度分布(打乱由 cstimer 定长生成);解步数采样分布见「难度」',
    en: 'No scramble-length distribution for the Siamese 1×2×3 (cstimer generates fixed-form scrambles); see "Difficulty" for the sampled solution-length distribution',
  },
  source: { kind: 'json', url: '/stats/scramble/dist_sia123.json', v: '20260623', fallbackStateCount: '29,352,224,556,213,070,635,827,560,960,000', downloadSampleName: 'sia123_sample.csv', sampleFormat: 'bounded', downloadSampleLabel: DL_SAMPLE },
};

const sia222: EnumSpec = {
  event: 'sia222',
  color: '#8338ec',
  seriesName: { zh: '联体 2×2×2(采样,最优)', en: 'Siamese 2×2×2 (sampled, optimal)' },
  spaceLabel: { zh: '随机打乱样本(离线预计算,按 z2 y 拆半 + 各半 IDA* 最优,拼接=全局最优)', en: 'random-scramble samples (precomputed offline, split at z2 y + per-half optimal IDA*, concatenation is globally optimal)' },
  moveUnitLabel: { zh: '一个 token = 1 步', en: 'one token = 1 move' },
  meta: ({ stateCountStr, sampleCount }) => ({
    zh: `这是【随机打乱的最优解长度】采样分布:联体 2×2×2 是两个 3×3×3 沿共享 2×2×2 块粘成的一体,实测整个群是直积 G = G_A × G_B(A/B 招式作用于互不相交的块且两两对易),共享块锁死每个立方各 3 个面 → 每半边都是受限 ⟨U,R,F⟩ 3×3×3。因此解法 = 把打乱按 z2 y 拆成 A、B 两块,各半边用 IDA*(角剪枝表 3,674,160 + 两张互补 6 棱剪枝表)独立求最优解,再拼接 —— 由直积结构,拼接长度 = 两半最优之和 = 全局最优。整体可达状态约 ${stateCountStr} 个,无法整图枚举,所以这条曲线由 build 脚本离线对 ${sampleCount.toLocaleString()} 条 cstimer 同款随机打乱求解后分桶,页面只读取预计算结果。剪枝表较大(~18.8MB 常驻),建议桌面端使用。`,
    en: `This is a SAMPLED distribution of the OPTIMAL solution length on random scrambles: the Siamese 2×2×2 is two 3×3×3 cubes glued at a shared 2×2×2 block. The whole group is a measured DIRECT PRODUCT G = G_A × G_B (cube-A and cube-B moves act on disjoint pieces and all commute); the shared block locks three faces of each cube, so EACH HALF is a restricted ⟨U,R,F⟩ 3×3×3. Solving therefore splits the scramble at z2 y into an A-block and a B-block, solves each half OPTIMALLY with IDA* (corner pattern database 3,674,160 + two complementary 6-edge databases), and concatenates — by the direct-product structure the concatenation's length is the sum of the two half-optima and is GLOBALLY OPTIMAL. The bonded puzzle has ~${stateCountStr} reachable states, far too many to enumerate, so this curve is precomputed offline by solving ${sampleCount.toLocaleString()} cstimer-style random scrambles; the page only reads the result. The databases are sizeable (~18.8MB resident) — desktop recommended.`,
  }),
  lengthNote: {
    zh: '联体 2×2×2 无打乱长度分布(打乱由 cstimer 定长生成);最优解步数采样分布见「难度」',
    en: 'No scramble-length distribution for the Siamese 2×2×2 (cstimer generates fixed-form scrambles); see "Difficulty" for the sampled optimal-solution-length distribution',
  },
  source: { kind: 'json', url: '/stats/scramble/dist_sia222.json', v: '20260624', fallbackStateCount: '29,124,745,198,874,117,548,277,760,000', downloadSampleName: 'sia222_sample.csv', sampleFormat: 'bounded', downloadSampleLabel: DL_SAMPLE },
};

export const ENUM_SPECS: Record<string, EnumSpec> = {
  // JSON-fetched
  crz3a, mpyrso: mpyr, '233': cuboid233, '334': cuboid334, '335': cuboid335,
  '336': cuboid336, '337': cuboid337, bsq, cm3, ctico, heli, helicv, sq2, ssq1, sia123, sia222,
  ...PRECOMPUTED_EXACT_SPECS,
  ...PUBLISHED_EXACT_SPECS,
};
