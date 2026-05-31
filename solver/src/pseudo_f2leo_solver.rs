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

use crate::cube_common::{alg_rotation, state_space, valid_moves, Move};
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
}
