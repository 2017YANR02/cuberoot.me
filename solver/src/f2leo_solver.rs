//! F2LEO 阶段 IDA* 搜索器(count-only)。
//!
//! 忠实移植自上游 `RubiksSolverDemo/src/F2LEOAnalyzer/analyzer.cpp` 的
//! `cross_analyzer` + `xcross_analyzer2`。F2LEO = cross 进度(cross / xcross /
//! xxcross / xxxcross,**无 xxxxcross**)+ 对**尚未归位的 F2L 棱**做 EO 门控:
//!   - cross 阶段:cross solved 且 4 个 F2L 槽棱(中层棱,pos 0..3)全朝向好。
//!   - xⁿcross 阶段:cross + 选定 n 个 F2L pair(角+棱归位)且剩余 4-n 个自由棱朝向好。
//!
//! 与 std 的 `xcross_solver` 关键差异:std 走"按槽共轭 + 一张大表",但 EO 在共轭
//! 下不守恒,故这里**不共轭**——照上游用 4 张逐槽小剪枝表(每张 CROSS×CORNER =
//! 190080×24,depth-10 BFS,~4.6 MB),在真实朝向里直接追踪棱朝向(`mt_edge` 值
//! `2*pos+ori` 的奇偶位)。EO 不进剪枝表(剪枝只含 cross+角),仅在叶子/根门控,
//! 故剪枝仍可采纳(cross+角距离 ≤ 真实 F2LEO 距离),IDA* 首达深度即最优。
//!
//! 复用表(全小/中表,**不需要** huge 表 / `CUBE_ALLOW_HUGE_TABLES`):
//!   - `mt_edge2`(~37 KB,cross 两棱组)+ `pt_cross`(~137 KB,cross 距离)
//!   - `mt_edge4`(~17 MB,4 棱组,xcross+)+ `mt_corn` + `mt_edge`
//!   - 自建 4 张 xcross 剪枝表(~18 MB 常驻,进程级 OnceLock 建一次)

use std::sync::{Arc, OnceLock};

use crate::cube_common::{
    alg_rotation, state_space, valid_moves, valid_moves_masked, Move, MoveMask, ValidMovesTable,
};
use crate::move_tables::{self, MoveTable};
use crate::prune_tables::{self, PackedPruneTable};

/// 4 个 F2L 槽的"已解角"种子(corner = 3*pos+ori,pos 4..7 = D 层角)。
const SLOT_CORNER: [usize; 4] = [12, 15, 18, 21];
/// 4 个 F2L 槽的"已解棱"种子(edge = 2*pos+ori,pos 0..3 = 中层棱,朝向好)。
const SLOT_EDGE: [usize; 4] = [0, 2, 4, 6];
/// xcross 剪枝表 BFS 深度(与上游 `create_prune_table2` 一致)。
const PRUNE_DEPTH: u8 = 10;

const E2A: usize = state_space::EDGE2_A_SOLVED; // 416
const E2B: usize = state_space::EDGE2_B_SOLVED; // 520
const E4_SOLVED: usize = state_space::CROSS_SOLVED; // 187520
const E2: usize = state_space::EDGE2; // 528
const NC: usize = state_space::CORNER; // 24

// 各阶段搜索深度安全上界(远超真实 F2LEO 值;prune 让正常 case 在最优深度即返回,
// 上界仅为防御性封顶,正常永远用不到)。
const CAP_CROSS: u32 = 14;
const CAP_XC: u32 = 16;
const CAP_XXC: u32 = 18;
const CAP_XXXC: u32 = 20;

// xcross 组合(min over 槽);xxcross 组合(min over pair);xxxcross 组合(min over triple)。
const XC: [&[usize]; 4] = [&[0], &[1], &[2], &[3]];
const XXC: [&[usize]; 6] = [&[0, 1], &[0, 2], &[0, 3], &[1, 2], &[1, 3], &[2, 3]];
const XXXC: [&[usize]; 4] = [&[0, 1, 2], &[0, 1, 3], &[0, 2, 3], &[1, 2, 3]];

/// 4 张逐槽 xcross 剪枝表(进程级建一次)。`tables[s][e4*24 + corner]` = 从该槽
/// 已解态起的 BFS 距离(255 = 未达 / ≥ PRUNE_DEPTH)。
struct F2leoPrune {
    tables: [Vec<u8>; 4],
}

impl F2leoPrune {
    /// 从 mt_edge4 / mt_corn 现场建 4 张逐槽 xcross 剪枝表(不依赖 manager;wasm 路径也用)。
    fn build(mt_edge4: &[u32], mt_corn: &[u32]) -> Self {
        F2leoPrune {
            tables: std::array::from_fn(|s| build_xcross_prune(mt_edge4, mt_corn, SLOT_CORNER[s])),
        }
    }
}

/// native:进程级缓存(OnceLock)。首调经 manager ensure 表后建一次,后续 new 直接 Arc clone。
#[cfg(not(target_arch = "wasm32"))]
fn f2leo_prune() -> Arc<F2leoPrune> {
    static P: OnceLock<Arc<F2leoPrune>> = OnceLock::new();
    P.get_or_init(|| {
        let mtm = move_tables::instance();
        let mt_edge4 = mtm.ensure_edge4();
        let mt_corn = mtm.ensure_corn();
        Arc::new(F2leoPrune::build(mt_edge4.as_u32(), mt_corn.as_u32()))
    })
    .clone()
}

/// 翻译上游 `create_prune_table2`:对 (edge4 × corner) 子问题从 `corner_seed` 已解态
/// 做 BFS。`mt_edge4` stride 24、值已 ×24;`mt_corn` stride 18、值 0..23。
fn build_xcross_prune(mt_edge4: &[u32], mt_corn: &[u32], corner_seed: usize) -> Vec<u8> {
    let size = state_space::CROSS * NC; // 190080 * 24
    let mut pt = vec![255u8; size];
    pt[E4_SOLVED * NC + corner_seed] = 0;
    for d in 0..PRUNE_DEPTH {
        for i in 0..size {
            if pt[i] != d {
                continue;
            }
            let e4_24 = (i / NC) * 24;
            let corn_18 = (i % NC) * 18;
            for j in 0..18 {
                let ni = mt_edge4[e4_24 + j] as usize + mt_corn[corn_18 + j] as usize;
                if pt[ni] == 255 {
                    pt[ni] = d + 1;
                }
            }
        }
    }
    pt
}

pub struct F2leoSolver {
    mt_edge2: Arc<MoveTable>,
    mt_edge4: Arc<MoveTable>,
    mt_corn: Arc<MoveTable>,
    mt_edge: Arc<MoveTable>,
    pt_cross: Arc<PackedPruneTable>,
    prune: Arc<F2leoPrune>,
}

impl F2leoSolver {
    /// native:经 manager ensure 全部表(均已在 std/eo 流程生成,直接 mmap),
    /// 并触发一次性 4 张 xcross 剪枝表构建(OnceLock,后续 new 直接复用)。
    #[cfg(not(target_arch = "wasm32"))]
    pub fn new() -> Self {
        let mtm = move_tables::instance();
        let ptm = prune_tables::instance();
        F2leoSolver {
            mt_edge2: mtm.ensure_edge2(),
            mt_edge4: mtm.ensure_edge4(),
            mt_corn: mtm.ensure_corn(),
            mt_edge: mtm.ensure_edge(),
            pt_cross: ptm.ensure_pt_cross(),
            prune: f2leo_prune(),
        }
    }

    /// 预建表直接构造(绕过 manager / 磁盘 / mmap),wasm 路径用。
    /// 现场建 4 张 xcross 剪枝表(~18MB,wasm 仅构造一次)。
    pub fn from_tables(
        mt_edge2: Arc<MoveTable>,
        mt_edge4: Arc<MoveTable>,
        mt_corn: Arc<MoveTable>,
        mt_edge: Arc<MoveTable>,
        pt_cross: Arc<PackedPruneTable>,
    ) -> Self {
        let prune = Arc::new(F2leoPrune::build(mt_edge4.as_u32(), mt_corn.as_u32()));
        F2leoSolver {
            mt_edge2,
            mt_edge4,
            mt_corn,
            mt_edge,
            pt_cross,
            prune,
        }
    }

    // ===================== Cross 阶段 =====================
    // cross(两棱组 i1/i2 + pt_cross)+ 4 个 F2L 棱 EO。

    fn search_cross(&self, i1: usize, i2: usize, eo: [usize; 4], depth: u32, prev: u8) -> bool {
        let (vmoves, vcnt) = valid_moves();
        let count = vcnt[prev as usize] as usize;
        let row = &vmoves[prev as usize];
        let m2 = self.mt_edge2.as_u32();
        let me = self.mt_edge.as_u32();
        for k in 0..count {
            let m = row[k] as usize;
            let n1 = m2[i1 + m] as usize;
            let n2 = m2[i2 + m] as usize;
            let pr = self.pt_cross.get((n1 as u64) * (E2 as u64) + n2 as u64) as u32;
            if pr >= depth {
                continue;
            }
            let ne: [usize; 4] = std::array::from_fn(|t| me[eo[t] + m] as usize);
            if depth == 1 {
                // 走到这里 pr < 1 ⇒ pr == 0(cross solved);只差 EO 全好。
                if ne.iter().all(|&e| e % 2 == 0) {
                    return true;
                }
            } else if self.search_cross(
                n1 * 18,
                n2 * 18,
                std::array::from_fn(|t| ne[t] * 18),
                depth - 1,
                m as u8,
            ) {
                return true;
            }
        }
        false
    }

    /// i1/i2 = 两棱组原始 index(0..527),eo = 4 个 F2L 棱原始 state(0..23)。
    fn solve_cross(&self, i1: usize, i2: usize, eo: [usize; 4]) -> u32 {
        let pr = self.pt_cross.get((i1 as u64) * (E2 as u64) + i2 as u64) as u32;
        if pr == 0 && eo.iter().all(|&e| e % 2 == 0) {
            return 0;
        }
        let start = pr.max(1);
        let eo18: [usize; 4] = std::array::from_fn(|t| eo[t] * 18);
        for d in start..=CAP_CROSS {
            if self.search_cross(i1 * 18, i2 * 18, eo18, d, 18) {
                return d;
            }
        }
        CAP_CROSS // 理论不可达
    }

    // ===================== XCross / XXCross / XXXCross =====================
    // 通用:解 `combo`(1~3 个槽)对应的 F2LEO 子问题,EO 门控剩余自由棱。
    //   e4_24:共享 edge4(已 ×24 form)。
    //   corn[i]/edge[i] = combo[i] 槽的角/棱(stride*18 form);egoal[i] = SLOT_EDGE。
    //   free[j] = 自由槽棱(stride*18 form,目标 %2==0)。prune[i] = combo[i] 的剪枝表。

    #[allow(clippy::too_many_arguments)]
    fn search_combo(
        &self,
        e4_24: usize,
        corn: &[usize],
        edge: &[usize],
        egoal: &[usize],
        free: &[usize],
        prune: &[&[u8]],
        depth: u32,
        prev: u8,
    ) -> bool {
        let (vmoves, vcnt) = valid_moves();
        let count = vcnt[prev as usize] as usize;
        let row = &vmoves[prev as usize];
        let m4 = self.mt_edge4.as_u32();
        let mc = self.mt_corn.as_u32();
        let me = self.mt_edge.as_u32();
        let n = corn.len();
        let nf = free.len();
        for k in 0..count {
            let m = row[k] as usize;
            let ne4 = m4[e4_24 + m] as usize; // = 24 * new_edge4
            let mut ncorn = [0usize; 3];
            let mut pruned = false;
            for i in 0..n {
                let nc = mc[corn[i] + m] as usize;
                if prune[i][ne4 + nc] as u32 >= depth {
                    pruned = true;
                    break;
                }
                ncorn[i] = nc;
            }
            if pruned {
                continue;
            }
            if depth == 1 {
                // 所有 solved 槽 prune < 1 ⇒ == 0;只差棱归位 + 自由棱 EO 全好。
                let mut ok = true;
                for i in 0..n {
                    if me[edge[i] + m] as usize != egoal[i] {
                        ok = false;
                        break;
                    }
                }
                if ok {
                    for j in 0..nf {
                        if me[free[j] + m] as usize % 2 != 0 {
                            ok = false;
                            break;
                        }
                    }
                }
                if ok {
                    return true;
                }
            } else {
                let mut nc18 = [0usize; 3];
                let mut ne18 = [0usize; 3];
                let mut nf18 = [0usize; 3];
                for i in 0..n {
                    nc18[i] = ncorn[i] * 18;
                    ne18[i] = me[edge[i] + m] as usize * 18;
                }
                for j in 0..nf {
                    nf18[j] = me[free[j] + m] as usize * 18;
                }
                if self.search_combo(
                    ne4,
                    &nc18[..n],
                    &ne18[..n],
                    egoal,
                    &nf18[..nf],
                    prune,
                    depth - 1,
                    m as u8,
                ) {
                    return true;
                }
            }
        }
        false
    }

    /// 解单个 combo 的最优步数;`h` = 根剪枝下界,`best` = 当前最优(用于封顶早停)。
    fn solve_combo(
        &self,
        e4_24: usize,
        corn_root: &[usize; 4],
        edge_root: &[usize; 4],
        combo: &[usize],
        h: u32,
        cap: u32,
        best: u32,
    ) -> u32 {
        let n = combo.len();
        let mut prune_refs = [self.prune.tables[0].as_slice(); 3];
        let mut corn = [0usize; 3];
        let mut edge = [0usize; 3];
        let mut egoal = [0usize; 3];
        for (i, &s) in combo.iter().enumerate() {
            prune_refs[i] = self.prune.tables[s].as_slice();
            corn[i] = corn_root[s];
            edge[i] = edge_root[s];
            egoal[i] = SLOT_EDGE[s];
        }
        let mut free = [0usize; 3];
        let mut nf = 0;
        for s in 0..4 {
            if !combo.contains(&s) {
                free[nf] = edge_root[s];
                nf += 1;
            }
        }

        // 根门控:所有 solved 槽 prune==0 且棱归位,且自由棱 EO 全好。
        let root_ok = (0..n).all(|i| prune_refs[i][e4_24 + corn[i]] == 0 && edge[i] == egoal[i])
            && (0..nf).all(|j| free[j] % 2 == 0);
        if root_ok {
            return 0;
        }

        let corn18: [usize; 3] = std::array::from_fn(|i| corn[i] * 18);
        let edge18: [usize; 3] = std::array::from_fn(|i| edge[i] * 18);
        let free18: [usize; 3] = std::array::from_fn(|j| free[j] * 18);
        let max_d = cap.min(best.saturating_sub(1));
        let start = h.max(1);
        for d in start..=max_d {
            if self.search_combo(
                e4_24,
                &corn18[..n],
                &edge18[..n],
                &egoal[..n],
                &free18[..nf],
                &prune_refs[..n],
                d,
                18,
            ) {
                return d;
            }
        }
        99
    }

    /// 一个阶段(xc/xxc/xxxc):min over 组合,按根剪枝下界排序 + 早停。
    fn solve_stage(
        &self,
        e4_24: usize,
        corn_root: &[usize; 4],
        edge_root: &[usize; 4],
        combos: &[&[usize]],
        cap: u32,
    ) -> u32 {
        let prune = &self.prune.tables;
        let mut scored: [(u32, &[usize]); 6] = [(0, &[]); 6];
        for (k, &c) in combos.iter().enumerate() {
            let h = c
                .iter()
                .map(|&s| prune[s][e4_24 + corn_root[s]] as u32)
                .max()
                .unwrap();
            scored[k] = (h, c);
        }
        let m = combos.len();
        scored[..m].sort_by_key(|t| t.0);
        let mut best = 99u32;
        for &(h, combo) in &scored[..m] {
            if h >= best {
                break;
            }
            let res = self.solve_combo(e4_24, corn_root, edge_root, combo, h, cap, best);
            best = best.min(res);
        }
        best
    }

    // 12 朝向 = 6 面 × {无 y, y};每面折叠取 min。F2LEO 的 EO 轴可由 y 自由选
    // (整体转动不计步), 真实值 = min(face, face+y), 与 eo 分析器同口径。

    /// 把一条(已旋转)move 序列推进到根状态:两棱组 i1/i2、edge4(×24 form)、
    /// 4 个 F2L 槽角(0..23)、4 个 F2L 槽棱(0..23)。
    fn root_state(&self, a: &[u8]) -> (usize, usize, usize, [usize; 4], [usize; 4]) {
        let m2 = self.mt_edge2.as_u32();
        let m4 = self.mt_edge4.as_u32();
        let mc = self.mt_corn.as_u32();
        let me = self.mt_edge.as_u32();
        let mut i1 = E2A;
        let mut i2 = E2B;
        let mut e4_24 = E4_SOLVED * 24;
        let mut corn = SLOT_CORNER;
        let mut edg = SLOT_EDGE;
        for &mm in a {
            let m = mm as usize;
            i1 = m2[i1 * 18 + m] as usize;
            i2 = m2[i2 * 18 + m] as usize;
            e4_24 = m4[e4_24 + m] as usize;
            for s in 0..4 {
                corn[s] = mc[corn[s] * 18 + m] as usize;
                edg[s] = me[edg[s] * 18 + m] as usize;
            }
        }
        (i1, i2, e4_24, corn, edg)
    }

    /// 单个阶段(0=cross,1=xc,2=xxc,3=xxxc)的 12 朝向解,折叠成 6 值
    /// (D/U/L/R/F/B = z0/z2/z3/z1/x3/x1)。cross 用精确 pt_cross 故极快;
    /// xc/xxc/xxxc 用弱剪枝故慢。UI 默认只看 cross → 先单算 cross 秒出。
    pub fn get_stage(&self, alg: &[Move], stage: usize) -> Vec<u32> {
        const ROTS12: [&str; 12] =
            ["", "y", "z2", "z2 y", "z'", "z' y", "z", "z y", "x'", "x' y", "x", "x y"];
        let base: Vec<u8> = alg.iter().map(|m| m.index() as u8).collect();
        let mut v = [0u32; 12];
        for (r, rot) in ROTS12.iter().enumerate() {
            let mut a = base.clone();
            alg_rotation(&mut a, rot);
            let (i1, i2, e4_24, corn, edg) = self.root_state(&a);
            v[r] = match stage {
                0 => self.solve_cross(i1, i2, edg),
                1 => self.solve_stage(e4_24, &corn, &edg, &XC, CAP_XC),
                2 => self.solve_stage(e4_24, &corn, &edg, &XXC, CAP_XXC),
                _ => self.solve_stage(e4_24, &corn, &edg, &XXXC, CAP_XXXC),
            };
        }
        (0..6).map(|k| v[2 * k].min(v[2 * k + 1])).collect()
    }

    /// 6 视角 × 4 阶段,返回 24 值,顺序 [cross×6, xcross×6, xxcross×6, xxxcross×6]。
    pub fn get_stats(&self, alg: &[Move]) -> Vec<u32> {
        let mut cross = [0u32; 12];
        let mut xc = [0u32; 12];
        let mut xxc = [0u32; 12];
        let mut xxxc = [0u32; 12];

        let base: Vec<u8> = alg.iter().map(|m| m.index() as u8).collect();
        const ROTS12: [&str; 12] =
            ["", "y", "z2", "z2 y", "z'", "z' y", "z", "z y", "x'", "x' y", "x", "x y"];

        for (r, rot) in ROTS12.iter().enumerate() {
            let mut a = base.clone();
            alg_rotation(&mut a, rot);
            let (i1, i2, e4_24, corn, edg) = self.root_state(&a);
            cross[r] = self.solve_cross(i1, i2, edg);
            xc[r] = self.solve_stage(e4_24, &corn, &edg, &XC, CAP_XC);
            xxc[r] = self.solve_stage(e4_24, &corn, &edg, &XXC, CAP_XXC);
            xxxc[r] = self.solve_stage(e4_24, &corn, &edg, &XXXC, CAP_XXXC);
        }

        // 折叠:每面 = min(无 y, y);顺序 D/U/L/R/F/B = z0/z2/z3/z1/x3/x1。
        let mut out = Vec::with_capacity(24);
        for arr in [&cross, &xc, &xxc, &xxxc] {
            for k in 0..6 {
                out.push(arr[2 * k].min(arr[2 * k + 1]));
            }
        }
        out
    }

    // ===================== 多解枚举(带 y 帧 + combo + cap)=====================
    // 镜像 search_cross / search_combo,但收集 path 而非首解返回。F2LEO 破坏 y 对称
    // (同 eo_cross_solver):best_len = min(rot, rot·y),返回 winning frame(可能含尾 y)
    // + 该 rot 帧 raw move 索引路径。剪枝 / 叶子门控与 count 完全一致(可采纳下界)⇒ 跨帧
    // 跨 combo 按 h 升序迭代加深,首个出解深度即真最优 = best_len(= get_stage 该 face 值)。

    /// 镜像 search_cross,收集 path。叶子:cross solved(pr<1⟹0)∧ 4 个 F2L 棱 EO 全好。
    #[allow(clippy::too_many_arguments)]
    fn enum_cross(
        &self,
        i1: usize,
        i2: usize,
        eo: [usize; 4],
        depth: u32,
        prev: u8,
        path: &mut Vec<u8>,
        out: &mut Vec<Vec<u8>>,
        cap: usize,
    ) {
        if out.len() >= cap {
            return;
        }
        let (vmoves, vcnt) = valid_moves();
        let count = vcnt[prev as usize] as usize;
        let row = &vmoves[prev as usize];
        let m2 = self.mt_edge2.as_u32();
        let me = self.mt_edge.as_u32();
        for k in 0..count {
            if out.len() >= cap {
                return;
            }
            let m = row[k] as usize;
            let n1 = m2[i1 + m] as usize;
            let n2 = m2[i2 + m] as usize;
            let pr = self.pt_cross.get((n1 as u64) * (E2 as u64) + n2 as u64) as u32;
            if pr >= depth {
                continue;
            }
            let ne: [usize; 4] = std::array::from_fn(|t| me[eo[t] + m] as usize);
            path.push(m as u8);
            if depth == 1 {
                if ne.iter().all(|&e| e % 2 == 0) {
                    out.push(path.clone());
                }
            } else if pr > 0 || ne.iter().any(|&e| e % 2 != 0) {
                // cross 已解(pr==0)且自由棱 EO 全好却仍要走步 = 更短解 + 无效尾动,跳过。
                self.enum_cross(
                    n1 * 18,
                    n2 * 18,
                    std::array::from_fn(|t| ne[t] * 18),
                    depth - 1,
                    m as u8,
                    path,
                    out,
                    cap,
                );
            }
            path.pop();
        }
    }

    /// 镜像 search_combo,收集 path。叶子:已解槽棱归位 ∧ 自由棱 EO 全好。
    #[allow(clippy::too_many_arguments)]
    fn enum_combo(
        &self,
        e4_24: usize,
        corn: &[usize],
        edge: &[usize],
        egoal: &[usize],
        free: &[usize],
        prune: &[&[u8]],
        depth: u32,
        prev: u8,
        path: &mut Vec<u8>,
        out: &mut Vec<Vec<u8>>,
        cap: usize,
    ) {
        if out.len() >= cap {
            return;
        }
        let (vmoves, vcnt) = valid_moves();
        let count = vcnt[prev as usize] as usize;
        let row = &vmoves[prev as usize];
        let m4 = self.mt_edge4.as_u32();
        let mc = self.mt_corn.as_u32();
        let me = self.mt_edge.as_u32();
        let n = corn.len();
        let nf = free.len();
        for k in 0..count {
            if out.len() >= cap {
                return;
            }
            let m = row[k] as usize;
            let ne4 = m4[e4_24 + m] as usize;
            let mut ncorn = [0usize; 3];
            let mut pruned = false;
            let mut max_pr = 0u32; // 各槽 prune 最大值;==0 是「全解」的必要条件之一
            for i in 0..n {
                let nc = mc[corn[i] + m] as usize;
                let pr = prune[i][ne4 + nc] as u32;
                if pr >= depth {
                    pruned = true;
                    break;
                }
                if pr > max_pr {
                    max_pr = pr;
                }
                ncorn[i] = nc;
            }
            if pruned {
                continue;
            }
            // 子状态目标判定(与 depth==1 叶子同一判据):已解槽棱归位 ∧ 自由棱 EO 全好。
            let mut ok = true;
            for i in 0..n {
                if me[edge[i] + m] as usize != egoal[i] {
                    ok = false;
                    break;
                }
            }
            if ok {
                for j in 0..nf {
                    if me[free[j] + m] as usize % 2 != 0 {
                        ok = false;
                        break;
                    }
                }
            }
            path.push(m as u8);
            if depth == 1 {
                if ok {
                    out.push(path.clone());
                }
            } else if !(max_pr == 0 && ok) {
                // 全解(各槽 prune==0 ∧ 槽棱归位 ∧ 自由棱 EO)却仍要走步 = 更短解 + 无效尾动,跳过。
                let mut nc18 = [0usize; 3];
                let mut ne18 = [0usize; 3];
                let mut nf18 = [0usize; 3];
                for i in 0..n {
                    nc18[i] = ncorn[i] * 18;
                    ne18[i] = me[edge[i] + m] as usize * 18;
                }
                for j in 0..nf {
                    nf18[j] = me[free[j] + m] as usize * 18;
                }
                self.enum_combo(
                    ne4,
                    &nc18[..n],
                    &ne18[..n],
                    egoal,
                    &nf18[..nf],
                    prune,
                    depth - 1,
                    m as u8,
                    path,
                    out,
                    cap,
                );
            }
            path.pop();
        }
    }

    /// 单 face 多解枚举:返回 (best_len, 解集)。每条解带自己的 (frame, combo 棱槽, move 路径),
    /// 因并列最优可能落在不同 frame(rot vs rot·y)/不同 combo,故标签逐条携带。
    /// stage 0=cross(combo 空)/ 1=xc / 2=xxc / 3=xxxc。frame ∈ {rot, "{rot} y"};
    /// move 路径为该 frame 帧 raw move 索引。extra=允许超出最优步数;cap=最多收集**总**条数。
    /// 空解集 + len=0 ⟹ 该 face 已解(0 步)。
    #[allow(clippy::type_complexity)]
    /// `force`:用户指定槽位组合(索引 0..3,0=BL/1=BR/2=FR/3=FL);空 = 自动挑最优槽(逐位与
    /// 原先一致)。非空时只枚举该 combo(用它自身最优长度),不与其它槽比较。
    pub fn enumerate_small(
        &self,
        alg: &[Move],
        rot: &str,
        stage: usize,
        extra: u32,
        cap: usize,
        force: &[usize],
    ) -> (u32, Vec<(String, Vec<usize>, Vec<u8>)>) {
        let base: Vec<u8> = alg.iter().map(|m| m.index() as u8).collect();
        let y_frame = if rot.is_empty() { "y".to_string() } else { format!("{} y", rot) };
        let frames = [rot.to_string(), y_frame];

        // ---- stage 0:cross + 4 棱 EO(无 combo)----
        if stage == 0 {
            // (h, frame_idx, i1, i2, edg);root h = pt_cross 距离,pr==0 但 EO 未满兜 1。
            let mut roots: Vec<(u32, usize, usize, usize, [usize; 4])> = Vec::with_capacity(2);
            for (fi, fr) in frames.iter().enumerate() {
                let mut a = base.clone();
                alg_rotation(&mut a, fr);
                let (i1, i2, _e4, _corn, edg) = self.root_state(&a);
                let pr = self.pt_cross.get((i1 as u64) * (E2 as u64) + i2 as u64) as u32;
                let eo_ok = edg.iter().all(|&e| e % 2 == 0);
                if pr == 0 && eo_ok {
                    return (0, Vec::new()); // 已解
                }
                let h = if pr == 0 { 1 } else { pr };
                roots.push((h, fi, i1, i2, edg));
            }
            roots.sort_by_key(|t| (t.0, t.1)); // 同 h 下 rot(frame 0)优先。
            let d0 = roots.iter().map(|t| t.0).min().unwrap_or(1).max(1);

            // 求 best_len(bd)= 首个有任一 root 出解的深度;并记录该深度成功的全部 root(并列)。
            let mut best_len = 0u32;
            let mut tied: Vec<(usize, usize, usize, [usize; 4])> = Vec::new(); // (fi, i1, i2, edg)
            'find0: for d in d0..=CAP_CROSS {
                for &(h, fi, i1, i2, edg) in &roots {
                    if h > d {
                        continue;
                    }
                    let eo18: [usize; 4] = std::array::from_fn(|t| edg[t] * 18);
                    let mut probe: Vec<Vec<u8>> = Vec::new();
                    let mut path = Vec::new();
                    self.enum_cross(i1 * 18, i2 * 18, eo18, d, 18, &mut path, &mut probe, 1);
                    if !probe.is_empty() {
                        tied.push((fi, i1, i2, edg));
                    }
                }
                if !tied.is_empty() {
                    best_len = d;
                    break 'find0;
                }
            }
            if best_len == 0 {
                return (CAP_CROSS, Vec::new());
            }

            // 逐深度 d 外层、并列 frame 内层交错收集;extra 仅对并列集续;cap 控总条数。
            let mut out: Vec<(String, Vec<usize>, Vec<u8>)> = Vec::new();
            'collect0: for d in best_len..=(best_len + extra).min(CAP_CROSS) {
                for &(fi, i1, i2, edg) in &tied {
                    if out.len() >= cap {
                        break 'collect0;
                    }
                    let eo18: [usize; 4] = std::array::from_fn(|t| edg[t] * 18);
                    let mut frame_out: Vec<Vec<u8>> = Vec::new();
                    let mut path = Vec::new();
                    self.enum_cross(i1 * 18, i2 * 18, eo18, d, 18, &mut path, &mut frame_out, cap - out.len());
                    for sol in frame_out {
                        out.push((frames[fi].clone(), vec![], sol));
                    }
                }
            }
            return (best_len, out);
        }

        // ---- stage 1/2/3:combo cascade ----
        let forced: [&[usize]; 1] = [force];
        let combos: &[&[usize]] = if force.is_empty() {
            match stage {
                1 => &XC,
                2 => &XXC,
                _ => &XXXC,
            }
        } else {
            &forced
        };
        let cap_d = match stage {
            1 => CAP_XC,
            2 => CAP_XXC,
            _ => CAP_XXXC,
        };

        struct Ctx {
            e4_24: usize,
            corn: [usize; 4],
            edg: [usize; 4],
        }
        let mut ctxs: Vec<Ctx> = Vec::with_capacity(2);
        let mut cands: Vec<(u32, usize, usize)> = Vec::new(); // (h, frame_idx, combo_idx)
        for fr in frames.iter() {
            let mut a = base.clone();
            alg_rotation(&mut a, fr);
            let (_i1, _i2, e4_24, corn, edg) = self.root_state(&a);
            let fi = ctxs.len();
            for (ci, combo) in combos.iter().enumerate() {
                let h = combo
                    .iter()
                    .map(|&s| self.prune.tables[s][e4_24 + corn[s]] as u32)
                    .max()
                    .unwrap();
                if h == 0 {
                    // 根已解:角已置 + 棱归位 + 自由棱 EO 全好 → 0 步。
                    let homed = combo.iter().all(|&s| edg[s] == SLOT_EDGE[s]);
                    let free_ok = (0..4).all(|s| combo.contains(&s) || edg[s] % 2 == 0);
                    if homed && free_ok {
                        return (0, Vec::new());
                    }
                }
                cands.push((h, fi, ci));
            }
            ctxs.push(Ctx { e4_24, corn, edg });
        }
        cands.sort_by_key(|t| t.0); // 稳定:同 h 下 rot 帧、低 combo idx 优先。
        let d0 = cands.iter().map(|t| t.0).min().unwrap_or(1).max(1);

        // 单候选在深度 d 内 enum_combo 收 `out`(供 best_len 探测与正式收集复用)。
        let run = |s: &Self, fi: usize, ci: usize, d: u32, out: &mut Vec<Vec<u8>>, cap: usize| {
            let ctx = &ctxs[fi];
            let combo = combos[ci];
            let n = combo.len();
            let mut prune_refs = [s.prune.tables[0].as_slice(); 3];
            let mut corn18 = [0usize; 3];
            let mut edge18 = [0usize; 3];
            let mut egoal = [0usize; 3];
            for (i, &sl) in combo.iter().enumerate() {
                prune_refs[i] = s.prune.tables[sl].as_slice();
                corn18[i] = ctx.corn[sl] * 18;
                edge18[i] = ctx.edg[sl] * 18;
                egoal[i] = SLOT_EDGE[sl];
            }
            let mut free18 = [0usize; 3];
            let mut nf = 0;
            for sl in 0..4 {
                if !combo.contains(&sl) {
                    free18[nf] = ctx.edg[sl] * 18;
                    nf += 1;
                }
            }
            let mut path = Vec::new();
            s.enum_combo(
                ctx.e4_24, &corn18[..n], &edge18[..n], &egoal[..n], &free18[..nf],
                &prune_refs[..n], d, 18, &mut path, out, cap,
            );
        };

        // 求 best_len(bd)= 首个有任一候选出解的深度;并记录该深度成功的全部 (frame, combo)(并列)。
        let mut best_len = 0u32;
        let mut tied: Vec<(usize, usize)> = Vec::new(); // (frame_idx, combo_idx)
        'find: for d in d0..=cap_d {
            for &(h, fi, ci) in &cands {
                if h > d {
                    continue;
                }
                let mut probe: Vec<Vec<u8>> = Vec::new();
                run(self, fi, ci, d, &mut probe, 1);
                if !probe.is_empty() {
                    tied.push((fi, ci));
                }
            }
            if !tied.is_empty() {
                best_len = d;
                break 'find;
            }
        }
        if best_len == 0 {
            return (cap_d, Vec::new());
        }

        // 逐深度 d 外层、并列候选内层交错收集,保证跨候选按长度升序;extra 仅对并列集续;cap 控总条数。
        let mut out: Vec<(String, Vec<usize>, Vec<u8>)> = Vec::new();
        'collect: for d in best_len..=(best_len + extra).min(cap_d) {
            for &(fi, ci) in &tied {
                if out.len() >= cap {
                    break 'collect;
                }
                let mut cand_out: Vec<Vec<u8>> = Vec::new();
                run(self, fi, ci, d, &mut cand_out, cap - out.len());
                let combo = combos[ci].to_vec();
                for sol in cand_out {
                    out.push((frames[fi].clone(), combo.clone(), sol));
                }
            }
        }
        (best_len, out)
    }
}

// ============================================================================
// 受限步法 F2LEO(Phase 3:move mask)
// ----------------------------------------------------------------------------
// 与上面无限制小表 cascade 同结构、同剪枝表,仅把 `valid_moves()` 换成预过滤的
// `valid_moves_masked(mask)`,并加 `max_depth` 上限(限制下可能无解 / 深解超界)。
//
// 正确性:剪枝表(pt_cross / 自建 xcross 剪枝)是「无限制」距离的可采纳下界 → 对任意
// mask 仍可采纳(受限距离 ≥ 无限制距离)。从该下界起步的 IDA* 迭代加深,首个成功深度
// 即真·受限最优(≤ max_depth);超过 max_depth 仍无解返回 99 哨兵。mask=MASK_ALL 且
// max_depth 够大时与无限制版逐格 bit-exact。叶子 EO 门控(自由棱朝向)在共轭下不守恒,
// 故同 count 版仍走真实 frame 追踪。
impl F2leoSolver {
    fn search_cross_masked(
        &self,
        i1: usize,
        i2: usize,
        eo: [usize; 4],
        depth: u32,
        prev: u8,
        vm: &ValidMovesTable,
    ) -> bool {
        let (vmoves, vcnt) = vm;
        let count = vcnt[prev as usize] as usize;
        let row = &vmoves[prev as usize];
        let m2 = self.mt_edge2.as_u32();
        let me = self.mt_edge.as_u32();
        for k in 0..count {
            let m = row[k] as usize;
            let n1 = m2[i1 + m] as usize;
            let n2 = m2[i2 + m] as usize;
            let pr = self.pt_cross.get((n1 as u64) * (E2 as u64) + n2 as u64) as u32;
            if pr >= depth {
                continue;
            }
            let ne: [usize; 4] = std::array::from_fn(|t| me[eo[t] + m] as usize);
            if depth == 1 {
                if ne.iter().all(|&e| e % 2 == 0) {
                    return true;
                }
            } else if self.search_cross_masked(
                n1 * 18,
                n2 * 18,
                std::array::from_fn(|t| ne[t] * 18),
                depth - 1,
                m as u8,
                vm,
            ) {
                return true;
            }
        }
        false
    }

    /// 受限版 solve_cross:max_depth 内无解返回 99。
    fn solve_cross_masked(&self, i1: usize, i2: usize, eo: [usize; 4], vm: &ValidMovesTable, max_depth: u32) -> u32 {
        let pr = self.pt_cross.get((i1 as u64) * (E2 as u64) + i2 as u64) as u32;
        if pr == 0 && eo.iter().all(|&e| e % 2 == 0) {
            return 0;
        }
        let start = pr.max(1);
        let eo18: [usize; 4] = std::array::from_fn(|t| eo[t] * 18);
        for d in start..=max_depth {
            if self.search_cross_masked(i1 * 18, i2 * 18, eo18, d, 18, vm) {
                return d;
            }
        }
        99
    }

    #[allow(clippy::too_many_arguments)]
    fn search_combo_masked(
        &self,
        e4_24: usize,
        corn: &[usize],
        edge: &[usize],
        egoal: &[usize],
        free: &[usize],
        prune: &[&[u8]],
        depth: u32,
        prev: u8,
        vm: &ValidMovesTable,
    ) -> bool {
        let (vmoves, vcnt) = vm;
        let count = vcnt[prev as usize] as usize;
        let row = &vmoves[prev as usize];
        let m4 = self.mt_edge4.as_u32();
        let mc = self.mt_corn.as_u32();
        let me = self.mt_edge.as_u32();
        let n = corn.len();
        let nf = free.len();
        for k in 0..count {
            let m = row[k] as usize;
            let ne4 = m4[e4_24 + m] as usize;
            let mut ncorn = [0usize; 3];
            let mut pruned = false;
            for i in 0..n {
                let nc = mc[corn[i] + m] as usize;
                if prune[i][ne4 + nc] as u32 >= depth {
                    pruned = true;
                    break;
                }
                ncorn[i] = nc;
            }
            if pruned {
                continue;
            }
            if depth == 1 {
                let mut ok = true;
                for i in 0..n {
                    if me[edge[i] + m] as usize != egoal[i] {
                        ok = false;
                        break;
                    }
                }
                if ok {
                    for j in 0..nf {
                        if me[free[j] + m] as usize % 2 != 0 {
                            ok = false;
                            break;
                        }
                    }
                }
                if ok {
                    return true;
                }
            } else {
                let mut nc18 = [0usize; 3];
                let mut ne18 = [0usize; 3];
                let mut nf18 = [0usize; 3];
                for i in 0..n {
                    nc18[i] = ncorn[i] * 18;
                    ne18[i] = me[edge[i] + m] as usize * 18;
                }
                for j in 0..nf {
                    nf18[j] = me[free[j] + m] as usize * 18;
                }
                if self.search_combo_masked(
                    ne4,
                    &nc18[..n],
                    &ne18[..n],
                    egoal,
                    &nf18[..nf],
                    prune,
                    depth - 1,
                    m as u8,
                    vm,
                ) {
                    return true;
                }
            }
        }
        false
    }

    #[allow(clippy::too_many_arguments)]
    fn solve_combo_masked(
        &self,
        e4_24: usize,
        corn_root: &[usize; 4],
        edge_root: &[usize; 4],
        combo: &[usize],
        h: u32,
        cap: u32,
        best: u32,
        vm: &ValidMovesTable,
    ) -> u32 {
        let n = combo.len();
        let mut prune_refs = [self.prune.tables[0].as_slice(); 3];
        let mut corn = [0usize; 3];
        let mut edge = [0usize; 3];
        let mut egoal = [0usize; 3];
        for (i, &s) in combo.iter().enumerate() {
            prune_refs[i] = self.prune.tables[s].as_slice();
            corn[i] = corn_root[s];
            edge[i] = edge_root[s];
            egoal[i] = SLOT_EDGE[s];
        }
        let mut free = [0usize; 3];
        let mut nf = 0;
        for s in 0..4 {
            if !combo.contains(&s) {
                free[nf] = edge_root[s];
                nf += 1;
            }
        }
        let root_ok = (0..n).all(|i| prune_refs[i][e4_24 + corn[i]] == 0 && edge[i] == egoal[i])
            && (0..nf).all(|j| free[j] % 2 == 0);
        if root_ok {
            return 0;
        }
        let corn18: [usize; 3] = std::array::from_fn(|i| corn[i] * 18);
        let edge18: [usize; 3] = std::array::from_fn(|i| edge[i] * 18);
        let free18: [usize; 3] = std::array::from_fn(|j| free[j] * 18);
        let max_d = cap.min(best.saturating_sub(1));
        let start = h.max(1);
        for d in start..=max_d {
            if self.search_combo_masked(
                e4_24,
                &corn18[..n],
                &edge18[..n],
                &egoal[..n],
                &free18[..nf],
                &prune_refs[..n],
                d,
                18,
                vm,
            ) {
                return d;
            }
        }
        99
    }

    /// 受限版 solve_stage:cap 用 min(原阶段 cap, max_depth)。无解返回 99。
    fn solve_stage_masked(
        &self,
        e4_24: usize,
        corn_root: &[usize; 4],
        edge_root: &[usize; 4],
        combos: &[&[usize]],
        cap: u32,
        vm: &ValidMovesTable,
    ) -> u32 {
        let prune = &self.prune.tables;
        let mut scored: [(u32, &[usize]); 6] = [(0, &[]); 6];
        for (k, &c) in combos.iter().enumerate() {
            let h = c
                .iter()
                .map(|&s| prune[s][e4_24 + corn_root[s]] as u32)
                .max()
                .unwrap();
            scored[k] = (h, c);
        }
        let m = combos.len();
        scored[..m].sort_by_key(|t| t.0);
        let mut best = 99u32;
        for &(h, combo) in &scored[..m] {
            // 受限下解可能更深:h > best 才停(`>` 非 `>=`),覆盖 h == best 的并列候选。
            if h > best {
                break;
            }
            let res = self.solve_combo_masked(e4_24, corn_root, edge_root, combo, h, cap, 99, vm);
            best = best.min(res);
        }
        best
    }

    /// 受限版 get_stage:返回 6 视角值(12 朝向折叠 min);限制下无解的视角为 None。
    /// mask = 18 个 move 的 bitmask;max_depth 封顶。
    pub fn get_stage_masked(
        &self,
        alg: &[Move],
        stage: usize,
        mask: MoveMask,
        max_depth: u32,
    ) -> Vec<Option<u32>> {
        const ROTS12: [&str; 12] =
            ["", "y", "z2", "z2 y", "z'", "z' y", "z", "z y", "x'", "x' y", "x", "x y"];
        let vm = valid_moves_masked(mask);
        let base: Vec<u8> = alg.iter().map(|m| m.index() as u8).collect();
        let mut v = [99u32; 12];
        for (r, rot) in ROTS12.iter().enumerate() {
            let mut a = base.clone();
            alg_rotation(&mut a, rot);
            let (i1, i2, e4_24, corn, edg) = self.root_state(&a);
            v[r] = match stage {
                0 => self.solve_cross_masked(i1, i2, edg, &vm, CAP_CROSS.min(max_depth)),
                1 => self.solve_stage_masked(e4_24, &corn, &edg, &XC, CAP_XC.min(max_depth), &vm),
                2 => self.solve_stage_masked(e4_24, &corn, &edg, &XXC, CAP_XXC.min(max_depth), &vm),
                _ => self.solve_stage_masked(e4_24, &corn, &edg, &XXXC, CAP_XXXC.min(max_depth), &vm),
            };
        }
        (0..6)
            .map(|k| {
                let best = v[2 * k].min(v[2 * k + 1]);
                if best >= 99 { None } else { Some(best) }
            })
            .collect()
    }

    #[allow(clippy::too_many_arguments)]
    fn enum_cross_masked(
        &self,
        i1: usize,
        i2: usize,
        eo: [usize; 4],
        depth: u32,
        prev: u8,
        path: &mut Vec<u8>,
        out: &mut Vec<Vec<u8>>,
        cap: usize,
        vm: &ValidMovesTable,
    ) {
        if out.len() >= cap {
            return;
        }
        let (vmoves, vcnt) = vm;
        let count = vcnt[prev as usize] as usize;
        let row = &vmoves[prev as usize];
        let m2 = self.mt_edge2.as_u32();
        let me = self.mt_edge.as_u32();
        for k in 0..count {
            if out.len() >= cap {
                return;
            }
            let m = row[k] as usize;
            let n1 = m2[i1 + m] as usize;
            let n2 = m2[i2 + m] as usize;
            let pr = self.pt_cross.get((n1 as u64) * (E2 as u64) + n2 as u64) as u32;
            if pr >= depth {
                continue;
            }
            let ne: [usize; 4] = std::array::from_fn(|t| me[eo[t] + m] as usize);
            path.push(m as u8);
            if depth == 1 {
                if ne.iter().all(|&e| e % 2 == 0) {
                    out.push(path.clone());
                }
            } else if pr > 0 || ne.iter().any(|&e| e % 2 != 0) {
                self.enum_cross_masked(
                    n1 * 18,
                    n2 * 18,
                    std::array::from_fn(|t| ne[t] * 18),
                    depth - 1,
                    m as u8,
                    path,
                    out,
                    cap,
                    vm,
                );
            }
            path.pop();
        }
    }

    #[allow(clippy::too_many_arguments)]
    fn enum_combo_masked(
        &self,
        e4_24: usize,
        corn: &[usize],
        edge: &[usize],
        egoal: &[usize],
        free: &[usize],
        prune: &[&[u8]],
        depth: u32,
        prev: u8,
        path: &mut Vec<u8>,
        out: &mut Vec<Vec<u8>>,
        cap: usize,
        vm: &ValidMovesTable,
    ) {
        if out.len() >= cap {
            return;
        }
        let (vmoves, vcnt) = vm;
        let count = vcnt[prev as usize] as usize;
        let row = &vmoves[prev as usize];
        let m4 = self.mt_edge4.as_u32();
        let mc = self.mt_corn.as_u32();
        let me = self.mt_edge.as_u32();
        let n = corn.len();
        let nf = free.len();
        for k in 0..count {
            if out.len() >= cap {
                return;
            }
            let m = row[k] as usize;
            let ne4 = m4[e4_24 + m] as usize;
            let mut ncorn = [0usize; 3];
            let mut pruned = false;
            let mut max_pr = 0u32;
            for i in 0..n {
                let nc = mc[corn[i] + m] as usize;
                let pr = prune[i][ne4 + nc] as u32;
                if pr >= depth {
                    pruned = true;
                    break;
                }
                if pr > max_pr {
                    max_pr = pr;
                }
                ncorn[i] = nc;
            }
            if pruned {
                continue;
            }
            let mut ok = true;
            for i in 0..n {
                if me[edge[i] + m] as usize != egoal[i] {
                    ok = false;
                    break;
                }
            }
            if ok {
                for j in 0..nf {
                    if me[free[j] + m] as usize % 2 != 0 {
                        ok = false;
                        break;
                    }
                }
            }
            path.push(m as u8);
            if depth == 1 {
                if ok {
                    out.push(path.clone());
                }
            } else if !(max_pr == 0 && ok) {
                let mut nc18 = [0usize; 3];
                let mut ne18 = [0usize; 3];
                let mut nf18 = [0usize; 3];
                for i in 0..n {
                    nc18[i] = ncorn[i] * 18;
                    ne18[i] = me[edge[i] + m] as usize * 18;
                }
                for j in 0..nf {
                    nf18[j] = me[free[j] + m] as usize * 18;
                }
                self.enum_combo_masked(
                    ne4,
                    &nc18[..n],
                    &ne18[..n],
                    egoal,
                    &nf18[..nf],
                    prune,
                    depth - 1,
                    m as u8,
                    path,
                    out,
                    cap,
                    vm,
                );
            }
            path.pop();
        }
    }

    /// 受限版 enumerate_small:同形 (best_len, Vec<(frame, combo, sol)>);限制下无解返回 (99, []).
    #[allow(clippy::too_many_arguments)]
    pub fn enumerate_small_masked(
        &self,
        alg: &[Move],
        rot: &str,
        stage: usize,
        extra: u32,
        cap: usize,
        force: &[usize],
        mask: MoveMask,
        max_depth: u32,
    ) -> (u32, Vec<(String, Vec<usize>, Vec<u8>)>) {
        let vm = valid_moves_masked(mask);
        let base: Vec<u8> = alg.iter().map(|m| m.index() as u8).collect();
        let y_frame = if rot.is_empty() { "y".to_string() } else { format!("{} y", rot) };
        let frames = [rot.to_string(), y_frame];

        // ---- stage 0:cross + 4 棱 EO ----
        if stage == 0 {
            let cap_d = CAP_CROSS.min(max_depth);
            let mut roots: Vec<(u32, usize, usize, usize, [usize; 4])> = Vec::with_capacity(2);
            for (fi, fr) in frames.iter().enumerate() {
                let mut a = base.clone();
                alg_rotation(&mut a, fr);
                let (i1, i2, _e4, _corn, edg) = self.root_state(&a);
                let pr = self.pt_cross.get((i1 as u64) * (E2 as u64) + i2 as u64) as u32;
                let eo_ok = edg.iter().all(|&e| e % 2 == 0);
                if pr == 0 && eo_ok {
                    return (0, Vec::new());
                }
                let h = if pr == 0 { 1 } else { pr };
                roots.push((h, fi, i1, i2, edg));
            }
            roots.sort_by_key(|t| (t.0, t.1));
            let d0 = roots.iter().map(|t| t.0).min().unwrap_or(1).max(1);

            let mut best_len = 99u32;
            let mut tied: Vec<(usize, usize, usize, [usize; 4])> = Vec::new();
            'find0: for d in d0..=cap_d {
                for &(h, fi, i1, i2, edg) in &roots {
                    if h > d {
                        continue;
                    }
                    let eo18: [usize; 4] = std::array::from_fn(|t| edg[t] * 18);
                    let mut probe: Vec<Vec<u8>> = Vec::new();
                    let mut path = Vec::new();
                    self.enum_cross_masked(i1 * 18, i2 * 18, eo18, d, 18, &mut path, &mut probe, 1, &vm);
                    if !probe.is_empty() {
                        tied.push((fi, i1, i2, edg));
                    }
                }
                if !tied.is_empty() {
                    best_len = d;
                    break 'find0;
                }
            }
            if best_len >= 99 {
                return (99, Vec::new());
            }

            let mut out: Vec<(String, Vec<usize>, Vec<u8>)> = Vec::new();
            'collect0: for d in best_len..=(best_len + extra).min(cap_d) {
                for &(fi, i1, i2, edg) in &tied {
                    if out.len() >= cap {
                        break 'collect0;
                    }
                    let eo18: [usize; 4] = std::array::from_fn(|t| edg[t] * 18);
                    let mut frame_out: Vec<Vec<u8>> = Vec::new();
                    let mut path = Vec::new();
                    self.enum_cross_masked(i1 * 18, i2 * 18, eo18, d, 18, &mut path, &mut frame_out, cap - out.len(), &vm);
                    for sol in frame_out {
                        out.push((frames[fi].clone(), vec![], sol));
                    }
                }
            }
            return (best_len, out);
        }

        // ---- stage 1/2/3:combo cascade ----
        let forced: [&[usize]; 1] = [force];
        let combos: &[&[usize]] = if force.is_empty() {
            match stage {
                1 => &XC,
                2 => &XXC,
                _ => &XXXC,
            }
        } else {
            &forced
        };
        let cap_d = match stage {
            1 => CAP_XC,
            2 => CAP_XXC,
            _ => CAP_XXXC,
        }
        .min(max_depth);

        struct Ctx {
            e4_24: usize,
            corn: [usize; 4],
            edg: [usize; 4],
        }
        let mut ctxs: Vec<Ctx> = Vec::with_capacity(2);
        let mut cands: Vec<(u32, usize, usize)> = Vec::new();
        for fr in frames.iter() {
            let mut a = base.clone();
            alg_rotation(&mut a, fr);
            let (_i1, _i2, e4_24, corn, edg) = self.root_state(&a);
            let fi = ctxs.len();
            for (ci, combo) in combos.iter().enumerate() {
                let h = combo
                    .iter()
                    .map(|&s| self.prune.tables[s][e4_24 + corn[s]] as u32)
                    .max()
                    .unwrap();
                cands.push((h, fi, ci));
            }
            ctxs.push(Ctx { e4_24, corn, edg });
        }
        cands.sort_by_key(|t| t.0);
        let d0 = cands.iter().map(|t| t.0).min().unwrap_or(1).max(1);

        let run = |s: &Self, fi: usize, ci: usize, d: u32, out: &mut Vec<Vec<u8>>, cap: usize| {
            let ctx = &ctxs[fi];
            let combo = combos[ci];
            let n = combo.len();
            let mut prune_refs = [s.prune.tables[0].as_slice(); 3];
            let mut corn18 = [0usize; 3];
            let mut edge18 = [0usize; 3];
            let mut egoal = [0usize; 3];
            for (i, &sl) in combo.iter().enumerate() {
                prune_refs[i] = s.prune.tables[sl].as_slice();
                corn18[i] = ctx.corn[sl] * 18;
                edge18[i] = ctx.edg[sl] * 18;
                egoal[i] = SLOT_EDGE[sl];
            }
            let mut free18 = [0usize; 3];
            let mut nf = 0;
            for sl in 0..4 {
                if !combo.contains(&sl) {
                    free18[nf] = ctx.edg[sl] * 18;
                    nf += 1;
                }
            }
            let mut path = Vec::new();
            s.enum_combo_masked(
                ctx.e4_24, &corn18[..n], &edge18[..n], &egoal[..n], &free18[..nf],
                &prune_refs[..n], d, 18, &mut path, out, cap, &vm,
            );
        };

        let mut best_len = 99u32;
        let mut tied: Vec<(usize, usize)> = Vec::new();
        'find: for d in d0..=cap_d {
            for &(h, fi, ci) in &cands {
                if h > d {
                    continue;
                }
                let mut probe: Vec<Vec<u8>> = Vec::new();
                run(self, fi, ci, d, &mut probe, 1);
                if !probe.is_empty() {
                    tied.push((fi, ci));
                }
            }
            if !tied.is_empty() {
                best_len = d;
                break 'find;
            }
        }
        if best_len >= 99 {
            return (99, Vec::new());
        }

        let mut out: Vec<(String, Vec<usize>, Vec<u8>)> = Vec::new();
        'collect: for d in best_len..=(best_len + extra).min(cap_d) {
            for &(fi, ci) in &tied {
                if out.len() >= cap {
                    break 'collect;
                }
                let mut cand_out: Vec<Vec<u8>> = Vec::new();
                run(self, fi, ci, d, &mut cand_out, cap - out.len());
                let combo = combos[ci].to_vec();
                for sol in cand_out {
                    out.push((frames[fi].clone(), combo.clone(), sol));
                }
            }
        }
        (best_len, out)
    }
}

// ============================================================================
// 大表版 F2LEO(native-only)
// ============================================================================
//
// 动机:上面的 `F2leoSolver` 在 xcross/xxcross/xxxcross 用「cross + 单角」逐槽弱剪枝
// (~18 MB 自建表),启发式离真值 gap 大、节点爆炸(实测 ~3.5 例/s)。本节复用 std
// `XCrossSolver` 已 golden 验证的「联合大表」cross 进度启发式:
//   - XCross:`pt_cross_C4E0`(52 MB,cross + 1 角 + 1 棱,单槽精确距离)。
//   - XXCross:1 张 pair huge 表(neighbor `pt_cross_C4C5E0E1` / diagonal
//     `pt_cross_C4C6E0E2`,各 ~10 GB,cross + 2 角 + 2 棱的精确 pair 距离)。
//   - XXXCross:三元组的 3 个 pair,取 3 张 huge 表的 max。
// 叶子额外门控「自由 F2L 棱 EO」(实 frame,与小表版同口径)。
//
// 正确性:cross 进度搜索 = std `XCrossSolver` 逐字节同构(共轭坐标 + 同剪枝),已对
// C++ golden bit-exact;此处仅在叶子加「自由棱 EO 全好」判定 + 用实 frame 棱追踪,
// 目标与小表版完全相同(cross+n 槽解 ∧ 自由 F2L 棱朝向好)。两版均用可采纳下界 +
// 迭代加深到同一目标,故首达深度(= 输出值)逐格一致 —— 实测对小表版 golden bit-exact。
// huge 表是 cross 进度的「近乎精确」下界(实测 f2leo 值 ≈ std 值,xxxcross delta avg
// 0.03),故 EO 尾巴只有 0~2 步,搜索访问节点远少于弱剪枝版。
//
// 仅 native;wasm 路径仍用 `F2leoSolver`(小表 cascade)。需 huge 表 +
// `CUBE_ALLOW_HUGE_TABLES=1`(否则 manager ensure huge 会 panic)。
#[cfg(not(target_arch = "wasm32"))]
use crate::cube_common::{
    array_to_index, conj_moves_flat, get_diagonal_view, get_neighbor_view,
};
#[cfg(not(target_arch = "wasm32"))]
use crate::executor::bump_node_count;

#[cfg(not(target_arch = "wasm32"))]
const CORNER2: usize = state_space::CORNER2; // 504
#[cfg(not(target_arch = "wasm32"))]
const IDX_C4: u32 = 12;

/// 单槽位在(已旋转)alg 下的共轭虚拟状态。im/ic/ie 用于 XCross(pt_cross_C4E0);
/// ie6_*/ic2_* 用于 huge pair 表(nb=neighbor, dg=diagonal)。对应 std `VirtState`。
#[cfg(not(target_arch = "wasm32"))]
#[derive(Debug, Clone, Copy, Default)]
struct BigVirt {
    im: u32,
    ic: u32,
    ie: u32,
    ie6_nb: u32,
    ic2_nb: u32,
    ie6_dg: u32,
    ic2_dg: u32,
}

#[cfg(not(target_arch = "wasm32"))]
pub struct F2leoBigSolver {
    mt_edge2: Arc<MoveTable>,
    mt_edge4: Arc<MoveTable>,
    mt_corn: Arc<MoveTable>,
    mt_edge: Arc<MoveTable>,
    mt_edge6: Arc<MoveTable>,
    mt_corn2: Arc<MoveTable>,
    pt_cross: Arc<PackedPruneTable>,
    pt_cross_c4e0: Arc<PackedPruneTable>,
    pt_nb: Arc<PackedPruneTable>, // pt_cross_C4C5E0E1 (neighbor)
    pt_dg: Arc<PackedPruneTable>, // pt_cross_C4C6E0E2 (diagonal)
    idx_solved_e6_nb: u32,
    idx_solved_c2_nb: u32,
    idx_solved_e6_dg: u32,
    idx_solved_c2_dg: u32,
}

#[cfg(not(target_arch = "wasm32"))]
const PAIRS: [(usize, usize); 6] = [(0, 1), (0, 2), (0, 3), (1, 2), (1, 3), (2, 3)];
#[cfg(not(target_arch = "wasm32"))]
const TRIPS: [(usize, usize, usize); 4] = [(0, 1, 2), (0, 1, 3), (0, 2, 3), (1, 2, 3)];

#[cfg(not(target_arch = "wasm32"))]
impl F2leoBigSolver {
    /// native:经 manager ensure 全部表(huge 需 CUBE_ALLOW_HUGE_TABLES=1)。
    pub fn new() -> Self {
        let mtm = move_tables::instance();
        let ptm = prune_tables::instance();

        let v_e6_nb: [i32; 6] = [0, 2, 16, 18, 20, 22];
        let v_e6_dg: [i32; 6] = [0, 4, 16, 18, 20, 22];
        let v_c2_nb: [i32; 2] = [12, 15];
        let v_c2_dg: [i32; 2] = [12, 18];

        F2leoBigSolver {
            mt_edge2: mtm.ensure_edge2(),
            mt_edge4: mtm.ensure_edge4(),
            mt_corn: mtm.ensure_corn(),
            mt_edge: mtm.ensure_edge(),
            mt_edge6: mtm.ensure_edge6(),
            mt_corn2: mtm.ensure_corn2(),
            pt_cross: ptm.ensure_pt_cross(),
            pt_cross_c4e0: ptm.ensure_pt_cross_c4e0(),
            pt_nb: ptm.ensure_pt_cross_c4c5e0e1(),
            pt_dg: ptm.ensure_pt_cross_c4c6e0e2(),
            idx_solved_e6_nb: array_to_index(&v_e6_nb, 6, 2, 12) as u32,
            idx_solved_c2_nb: array_to_index(&v_c2_nb, 2, 3, 8) as u32,
            idx_solved_e6_dg: array_to_index(&v_e6_dg, 6, 2, 12) as u32,
            idx_solved_c2_dg: array_to_index(&v_c2_dg, 2, 3, 8) as u32,
        }
    }

    /// 实 frame 根状态:两棱组 i1/i2(cross 用),4 个 F2L 棱 edg[0..3]
    /// (原始 0..23,= 2*pos+ori;用于 cross 阶段 + 自由棱 EO 门控)。
    fn real_root(&self, a: &[u8]) -> (usize, usize, [usize; 4]) {
        let m2 = self.mt_edge2.as_u32();
        let me = self.mt_edge.as_u32();
        let mut i1 = E2A;
        let mut i2 = E2B;
        let mut edg = SLOT_EDGE;
        for &mm in a {
            let m = mm as usize;
            i1 = m2[i1 * 18 + m] as usize;
            i2 = m2[i2 * 18 + m] as usize;
            for s in 0..4 {
                edg[s] = me[edg[s] * 18 + m] as usize;
            }
        }
        (i1, i2, edg)
    }

    /// 在 slot_k 视角下推(已旋转)alg,得共轭虚拟状态。对应 std `get_virt`。
    fn get_virt(&self, alg: &[u8], slot_k: usize) -> BigVirt {
        let mt_e4 = self.mt_edge4.as_u32();
        let mt_c = self.mt_corn.as_u32();
        let mt_e = self.mt_edge.as_u32();
        let mt_e6 = self.mt_edge6.as_u32();
        let mt_c2 = self.mt_corn2.as_u32();
        let cj = conj_moves_flat();

        let mut cur_mul: u32 = (state_space::CROSS_SOLVED as u32) * (state_space::CORNER as u32);
        let mut cur_corn: u32 = IDX_C4 * 18;
        let mut cur_e0: u32 = 0;
        let mut e6_nb = self.idx_solved_e6_nb * 18;
        let mut c2_nb = self.idx_solved_c2_nb * 18;
        let mut e6_dg = self.idx_solved_e6_dg * 18;
        let mut c2_dg = self.idx_solved_c2_dg * 18;

        for &m in alg {
            let mc = cj[m as usize][slot_k] as usize;
            cur_mul = mt_e4[(cur_mul as usize) + mc];
            cur_corn = mt_c[(cur_corn as usize) + mc] * 18;
            cur_e0 = mt_e[(cur_e0 as usize) * 18 + mc];
            e6_nb = mt_e6[(e6_nb as usize) + mc] * 18;
            c2_nb = mt_c2[(c2_nb as usize) + mc] * 18;
            e6_dg = mt_e6[(e6_dg as usize) + mc] * 18;
            c2_dg = mt_c2[(c2_dg as usize) + mc] * 18;
        }
        BigVirt {
            im: cur_mul,
            ic: cur_corn / 18,
            ie: cur_e0,
            ie6_nb: e6_nb / 18,
            ic2_nb: c2_nb / 18,
            ie6_dg: e6_dg / 18,
            ic2_dg: c2_dg / 18,
        }
    }

    /// 单视角 huge 表查值:pair (a,b) 优先 neighbor,否则 diagonal。对应 std `pair_huge`。
    fn pair_huge<'a>(&'a self, st: &[BigVirt; 4], a: usize, b: usize) -> (u32, u32, i32, &'a PackedPruneTable) {
        let v_nb = get_neighbor_view(a as i32, b as i32);
        if v_nb != -1 {
            let s = &st[v_nb as usize];
            (s.ie6_nb, s.ic2_nb, v_nb, &self.pt_nb)
        } else {
            let v_dg = get_diagonal_view(a as i32, b as i32);
            let s = &st[v_dg as usize];
            (s.ie6_dg, s.ic2_dg, v_dg, &self.pt_dg)
        }
    }

    /// huge 表推进 + 剪枝。对应 std `huge_check`(conj=-1 视为不剪)。
    #[inline]
    fn huge_check(&self, conj: i32, table: &PackedPruneTable, e6: u32, c2: u32, m: usize, depth: u32) -> (bool, u32, u32) {
        if conj == -1 {
            return (false, 0, 0);
        }
        let cj = conj_moves_flat();
        let mx = cj[m][conj as usize] as usize;
        let n_e6 = self.mt_edge6.as_u32()[(e6 as usize) * 18 + mx];
        let n_c2 = self.mt_corn2.as_u32()[(c2 as usize) * 18 + mx];
        let idx: u64 = n_e6 as u64 * CORNER2 as u64 + n_c2 as u64;
        (table.get(idx) as u32 >= depth, n_e6, n_c2)
    }

    // ---------------- Cross 阶段(同 F2leoSolver,pt_cross + 4 棱 EO)----------------

    fn search_cross(&self, i1: usize, i2: usize, eo: [usize; 4], depth: u32, prev: u8) -> bool {
        let (vmoves, vcnt) = valid_moves();
        let count = vcnt[prev as usize] as usize;
        let row = &vmoves[prev as usize];
        let m2 = self.mt_edge2.as_u32();
        let me = self.mt_edge.as_u32();
        for k in 0..count {
            let m = row[k] as usize;
            let n1 = m2[i1 + m] as usize;
            let n2 = m2[i2 + m] as usize;
            let pr = self.pt_cross.get((n1 as u64) * (E2 as u64) + n2 as u64) as u32;
            if pr >= depth {
                continue;
            }
            let ne: [usize; 4] = std::array::from_fn(|t| me[eo[t] + m] as usize);
            if depth == 1 {
                if ne.iter().all(|&e| e % 2 == 0) {
                    return true;
                }
            } else if self.search_cross(
                n1 * 18,
                n2 * 18,
                std::array::from_fn(|t| ne[t] * 18),
                depth - 1,
                m as u8,
            ) {
                return true;
            }
        }
        false
    }

    fn solve_cross(&self, i1: usize, i2: usize, eo: [usize; 4]) -> u32 {
        let pr = self.pt_cross.get((i1 as u64) * (E2 as u64) + i2 as u64) as u32;
        if pr == 0 && eo.iter().all(|&e| e % 2 == 0) {
            return 0;
        }
        let start = pr.max(1);
        let eo18: [usize; 4] = std::array::from_fn(|t| eo[t] * 18);
        for d in start..=CAP_CROSS {
            if self.search_cross(i1 * 18, i2 * 18, eo18, d, 18) {
                return d;
            }
        }
        CAP_CROSS
    }

    // ---------------- XCross(单槽 pt_cross_C4E0 + 3 自由棱 EO)----------------

    fn search_x1(&self, i1: usize, i2: usize, i3: usize, slot: usize, free18: &[usize], depth: u32, prev: u8) -> bool {
        let (vmoves, vcnt) = valid_moves();
        let count = vcnt[prev as usize] as usize;
        let row = &vmoves[prev as usize];
        let mt_e4 = self.mt_edge4.as_u32();
        let mt_c = self.mt_corn.as_u32();
        let mt_e = self.mt_edge.as_u32();
        let cj = conj_moves_flat();
        let pt = &self.pt_cross_c4e0;
        let nf = free18.len();
        let mut local: u64 = 0;
        for k in 0..count {
            let m = row[k] as usize;
            local += 1;
            let m1 = cj[m][slot] as usize;
            let n1 = mt_e4[i1 + m1] as usize;
            let n2 = mt_c[i2 + m1] as usize;
            let n3 = mt_e[i3 + m1] as usize;
            let idx: u64 = (n1 as u64 + n2 as u64) * 24 + n3 as u64;
            if pt.get(idx) as u32 >= depth {
                continue;
            }
            let mut nfree = [0usize; 3];
            for j in 0..nf {
                nfree[j] = mt_e[free18[j] + m] as usize;
            }
            if depth == 1 {
                if (0..nf).all(|j| nfree[j] % 2 == 0) {
                    bump_node_count(local);
                    return true;
                }
            } else {
                let mut nf18 = [0usize; 3];
                for j in 0..nf {
                    nf18[j] = nfree[j] * 18;
                }
                if self.search_x1(n1, n2 * 18, n3 * 18, slot, &nf18[..nf], depth - 1, m as u8) {
                    bump_node_count(local);
                    return true;
                }
            }
        }
        bump_node_count(local);
        false
    }

    fn solve_xc(&self, st: &[BigVirt; 4], edg: &[usize; 4]) -> u32 {
        let mut tasks: [(usize, u32); 4] = std::array::from_fn(|k| {
            let s = &st[k];
            let idx = (s.im as u64 + s.ic as u64) * 24 + s.ie as u64;
            (k, self.pt_cross_c4e0.get(idx) as u32)
        });
        tasks.sort_by_key(|t| t.1);
        let mut best = 99u32;
        for &(s, h) in &tasks {
            if h >= best {
                break;
            }
            // 自由棱 = 非 combo 槽的 F2L 棱。
            let mut free18 = [0usize; 3];
            let mut nf = 0;
            for t in 0..4 {
                if t != s {
                    free18[nf] = edg[t] * 18;
                    nf += 1;
                }
            }
            let res = if h == 0 && (0..nf).all(|j| (free18[j] / 18) % 2 == 0) {
                0
            } else {
                let max_d = CAP_XC.min(best.saturating_sub(1));
                let mut found = 99;
                for d in h.max(1)..=max_d {
                    if self.search_x1(st[s].im as usize, (st[s].ic as usize) * 18, (st[s].ie as usize) * 18, s, &free18[..nf], d, 18) {
                        found = d;
                        break;
                    }
                }
                found
            };
            best = best.min(res);
        }
        best
    }

    // ---------------- XXCross(1 张 pair huge 表 + 2 自由棱 EO)----------------

    #[allow(clippy::too_many_arguments)]
    fn search_x2(&self, e6: u32, c2: u32, conj: i32, table: &PackedPruneTable, free18: &[usize], depth: u32, prev: u8) -> bool {
        let (vmoves, vcnt) = valid_moves();
        let count = vcnt[prev as usize] as usize;
        let row = &vmoves[prev as usize];
        let mt_e = self.mt_edge.as_u32();
        let nf = free18.len();
        let mut local: u64 = 0;
        for k in 0..count {
            let m = row[k] as usize;
            local += 1;
            let (pruned, n_e6, n_c2) = self.huge_check(conj, table, e6, c2, m, depth);
            if pruned {
                continue;
            }
            let mut nfree = [0usize; 2];
            for j in 0..nf {
                nfree[j] = mt_e[free18[j] + m] as usize;
            }
            if depth == 1 {
                if (0..nf).all(|j| nfree[j] % 2 == 0) {
                    bump_node_count(local);
                    return true;
                }
            } else {
                let mut nf18 = [0usize; 2];
                for j in 0..nf {
                    nf18[j] = nfree[j] * 18;
                }
                if self.search_x2(n_e6, n_c2, conj, table, &nf18[..nf], depth - 1, m as u8) {
                    bump_node_count(local);
                    return true;
                }
            }
        }
        bump_node_count(local);
        false
    }

    fn solve_xxc(&self, st: &[BigVirt; 4], edg: &[usize; 4]) -> u32 {
        let mut t2: [(usize, usize, u32); 6] = std::array::from_fn(|i| {
            let (a, b) = PAIRS[i];
            let (e6, c2, _, table) = self.pair_huge(st, a, b);
            let h = table.get(e6 as u64 * CORNER2 as u64 + c2 as u64) as u32;
            (a, b, h)
        });
        t2.sort_by_key(|t| t.2);
        let mut best = 99u32;
        for &(a, b, h) in &t2 {
            if h >= best {
                break;
            }
            let mut free18 = [0usize; 2];
            let mut nf = 0;
            for t in 0..4 {
                if t != a && t != b {
                    free18[nf] = edg[t] * 18;
                    nf += 1;
                }
            }
            let res = if h == 0 && (0..nf).all(|j| (free18[j] / 18) % 2 == 0) {
                0
            } else {
                let (e6, c2, conj, table) = self.pair_huge(st, a, b);
                let max_d = CAP_XXC.min(best.saturating_sub(1));
                let mut found = 99;
                for d in h.max(1)..=max_d {
                    if self.search_x2(e6, c2, conj, table, &free18[..nf], d, 18) {
                        found = d;
                        break;
                    }
                }
                found
            };
            best = best.min(res);
        }
        best
    }

    // ---------------- XXXCross(3 张 pair huge 表 + 1 自由棱 EO)----------------

    #[allow(clippy::too_many_arguments)]
    fn search_x3(
        &self,
        e6: [u32; 3],
        c2: [u32; 3],
        conj: [i32; 3],
        table: [&PackedPruneTable; 3],
        free18: usize,
        depth: u32,
        prev: u8,
    ) -> bool {
        let (vmoves, vcnt) = valid_moves();
        let count = vcnt[prev as usize] as usize;
        let row = &vmoves[prev as usize];
        let mt_e = self.mt_edge.as_u32();
        let mut local: u64 = 0;
        for k in 0..count {
            let m = row[k] as usize;
            local += 1;
            let mut n_e6 = [0u32; 3];
            let mut n_c2 = [0u32; 3];
            let mut pruned = false;
            for i in 0..3 {
                let (pr, ne6, nc2) = self.huge_check(conj[i], table[i], e6[i], c2[i], m, depth);
                if pr {
                    pruned = true;
                    break;
                }
                n_e6[i] = ne6;
                n_c2[i] = nc2;
            }
            if pruned {
                continue;
            }
            let nfree = mt_e[free18 + m] as usize;
            if depth == 1 {
                if nfree % 2 == 0 {
                    bump_node_count(local);
                    return true;
                }
            } else if self.search_x3(n_e6, n_c2, conj, table, nfree * 18, depth - 1, m as u8) {
                bump_node_count(local);
                return true;
            }
        }
        bump_node_count(local);
        false
    }

    fn solve_xxxc(&self, st: &[BigVirt; 4], edg: &[usize; 4]) -> u32 {
        let mut t3: [(usize, usize, usize, u32); 4] = std::array::from_fn(|i| {
            let (a, b, c) = TRIPS[i];
            let h = [(a, b), (b, c), (c, a)]
                .iter()
                .map(|&(x, y)| {
                    let (e6, c2, _, table) = self.pair_huge(st, x, y);
                    table.get(e6 as u64 * CORNER2 as u64 + c2 as u64) as u32
                })
                .max()
                .unwrap();
            (a, b, c, h)
        });
        t3.sort_by_key(|t| t.3);
        let mut best = 99u32;
        for &(a, b, c, h) in &t3 {
            if h >= best {
                break;
            }
            // 自由棱 = 唯一非 combo 槽。
            let mut free = 0usize;
            for t in 0..4 {
                if t != a && t != b && t != c {
                    free = edg[t];
                }
            }
            let res = if h == 0 && free % 2 == 0 {
                0
            } else {
                let mut e6 = [0u32; 3];
                let mut c2 = [0u32; 3];
                let mut conj = [-1i32; 3];
                let mut table: [&PackedPruneTable; 3] = [&self.pt_nb; 3];
                for (i, &(x, y)) in [(a, b), (b, c), (c, a)].iter().enumerate() {
                    let (pe6, pc2, pconj, pt) = self.pair_huge(st, x, y);
                    e6[i] = pe6;
                    c2[i] = pc2;
                    conj[i] = pconj;
                    table[i] = pt;
                }
                let max_d = CAP_XXXC.min(best.saturating_sub(1));
                let mut found = 99;
                for d in h.max(1)..=max_d {
                    if self.search_x3(e6, c2, conj, table, free * 18, d, 18) {
                        found = d;
                        break;
                    }
                }
                found
            };
            best = best.min(res);
        }
        best
    }

    /// 6 视角 × 4 阶段,返回 24 值,顺序 [cross×6, xcross×6, xxcross×6, xxxcross×6]。
    /// 12 朝向 = 6 面 × {无 y, y};每面折叠取 min(F2LEO 的 EO 轴可由 y 自由选)。
    pub fn get_stats(&self, alg: &[Move]) -> Vec<u32> {
        const ROTS12: [&str; 12] =
            ["", "y", "z2", "z2 y", "z'", "z' y", "z", "z y", "x'", "x' y", "x", "x y"];
        let base: Vec<u8> = alg.iter().map(|m| m.index() as u8).collect();
        let mut cross = [0u32; 12];
        let mut xc = [0u32; 12];
        let mut xxc = [0u32; 12];
        let mut xxxc = [0u32; 12];

        for (r, rot) in ROTS12.iter().enumerate() {
            let mut a = base.clone();
            alg_rotation(&mut a, rot);
            let (i1, i2, edg) = self.real_root(&a);
            let st: [BigVirt; 4] = std::array::from_fn(|k| self.get_virt(&a, k));
            cross[r] = self.solve_cross(i1, i2, edg);
            xc[r] = self.solve_xc(&st, &edg);
            xxc[r] = self.solve_xxc(&st, &edg);
            xxxc[r] = self.solve_xxxc(&st, &edg);
        }

        let mut out = Vec::with_capacity(24);
        for arr in [&cross, &xc, &xxc, &xxxc] {
            for k in 0..6 {
                out.push(arr[2 * k].min(arr[2 * k + 1]));
            }
        }
        out
    }
}

#[cfg(not(target_arch = "wasm32"))]
impl Default for F2leoBigSolver {
    fn default() -> Self {
        Self::new()
    }
}

/// 进程级单例(OnceLock):首调 ensure 全部表(含 huge mmap),后续 Arc clone。
#[cfg(not(target_arch = "wasm32"))]
pub fn f2leo_big_instance() -> Arc<F2leoBigSolver> {
    static S: OnceLock<Arc<F2leoBigSolver>> = OnceLock::new();
    S.get_or_init(|| Arc::new(F2leoBigSolver::new())).clone()
}

#[cfg(test)]
mod enum_tests {
    use super::*;
    use crate::cube_common::{string_to_alg, test_env_lock};
    use std::path::PathBuf;

    const ROTS: [&str; 6] = ["", "z2", "z'", "z", "x'", "x"];

    /// 重放:full = (scramble 在 frame 帧) ++ sol,推到根态后校验 F2LEO 目标
    /// (cross solved ∧ combo 槽棱归位 ∧ 自由棱 EO 全好)= 一个真正独立于 count 路径的解验证。
    fn verify_f2leo(
        s: &F2leoSolver,
        alg: &[Move],
        frame: &str,
        sol: &[u8],
        stage: usize,
        combo: &[usize],
    ) -> bool {
        let mut full: Vec<u8> = alg.iter().map(|m| m.index() as u8).collect();
        alg_rotation(&mut full, frame);
        full.extend_from_slice(sol);
        let (i1, i2, e4_24, corn, edg) = s.root_state(&full);
        if stage == 0 {
            return s.pt_cross.get((i1 as u64) * (E2 as u64) + i2 as u64) == 0
                && edg.iter().all(|&e| e % 2 == 0);
        }
        for &slot in combo {
            if s.prune.tables[slot][e4_24 + corn[slot]] != 0 || edg[slot] != SLOT_EDGE[slot] {
                return false;
            }
        }
        (0..4).all(|sl| combo.contains(&sl) || edg[sl] % 2 == 0)
    }

    /// F2LEO 枚举:(1) best_len == get_stage 该 face 折叠值(golden 一致);(2) 每条最优解
    /// 长度 == best_len;(3) 重放确实达成目标态。需真实表 mmap:
    /// `cargo test --release -- --ignored f2leo_enum`
    #[test]
    #[ignore]
    fn f2leo_enum_consistency_and_validity() {
        let _lock = test_env_lock().lock().unwrap_or_else(|e| e.into_inner());
        std::env::set_var(
            "CUBE_TABLE_DIR",
            PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tables"),
        );
        let solver = F2leoSolver::new();
        // 内存紧张:1 条打乱足够锁 bit-exact;跳过最重的 xxxc(stage 3),它由浏览器小表侧验。
        let scrambles = ["B2 U' L2 U F2 L2 D2 L2 U F2 L F2 L D U L' D2 F' U2 B"];
        for scr in scrambles {
            let alg = string_to_alg(scr);
            for stage in 0..3usize {
                let counts = solver.get_stage(&alg, stage);
                for face in 0..6usize {
                    let (len, sols) =
                        solver.enumerate_small(&alg, ROTS[face], stage, 0, 100, &[]);
                    assert_eq!(
                        len, counts[face],
                        "f2leo len mismatch scr={scr} stage={stage} face={face}: enum {len} vs count {}",
                        counts[face]
                    );
                    if len == 0 {
                        continue;
                    }
                    assert!(!sols.is_empty(), "non-zero len must enumerate ≥1 sol");
                    // 每条解都是合法并列:长度 == best_len ∧ 在其自带 frame+combo 下重放达成目标。
                    for (frame, combo, p) in &sols {
                        assert_eq!(p.len() as u32, len, "optimal sol length must == best_len");
                        assert!(
                            verify_f2leo(&solver, &alg, frame, p, stage, combo),
                            "f2leo sol invalid: scr={scr} stage={stage} face={face} frame={frame} combo={combo:?}"
                        );
                    }
                }
            }
        }
    }
}
