// Pure-TS non-WCA solver fleet — data for the /code/solvers dashboard.
//
// Extracted from page.tsx so a CI guard can import it
// (tests/code-solvers-fleet-sync.test.ts): the set of NONWCA_TS event ids MUST
// equal CSTIMER_SOLVABLE_IDS (lib/cstimer-scramble.ts) — every pure-TS non-WCA
// puzzle with `solvable:true` has exactly one row here, and NONWCA_TS_PLANNED
// (not-yet-built) must be disjoint from the solvable set.
//
// Wiring a new non-WCA solver INCLUDES adding its row here (see
// solver/NONWCA_PUZZLE_LOOP.md §0.4 wiring touch-points). Data is verified from
// each solver's file header + NONWCA_PUZZLE_LOOP.md §1/§2 — do NOT guess.
//
// 多数在浏览器现算 (无 Rust / 无 WASM / 无服务器); TIER B 例外 = 离线预计算的精确距离表
// (stats/scramble/opt_<p>.bin.gz), 浏览器 fetch + inflate + 查表 + 梯度下降, 仍可证最优, 常驻几十 MB.
// 状态数 (可达闭包, 多超 2^53) 一律预格式化字符串, 禁 number 字面量 (§0.0 #4).
// tier: A 现场全 BFS 最优 / B 离线精确距离表 (现场 BFS >1.5s 或常驻 >100MB 时落表, §0.0 #10) /
//        C 单实例 IDA* 可证最优 / D 近最优或有界 (诚实标, §0.0 #3).
// quality 三桶: 'optimal' (A/B/C 可证最短) / 'near' (近最优, 非全局最优) / 'bounded' (有效 + 有界, 非最优).

export type TsTier = 'A' | 'B' | 'C' | 'D';
export type TsQuality = 'optimal' | 'near' | 'bounded';
export interface NonWcaTsSolver {
  event: string; // cstimer event id → /scramble/solver?event=<event>
  zhName: string; enName: string;
  tier: TsTier;
  quality: TsQuality;
  states: string; // 可达态闭包, 预格式化字符串 (可超 2^53)
  zhStates?: string; enStates?: string; // states 旁补充 (近似量级 / 口径)
  gods?: string; // 上帝之数 / MAX_LENGTH (带口径标签)
  zhMethod: string; enMethod: string;
}

// 顺序: 可证最优 (A 现场 BFS → C 单实例 IDA*) → 近最优 (D hybrid) → 有效 + 有界 (D 构造式).
export const NONWCA_TS: NonWcaTsSolver[] = [
  // ── TIER A: 现场全 BFS, 整图可达态 ≤ ~3M, 每解可证最短 ──
  { event: 'ivy', zhName: '枫叶魔方', enName: 'Ivy Cube', tier: 'A', quality: 'optimal',
    states: '29,160', gods: 'God 8',
    zhMethod: '进页一次全图 BFS (81×360 态), 查表即最短', enMethod: 'one full-graph BFS on load (81×360 states), table lookup = shortest' },
  { event: '133', zhName: '1×3×3 花型', enName: '1×3×3 Floppy', tier: 'A', quality: 'optimal',
    states: '192', zhStates: '= 24×16/2', enStates: '= 24×16/2', gods: 'God 8',
    zhMethod: '全图 BFS (奇偶约束砍半的真闭包), 套 Ivy 范式', enMethod: 'full-graph BFS (true closure halved by a parity constraint), Ivy pattern' },
  { event: '223', zhName: '2×2×3 (整魔方)', enName: '2×2×3 (standalone)', tier: 'A', quality: 'optimal',
    states: '241,920', zhStates: '= 8!×3! (角 8! × 中层 3!)', enStates: '= 8!×3! (8 corners × 3-cell middle layer)', gods: 'God 14',
    zhMethod: '独立 2×2×3 整魔方 (非 Petrus 块): 进页一次全图 BFS, 查表即最短, 均值 ~9.74', enMethod: 'standalone whole 2×2×3 tower (not the Petrus block): one full-graph BFS on load, table lookup = shortest, mean ~9.74' },
  { event: 'sfl', zhName: '超薄花型', enName: 'Super Floppy', tier: 'A', quality: 'optimal',
    states: '3,041,280', zhStates: '= P(12,4)×4⁴', enStates: '= P(12,4)×4⁴', gods: 'God 13',
    zhMethod: '整图 BFS (整数排名编码, build+BFS ~573ms)', enMethod: 'full-graph BFS (integer-rank encoding, build+BFS ~573ms)' },
  { event: 'ufo', zhName: 'UFO', enName: 'UFO', tier: 'A', quality: 'optimal',
    states: '60,480', gods: 'God 10',
    zhMethod: '整图 BFS <50ms (球半刚体锁, 真闭包远低于着色上界)', enMethod: 'full-graph BFS <50ms (rigid ball-halves; true closure far below the coloring bound)' },
  { event: 'cm2', zhName: 'Cmetrick Mini', enName: 'Cmetrick Mini', tier: 'A', quality: 'optimal',
    states: '165,888', zhStates: '= 24⁴/2', enStates: '= 24⁴/2', gods: 'God 10',
    zhMethod: '2×2 球阵整图 BFS (face-turn 口径, build+BFS ~293ms)', enMethod: '2×2 ball-grid full BFS (face-turn metric, build+BFS ~293ms)' },
  { event: 'dmd', zhName: '钻石', enName: 'Diamond', tier: 'A', quality: 'optimal',
    states: '138,240', gods: 'God 10',
    zhMethod: '八面体面转整图 BFS; cstimer 真引擎 round-trip 锚定', enMethod: 'octahedron face-turn full BFS; anchored by cstimer real-engine round-trip' },
  { event: 'gear', zhName: '齿轮魔方', enName: 'Gear Cube', tier: 'A', quality: 'optimal',
    states: '41,472', gods: 'God 6 (face-turn)',
    zhMethod: '齿轮含齿旋转编码整图 BFS ~173ms (实测落 TIER A 非 B)', enMethod: 'gear-tooth-encoded full BFS ~173ms (measured into TIER A, not B)' },
  { event: '8p', zhName: '八数码', enName: '8-Puzzle', tier: 'A', quality: 'optimal',
    states: '181,440', zhStates: '= 9!/2', enStates: '= 9!/2', gods: 'God 31',
    zhMethod: '滑块类整图 BFS (复用 slider-puzzle 核, 15p 同源)', enMethod: 'sliding-tile full BFS (shared slider-puzzle core, same as 15p)' },
  { event: 'bic', zhName: '联体魔方', enName: 'Bicube', tier: 'B', quality: 'optimal',
    states: '1,108,800', gods: 'God 28 (face-turn)',
    zhMethod: 'TIER B 离线精确距离表 opt_bic.bin.gz (~1.8MB; 现场 BFS ~6.4s/~510MB 移动端必崩, 故落表): 浏览器 fetch+inflate → 常驻 ~10MB 类型化数组, 查表+梯度下降, 可证最优; 上帝之数 28 见 jaapsch.net', enMethod: 'TIER B offline exact-distance table opt_bic.bin.gz (~1.8MB; in-browser BFS was ~6.4s/~510MB → mobile crash, so tabled): browser fetch+inflate → ~10MB typed arrays resident, lookup + gradient descent, provably optimal; cf. jaapsch.net God 28' },
  // ── TIER C: 单实例 IDA* + 可采纳启发式, 每解可证最短 ──
  { event: '233', zhName: '2×3×3 多米诺', enName: '2×3×3 Domino', tier: 'C', quality: 'optimal',
    states: '1,625,702,400', zhStates: '= 8!·8! ≈ 1.63×10⁹', enStates: '= 8!·8! ≈ 1.63×10⁹', gods: '样本 ≤16 / sampled ≤16',
    zhMethod: '8 角 + 8 棱各满 PDB, IDA* + max(角,棱) 可采纳启发式出可证最短', enMethod: 'full corner & edge PDBs; IDA* + admissible max(corner, edge) → provably shortest' },
  { event: '15p', zhName: '数字华容道', enName: '15-Puzzle', tier: 'C', quality: 'optimal',
    states: '10,461,394,944,000', zhStates: '= 16!/2 ≈ 1.05×10¹³', enStates: '= 16!/2 ≈ 1.05×10¹³', gods: 'God 80, 均值 ~52.6 / God 80, mean ~52.6',
    zhMethod: '每条打乱 IDA* + walking-distance 可采纳启发式出可证最短; God 数 80 (Korf)', enMethod: 'per-scramble IDA* + admissible walking-distance heuristic → provably shortest; God\'s number 80 (Korf)' },
  // ── TIER D: 两阶段约简, 近最优 (浅态可证最优捷径, 深态诚实标近最优) ──
  { event: '335', zhName: '3×3×5', enName: '3×3×5', tier: 'D', quality: 'near',
    states: '156,067,430,400', zhStates: '≈ 1.56×10¹¹', enStates: '≈ 1.56×10¹¹', gods: 'cap CUBOID335_MAX_LENGTH=45',
    zhMethod: 'phase-1 IDDFS 归约进 H + phase-2 重叠 PDB; 采样 98.25% 可证最优, 中位 ~14', enMethod: 'phase-1 IDDFS into H + phase-2 overlapping PDBs; 98.25% provably optimal in sampling, median ~14' },
  { event: '337', zhName: '3×3×7', enName: '3×3×7', tier: 'D', quality: 'near',
    states: '126,859,598,081,556,480,000', zhStates: '≈ 1.27×10²⁰', enStates: '≈ 1.27×10²⁰', gods: 'cap CUBOID337_MAX_LENGTH=80',
    zhMethod: '两阶段约简 hybrid (16 token); 浅态可证最优捷径, 余诚实近最优', enMethod: 'two-phase reduction hybrid (16 tokens); optimal shortcut on shallow states, else honest near-optimal' },
  { event: '334', zhName: '3×3×4', enName: '3×3×4', tier: 'D', quality: 'near',
    states: '165,181,768,335,360,000', zhStates: '≈ 1.65×10¹⁷ (物理态)', enStates: '≈ 1.65×10¹⁷ (physical)', gods: 'cap CUBOID334_MAX_LENGTH=40',
    zhMethod: '两阶段约简 hybrid; 中位 ~17, 浅态可证最优捷径', enMethod: 'two-phase reduction hybrid; median ~17, optimal shortcut on shallow states' },
  { event: '336', zhName: '3×3×6', enName: '3×3×6', tier: 'D', quality: 'near',
    states: '8,391,762,413,094,961,152,000,000', zhStates: '≈ 8.4×10²⁴ (物理态)', enStates: '≈ 8.4×10²⁴ (physical)', gods: 'cap CUBOID336_MAX_LENGTH=80',
    zhMethod: '两阶段约简 hybrid (21 token 全刚体); 7 张重叠 EXACT joint-triple PDB max 启发', enMethod: 'two-phase reduction hybrid (21 rigid tokens); 7 overlapping EXACT joint-triple PDBs max heuristic' },
  { event: 'crz3a', zhName: '疯狂 3×3', enName: 'Crazy 3×3', tier: 'D', quality: 'near',
    states: '~4.3×10¹⁹', zhStates: '标准 3×3', enStates: 'standard 3×3', gods: 'bound 26 (HTM)',
    zhMethod: '底层即普通 3×3, 直接 import 站内 kociemba 两阶段; 典型 18–23 HTM', enMethod: 'really a plain 3×3 — imports the site kociemba two-phase; typically 18–23 HTM' },
  { event: 'mpyrso', zhName: '大金字塔', enName: 'Master Pyraminx', tier: 'D', quality: 'near',
    states: '~4.6×10¹¹', gods: '均值 ~21 / mean ~21 (face-turn)',
    zhMethod: 'wrap cstimer 自带两阶段 solver 当引擎 (无全 BFS / 无表)', enMethod: 'wraps cstimer’s own two-phase solver as the engine (no full BFS, no tables)' },
  { event: 'dino', zhName: '恐龙魔方', enName: 'Dino Cube', tier: 'D', quality: 'near',
    states: '239,500,800', zhStates: '= A12 = 12!/2', enStates: '= A12 = 12!/2', gods: 'God 10 (face-turn)',
    zhMethod: 'wrap cstimer dino solver (redi IDA*) 当引擎: 棱置换 A12 超 BFS/表, 不建表, 均值 ~9.53', enMethod: 'wraps cstimer’s dino solver (redi IDA*) as the engine: A12 edge perm is beyond BFS/table, no table built, mean ~9.53' },
  // ── TIER D: 从零构造式约简, 有效 + 有界 (非最优) ──
  { event: 'sq2', zhName: '方块二', enName: 'Square-2', tier: 'D', quality: 'bounded',
    states: '76,828,484,468,736,000', zhStates: '= 12·18! ≈ 7.68×10¹⁶', enStates: '= 12·18! ≈ 7.68×10¹⁶', gods: 'cap SQ2_MAX_LENGTH=130',
    zhMethod: '构造式 3-循环约简 (parity fix + conjugator 表路由); 均值 ~70 元组', enMethod: 'constructive 3-cycle reduction (parity fix + conjugator routing); mean ~70 tuples' },
  { event: 'ssq1', zhName: '超 Sq-1', enName: 'Super Square-1', tier: 'D', quality: 'bounded',
    states: '≈1.15×10²⁵', zhStates: '两个耦合 Sq-1', enStates: 'two coupled Sq-1s', gods: 'cap SSQ1_MAX_LENGTH=60',
    zhMethod: '真两阶段形状 + 置换约简 (单面 3,678 形状); 采样双峰 (奇偶分支)', enMethod: 'genuine two-phase shape + permutation reduction (3,678 single-face shapes); bimodal sampling (parity branch)' },
  { event: 'bsq', zhName: '受限 Sq-1', enName: 'Bandaged Square-1', tier: 'D', quality: 'bounded',
    states: '518,400', zhStates: '形状 coset = 720² (全群更大, 不可全 BFS)', enStates: 'shape coset = 720² (full group larger, no full BFS)', gods: 'cap BSQ_MAX_LENGTH=90',
    zhMethod: '构造式三阶段 (形状→角排列→定角棱排列), 只吐合法 (x,0)+/', enMethod: 'constructive three stages (shape → corner perm → fixed-corner edge perm), legal (x,0)+/ only' },
  { event: 'cm3', zhName: 'Cmetrick', enName: 'Cmetrick', tier: 'D', quality: 'bounded',
    states: '165,112,971,264', zhStates: '≈ 1.65×10¹¹ = 24⁹/24', enStates: '≈ 1.65×10¹¹ = 24⁹/24', gods: 'cap CM3_MAX_LENGTH=60',
    zhMethod: '从零逐球约简 (cm2 的 3×3 放大): 先用线翻转解 9 个符号位 (G/H=Z2), 再用单球对易子 gadget 逐球归位; 参考 jaapsch.net', enMethod: 'from-scratch ball-by-ball reduction (the 3×3 scaling of cm2): line-flips solve the 9 sign bits (G/H=Z2), then single-ball commutator gadgets fix each ball; cf. jaapsch.net' },
];

// 已登记但尚未建求解器的 TIER D2 backlog (诚实: 未建). 见 solver/NONWCA_PUZZLE_LOOP.md §1 TIER D2 表.
// CI 守卫断言这些 event 与 CSTIMER_SOLVABLE_IDS 不相交 (已建/可解的不该还挂"规划中").
export const NONWCA_TS_PLANNED: ReadonlyArray<{ event: string; zh: string; en: string }> = [
  { event: 'sia113', zh: '联体 1×1×3', en: 'Siamese 1×1×3' },
  { event: 'sia123', zh: '联体 1×2×3', en: 'Siamese 1×2×3' },
  { event: 'sia222', zh: '联体 2×2×2', en: 'Siamese 2×2×2' },
  { event: 'prcp', zh: '五魔金字塔', en: 'Pyraminx Crystal' },
  { event: 'giga', zh: '六阶五魔', en: 'Gigaminx' },
  { event: 'ctico', zh: '二十面体', en: 'Icosamate' },
  { event: 'heli', zh: '直升机', en: 'Helicopter' },
  { event: 'helicv', zh: '弧面直升机', en: 'Curvy Copter' },
];

// TIER 标签 (A 现场 BFS / B 离线精确表 / C 单实例 IDA* / D 两阶段约简).
export const TS_TIER_LABEL: Record<TsTier, { zh: string; en: string }> = {
  A: { zh: 'A 现场 BFS', en: 'A live BFS' },
  B: { zh: 'B 离线精确表', en: 'B offline table' },
  C: { zh: 'C 单实例 IDA*', en: 'C per-instance IDA*' },
  D: { zh: 'D 两阶段约简', en: 'D two-phase' },
};
// quality 三桶, 诚实标: 可证最优 / 近最优 / 有效 + 有界.
export const TS_QUALITY: Record<TsQuality, { zh: string; en: string; cls: string }> = {
  optimal: { zh: '可证最优', en: 'provably optimal', cls: 'solv-q-optimal' },
  near: { zh: '近最优', en: 'near-optimal', cls: 'solv-q-near' },
  bounded: { zh: '有效 + 有界', en: 'valid + bounded', cls: 'solv-q-bounded' },
};
