//! Pseudo F2LEO 阶段 IDA* 搜索器(count-only)。
//!
//! 忠实移植自上游 `RubiksSolverDemo/src/pseudoF2LEOAnalyzer/pseudo_analyzer.cpp`。
//! 与 [`crate::f2leo_solver`] 同构,唯一语义差异 = **角槽(pslot/PSC)与棱槽(slot/PSE)
//! 解耦**(pseudo:角可归位到差一个 D 转的"错位"槽)+ cross 剪枝用 4 个 D-AUF 等价
//! 解种子。同样不共轭、自建小表、不碰 huge 表。
//!
//! 与 f2leo 的差异(其余逐字节相同):
//!   - cross 剪枝 `build_pscross_prune`:528×528、depth-8、**4 个种子**
//!     (416,520)/(468,428)/(520,416)/(428,468)(= cross 在 D/D'/D2 下的等价解),
//!     不复用 `pt_cross`。
//!   - xcross 剪枝 `build_psxcross_prune` = f2leo 的基础上多 3 个 depth-0 种子
//!     (对已解态施 D/D2/D' = move 3/4/5)。
//!   - 枚举:xcross/xxcross/xxxcross 从 4/6/4 升到 **16/36/16** 的 (棱槽,角槽) 组合
//!     (棱子集 × 角子集 的笛卡尔积,positional 配对 slotᵢ↔pslotᵢ)。
//!   - 取值时:角/剪枝表按 **pslot**,棱归位目标 + 自由棱集按 **slot**。

use std::sync::{Arc, OnceLock};

use crate::cube_common::{
    alg_rotation, state_space, valid_moves, valid_moves_masked, Move, MoveMask, ValidMovesTable,
};
use crate::move_tables::{self, MoveTable};

/// (棱槽 slot, 角槽 pslot)。
type Pair = (usize, usize);

const SLOT_CORNER: [usize; 4] = [12, 15, 18, 21];
const SLOT_EDGE: [usize; 4] = [0, 2, 4, 6];
const PRUNE_DEPTH: u8 = 10; // xcross 剪枝 BFS 深度(同 f2leo / 上游)
const PSCROSS_DEPTH: u8 = 8; // cross 剪枝 BFS 深度(上游 create_prune_table_cross(8,..))

const E2A: usize = state_space::EDGE2_A_SOLVED; // 416
const E2B: usize = state_space::EDGE2_B_SOLVED; // 520
const E4_SOLVED: usize = state_space::CROSS_SOLVED; // 187520
const E2: usize = state_space::EDGE2; // 528
const NC: usize = state_space::CORNER; // 24

const CAP_CROSS: u32 = 14;
const CAP_XC: u32 = 16;
const CAP_XXC: u32 = 18;
const CAP_XXXC: u32 = 20;

// ---- (棱槽,角槽) 组合:棱子集 × 角子集 笛卡尔积,positional 配对 ----

struct Combos {
    xc: Vec<Vec<Pair>>,   // 4×4 = 16
    xxc: Vec<Vec<Pair>>,  // 6×6 = 36
    xxxc: Vec<Vec<Pair>>, // 4×4 = 16
}

fn combos() -> &'static Combos {
    static C: OnceLock<Combos> = OnceLock::new();
    C.get_or_init(|| {
        let s1: [&[usize]; 4] = [&[0], &[1], &[2], &[3]];
        let s2: [&[usize]; 6] = [&[0, 1], &[0, 2], &[0, 3], &[1, 2], &[1, 3], &[2, 3]];
        let s3: [&[usize]; 4] = [&[0, 1, 2], &[0, 1, 3], &[0, 2, 3], &[1, 2, 3]];
        Combos {
            xc: product(&s1),
            xxc: product(&s2),
            xxxc: product(&s3),
        }
    })
}

/// 棱子集 × 角子集 笛卡尔积,每对 positional 配对(已排序子集逐位 zip)。
fn product(subsets: &[&[usize]]) -> Vec<Vec<Pair>> {
    let mut out = Vec::new();
    for e in subsets {
        for c in subsets {
            out.push(e.iter().zip(c.iter()).map(|(&s, &p)| (s, p)).collect());
        }
    }
    out
}

// ---- 剪枝表(进程级建一次)----

struct PseudoPrune {
    cross: Vec<u8>,        // 528×528,4 个 D-AUF 种子
    xcross: [Vec<u8>; 4],  // 4 张逐角槽,各 190080×24,带 D-AUF 多种子
}

impl PseudoPrune {
    /// 从 mt_edge2 / mt_edge4 / mt_corn 现场建(不依赖 manager;wasm 路径也用)。
    fn build(mt_edge2: &[u32], mt_edge4: &[u32], mt_corn: &[u32]) -> Self {
        PseudoPrune {
            cross: build_pscross_prune(mt_edge2),
            xcross: std::array::from_fn(|s| build_psxcross_prune(mt_edge4, mt_corn, SLOT_CORNER[s])),
        }
    }
}

/// native:进程级缓存(OnceLock),首调经 manager 建一次,后续 new 直接 Arc clone。
#[cfg(not(target_arch = "wasm32"))]
fn pseudo_prune() -> Arc<PseudoPrune> {
    static P: OnceLock<Arc<PseudoPrune>> = OnceLock::new();
    P.get_or_init(|| {
        let mtm = move_tables::instance();
        let mt_edge2 = mtm.ensure_edge2();
        let mt_edge4 = mtm.ensure_edge4();
        let mt_corn = mtm.ensure_corn();
        Arc::new(PseudoPrune::build(
            mt_edge2.as_u32(),
            mt_edge4.as_u32(),
            mt_corn.as_u32(),
        ))
    })
    .clone()
}

/// 上游 `create_prune_table_cross`:528×528,4 个 D-AUF 等价解种子,两坐标同 move 推进。
fn build_pscross_prune(mt_edge2: &[u32]) -> Vec<u8> {
    let size = E2 * E2;
    let mut pt = vec![255u8; size];
    pt[E2A * E2 + E2B] = 0;
    pt[468 * E2 + 428] = 0;
    pt[E2B * E2 + E2A] = 0;
    pt[428 * E2 + 468] = 0;
    for d in 0..PSCROSS_DEPTH {
        for i in 0..size {
            if pt[i] != d {
                continue;
            }
            let a18 = (i / E2) * 18;
            let b18 = (i % E2) * 18;
            for j in 0..18 {
                let ni = mt_edge2[a18 + j] as usize * E2 + mt_edge2[b18 + j] as usize;
                if pt[ni] == 255 {
                    pt[ni] = d + 1;
                }
            }
        }
    }
    pt
}

/// 上游 `create_prune_table_xcross`:= f2leo 的逐槽 xcross 剪枝,外加 3 个 depth-0
/// 种子(对已解态施 D/D2/D' = move 3/4/5,= 角进入 D-AUF 等价槽位)。
fn build_psxcross_prune(mt_edge4: &[u32], mt_corn: &[u32], corner_seed: usize) -> Vec<u8> {
    let size = state_space::CROSS * NC;
    let mut pt = vec![255u8; size];
    pt[E4_SOLVED * NC + corner_seed] = 0;
    for j in 3..6 {
        // D(3) / D2(4) / D'(5):cross 仍解,角进入等价槽。mt_edge4 值已 ×24。
        let ni = mt_edge4[E4_SOLVED * 24 + j] as usize + mt_corn[corner_seed * 18 + j] as usize;
        if pt[ni] == 255 {
            pt[ni] = 0;
        }
    }
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

pub struct PseudoF2leoSolver {
    mt_edge2: Arc<MoveTable>,
    mt_edge4: Arc<MoveTable>,
    mt_corn: Arc<MoveTable>,
    mt_edge: Arc<MoveTable>,
    prune: Arc<PseudoPrune>,
}

impl PseudoF2leoSolver {
    #[cfg(not(target_arch = "wasm32"))]
    pub fn new() -> Self {
        let mtm = move_tables::instance();
        PseudoF2leoSolver {
            mt_edge2: mtm.ensure_edge2(),
            mt_edge4: mtm.ensure_edge4(),
            mt_corn: mtm.ensure_corn(),
            mt_edge: mtm.ensure_edge(),
            prune: pseudo_prune(),
        }
    }

    /// 预建表直接构造(绕过 manager),wasm 路径用。现场建 cross + 4 xcross 剪枝表。
    pub fn from_tables(
        mt_edge2: Arc<MoveTable>,
        mt_edge4: Arc<MoveTable>,
        mt_corn: Arc<MoveTable>,
        mt_edge: Arc<MoveTable>,
    ) -> Self {
        let prune = Arc::new(PseudoPrune::build(
            mt_edge2.as_u32(),
            mt_edge4.as_u32(),
            mt_corn.as_u32(),
        ));
        PseudoF2leoSolver {
            mt_edge2,
            mt_edge4,
            mt_corn,
            mt_edge,
            prune,
        }
    }

    // ===================== Cross 阶段 =====================
    // 两棱组 i1/i2 + 4-seed pscross 剪枝 + 4 个 F2L 棱 EO。

    fn search_cross(&self, i1: usize, i2: usize, eo: [usize; 4], depth: u32, prev: u8) -> bool {
        let (vmoves, vcnt) = valid_moves();
        let count = vcnt[prev as usize] as usize;
        let row = &vmoves[prev as usize];
        let m2 = self.mt_edge2.as_u32();
        let me = self.mt_edge.as_u32();
        let pc = &self.prune.cross;
        for k in 0..count {
            let m = row[k] as usize;
            let n1 = m2[i1 + m] as usize;
            let n2 = m2[i2 + m] as usize;
            let pr = pc[n1 * E2 + n2] as u32;
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
        let pr = self.prune.cross[i1 * E2 + i2] as u32;
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

    // ===================== XCross / XXCross / XXXCross =====================
    // 与 f2leo 的 search_combo 完全同构;差异仅在调用方按 (slot,pslot) 喂参数。

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

    /// combo = (棱槽,角槽) 对的列表;角/剪枝按 pslot,棱目标 + 自由棱按 slot。
    fn solve_combo(
        &self,
        e4_24: usize,
        corn_root: &[usize; 4],
        edge_root: &[usize; 4],
        combo: &[Pair],
        h: u32,
        cap: u32,
        best: u32,
    ) -> u32 {
        let n = combo.len();
        let mut prune_refs = [self.prune.xcross[0].as_slice(); 3];
        let mut corn = [0usize; 3];
        let mut edge = [0usize; 3];
        let mut egoal = [0usize; 3];
        let mut slot_set = [false; 4];
        for (i, &(s, p)) in combo.iter().enumerate() {
            prune_refs[i] = self.prune.xcross[p].as_slice();
            corn[i] = corn_root[p];
            edge[i] = edge_root[s];
            egoal[i] = SLOT_EDGE[s];
            slot_set[s] = true;
        }
        let mut free = [0usize; 3];
        let mut nf = 0;
        for s in 0..4 {
            if !slot_set[s] {
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

    fn solve_stage(
        &self,
        e4_24: usize,
        corn_root: &[usize; 4],
        edge_root: &[usize; 4],
        combos: &[Vec<Pair>],
        cap: u32,
    ) -> u32 {
        let xt = &self.prune.xcross;
        let m = combos.len();
        let mut scored: [(u32, &Vec<Pair>); 36] = [(0, &combos[0]); 36];
        for k in 0..m {
            let c = &combos[k];
            let h = c
                .iter()
                .map(|&(_s, p)| xt[p][e4_24 + corn_root[p]] as u32)
                .max()
                .unwrap();
            scored[k] = (h, c);
        }
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

    /// 把一条(已旋转)move 序列推进到根状态(同 f2leo)。
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

    /// 单个阶段(0=cross,1=xc,2=xxc,3=xxxc)的 12 朝向解,折叠成 6 值。
    pub fn get_stage(&self, alg: &[Move], stage: usize) -> Vec<u32> {
        const ROTS12: [&str; 12] =
            ["", "y", "z2", "z2 y", "z'", "z' y", "z", "z y", "x'", "x' y", "x", "x y"];
        let base: Vec<u8> = alg.iter().map(|m| m.index() as u8).collect();
        let cb = combos();
        let mut v = [0u32; 12];
        for (r, rot) in ROTS12.iter().enumerate() {
            let mut a = base.clone();
            alg_rotation(&mut a, rot);
            let (i1, i2, e4_24, corn, edg) = self.root_state(&a);
            v[r] = match stage {
                0 => self.solve_cross(i1, i2, edg),
                1 => self.solve_stage(e4_24, &corn, &edg, &cb.xc, CAP_XC),
                2 => self.solve_stage(e4_24, &corn, &edg, &cb.xxc, CAP_XXC),
                _ => self.solve_stage(e4_24, &corn, &edg, &cb.xxxc, CAP_XXXC),
            };
        }
        (0..6).map(|k| v[2 * k].min(v[2 * k + 1])).collect()
    }

    /// 6 视角 × 4 阶段,返回 24 值,顺序 [cross×6, xcross×6, xxcross×6, xxxcross×6]。
    pub fn get_stats(&self, alg: &[Move]) -> Vec<u32> {
        // 12 朝向 = 6 面 × {无 y, y};每面折叠取 min(同 f2leo / eo 口径)。
        const ROTS12: [&str; 12] =
            ["", "y", "z2", "z2 y", "z'", "z' y", "z", "z y", "x'", "x' y", "x", "x y"];
        let mut cross = [0u32; 12];
        let mut xc = [0u32; 12];
        let mut xxc = [0u32; 12];
        let mut xxxc = [0u32; 12];

        let base: Vec<u8> = alg.iter().map(|m| m.index() as u8).collect();
        let cb = combos();

        for (r, rot) in ROTS12.iter().enumerate() {
            let mut a = base.clone();
            alg_rotation(&mut a, rot);
            let (i1, i2, e4_24, corn, edg) = self.root_state(&a);
            cross[r] = self.solve_cross(i1, i2, edg);
            xc[r] = self.solve_stage(e4_24, &corn, &edg, &cb.xc, CAP_XC);
            xxc[r] = self.solve_stage(e4_24, &corn, &edg, &cb.xxc, CAP_XXC);
            xxxc[r] = self.solve_stage(e4_24, &corn, &edg, &cb.xxxc, CAP_XXXC);
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

    // ===================== 多解枚举(带 y 帧 + (棱槽,角槽) combo + cap)=====================
    // 同 f2leo_solver,差异仅在 combo = (slot,pslot) 对:角/剪枝按 pslot,棱目标/自由棱按 slot,
    // cross 用 4-seed pscross 剪枝。frame ∈ {rot, "{rot} y"},首个出解深度即 best_len。

    /// 镜像 search_cross,收集 path(pscross 剪枝 + 4 棱 EO)。
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
        let pc = &self.prune.cross;
        for k in 0..count {
            if out.len() >= cap {
                return;
            }
            let m = row[k] as usize;
            let n1 = m2[i1 + m] as usize;
            let n2 = m2[i2 + m] as usize;
            let pr = pc[n1 * E2 + n2] as u32;
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
                // pseudo-cross 已解(pr==0)且自由棱 EO 全好却仍要走步 = 更短解 + 无效尾动,跳过。
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

    /// 镜像 search_combo,收集 path(参数已按 (slot,pslot) 映射成与 f2leo 同形的 slices)。
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

    /// 单 face 多解枚举:返回 (best_len, 每条解 (frame, combo 棱槽标签, move 路径))。
    /// stage 0=cross(combo 空)/ 1=xc / 2=xxc / 3=xxxc。frame ∈ {rot, "{rot} y"},逐条带
    /// (并列槽可能落在不同 frame)。空解集 + len=0 ⟹ 该 face 已解。
    /// best_len 与原"首个成功深度"逐字节一致;此处把**所有**该深度成功的候选(跨 frame /
    /// 跨 combo)都收集为并列解,d 外层、候选内层交错以保长度升序;cap 控总条数。
    /// `force`:用户指定的目标槽位集合(索引 ⊂ {0,1,2,3},0=BL/1=BR/2=FR/3=FL);空 = 自动挑
    /// 最优槽(逐位与原先一致)。非空时只枚举"目标槽位集合 == force"的 combo(pseudo source 仍自动)。
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

        // ---- stage 0:pscross + 4 棱 EO ----
        if stage == 0 {
            let mut roots: Vec<(u32, usize, usize, usize, [usize; 4])> = Vec::with_capacity(2);
            for (fi, fr) in frames.iter().enumerate() {
                let mut a = base.clone();
                alg_rotation(&mut a, fr);
                let (i1, i2, _e4, _corn, edg) = self.root_state(&a);
                let pr = self.prune.cross[i1 * E2 + i2] as u32;
                let eo_ok = edg.iter().all(|&e| e % 2 == 0);
                if pr == 0 && eo_ok {
                    return (0, Vec::new());
                }
                let h = if pr == 0 { 1 } else { pr };
                roots.push((h, fi, i1, i2, edg));
            }
            roots.sort_by_key(|t| (t.0, t.1));
            let d0 = roots.iter().map(|t| t.0).min().unwrap_or(1).max(1);

            // 第一遍:找首个有任一 root 非空枚举的深度 = best_len,并收集**所有**该深度
            // 非空的 root(并列),每条解带自己的 frame。
            let mut out: Vec<(String, Vec<usize>, Vec<u8>)> = Vec::new();
            let mut best_len = CAP_CROSS;
            let mut tied: Vec<usize> = Vec::new(); // roots 下标
            'bd0: for d in d0..=CAP_CROSS {
                for (ri, &(h, fi, i1, i2, edg)) in roots.iter().enumerate() {
                    if h > d {
                        continue;
                    }
                    let eo18: [usize; 4] = std::array::from_fn(|t| edg[t] * 18);
                    let mut co: Vec<Vec<u8>> = Vec::new();
                    let mut path = Vec::new();
                    let rem = cap.saturating_sub(out.len());
                    self.enum_cross(i1 * 18, i2 * 18, eo18, d, 18, &mut path, &mut co, rem);
                    if !co.is_empty() {
                        best_len = d;
                        tied.push(ri);
                        for sol in co {
                            if out.len() >= cap {
                                break;
                            }
                            out.push((frames[fi].clone(), vec![], sol));
                        }
                    }
                }
                if !tied.is_empty() {
                    break 'bd0;
                }
            }
            if tied.is_empty() {
                return (CAP_CROSS, Vec::new());
            }

            // extra:仅对并列 root 在 best_len+1..=best_len+extra 继续收集,交错保升序。
            'ex0: for d in (best_len + 1)..=(best_len + extra).min(CAP_CROSS) {
                for &ri in &tied {
                    if out.len() >= cap {
                        break 'ex0;
                    }
                    let (_h, fi, i1, i2, edg) = roots[ri];
                    let eo18: [usize; 4] = std::array::from_fn(|t| edg[t] * 18);
                    let mut co: Vec<Vec<u8>> = Vec::new();
                    let mut path = Vec::new();
                    self.enum_cross(i1 * 18, i2 * 18, eo18, d, 18, &mut path, &mut co, cap - out.len());
                    for sol in co {
                        out.push((frames[fi].clone(), vec![], sol));
                    }
                }
            }
            return (best_len, out);
        }

        // ---- stage 1/2/3:(棱槽,角槽) combo cascade ----
        let cb = combos();
        let cs: &[Vec<Pair>] = match stage {
            1 => &cb.xc,
            2 => &cb.xxc,
            _ => &cb.xxxc,
        };
        // 用户指定槽位:只保留"目标槽位集合(combo 各 (s,_) 的 s)== force"的 combo;空 force 不过滤。
        let cs_filt: Vec<Vec<Pair>>;
        let cs: &[Vec<Pair>] = if force.is_empty() {
            cs
        } else {
            let fset: std::collections::BTreeSet<usize> = force.iter().copied().collect();
            cs_filt = cs
                .iter()
                .filter(|c| {
                    c.iter().map(|&(s, _)| s).collect::<std::collections::BTreeSet<usize>>() == fset
                })
                .cloned()
                .collect();
            &cs_filt
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
        let xt = &self.prune.xcross;
        for fr in frames.iter() {
            let mut a = base.clone();
            alg_rotation(&mut a, fr);
            let (_i1, _i2, e4_24, corn, edg) = self.root_state(&a);
            let fi = ctxs.len();
            for (ci, combo) in cs.iter().enumerate() {
                let h = combo
                    .iter()
                    .map(|&(_s, p)| xt[p][e4_24 + corn[p]] as u32)
                    .max()
                    .unwrap();
                if h == 0 {
                    let homed = combo.iter().all(|&(s, _p)| edg[s] == SLOT_EDGE[s]);
                    let mut in_set = [false; 4];
                    for &(s, _p) in combo {
                        in_set[s] = true;
                    }
                    let free_ok = (0..4).all(|s| in_set[s] || edg[s] % 2 == 0);
                    if homed && free_ok {
                        return (0, Vec::new());
                    }
                }
                cands.push((h, fi, ci));
            }
            ctxs.push(Ctx { e4_24, corn, edg });
        }
        cands.sort_by_key(|t| t.0);
        let d0 = cands.iter().map(|t| t.0).min().unwrap_or(1).max(1);

        // 给定候选(frame_idx, combo_idx)在深度 d 枚举,解收进 out(带 frame + 棱槽标签)。
        // 返回该次新增是否非空。
        let enum_cand = |solver: &Self,
                         out: &mut Vec<(String, Vec<usize>, Vec<u8>)>,
                         fi: usize,
                         ci: usize,
                         d: u32,
                         ctxs: &[Ctx]|
         -> bool {
            if out.len() >= cap {
                return false;
            }
            let ctx = &ctxs[fi];
            let combo = &cs[ci];
            let n = combo.len();
            let mut prune_refs = [xt[0].as_slice(); 3];
            let mut corn18 = [0usize; 3];
            let mut edge18 = [0usize; 3];
            let mut egoal = [0usize; 3];
            let mut in_set = [false; 4];
            for (i, &(s, p)) in combo.iter().enumerate() {
                prune_refs[i] = xt[p].as_slice();
                corn18[i] = ctx.corn[p] * 18;
                edge18[i] = ctx.edg[s] * 18;
                egoal[i] = SLOT_EDGE[s];
                in_set[s] = true;
            }
            let mut free18 = [0usize; 3];
            let mut nf = 0;
            for s in 0..4 {
                if !in_set[s] {
                    free18[nf] = ctx.edg[s] * 18;
                    nf += 1;
                }
            }
            let mut co: Vec<Vec<u8>> = Vec::new();
            let mut path = Vec::new();
            solver.enum_combo(
                ctx.e4_24, &corn18[..n], &edge18[..n], &egoal[..n], &free18[..nf],
                &prune_refs[..n], d, 18, &mut path, &mut co, cap - out.len(),
            );
            let nonempty = !co.is_empty();
            let label: Vec<usize> = combo.iter().map(|&(s, _p)| s).collect();
            for sol in co {
                if out.len() >= cap {
                    break;
                }
                out.push((frames[fi].clone(), label.clone(), sol));
            }
            nonempty
        };

        // 第一遍:找 best_len = 首个有任一候选非空枚举的深度,收集**所有**该深度非空候选(并列)。
        let mut out: Vec<(String, Vec<usize>, Vec<u8>)> = Vec::new();
        let mut best_len = cap_d;
        let mut tied: Vec<(usize, usize)> = Vec::new(); // (frame_idx, combo_idx)
        'bd: for d in d0..=cap_d {
            for &(h, fi, ci) in &cands {
                if h > d {
                    continue;
                }
                if enum_cand(self, &mut out, fi, ci, d, &ctxs) {
                    best_len = d;
                    tied.push((fi, ci));
                }
            }
            if !tied.is_empty() {
                break 'bd;
            }
        }
        if tied.is_empty() {
            return (cap_d, Vec::new());
        }

        // extra:仅对并列候选在 best_len+1..=best_len+extra 继续收集,交错保升序。
        'ex: for d in (best_len + 1)..=(best_len + extra).min(cap_d) {
            for &(fi, ci) in &tied {
                if out.len() >= cap {
                    break 'ex;
                }
                enum_cand(self, &mut out, fi, ci, d, &ctxs);
            }
        }
        (best_len, out)
    }
}

// ============================================================================
// 受限步法 Pseudo F2LEO(Phase 3:move mask)
// ----------------------------------------------------------------------------
// 与上面无限制小表 cascade 同结构、同剪枝表(4-seed pscross + 自建 xcross 剪枝),仅把
// `valid_moves()` 换成 `valid_moves_masked(mask)` 并加 `max_depth` 上限。正确性同
// f2leo masked:剪枝表是无限制距离的可采纳下界,对任意 mask 仍可采纳 ⇒ IDA* 首达即
// 真·受限最优(≤ max_depth),超界返回 99 哨兵。叶子 EO 门控走真实 frame。
impl PseudoF2leoSolver {
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
        let pc = &self.prune.cross;
        for k in 0..count {
            let m = row[k] as usize;
            let n1 = m2[i1 + m] as usize;
            let n2 = m2[i2 + m] as usize;
            let pr = pc[n1 * E2 + n2] as u32;
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

    fn solve_cross_masked(&self, i1: usize, i2: usize, eo: [usize; 4], vm: &ValidMovesTable, max_depth: u32) -> u32 {
        let pr = self.prune.cross[i1 * E2 + i2] as u32;
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
        combo: &[Pair],
        h: u32,
        cap: u32,
        best: u32,
        vm: &ValidMovesTable,
    ) -> u32 {
        let n = combo.len();
        let mut prune_refs = [self.prune.xcross[0].as_slice(); 3];
        let mut corn = [0usize; 3];
        let mut edge = [0usize; 3];
        let mut egoal = [0usize; 3];
        let mut slot_set = [false; 4];
        for (i, &(s, p)) in combo.iter().enumerate() {
            prune_refs[i] = self.prune.xcross[p].as_slice();
            corn[i] = corn_root[p];
            edge[i] = edge_root[s];
            egoal[i] = SLOT_EDGE[s];
            slot_set[s] = true;
        }
        let mut free = [0usize; 3];
        let mut nf = 0;
        for s in 0..4 {
            if !slot_set[s] {
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

    fn solve_stage_masked(
        &self,
        e4_24: usize,
        corn_root: &[usize; 4],
        edge_root: &[usize; 4],
        combos: &[Vec<Pair>],
        cap: u32,
        vm: &ValidMovesTable,
    ) -> u32 {
        let xt = &self.prune.xcross;
        let m = combos.len();
        let mut scored: [(u32, &Vec<Pair>); 36] = [(0, &combos[0]); 36];
        for k in 0..m {
            let c = &combos[k];
            let h = c
                .iter()
                .map(|&(_s, p)| xt[p][e4_24 + corn_root[p]] as u32)
                .max()
                .unwrap();
            scored[k] = (h, c);
        }
        scored[..m].sort_by_key(|t| t.0);
        let mut best = 99u32;
        for &(h, combo) in &scored[..m] {
            if h > best {
                break;
            }
            let res = self.solve_combo_masked(e4_24, corn_root, edge_root, combo, h, cap, 99, vm);
            best = best.min(res);
        }
        best
    }

    /// 受限版 get_stage:返回 6 视角值(12 朝向折叠 min);限制下无解的视角为 None。
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
        let cb = combos();
        let mut v = [99u32; 12];
        for (r, rot) in ROTS12.iter().enumerate() {
            let mut a = base.clone();
            alg_rotation(&mut a, rot);
            let (i1, i2, e4_24, corn, edg) = self.root_state(&a);
            v[r] = match stage {
                0 => self.solve_cross_masked(i1, i2, edg, &vm, CAP_CROSS.min(max_depth)),
                1 => self.solve_stage_masked(e4_24, &corn, &edg, &cb.xc, CAP_XC.min(max_depth), &vm),
                2 => self.solve_stage_masked(e4_24, &corn, &edg, &cb.xxc, CAP_XXC.min(max_depth), &vm),
                _ => self.solve_stage_masked(e4_24, &corn, &edg, &cb.xxxc, CAP_XXXC.min(max_depth), &vm),
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
        let pc = &self.prune.cross;
        for k in 0..count {
            if out.len() >= cap {
                return;
            }
            let m = row[k] as usize;
            let n1 = m2[i1 + m] as usize;
            let n2 = m2[i2 + m] as usize;
            let pr = pc[n1 * E2 + n2] as u32;
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

        // ---- stage 0:pscross + 4 棱 EO ----
        if stage == 0 {
            let cap_d = CAP_CROSS.min(max_depth);
            let mut roots: Vec<(u32, usize, usize, usize, [usize; 4])> = Vec::with_capacity(2);
            for (fi, fr) in frames.iter().enumerate() {
                let mut a = base.clone();
                alg_rotation(&mut a, fr);
                let (i1, i2, _e4, _corn, edg) = self.root_state(&a);
                let pr = self.prune.cross[i1 * E2 + i2] as u32;
                let eo_ok = edg.iter().all(|&e| e % 2 == 0);
                if pr == 0 && eo_ok {
                    return (0, Vec::new());
                }
                let h = if pr == 0 { 1 } else { pr };
                roots.push((h, fi, i1, i2, edg));
            }
            roots.sort_by_key(|t| (t.0, t.1));
            let d0 = roots.iter().map(|t| t.0).min().unwrap_or(1).max(1);

            let mut out: Vec<(String, Vec<usize>, Vec<u8>)> = Vec::new();
            let mut best_len = 99u32;
            let mut tied: Vec<usize> = Vec::new();
            'bd0: for d in d0..=cap_d {
                for (ri, &(h, _fi, i1, i2, edg)) in roots.iter().enumerate() {
                    if h > d {
                        continue;
                    }
                    let eo18: [usize; 4] = std::array::from_fn(|t| edg[t] * 18);
                    let mut co: Vec<Vec<u8>> = Vec::new();
                    let mut path = Vec::new();
                    self.enum_cross_masked(i1 * 18, i2 * 18, eo18, d, 18, &mut path, &mut co, 1, &vm);
                    if !co.is_empty() {
                        tied.push(ri);
                    }
                }
                if !tied.is_empty() {
                    best_len = d;
                    break 'bd0;
                }
            }
            if best_len >= 99 {
                return (99, Vec::new());
            }
            'collect0: for d in best_len..=(best_len + extra).min(cap_d) {
                for &ri in &tied {
                    if out.len() >= cap {
                        break 'collect0;
                    }
                    let (_h, fi, i1, i2, edg) = roots[ri];
                    let eo18: [usize; 4] = std::array::from_fn(|t| edg[t] * 18);
                    let mut co: Vec<Vec<u8>> = Vec::new();
                    let mut path = Vec::new();
                    self.enum_cross_masked(i1 * 18, i2 * 18, eo18, d, 18, &mut path, &mut co, cap - out.len(), &vm);
                    for sol in co {
                        out.push((frames[fi].clone(), vec![], sol));
                    }
                }
            }
            return (best_len, out);
        }

        // ---- stage 1/2/3:(棱槽,角槽) combo cascade ----
        let cb = combos();
        let cs0: &[Vec<Pair>] = match stage {
            1 => &cb.xc,
            2 => &cb.xxc,
            _ => &cb.xxxc,
        };
        let cs_filt: Vec<Vec<Pair>>;
        let cs: &[Vec<Pair>] = if force.is_empty() {
            cs0
        } else {
            let fset: std::collections::BTreeSet<usize> = force.iter().copied().collect();
            cs_filt = cs0
                .iter()
                .filter(|c| {
                    c.iter().map(|&(s, _)| s).collect::<std::collections::BTreeSet<usize>>() == fset
                })
                .cloned()
                .collect();
            &cs_filt
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
        let xt = &self.prune.xcross;
        for fr in frames.iter() {
            let mut a = base.clone();
            alg_rotation(&mut a, fr);
            let (_i1, _i2, e4_24, corn, edg) = self.root_state(&a);
            let fi = ctxs.len();
            for (ci, combo) in cs.iter().enumerate() {
                let h = combo
                    .iter()
                    .map(|&(_s, p)| xt[p][e4_24 + corn[p]] as u32)
                    .max()
                    .unwrap();
                cands.push((h, fi, ci));
            }
            ctxs.push(Ctx { e4_24, corn, edg });
        }
        if cs.is_empty() {
            return (99, Vec::new());
        }
        cands.sort_by_key(|t| t.0);
        let d0 = cands.iter().map(|t| t.0).min().unwrap_or(1).max(1);

        let run = |solver: &Self, fi: usize, ci: usize, d: u32, out: &mut Vec<Vec<u8>>, cap: usize, ctxs: &[Ctx]| {
            let ctx = &ctxs[fi];
            let combo = &cs[ci];
            let n = combo.len();
            let mut prune_refs = [xt[0].as_slice(); 3];
            let mut corn18 = [0usize; 3];
            let mut edge18 = [0usize; 3];
            let mut egoal = [0usize; 3];
            let mut in_set = [false; 4];
            for (i, &(s, p)) in combo.iter().enumerate() {
                prune_refs[i] = xt[p].as_slice();
                corn18[i] = ctx.corn[p] * 18;
                edge18[i] = ctx.edg[s] * 18;
                egoal[i] = SLOT_EDGE[s];
                in_set[s] = true;
            }
            let mut free18 = [0usize; 3];
            let mut nf = 0;
            for s in 0..4 {
                if !in_set[s] {
                    free18[nf] = ctx.edg[s] * 18;
                    nf += 1;
                }
            }
            let mut path = Vec::new();
            solver.enum_combo_masked(
                ctx.e4_24, &corn18[..n], &edge18[..n], &egoal[..n], &free18[..nf],
                &prune_refs[..n], d, 18, &mut path, out, cap, &vm,
            );
        };

        let mut best_len = 99u32;
        let mut tied: Vec<(usize, usize)> = Vec::new();
        'bd: for d in d0..=cap_d {
            for &(h, fi, ci) in &cands {
                if h > d {
                    continue;
                }
                let mut probe: Vec<Vec<u8>> = Vec::new();
                run(self, fi, ci, d, &mut probe, 1, &ctxs);
                if !probe.is_empty() {
                    tied.push((fi, ci));
                }
            }
            if !tied.is_empty() {
                best_len = d;
                break 'bd;
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
                run(self, fi, ci, d, &mut cand_out, cap - out.len(), &ctxs);
                let label: Vec<usize> = cs[ci].iter().map(|&(s, _p)| s).collect();
                for sol in cand_out {
                    out.push((frames[fi].clone(), label.clone(), sol));
                }
            }
        }
        (best_len, out)
    }
}

// ============================================================================
// 大表版 Pseudo F2LEO(native-only)
// ============================================================================
//
// 动机:上面的 `PseudoF2leoSolver` 在 xcross+ 用「pseudo cross + 单角」逐 pslot 弱
// 剪枝(自建 ~18 MB 表),节点爆炸(实测 ~3 例/s)。本节复用 pseudo XCross 已验证的
// `pt_pscross_C4E[diff]`(4 × 54 MB,pseudo cross + 1 角 + 1 棱,带 4 个 D-AUF 种子)
// 作每对 (棱槽 s, 角槽 p) 的精确单对距离下界,xcross/xxcross/xxxcross 各阶段取「combo
// 内所有对的 max」(可采纳:解 N 对 ≥ 解其中最难单对)。叶子门控自由 F2L 棱 EO(实 frame)。
//
// 关键:pseudo 没有「cross + 2角 + 2棱」联合大表,但有 std-`pseudo` 用的整套 corner-only /
// edge-only 大表电池:per-pair pt_pscross_C4E(4×54MB)+ corner2/edge2(C4C5/C4C6/E0E1/E0E2,
// ~48-50MB)+ corner3/edge3(C4C5C6 862MB / E0E1E2 1GB,需 CUBE_ALLOW_HUGE_TABLES=1)。combo 的
// 启发式 = max(每对 C4E, 角组距离, 棱组距离);角组/棱组用 setup_aux 共轭到 canonical 表
// (corner3 支配其 corner-pair,故 3-subset 只留 triple)。实测真实打乱该电池比纯 per-pair 快 ~8×。
//
// 共轭沿用 std 式「逐节点」(非 pseudo XCross 的「根预共轭 + raw m」)—— 因为自由棱 EO 必须在
// 实 frame 追踪:每节点用实 move m 推进自由棱(实 frame),用 cj[m][p] 推进各对坐标、用
// rot_map[mapper][cj[m][ref_slot]] 推进各 aux(查 canonical 帧的电池表)。根 aux 态复用 std-pseudo
// 已 golden 的 setup_aux(其根共轭 = mapper∘cj[·][ref_slot],与逐节点推进一致)。
//
// 正确性:cross 进度 = pseudo 电池逐字节同构;此处加叶子自由棱 EO,目标与小表版完全相同 →
// 输出逐格 bit-exact(对拍 2001 行 + tests/e2e_f2leo.rs)。仅 native;wasm 仍用 `PseudoF2leoSolver`。
#[cfg(not(target_arch = "wasm32"))]
use crate::cube_common::{array_to_index, conj_moves_flat, rot_map};
#[cfg(not(target_arch = "wasm32"))]
use crate::executor::bump_node_count;
#[cfg(not(target_arch = "wasm32"))]
use crate::prune_tables::{self, PackedPruneTable};

/// 大表电池的 6 张辅助剪枝表(corner2/edge2/corner3/edge3),对应 std-pseudo `AuxTable`。
#[cfg(not(target_arch = "wasm32"))]
const MAX_AUX: usize = 8;

#[cfg(not(target_arch = "wasm32"))]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum AuxTable {
    PsCrossE0E1,
    PsCrossE0E2,
    PsCrossC4C5,
    PsCrossC4C6,
    PsCrossE0E1E2,
    PsCrossC4C5C6,
}

#[cfg(not(target_arch = "wasm32"))]
#[derive(Debug, Clone, Copy)]
struct AuxState {
    table: AuxTable,
    current_idx: u32,
    current_cross_scaled: u32,
    move_mapper_idx: u8,
}

#[cfg(not(target_arch = "wasm32"))]
impl AuxState {
    const EMPTY: AuxState = AuxState {
        table: AuxTable::PsCrossE0E1,
        current_idx: 0,
        current_cross_scaled: 0,
        move_mapper_idx: 4,
    };
    #[inline]
    fn is_valid(&self) -> bool {
        self.move_mapper_idx < 4
    }
}

/// 单 corner pslot 在(已旋转)alg 下的共轭虚拟状态(对应 pseudo XCross `ConjState`)。
#[cfg(not(target_arch = "wasm32"))]
#[derive(Debug, Clone, Copy)]
struct BigConj {
    im: u32,          // mt_edge4 当前态(已 ×24)
    ic_b: u32,        // mt_corn 当前态(0..23)
    ie_rel: [u32; 4], // 4 个 edge slot 的 mt_edge 当前态(0..23,共轭后)
}

#[cfg(not(target_arch = "wasm32"))]
pub struct PseudoF2leoBigSolver {
    mt_edge2: Arc<MoveTable>,
    mt_edge4: Arc<MoveTable>,
    mt_corn: Arc<MoveTable>,
    mt_edge: Arc<MoveTable>,
    mt_corn2: Arc<MoveTable>,
    mt_edge3: Arc<MoveTable>,
    mt_corn3: Arc<MoveTable>,
    cross_prune: Vec<u8>, // 528×528 pscross(4 D-AUF 种子),cross 阶段用(同小表版)
    pt_pscross_c4e: [Arc<PackedPruneTable>; 4],
    // 大表电池(corner2/edge2 ~48-50MB; corner3/edge3 = C4C5C6 862MB + E0E1E2 1GB)
    pt_pscross_e0e1: Arc<PackedPruneTable>,
    pt_pscross_e0e2: Arc<PackedPruneTable>,
    pt_pscross_c4c5: Arc<PackedPruneTable>,
    pt_pscross_c4c6: Arc<PackedPruneTable>,
    pt_pscross_e0e1e2: Arc<PackedPruneTable>,
    pt_pscross_c4c5c6: Arc<PackedPruneTable>,
}

#[cfg(not(target_arch = "wasm32"))]
impl PseudoF2leoBigSolver {
    /// huge 电池(E0E1E2 1GB + C4C5C6 862MB)需 CUBE_ALLOW_HUGE_TABLES=1。
    pub fn new() -> Self {
        let mtm = move_tables::instance();
        let ptm = prune_tables::instance();
        let mt_edge2 = mtm.ensure_edge2();
        PseudoF2leoBigSolver {
            cross_prune: build_pscross_prune(mt_edge2.as_u32()),
            mt_edge2,
            mt_edge4: mtm.ensure_edge4(),
            mt_corn: mtm.ensure_corn(),
            mt_edge: mtm.ensure_edge(),
            mt_corn2: mtm.ensure_corn2(),
            mt_edge3: mtm.ensure_edge3(),
            mt_corn3: mtm.ensure_corn3(),
            pt_pscross_c4e: [
                ptm.ensure_pt_pscross_c4e(0),
                ptm.ensure_pt_pscross_c4e(1),
                ptm.ensure_pt_pscross_c4e(2),
                ptm.ensure_pt_pscross_c4e(3),
            ],
            pt_pscross_e0e1: ptm.ensure_pt_pscross_e0e1(),
            pt_pscross_e0e2: ptm.ensure_pt_pscross_e0e2(),
            pt_pscross_c4c5: ptm.ensure_pt_pscross_c4c5(),
            pt_pscross_c4c6: ptm.ensure_pt_pscross_c4c6(),
            pt_pscross_e0e1e2: ptm.ensure_pt_pscross_e0e1e2(),
            pt_pscross_c4c5c6: ptm.ensure_pt_pscross_c4c5c6(),
        }
    }

    #[inline]
    fn aux_pt(&self, t: AuxTable) -> &PackedPruneTable {
        match t {
            AuxTable::PsCrossE0E1 => &self.pt_pscross_e0e1,
            AuxTable::PsCrossE0E2 => &self.pt_pscross_e0e2,
            AuxTable::PsCrossC4C5 => &self.pt_pscross_c4c5,
            AuxTable::PsCrossC4C6 => &self.pt_pscross_c4c6,
            AuxTable::PsCrossE0E1E2 => &self.pt_pscross_e0e1e2,
            AuxTable::PsCrossC4C5C6 => &self.pt_pscross_c4c5c6,
        }
    }

    #[inline]
    fn aux_mt(&self, t: AuxTable) -> &[u32] {
        match t {
            AuxTable::PsCrossE0E1 | AuxTable::PsCrossE0E2 => self.mt_edge2.as_u32(),
            AuxTable::PsCrossC4C5 | AuxTable::PsCrossC4C6 => self.mt_corn2.as_u32(),
            AuxTable::PsCrossE0E1E2 => self.mt_edge3.as_u32(),
            AuxTable::PsCrossC4C5C6 => self.mt_corn3.as_u32(),
        }
    }

    #[inline]
    fn aux_multiplier(t: AuxTable) -> u32 {
        match t {
            AuxTable::PsCrossE0E1 | AuxTable::PsCrossE0E2 => state_space::EDGE2 as u32,
            AuxTable::PsCrossC4C5 | AuxTable::PsCrossC4C6 => state_space::CORNER2 as u32,
            AuxTable::PsCrossE0E1E2 => state_space::EDGE3 as u32,
            AuxTable::PsCrossC4C5C6 => state_space::CORNER3 as u32,
        }
    }

    /// 复用 std-pseudo `setup_aux`(3-subset triple 覆盖 → 跳过被覆盖的 2-subset pair):
    /// 给定 combo 的 target_pieces(角 +4 / 棱 raw)+ ref_slot(combo 首角 pslot),共轭整条
    /// (已旋转)alg 算出每个 corner-group / edge-group 的根 aux 态。move_mapper_idx 标记 rot_map
    /// 视角;`is_valid()` 假表(mapper>=4)忽略。与 std-pseudo 逐字节同构(根共轭同式)。
    fn setup_aux(&self, target_pieces: &[u8], alg: &[u8], ref_slot: usize) -> ([AuxState; MAX_AUX], usize) {
        let mut out = [AuxState::EMPTY; MAX_AUX];
        let mut count = 0;
        let mt_e4 = self.mt_edge4.as_u32();
        let cj = conj_moves_flat();
        let rm = rot_map();
        let vcs = (state_space::CROSS_SOLVED as u32) * (state_space::CORNER as u32);
        let mut covered = [[false; 8]; 8];

        // build one aux state by conjugating the whole alg in (mapper ∘ cj[·][ref_slot]).
        let build = |table: AuxTable, init_idx: u32, rot_idx: usize| -> AuxState {
            let mt = self.aux_mt(table);
            let mut cur = init_idx;
            let mut cur_cr = vcs;
            let mapper = &rm[rot_idx];
            for &m in alg {
                let m_p = cj[m as usize][ref_slot] as usize;
                let m_r = mapper[m_p] as usize;
                cur = mt[(cur as usize) * 18 + m_r];
                cur_cr = mt_e4[(cur_cr as usize) + m_r];
            }
            AuxState { table, current_idx: cur, current_cross_scaled: cur_cr, move_mapper_idx: rot_idx as u8 }
        };

        // --- Step 1: 3-subset(corner3 / edge3),标记覆盖的 pair ---
        if target_pieces.len() >= 3 {
            let n = target_pieces.len();
            for i in 0..n {
                for j in (i + 1)..n {
                    for k in (j + 1)..n {
                        if count >= MAX_AUX {
                            break;
                        }
                        let (p1, p2, p3) = (target_pieces[i], target_pieces[j], target_pieces[k]);
                        let is_c3 = p1 >= 4 && p2 >= 4 && p3 >= 4;
                        let is_e3 = p1 < 4 && p2 < 4 && p3 < 4;
                        if !is_c3 && !is_e3 {
                            continue;
                        }
                        let (table, init_idx, rot_idx) = if is_c3 {
                            let r1 = ((p1 - 4) as i32 - ref_slot as i32 + 4).rem_euclid(4) as u32 + 4;
                            let r2 = ((p2 - 4) as i32 - ref_slot as i32 + 4).rem_euclid(4) as u32 + 4;
                            let r3 = ((p3 - 4) as i32 - ref_slot as i32 + 4).rem_euclid(4) as u32 + 4;
                            let mut keys = [r1, r2, r3];
                            keys.sort();
                            let rot_idx = match (keys[0], keys[1], keys[2]) {
                                (4, 5, 6) => 0,
                                (4, 5, 7) => 1,
                                (4, 6, 7) => 2,
                                (5, 6, 7) => 3,
                                _ => continue,
                            };
                            (AuxTable::PsCrossC4C5C6, array_to_index(&[12, 15, 18], 3, 3, 8) as u32, rot_idx)
                        } else {
                            let r1 = (p1 as i32 - ref_slot as i32 + 4).rem_euclid(4) as u32;
                            let r2 = (p2 as i32 - ref_slot as i32 + 4).rem_euclid(4) as u32;
                            let r3 = (p3 as i32 - ref_slot as i32 + 4).rem_euclid(4) as u32;
                            let mut keys = [r1, r2, r3];
                            keys.sort();
                            let rot_idx = match (keys[0], keys[1], keys[2]) {
                                (0, 1, 2) => 0,
                                (0, 1, 3) => 1,
                                (0, 2, 3) => 2,
                                (1, 2, 3) => 3,
                                _ => continue,
                            };
                            (AuxTable::PsCrossE0E1E2, array_to_index(&[0, 2, 4], 3, 2, 12) as u32, rot_idx)
                        };
                        out[count] = build(table, init_idx, rot_idx);
                        count += 1;
                        for &(a, b) in &[(p1, p2), (p1, p3), (p2, p3)] {
                            if a < 8 && b < 8 {
                                covered[a as usize][b as usize] = true;
                                covered[b as usize][a as usize] = true;
                            }
                        }
                    }
                }
            }
        }

        // --- Step 2: 2-subset(跳过被 triple 覆盖的 pair)---
        let n = target_pieces.len();
        for i in 0..n {
            for j in (i + 1)..n {
                if count >= MAX_AUX {
                    break;
                }
                let (p1, p2) = (target_pieces[i], target_pieces[j]);
                if p1 < 8 && p2 < 8 && covered[p1 as usize][p2 as usize] {
                    continue;
                }
                if p1 < 4 && p2 < 4 {
                    let r1 = ((p1 as i32 - ref_slot as i32 + 4) & 3) as u32;
                    let r2 = ((p2 as i32 - ref_slot as i32 + 4) & 3) as u32;
                    let (k1, k2) = if r1 < r2 { (r1, r2) } else { (r2, r1) };
                    let (table, rot_idx, target): (AuxTable, usize, [i32; 2]) = if k2.wrapping_sub(k1) == 2 {
                        (AuxTable::PsCrossE0E2, if k1 == 0 { 0 } else { 1 }, [0, 4])
                    } else {
                        let rot = match (k1, k2) {
                            (0, 1) => 0,
                            (0, 3) => 1,
                            (2, 3) => 2,
                            (1, 2) => 3,
                            _ => 0,
                        };
                        (AuxTable::PsCrossE0E1, rot, [0, 2])
                    };
                    out[count] = build(table, array_to_index(&target, 2, 2, 12) as u32, rot_idx);
                    count += 1;
                } else if p1 >= 4 && p2 >= 4 {
                    let r1 = (((p1 - 4) as i32 - ref_slot as i32 + 4) & 3) as u32 + 4;
                    let r2 = (((p2 - 4) as i32 - ref_slot as i32 + 4) & 3) as u32 + 4;
                    let (k1, k2) = if r1 < r2 { (r1, r2) } else { (r2, r1) };
                    let (table, rot_idx, target): (AuxTable, usize, [i32; 2]) = if k2.wrapping_sub(k1) == 2 {
                        (AuxTable::PsCrossC4C6, if k1 == 4 { 0 } else { 3 }, [12, 18])
                    } else {
                        let rot = match (k1, k2) {
                            (4, 5) => 0,
                            (4, 7) => 1,
                            (6, 7) => 2,
                            (5, 6) => 3,
                            _ => 0,
                        };
                        (AuxTable::PsCrossC4C5, rot, [12, 15])
                    };
                    out[count] = build(table, array_to_index(&target, 2, 3, 8) as u32, rot_idx);
                    count += 1;
                }
            }
        }
        (out, count)
    }

    /// diff = (edge_slot - corner_pslot + 4) & 3,对应 pseudo XCross `get_diff`。
    #[inline]
    fn diff(s: usize, p: usize) -> usize {
        (s + 4 - p) & 3
    }

    /// 实 frame 根状态:两棱组 i1/i2(cross 用),4 个 F2L 棱 edg[0..3](0..23,自由棱 EO 用)。
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

    /// 4 个 corner pslot 的共轭虚拟状态(对应 pseudo XCross `initial_states`)。
    fn initial_states(&self, alg: &[u8]) -> [BigConj; 4] {
        let mt_e4 = self.mt_edge4.as_u32();
        let mt_c = self.mt_corn.as_u32();
        let mt_e = self.mt_edge.as_u32();
        let cj = conj_moves_flat();
        let mut out = [BigConj { im: 0, ic_b: 0, ie_rel: [0; 4] }; 4];
        for p in 0..4 {
            let mut cur_mul: u32 = (state_space::CROSS_SOLVED as u32) * (state_space::CORNER as u32);
            let mut cur_cn: u32 = 12 * 18;
            let mut cur_e: [u32; 4] = [0, 2, 4, 6];
            for &m in alg {
                let mc = cj[m as usize][p] as usize;
                cur_mul = mt_e4[(cur_mul as usize) + mc];
                cur_cn = mt_c[(cur_cn as usize) + mc] * 18;
                for k in 0..4 {
                    cur_e[k] = mt_e[(cur_e[k] as usize) * 18 + mc];
                }
            }
            out[p] = BigConj { im: cur_mul, ic_b: cur_cn / 18, ie_rel: cur_e };
        }
        out
    }

    /// 单对 (棱槽 s, 角槽 p) 的 h 值(对应 pseudo XCross `get_h`)。
    #[inline]
    fn pair_h(&self, st: &[BigConj; 4], s: usize, p: usize) -> u32 {
        let d = Self::diff(s, p);
        let idx = (st[p].im as u64 + st[p].ic_b as u64) * 24 + st[p].ie_rel[d] as u64;
        self.pt_pscross_c4e[d].get(idx) as u32
    }

    // ---------------- Cross 阶段(同小表版:pscross 剪枝 + 4 棱 EO)----------------

    fn search_cross(&self, i1: usize, i2: usize, eo: [usize; 4], depth: u32, prev: u8) -> bool {
        let (vmoves, vcnt) = valid_moves();
        let count = vcnt[prev as usize] as usize;
        let row = &vmoves[prev as usize];
        let m2 = self.mt_edge2.as_u32();
        let me = self.mt_edge.as_u32();
        let pc = &self.cross_prune;
        for k in 0..count {
            let m = row[k] as usize;
            let n1 = m2[i1 + m] as usize;
            let n2 = m2[i2 + m] as usize;
            let pr = pc[n1 * E2 + n2] as u32;
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
        let pr = self.cross_prune[i1 * E2 + i2] as u32;
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

    // ---------------- XCross / XXCross / XXXCross(per-pair pt_pscross_C4E max + 自由棱 EO)----------------

    /// pairs[i] = (i1, i2, i3, p=共轭 slot, tab=diff)。ref_slot = combo 首角 pslot(aux 共轭基准)。
    /// aux/num_aux = 角组/棱组电池剪枝。free18 = 自由 F2L 棱(实 frame,×18)。
    /// 每节点:先 aux 剪(rot_map[mapper][cj[m][ref_slot]] 推进 + 查电池表),再每对 C4E 剪
    /// (cj[m][p] 推进),最后自由棱用实 m 推进、叶子门控 EO。
    #[allow(clippy::too_many_arguments)]
    fn search_psx(
        &self,
        pairs: &[(usize, usize, usize, usize, usize)],
        ref_slot: usize,
        aux: &[AuxState; MAX_AUX],
        num_aux: usize,
        free18: &[usize],
        depth: u32,
        prev: u8,
    ) -> bool {
        let (vmoves, vcnt) = valid_moves();
        let count = vcnt[prev as usize] as usize;
        let row = &vmoves[prev as usize];
        let mt_e4 = self.mt_edge4.as_u32();
        let mt_c = self.mt_corn.as_u32();
        let mt_e = self.mt_edge.as_u32();
        let cj = conj_moves_flat();
        let rm = rot_map();
        let n = pairs.len();
        let nf = free18.len();
        let mut local: u64 = 0;
        let mut next = [(0usize, 0usize, 0usize, 0usize, 0usize); 3];
        let mut next_aux = [AuxState::EMPTY; MAX_AUX];
        for k in 0..count {
            let m = row[k] as usize;
            local += 1;
            let mut pruned = false;

            // 1. 角组 / 棱组电池剪枝(rot_map[mapper] ∘ cj[·][ref_slot])。
            let m_ref = cj[m][ref_slot] as usize;
            for i in 0..num_aux {
                let cur = &aux[i];
                if !cur.is_valid() {
                    next_aux[i] = *cur;
                    continue;
                }
                let m_r = rm[cur.move_mapper_idx as usize][m_ref] as usize;
                let mt_aux = self.aux_mt(cur.table);
                let n_idx = mt_aux[(cur.current_idx as usize) * 18 + m_r];
                let n_cross = mt_e4[(cur.current_cross_scaled as usize) + m_r];
                let lookup: u64 = (n_cross / 24) as u64 * Self::aux_multiplier(cur.table) as u64 + n_idx as u64;
                if self.aux_pt(cur.table).get(lookup) as u32 >= depth {
                    pruned = true;
                    break;
                }
                next_aux[i] = AuxState {
                    table: cur.table,
                    current_idx: n_idx,
                    current_cross_scaled: n_cross,
                    move_mapper_idx: cur.move_mapper_idx,
                };
            }
            if pruned {
                continue;
            }

            // 2. 每对 C4E 剪枝(目标验证:全 0 ⟺ combo solved)。
            for (j, &(i1, i2, i3, p, tab)) in pairs.iter().enumerate() {
                let mc = cj[m][p] as usize;
                let n1 = mt_e4[i1 + mc] as usize;
                let n2 = mt_c[i2 + mc] as usize;
                let n3 = mt_e[i3 + mc] as usize;
                let idx: u64 = (n1 as u64 + n2 as u64) * 24 + n3 as u64;
                if self.pt_pscross_c4e[tab].get(idx) as u32 >= depth {
                    pruned = true;
                    break;
                }
                next[j] = (n1, n2 * 18, n3 * 18, p, tab);
            }
            if pruned {
                continue;
            }

            // 3. 自由棱(实 frame)+ 叶子 EO 门控。
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
                if self.search_psx(&next[..n], ref_slot, &next_aux, num_aux, &nf18[..nf], depth - 1, m as u8) {
                    bump_node_count(local);
                    return true;
                }
            }
        }
        bump_node_count(local);
        false
    }

    /// `a` = 已旋转 move 序列(setup_aux 共轭用)。combo 启发式 = max(每对 C4E, 角组, 棱组)。
    fn solve_stage(&self, a: &[u8], st: &[BigConj; 4], edg: &[usize; 4], combos: &[Vec<Pair>], cap: u32) -> u32 {
        let m = combos.len();
        let mut scored: [(u32, usize); 36] = [(0, 0); 36];
        // 每 combo 预建 aux(角组/棱组),存 (aux, num_aux, ref_slot)。
        let mut aux_all: [([AuxState; MAX_AUX], usize, usize); 36] =
            [([AuxState::EMPTY; MAX_AUX], 0, 0); 36];
        for k in 0..m {
            let combo = &combos[k];
            let ref_slot = combo[0].1; // 首对的角槽 pslot
            let mut tp = [0u8; 6];
            let mut tn = 0;
            for &(_s, p) in combo {
                tp[tn] = (p + 4) as u8;
                tn += 1;
            }
            for &(s, _p) in combo {
                tp[tn] = s as u8;
                tn += 1;
            }
            let (aux, naux) = self.setup_aux(&tp[..tn], a, ref_slot);
            let mut h = combo.iter().map(|&(s, p)| self.pair_h(st, s, p)).max().unwrap();
            for cur in aux.iter().take(naux) {
                let lookup: u64 = (cur.current_cross_scaled / 24) as u64
                    * Self::aux_multiplier(cur.table) as u64
                    + cur.current_idx as u64;
                let hv = self.aux_pt(cur.table).get(lookup) as u32;
                if hv > h {
                    h = hv;
                }
            }
            scored[k] = (h, k);
            aux_all[k] = (aux, naux, ref_slot);
        }
        scored[..m].sort_by_key(|t| t.0);
        let mut best = 99u32;
        for &(h, ci) in &scored[..m] {
            if h >= best {
                break;
            }
            let combo = &combos[ci];
            let (aux, naux, ref_slot) = &aux_all[ci];
            // 自由棱 = 不在 combo 棱槽集合里的 F2L 棱(实 frame)。
            let mut in_set = [false; 4];
            for &(s, _p) in combo {
                in_set[s] = true;
            }
            let mut free18 = [0usize; 3];
            let mut nf = 0;
            for t in 0..4 {
                if !in_set[t] {
                    free18[nf] = edg[t] * 18;
                    nf += 1;
                }
            }
            let res = if h == 0 && (0..nf).all(|j| (free18[j] / 18) % 2 == 0) {
                0
            } else {
                let mut pairs = [(0usize, 0usize, 0usize, 0usize, 0usize); 3];
                for (i, &(s, p)) in combo.iter().enumerate() {
                    let d = Self::diff(s, p);
                    pairs[i] = (st[p].im as usize, (st[p].ic_b as usize) * 18, (st[p].ie_rel[d] as usize) * 18, p, d);
                }
                let np = combo.len();
                let max_d = cap.min(best.saturating_sub(1));
                let mut found = 99;
                for d in h.max(1)..=max_d {
                    if self.search_psx(&pairs[..np], *ref_slot, aux, *naux, &free18[..nf], d, 18) {
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

    /// 6 视角 × 4 阶段,返回 24 值(同小表版口径:12 朝向折叠 min)。
    pub fn get_stats(&self, alg: &[Move]) -> Vec<u32> {
        const ROTS12: [&str; 12] =
            ["", "y", "z2", "z2 y", "z'", "z' y", "z", "z y", "x'", "x' y", "x", "x y"];
        let base: Vec<u8> = alg.iter().map(|m| m.index() as u8).collect();
        let cb = combos();
        let mut cross = [0u32; 12];
        let mut xc = [0u32; 12];
        let mut xxc = [0u32; 12];
        let mut xxxc = [0u32; 12];
        for (r, rot) in ROTS12.iter().enumerate() {
            let mut a = base.clone();
            alg_rotation(&mut a, rot);
            let (i1, i2, edg) = self.real_root(&a);
            let st = self.initial_states(&a);
            cross[r] = self.solve_cross(i1, i2, edg);
            xc[r] = self.solve_stage(&a, &st, &edg, &cb.xc, CAP_XC);
            xxc[r] = self.solve_stage(&a, &st, &edg, &cb.xxc, CAP_XXC);
            xxxc[r] = self.solve_stage(&a, &st, &edg, &cb.xxxc, CAP_XXXC);
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
impl Default for PseudoF2leoBigSolver {
    fn default() -> Self {
        Self::new()
    }
}

/// 进程级单例。
#[cfg(not(target_arch = "wasm32"))]
pub fn pseudo_f2leo_big_instance() -> Arc<PseudoF2leoBigSolver> {
    static S: OnceLock<Arc<PseudoF2leoBigSolver>> = OnceLock::new();
    S.get_or_init(|| Arc::new(PseudoF2leoBigSolver::new())).clone()
}

#[cfg(test)]
mod enum_tests {
    use super::*;
    use crate::cube_common::{string_to_alg, test_env_lock};
    use std::path::PathBuf;

    const ROTS: [&str; 6] = ["", "z2", "z'", "z", "x'", "x"];

    /// Pseudo F2LEO 枚举:best_len == get_stage 该 face 折叠值 + 每条最优解长度 == best_len。
    /// (combo 的 (棱槽,角槽) 配对未外露,移动有效性由浏览器端 cubing.js 重放独立校验。)
    /// `cargo test --release -- --ignored pseudo_f2leo_enum`
    #[test]
    #[ignore]
    fn pseudo_f2leo_enum_consistency() {
        let _lock = test_env_lock().lock().unwrap_or_else(|e| e.into_inner());
        std::env::set_var(
            "CUBE_TABLE_DIR",
            PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tables"),
        );
        let solver = PseudoF2leoSolver::new();
        // 内存紧张:1 条打乱 + 浅阶段(跳过最重的 xxxc)即可锁 bit-exact。
        let scrambles = ["B2 U' L2 U F2 L2 D2 L2 U F2 L F2 L D U L' D2 F' U2 B"];
        for scr in scrambles {
            let alg = string_to_alg(scr);
            for stage in 0..3usize {
                let counts = solver.get_stage(&alg, stage);
                for face in 0..6usize {
                    let (len, items) =
                        solver.enumerate_small(&alg, ROTS[face], stage, 0, 100, &[]);
                    assert_eq!(
                        len, counts[face],
                        "pseudo len mismatch scr={scr} stage={stage} face={face}: enum {len} vs count {}",
                        counts[face]
                    );
                    if len == 0 {
                        continue;
                    }
                    assert!(!items.is_empty(), "non-zero len must enumerate ≥1 sol");
                    for (_frame, _combo, p) in &items {
                        assert_eq!(p.len() as u32, len, "optimal sol length must == best_len");
                    }
                    // 并列合法性:每个出现的 (frame, combo) 都在 best_len 出解(即都是合法并列),
                    // 没有任何返回项落在非最优深度。
                    let mut seen: Vec<(&str, &Vec<usize>)> = Vec::new();
                    for (frame, combo, p) in &items {
                        assert_eq!(
                            p.len() as u32, len,
                            "tied (frame={frame}, combo={combo:?}) must solve at best_len {len}"
                        );
                        if !seen.iter().any(|&(f, c)| f == frame.as_str() && c == combo) {
                            seen.push((frame.as_str(), combo));
                        }
                    }
                    assert!(!seen.is_empty(), "must have ≥1 tied (frame,combo)");
                }
            }
        }
    }
}
