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

use crate::cube_common::{alg_rotation, state_space, valid_moves, Move};
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
}
