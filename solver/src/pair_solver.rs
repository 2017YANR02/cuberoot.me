//! Pair analyzer 求解器(Phase 7)。
//!
//! 移植自 C++ `pair_analyzer.cpp`(728 行)。4 阶段 IDA* cascade:
//!   - solve_1_group: Cross + Pair(4 corner slots,search_1)
//!   - solve_2_group: XCross + Pair(4 fix × 3 tgt = 12 task,search_2)
//!   - solve_3_group: XXCross + Pair(6 pair × 2 tgt = 12 task,search_3,huge table)
//!   - solve_4_group: XXXCross + Pair(4 tgt,search_4,3 个 huge table 同步)
//!
//! 依赖表:
//!   - mt_edge4 / mt_corn / mt_edge / mt_edge6 / mt_corn2
//!   - pt_cross_ins_C4 (~2.18 MB)
//!   - pt_pair_C4E0 (288 B)
//!   - pt_cross_C4E0 (~52 MB)
//!   - pt_cross_C4C5E0E1 (~10 GB)
//!   - pt_cross_C4C6E0E2 (~10 GB,可选,无则只用 neighbor 视角)

use std::sync::Arc;

use crate::cube_common::{
    alg_rotation, array_to_index, conj_moves_flat, get_diagonal_view, get_neighbor_view,
    state_space, valid_moves, Move,
};
use crate::executor::bump_node_count;
use crate::move_tables::{self, MoveTable};
use crate::prune_tables::{self, PackedPruneTable};

pub struct PairSolver {
    mt_edge4: Arc<MoveTable>,
    mt_corn: Arc<MoveTable>,
    mt_edge: Arc<MoveTable>,
    // huge 阶段表(wasm 小表模式全 None;native 全 Some)。mt_edge6 ~3GB,
    // pt_cross_C4C5E0E1/C4C6E0E2 各 ~10GB —— 浏览器装不下,小表模式靠
    // pt_cross_ins_C4 + pt_pair_C4E0 + pt_cross_C4E0 作可采纳下界(huge 仅加速,
    // 丢掉后 search_3/4 的 huge_check 在 None 下不剪枝,IDA* 仍逐格 bit-exact)。
    mt_edge6: Option<Arc<MoveTable>>,
    mt_corn2: Option<Arc<MoveTable>>,
    pt_cross_ins_c4: Arc<PackedPruneTable>,
    pt_pair_c4e0: Arc<PackedPruneTable>,
    pt_cross_c4e0: Arc<PackedPruneTable>,
    pt_cross_c4c5e0e1: Option<Arc<PackedPruneTable>>,
    pt_cross_c4c6e0e2: Option<Arc<PackedPruneTable>>,
    // 解决态的 4 个 E6/C2 索引(Neighbor / Diagonal)
    idx_solved_e6_nb: u32,
    idx_solved_e6_dg: u32,
    idx_solved_c2_nb: u32,
    idx_solved_c2_dg: u32,
}

/// 单 slot 在指定 alg 下的虚拟状态(7 个分量)。
#[derive(Debug, Clone, Copy, Default)]
struct VirtState {
    im: u32,
    ic: u32,
    ie: u32,
    ie6_nb: u32,
    ic2_nb: u32,
    ie6_dg: u32,
    ic2_dg: u32,
}

const IDX_C4: u32 = 12;
const IDX_E0: u32 = 0;

impl PairSolver {
    /// 解决态 E6/C2 索引(neighbor / diagonal),native+wasm 共用。
    fn solved_idx() -> (u32, u32, u32, u32) {
        let v_e6_nb: [i32; 6] = [0, 2, 16, 18, 20, 22];
        let v_e6_dg: [i32; 6] = [0, 4, 16, 18, 20, 22];
        let v_c2_nb: [i32; 2] = [12, 15];
        let v_c2_dg: [i32; 2] = [12, 18];
        (
            array_to_index(&v_e6_nb, 6, 2, 12) as u32,
            array_to_index(&v_e6_dg, 6, 2, 12) as u32,
            array_to_index(&v_c2_nb, 2, 3, 8) as u32,
            array_to_index(&v_c2_dg, 2, 3, 8) as u32,
        )
    }

    /// 构造时 ensure 所有必需的表。`with_diagonal=false` 时跳过 pt_cross_C4C6E0E2
    /// (节省 10 GB 磁盘 / RAM,只用 neighbor 视角)。native-only(走 manager)。
    #[cfg(not(target_arch = "wasm32"))]
    pub fn new(with_diagonal: bool) -> Self {
        let mtm = move_tables::instance();
        let ptm = prune_tables::instance();

        let (e6n, e6d, c2n, c2d) = Self::solved_idx();
        let pt_cross_c4c6e0e2 = if with_diagonal {
            Some(ptm.ensure_pt_cross_c4c6e0e2())
        } else {
            None
        };

        PairSolver {
            mt_edge4: mtm.ensure_edge4(),
            mt_corn: mtm.ensure_corn(),
            mt_edge: mtm.ensure_edge(),
            mt_edge6: Some(mtm.ensure_edge6()),
            mt_corn2: Some(mtm.ensure_corn2()),
            pt_cross_ins_c4: ptm.ensure_pt_cross_ins_c4(),
            pt_pair_c4e0: ptm.ensure_pt_pair_c4e0(),
            pt_cross_c4e0: ptm.ensure_pt_cross_c4e0(),
            pt_cross_c4c5e0e1: Some(ptm.ensure_pt_cross_c4c5e0e1()),
            pt_cross_c4c6e0e2,
            idx_solved_e6_nb: e6n,
            idx_solved_e6_dg: e6d,
            idx_solved_c2_nb: c2n,
            idx_solved_c2_dg: c2d,
        }
    }

    /// 小表模式(wasm):不要 mt_edge6 / huge pair 表。靠 pt_cross_ins_C4(~2.2MB)
    /// + pt_pair_C4E0(304B)+ pt_cross_C4E0(~52MB)作可采纳下界;huge_check 在
    /// None 下不剪枝,IDA* 仍逐格 bit-exact(仅访问更多节点)。
    pub fn from_tables(
        mt_edge4: Arc<MoveTable>,
        mt_corn: Arc<MoveTable>,
        mt_edge: Arc<MoveTable>,
        pt_cross_ins_c4: Arc<PackedPruneTable>,
        pt_pair_c4e0: Arc<PackedPruneTable>,
        pt_cross_c4e0: Arc<PackedPruneTable>,
    ) -> Self {
        let (e6n, e6d, c2n, c2d) = Self::solved_idx();
        PairSolver {
            mt_edge4,
            mt_corn,
            mt_edge,
            mt_edge6: None,
            mt_corn2: None,
            pt_cross_ins_c4,
            pt_pair_c4e0,
            pt_cross_c4e0,
            pt_cross_c4c5e0e1: None,
            pt_cross_c4c6e0e2: None,
            idx_solved_e6_nb: e6n,
            idx_solved_e6_dg: e6d,
            idx_solved_c2_nb: c2n,
            idx_solved_c2_dg: c2d,
        }
    }

    /// 在 slot_k 视角下推 alg,得到 7 个量。对应 C++ `get_conjugated_indices_all`。
    /// 小表模式(mt_edge6=None)不跟踪 e6/c2(huge 用),返回 0;它们仅在 huge 剪枝
    /// 时被读,而小表模式 huge 全 None → 不会用到。
    fn get_virt(&self, alg: &[u8], slot_k: usize) -> VirtState {
        let mt_e4 = self.mt_edge4.as_u32();
        let mt_c = self.mt_corn.as_u32();
        let mt_e = self.mt_edge.as_u32();
        let cj = conj_moves_flat();

        let mut cur_mul: u32 =
            (state_space::CROSS_SOLVED as u32) * (state_space::CORNER as u32);
        let mut cur_corn: u32 = IDX_C4 * 18;
        let mut cur_e0: u32 = IDX_E0 * 18;

        // huge(e6/c2)轨迹仅在 native(mt_edge6=Some)跟踪。
        let huge = self
            .mt_edge6
            .as_ref()
            .map(|m6| (m6.as_u32(), self.mt_corn2.as_ref().unwrap().as_u32()));
        let mut cur_e6_n: u32 = self.idx_solved_e6_nb * 18;
        let mut cur_c2_n: u32 = self.idx_solved_c2_nb * 18;
        let mut cur_e6_d: u32 = self.idx_solved_e6_dg * 18;
        let mut cur_c2_d: u32 = self.idx_solved_c2_dg * 18;

        for &m in alg {
            let mc = cj[m as usize][slot_k] as usize;
            cur_mul = mt_e4[(cur_mul as usize) + mc];
            cur_corn = mt_c[(cur_corn as usize) + mc] * 18;
            cur_e0 = mt_e[(cur_e0 as usize) + mc] * 18;
            if let Some((mt_e6, mt_c2)) = huge {
                cur_e6_n = mt_e6[(cur_e6_n as usize) + mc] * 18;
                cur_c2_n = mt_c2[(cur_c2_n as usize) + mc] * 18;
                cur_e6_d = mt_e6[(cur_e6_d as usize) + mc] * 18;
                cur_c2_d = mt_c2[(cur_c2_d as usize) + mc] * 18;
            }
        }
        VirtState {
            im: cur_mul,
            ic: cur_corn / 18,
            ie: cur_e0 / 18,
            ie6_nb: cur_e6_n / 18,
            ic2_nb: cur_c2_n / 18,
            ie6_dg: cur_e6_d / 18,
            ic2_dg: cur_c2_d / 18,
        }
    }

    /// 翻译 C++ `hugeTablePrunes`。conj=-1 或 table=None 时返回 (false, 0, 0)。
    /// 返回 (剪枝, new_e6, new_c2)。
    #[inline]
    fn huge_check(
        &self,
        conj: i32,
        table: Option<&PackedPruneTable>,
        e6: u32,
        c2: u32,
        m: usize,
        depth: u32,
    ) -> (bool, u32, u32) {
        let table = match table {
            Some(t) if conj != -1 => t,
            _ => return (false, 0, 0),
        };
        // table 为 Some ⇒ huge 已加载 ⇒ mt_edge6/mt_corn2 必为 Some(native)。
        let cj = conj_moves_flat();
        let mx = cj[m][conj as usize] as usize;
        let n_e6 = self.mt_edge6.as_ref().unwrap().as_u32()[(e6 as usize) * 18 + mx];
        let n_c2 = self.mt_corn2.as_ref().unwrap().as_u32()[(c2 as usize) * 18 + mx];
        let idx: u64 = n_e6 as u64 * state_space::CORNER2 as u64 + n_c2 as u64;
        let prune = table.get(idx) as u32;
        (prune >= depth, n_e6, n_c2)
    }

    // --- search_1: Cross + Pair on 1 slot ---
    fn search_1(&self, i1: usize, i2: usize, i3: usize, depth: u32, prev: u8, s1: usize) -> bool {
        let (vmoves, vcnt) = valid_moves();
        let count = vcnt[prev as usize] as usize;
        let row = &vmoves[prev as usize];
        let mt_e4 = self.mt_edge4.as_u32();
        let mt_c = self.mt_corn.as_u32();
        let mt_e = self.mt_edge.as_u32();
        let cj = conj_moves_flat();

        let mut local: u64 = 0;
        for k in 0..count {
            let m = row[k] as usize;
            local += 1;
            let mc = cj[m][s1] as usize;
            let n1 = mt_e4[i1 + mc] as usize;
            let n2 = mt_c[i2 + mc] as usize;
            if self.pt_cross_ins_c4.get((n1 + n2) as u64) as u32 >= depth {
                continue;
            }
            let n3 = mt_e[i3 + mc] as usize;
            if self.pt_pair_c4e0.get((n3 * 24 + n2) as u64) as u32 >= depth {
                continue;
            }
            if depth == 1 {
                if self.pt_cross_ins_c4.get((n1 + n2) as u64) == 0
                    && self.pt_pair_c4e0.get((n3 * 24 + n2) as u64) == 0
                {
                    bump_node_count(local);
                    return true;
                }
            } else if self.search_1(n1, n2 * 18, n3 * 18, depth - 1, m as u8, s1) {
                bump_node_count(local);
                return true;
            }
        }
        bump_node_count(local);
        false
    }

    // --- search_2: Cross+Pair (slot s_p) + XCross (slot s_x) ---
    #[allow(clippy::too_many_arguments)]
    fn search_2(
        &self,
        im_p: usize,
        ic_p: usize,
        ie_p: usize,
        im_x: usize,
        ic_x: usize,
        ie_x: usize,
        depth: u32,
        prev: u8,
        s_p: usize,
        s_x: usize,
    ) -> bool {
        let (vmoves, vcnt) = valid_moves();
        let count = vcnt[prev as usize] as usize;
        let row = &vmoves[prev as usize];
        let mt_e4 = self.mt_edge4.as_u32();
        let mt_c = self.mt_corn.as_u32();
        let mt_e = self.mt_edge.as_u32();
        let cj = conj_moves_flat();

        let mut local: u64 = 0;
        for k in 0..count {
            let m = row[k] as usize;
            local += 1;
            // 1. XCross
            let mc_x = cj[m][s_x] as usize;
            let n_im_x = mt_e4[im_x + mc_x] as usize;
            let n_ic_x = mt_c[ic_x + mc_x] as usize;
            let n_ie_x = mt_e[ie_x + mc_x] as usize;
            let idx_xc: u64 = (n_im_x as u64 + n_ic_x as u64) * 24 + n_ie_x as u64;
            if self.pt_cross_c4e0.get(idx_xc) as u32 >= depth {
                continue;
            }
            // 2. Cross (insertion C4 slot s_p)
            let mc_p = cj[m][s_p] as usize;
            let n_im_p = mt_e4[im_p + mc_p] as usize;
            let n_ic_p = mt_c[ic_p + mc_p] as usize;
            if self.pt_cross_ins_c4.get((n_im_p + n_ic_p) as u64) as u32 >= depth {
                continue;
            }
            // 3. Pair
            let n_ie_p = mt_e[ie_p + mc_p] as usize;
            if self.pt_pair_c4e0.get((n_ie_p * 24 + n_ic_p) as u64) as u32 >= depth {
                continue;
            }
            if depth == 1 {
                if self.pt_pair_c4e0.get((n_ie_p * 24 + n_ic_p) as u64) == 0
                    && self.pt_cross_c4e0.get(idx_xc) == 0
                {
                    bump_node_count(local);
                    return true;
                }
            } else if self.search_2(
                n_im_p,
                n_ic_p * 18,
                n_ie_p * 18,
                n_im_x,
                n_ic_x * 18,
                n_ie_x * 18,
                depth - 1,
                m as u8,
                s_p,
                s_x,
            ) {
                bump_node_count(local);
                return true;
            }
        }
        bump_node_count(local);
        false
    }

    // --- search_3: Cross+Pair (s_p) + XXCross via 1 huge table ---
    #[allow(clippy::too_many_arguments)]
    fn search_3(
        &self,
        im_p: usize,
        ic_p: usize,
        ie_p: usize,
        i_e6: u32,
        i_c2: u32,
        s_v: i32,
        p_huge: Option<&PackedPruneTable>,
        depth: u32,
        prev: u8,
        s_p: usize,
    ) -> bool {
        let (vmoves, vcnt) = valid_moves();
        let count = vcnt[prev as usize] as usize;
        let row = &vmoves[prev as usize];
        let mt_e4 = self.mt_edge4.as_u32();
        let mt_c = self.mt_corn.as_u32();
        let mt_e = self.mt_edge.as_u32();
        let cj = conj_moves_flat();

        let mut local: u64 = 0;
        for k in 0..count {
            let m = row[k] as usize;
            local += 1;
            let (pruned, n_ie6, n_ic2) = self.huge_check(s_v, p_huge, i_e6, i_c2, m, depth);
            if pruned {
                continue;
            }
            let mc_p = cj[m][s_p] as usize;
            let n_im_p = mt_e4[im_p + mc_p] as usize;
            let n_ic_p = mt_c[ic_p + mc_p] as usize;
            if self.pt_cross_ins_c4.get((n_im_p + n_ic_p) as u64) as u32 >= depth {
                continue;
            }
            let n_ie_p = mt_e[ie_p + mc_p] as usize;
            if self.pt_pair_c4e0.get((n_ie_p * 24 + n_ic_p) as u64) as u32 >= depth {
                continue;
            }
            if depth == 1 {
                if self.pt_pair_c4e0.get((n_ie_p * 24 + n_ic_p) as u64) == 0 {
                    bump_node_count(local);
                    return true;
                }
            } else {
                let (ne6, nc2) = if s_v != -1 { (n_ie6, n_ic2) } else { (0, 0) };
                if self.search_3(
                    n_im_p,
                    n_ic_p * 18,
                    n_ie_p * 18,
                    ne6,
                    nc2,
                    s_v,
                    p_huge,
                    depth - 1,
                    m as u8,
                    s_p,
                ) {
                    bump_node_count(local);
                    return true;
                }
            }
        }
        bump_node_count(local);
        false
    }

    // --- search_4: Cross+Pair (s_p) + XXXCross via 3 huge tables ---
    #[allow(clippy::too_many_arguments)]
    fn search_4(
        &self,
        im_p: usize,
        ic_p: usize,
        ie_p: usize,
        ie6: [u32; 3],
        ic2: [u32; 3],
        v: [i32; 3],
        p: [Option<&PackedPruneTable>; 3],
        depth: u32,
        prev: u8,
        s_p: usize,
    ) -> bool {
        let (vmoves, vcnt) = valid_moves();
        let count = vcnt[prev as usize] as usize;
        let row = &vmoves[prev as usize];
        let mt_e4 = self.mt_edge4.as_u32();
        let mt_c = self.mt_corn.as_u32();
        let mt_e = self.mt_edge.as_u32();
        let cj = conj_moves_flat();

        let mut local: u64 = 0;
        for k in 0..count {
            let m = row[k] as usize;
            local += 1;

            let mut n_ie6 = [0u32; 3];
            let mut n_ic2 = [0u32; 3];
            let mut any_pruned = false;
            for i in 0..3 {
                let (pr, e6, c2) = self.huge_check(v[i], p[i], ie6[i], ic2[i], m, depth);
                if pr {
                    any_pruned = true;
                    break;
                }
                n_ie6[i] = e6;
                n_ic2[i] = c2;
            }
            if any_pruned {
                continue;
            }
            let mc_p = cj[m][s_p] as usize;
            let n_im_p = mt_e4[im_p + mc_p] as usize;
            let n_ic_p = mt_c[ic_p + mc_p] as usize;
            if self.pt_cross_ins_c4.get((n_im_p + n_ic_p) as u64) as u32 >= depth {
                continue;
            }
            let n_ie_p = mt_e[ie_p + mc_p] as usize;
            if self.pt_pair_c4e0.get((n_ie_p * 24 + n_ic_p) as u64) as u32 >= depth {
                continue;
            }
            if depth == 1 {
                if self.pt_pair_c4e0.get((n_ie_p * 24 + n_ic_p) as u64) == 0 {
                    bump_node_count(local);
                    return true;
                }
            } else {
                let mut next_e6 = [0u32; 3];
                let mut next_c2 = [0u32; 3];
                for i in 0..3 {
                    if v[i] != -1 {
                        next_e6[i] = n_ie6[i];
                        next_c2[i] = n_ic2[i];
                    }
                }
                if self.search_4(
                    n_im_p,
                    n_ic_p * 18,
                    n_ie_p * 18,
                    next_e6,
                    next_c2,
                    v,
                    p,
                    depth - 1,
                    m as u8,
                    s_p,
                ) {
                    bump_node_count(local);
                    return true;
                }
            }
        }
        bump_node_count(local);
        false
    }

    // --- solve groups ---

    pub fn solve_1_group(&self, alg: &[u8], bound: u32) -> u32 {
        // 4 slot,按 h 升序
        let mut tasks: Vec<(usize, u32)> = (0..4)
            .map(|s1| {
                let st = self.get_virt(alg, s1);
                let h = self.pt_cross_ins_c4.get((st.im + st.ic) as u64) as u32;
                (s1, h)
            })
            .collect();
        tasks.sort_by_key(|t| t.1);

        let mut min_v = bound;
        for &(s1, h) in &tasks {
            if h >= min_v {
                continue;
            }
            let st = self.get_virt(alg, s1);
            if h == 0 && self.pt_pair_c4e0.get((st.ie * 24 + st.ic) as u64) == 0 {
                return 0;
            }
            let max_search = std::cmp::min(18, min_v.saturating_sub(1));
            for d in h..=max_search {
                if self.search_1(st.im as usize, (st.ic as usize) * 18, (st.ie as usize) * 18, d, 18, s1) {
                    if d < min_v {
                        min_v = d;
                    }
                    break;
                }
            }
        }
        min_v
    }

    pub fn solve_2_group(&self, alg: &[u8], bound: u32, lower_bound: u32) -> u32 {
        let mut tasks: Vec<(usize, usize, u32)> = Vec::with_capacity(12);
        for fix in 0..4 {
            for tgt in 0..4 {
                if fix == tgt {
                    continue;
                }
                let sp = self.get_virt(alg, tgt);
                let sx = self.get_virt(alg, fix);
                let h1 = self.pt_cross_ins_c4.get((sp.im + sp.ic) as u64) as u32;
                let h2 = self
                    .pt_cross_c4e0
                    .get((sx.im as u64 + sx.ic as u64) * 24 + sx.ie as u64)
                    as u32;
                tasks.push((tgt, fix, std::cmp::max(h1, h2)));
            }
        }
        tasks.sort_by_key(|t| t.2);

        let mut min_v = bound;
        for &(s1, s2, h) in &tasks {
            if h >= min_v {
                continue;
            }
            let sp = self.get_virt(alg, s1);
            let sx = self.get_virt(alg, s2);
            if h == 0 && self.pt_pair_c4e0.get((sp.ie * 24 + sp.ic) as u64) == 0 {
                return 0;
            }
            let max_search = std::cmp::min(18, min_v.saturating_sub(1));
            let start_d = std::cmp::max(h, lower_bound);
            for d in start_d..=max_search {
                if self.search_2(
                    sp.im as usize,
                    (sp.ic as usize) * 18,
                    (sp.ie as usize) * 18,
                    sx.im as usize,
                    (sx.ic as usize) * 18,
                    (sx.ie as usize) * 18,
                    d,
                    18,
                    s1,
                    s2,
                ) {
                    if d < min_v {
                        min_v = d;
                    }
                    break;
                }
            }
        }
        min_v
    }

    pub fn solve_3_group(&self, alg: &[u8], bound: u32, lower_bound: u32) -> u32 {
        const PAIRS: [[usize; 2]; 6] = [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]];

        let mut tasks: Vec<(usize, usize, usize, u32)> = Vec::with_capacity(12);
        for p in &PAIRS {
            for tgt in 0..4 {
                if tgt == p[0] || tgt == p[1] {
                    continue;
                }
                let sp = self.get_virt(alg, tgt);
                let sx1 = self.get_virt(alg, p[0]);
                let sx2 = self.get_virt(alg, p[1]);
                let h1 = self.pt_cross_ins_c4.get((sp.im + sp.ic) as u64) as u32;
                let h2 = self
                    .pt_cross_c4e0
                    .get((sx1.im as u64 + sx1.ic as u64) * 24 + sx1.ie as u64)
                    as u32;
                let h3 = self
                    .pt_cross_c4e0
                    .get((sx2.im as u64 + sx2.ic as u64) * 24 + sx2.ie as u64)
                    as u32;

                let mut h_huge = 0u32;
                let v_nb = get_neighbor_view(p[0] as i32, p[1] as i32);
                if v_nb != -1 {
                    if let Some(nb) = &self.pt_cross_c4c5e0e1 {
                        let st_v = self.get_virt(alg, v_nb as usize);
                        let idx: u64 =
                            st_v.ie6_nb as u64 * state_space::CORNER2 as u64 + st_v.ic2_nb as u64;
                        h_huge = nb.get(idx) as u32;
                    }
                } else if let Some(pt_dg) = &self.pt_cross_c4c6e0e2 {
                    let v_dg = get_diagonal_view(p[0] as i32, p[1] as i32);
                    let st_v = self.get_virt(alg, v_dg as usize);
                    let idx: u64 =
                        st_v.ie6_dg as u64 * state_space::CORNER2 as u64 + st_v.ic2_dg as u64;
                    h_huge = pt_dg.get(idx) as u32;
                }
                let h = h1.max(h2).max(h3).max(h_huge);
                tasks.push((tgt, p[0], p[1], h));
            }
        }
        tasks.sort_by_key(|t| t.3);

        let mut min_v = bound;
        for &(s1, s2, s3, h) in &tasks {
            if h >= min_v {
                continue;
            }
            let sp = self.get_virt(alg, s1);
            if h == 0 && self.pt_pair_c4e0.get((sp.ie * 24 + sp.ic) as u64) == 0 {
                return 0;
            }
            let mut ie6_use = 0u32;
            let mut ic2_use = 0u32;
            let mut v_use: i32 = -1;
            let mut p_use: Option<&PackedPruneTable> = None;
            let v_nb = get_neighbor_view(s2 as i32, s3 as i32);
            if v_nb != -1 && self.pt_cross_c4c5e0e1.is_some() {
                v_use = v_nb;
                let st = self.get_virt(alg, v_nb as usize);
                ie6_use = st.ie6_nb;
                ic2_use = st.ic2_nb;
                p_use = self.pt_cross_c4c5e0e1.as_deref();
            } else if let Some(pt_dg) = &self.pt_cross_c4c6e0e2 {
                let v_dg = get_diagonal_view(s2 as i32, s3 as i32);
                v_use = v_dg;
                let st = self.get_virt(alg, v_dg as usize);
                ie6_use = st.ie6_dg;
                ic2_use = st.ic2_dg;
                p_use = Some(pt_dg);
            }
            let max_search = std::cmp::min(18, min_v.saturating_sub(1));
            let start_d = std::cmp::max(h, lower_bound);
            for d in start_d..=max_search {
                if self.search_3(
                    sp.im as usize,
                    (sp.ic as usize) * 18,
                    (sp.ie as usize) * 18,
                    ie6_use,
                    ic2_use,
                    v_use,
                    p_use,
                    d,
                    18,
                    s1,
                ) {
                    if d < min_v {
                        min_v = d;
                    }
                    break;
                }
            }
        }
        min_v
    }

    pub fn solve_4_group(&self, alg: &[u8], bound: u32, lower_bound: u32) -> u32 {
        // 4 tgt;每个 tgt 配 3 个 fix 槽位
        let mut tasks: Vec<(usize, [usize; 3], u32)> = Vec::with_capacity(4);
        for tgt in 0..4 {
            let mut fix = [0usize; 3];
            let mut fi = 0;
            for k in 0..4 {
                if k != tgt {
                    fix[fi] = k;
                    fi += 1;
                }
            }
            let sp = self.get_virt(alg, tgt);
            let mut h = self.pt_cross_ins_c4.get((sp.im + sp.ic) as u64) as u32;
            let s0 = self.get_virt(alg, fix[0]);
            let s1 = self.get_virt(alg, fix[1]);
            let s2 = self.get_virt(alg, fix[2]);
            let s_arr = [s0, s1, s2];
            for i in 0..3 {
                let v = self
                    .pt_cross_c4e0
                    .get((s_arr[i].im as u64 + s_arr[i].ic as u64) * 24 + s_arr[i].ie as u64)
                    as u32;
                if v > h {
                    h = v;
                }
            }
            for i in 0..3 {
                for j in (i + 1)..3 {
                    let v_nb = get_neighbor_view(fix[i] as i32, fix[j] as i32);
                    if v_nb != -1 && self.pt_cross_c4c5e0e1.is_some() {
                        let st_v = self.get_virt(alg, v_nb as usize);
                        let idx: u64 =
                            st_v.ie6_nb as u64 * state_space::CORNER2 as u64 + st_v.ic2_nb as u64;
                        let h_huge = self.pt_cross_c4c5e0e1.as_ref().unwrap().get(idx) as u32;
                        if h_huge > h {
                            h = h_huge;
                        }
                    } else if let Some(pt_dg) = &self.pt_cross_c4c6e0e2 {
                        let v_dg = get_diagonal_view(fix[i] as i32, fix[j] as i32);
                        let st_v = self.get_virt(alg, v_dg as usize);
                        let idx: u64 =
                            st_v.ie6_dg as u64 * state_space::CORNER2 as u64 + st_v.ic2_dg as u64;
                        let h_huge = pt_dg.get(idx) as u32;
                        if h_huge > h {
                            h = h_huge;
                        }
                    }
                }
            }
            tasks.push((tgt, fix, h));
        }
        tasks.sort_by_key(|t| t.2);

        let mut min_v = bound;
        for &(s1, fix, h) in &tasks {
            if h >= min_v {
                continue;
            }
            let sp = self.get_virt(alg, s1);
            if h == 0 && self.pt_pair_c4e0.get((sp.ie * 24 + sp.ic) as u64) == 0 {
                return 0;
            }
            // 3 个 pair: (fix[0], fix[1]), (fix[1], fix[2]), (fix[2], fix[0])
            let pairs: [[usize; 2]; 3] =
                [[fix[0], fix[1]], [fix[1], fix[2]], [fix[2], fix[0]]];
            let mut ie6 = [0u32; 3];
            let mut ic2 = [0u32; 3];
            let mut v: [i32; 3] = [-1; 3];
            let mut p: [Option<&PackedPruneTable>; 3] = [None; 3];
            for i in 0..3 {
                let v_nb = get_neighbor_view(pairs[i][0] as i32, pairs[i][1] as i32);
                if v_nb != -1 && self.pt_cross_c4c5e0e1.is_some() {
                    v[i] = v_nb;
                    let st_v = self.get_virt(alg, v_nb as usize);
                    ie6[i] = st_v.ie6_nb;
                    ic2[i] = st_v.ic2_nb;
                    p[i] = self.pt_cross_c4c5e0e1.as_deref();
                } else if let Some(pt_dg) = &self.pt_cross_c4c6e0e2 {
                    let v_dg = get_diagonal_view(pairs[i][0] as i32, pairs[i][1] as i32);
                    v[i] = v_dg;
                    let st_v = self.get_virt(alg, v_dg as usize);
                    ie6[i] = st_v.ie6_dg;
                    ic2[i] = st_v.ic2_dg;
                    p[i] = Some(pt_dg);
                }
            }
            let max_search = std::cmp::min(18, min_v.saturating_sub(1));
            let start_d = std::cmp::max(h, lower_bound);
            for d in start_d..=max_search {
                if self.search_4(
                    sp.im as usize,
                    (sp.ic as usize) * 18,
                    (sp.ie as usize) * 18,
                    ie6,
                    ic2,
                    v,
                    p,
                    d,
                    18,
                    s1,
                ) {
                    if d < min_v {
                        min_v = d;
                    }
                    break;
                }
            }
        }
        min_v
    }

    /// 6 视角 × 4 阶段。返回 24 个值,顺序 [cross_pair, xcross_pair, xxcross_pair, xxxcross_pair] × rots。
    pub fn get_stats(&self, alg: &[Move], rots: &[&str]) -> Vec<u32> {
        let mut cp_res = vec![0u32; rots.len()];
        let mut xcp_res = vec![0u32; rots.len()];
        let mut xxcp_res = vec![0u32; rots.len()];
        let mut xxxcp_res = vec![0u32; rots.len()];

        let alg_idx: Vec<u8> = alg.iter().map(|m| m.index() as u8).collect();

        for (i, r) in rots.iter().enumerate() {
            let mut a = alg_idx.clone();
            alg_rotation(&mut a, r);
            cp_res[i] = self.solve_1_group(&a, 99);
        }
        for (i, r) in rots.iter().enumerate() {
            let mut a = alg_idx.clone();
            alg_rotation(&mut a, r);
            xcp_res[i] = self.solve_2_group(&a, 99, cp_res[i]);
        }
        for (i, r) in rots.iter().enumerate() {
            let mut a = alg_idx.clone();
            alg_rotation(&mut a, r);
            xxcp_res[i] = self.solve_3_group(&a, 99, xcp_res[i]);
        }
        for (i, r) in rots.iter().enumerate() {
            let mut a = alg_idx.clone();
            alg_rotation(&mut a, r);
            xxxcp_res[i] = self.solve_4_group(&a, 99, xxcp_res[i]);
        }

        let mut out = Vec::with_capacity(4 * rots.len());
        out.extend(cp_res);
        out.extend(xcp_res);
        out.extend(xxcp_res);
        out.extend(xxxcp_res);
        out
    }
}

// ============================================================================
// 小表 cascade(wasm 友好,无 huge / 无 mt_edge6)
// ----------------------------------------------------------------------------
// native solve_3/4_group 用 ~10GB huge 表「联合」验证 2~3 个 xcross 槽是否解出
// (叶子只查 pair,xcross 槽靠 huge prune 归 0)。wasm 装不下 huge,这里改成像
// std `get_stats_small` 那样**显式逐槽追踪**:每个 xcross 槽各用 pt_cross_C4E0,
// pair 槽用 cross_ins + pair。叶子(depth==1 且全部 prune < 1 ⇒ ==0)即 cross +
// pair + N 槽全解。per-slot C4E0 / cross_ins / pair 都是真实距离的可采纳下界 ⇒
// IDA* 首达即最优,与 huge 路径逐格 bit-exact,仅访问更多节点。
// 阶段 0/1(cross_pair/xcross_pair)native 本就不用 huge → 直接复用 solve_1/2_group。
impl PairSolver {
    /// 一步推进:pair 槽(p_*,slot=p_slot)+ N 个 xcross 槽(xc:(im,ic*18,ie*18,slot))。
    /// 任一 prune ≥ depth 即剪;depth==1 全过 ⇒ 全解。
    fn search_small(
        &self,
        p_im: usize,
        p_ic: usize,
        p_ie: usize,
        p_slot: usize,
        xc: &[(usize, usize, usize, usize)],
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
        let n = xc.len();

        let mut local: u64 = 0;
        let mut nxc = [(0usize, 0usize, 0usize, 0usize); 3];
        for k in 0..count {
            let m = row[k] as usize;
            local += 1;
            // pair 槽:cross_ins(cross+corner)+ pair(corner+edge 成对)
            let mc_p = cj[m][p_slot] as usize;
            let nim_p = mt_e4[p_im + mc_p] as usize;
            let nic_p = mt_c[p_ic + mc_p] as usize;
            if self.pt_cross_ins_c4.get((nim_p + nic_p) as u64) as u32 >= depth {
                continue;
            }
            let nie_p = mt_e[p_ie + mc_p] as usize;
            if self.pt_pair_c4e0.get((nie_p * 24 + nic_p) as u64) as u32 >= depth {
                continue;
            }
            // xcross 槽:各自 pt_cross_C4E0
            let mut pruned = false;
            for j in 0..n {
                let (im, ic, ie, slot) = xc[j];
                let mc = cj[m][slot] as usize;
                let n1 = mt_e4[im + mc] as usize;
                let n2 = mt_c[ic + mc] as usize;
                let n3 = mt_e[ie + mc] as usize;
                if self.pt_cross_c4e0.get(((n1 + n2) * 24 + n3) as u64) as u32 >= depth {
                    pruned = true;
                    break;
                }
                nxc[j] = (n1, n2 * 18, n3 * 18, slot);
            }
            if pruned {
                continue;
            }
            if depth == 1 {
                // 全部 prune < 1 ⇒ cross+pair+N 槽全 == 0(已解)。
                bump_node_count(local);
                return true;
            }
            if self.search_small(nim_p, nic_p * 18, nie_p * 18, p_slot, &nxc[..n], depth - 1, m as u8) {
                bump_node_count(local);
                return true;
            }
        }
        bump_node_count(local);
        false
    }

    /// 解一个 task:pair 槽 tgt + xcross 槽 xc_slots。h=根可采纳下界,lower=上一阶段(cascade)。
    fn solve_small_task(
        &self,
        st: &[VirtState; 4],
        tgt: usize,
        xc_slots: &[usize],
        h: u32,
        lower: u32,
        bound: u32,
    ) -> u32 {
        let sp = &st[tgt];
        // 根全解?(pair==0 且 h==0 ⇒ cross_ins + 各 C4E0 全 0)
        if h == 0 && self.pt_pair_c4e0.get((sp.ie * 24 + sp.ic) as u64) == 0 {
            return 0;
        }
        let mut xc = [(0usize, 0usize, 0usize, 0usize); 3];
        for (j, &s) in xc_slots.iter().enumerate() {
            xc[j] = (
                st[s].im as usize,
                (st[s].ic as usize) * 18,
                (st[s].ie as usize) * 18,
                s,
            );
        }
        let n = xc_slots.len();
        let max_d = std::cmp::min(18, bound.saturating_sub(1));
        let start = std::cmp::max(h.max(lower), 1);
        for d in start..=max_d {
            if self.search_small(
                sp.im as usize,
                (sp.ic as usize) * 18,
                (sp.ie as usize) * 18,
                tgt,
                &xc[..n],
                d,
                18,
            ) {
                return d;
            }
        }
        99
    }

    /// per-slot C4E0 下界。
    #[inline]
    fn h_c4e0(&self, s: &VirtState) -> u32 {
        self.pt_cross_c4e0
            .get((s.im as u64 + s.ic as u64) * 24 + s.ie as u64) as u32
    }
    /// pair 槽 cross_ins 下界。
    #[inline]
    fn h_ins(&self, s: &VirtState) -> u32 {
        self.pt_cross_ins_c4.get((s.im + s.ic) as u64) as u32
    }

    /// xxcross_pair(pair tgt + 2 xcross),min over 12 task。
    fn solve_3_small(&self, alg: &[u8], bound: u32, lower: u32) -> u32 {
        const PAIRS: [[usize; 2]; 6] = [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]];
        let st: [VirtState; 4] = std::array::from_fn(|s| self.get_virt(alg, s));
        let mut tasks: Vec<(usize, usize, usize, u32)> = Vec::with_capacity(12);
        for p in &PAIRS {
            for tgt in 0..4 {
                if tgt == p[0] || tgt == p[1] {
                    continue;
                }
                let h = self
                    .h_ins(&st[tgt])
                    .max(self.h_c4e0(&st[p[0]]))
                    .max(self.h_c4e0(&st[p[1]]));
                tasks.push((tgt, p[0], p[1], h));
            }
        }
        tasks.sort_by_key(|t| t.3);
        let mut min_v = bound;
        for &(tgt, x1, x2, h) in &tasks {
            if h >= min_v {
                continue;
            }
            let res = self.solve_small_task(&st, tgt, &[x1, x2], h, lower, min_v);
            if res < min_v {
                min_v = res;
            }
        }
        min_v
    }

    /// xxxcross_pair(pair tgt + 其余 3 槽),min over 4 task。
    fn solve_4_small(&self, alg: &[u8], bound: u32, lower: u32) -> u32 {
        let st: [VirtState; 4] = std::array::from_fn(|s| self.get_virt(alg, s));
        let mut tasks: Vec<(usize, [usize; 3], u32)> = Vec::with_capacity(4);
        for tgt in 0..4 {
            let mut fix = [0usize; 3];
            let mut fi = 0;
            for k in 0..4 {
                if k != tgt {
                    fix[fi] = k;
                    fi += 1;
                }
            }
            let h = self
                .h_ins(&st[tgt])
                .max(self.h_c4e0(&st[fix[0]]))
                .max(self.h_c4e0(&st[fix[1]]))
                .max(self.h_c4e0(&st[fix[2]]));
            tasks.push((tgt, fix, h));
        }
        tasks.sort_by_key(|t| t.2);
        let mut min_v = bound;
        for &(tgt, fix, h) in &tasks {
            if h >= min_v {
                continue;
            }
            let res = self.solve_small_task(&st, tgt, &fix, h, lower, min_v);
            if res < min_v {
                min_v = res;
            }
        }
        min_v
    }

    /// 小表 6 视角 × 4 阶段,返回 24 值 [cross_pair, xcross_pair, xxcross_pair, xxxcross_pair] × rots。
    /// 与 native `get_stats`(huge)逐格 bit-exact。阶段 0/1 复用 solve_1/2_group(本就无 huge)。
    pub fn get_stats_small(&self, alg: &[Move], rots: &[&str]) -> Vec<u32> {
        let n = rots.len();
        let mut cp = vec![0u32; n];
        let mut xcp = vec![0u32; n];
        let mut xxcp = vec![0u32; n];
        let mut xxxcp = vec![0u32; n];
        let base: Vec<u8> = alg.iter().map(|m| m.index() as u8).collect();
        for (i, r) in rots.iter().enumerate() {
            let mut a = base.clone();
            alg_rotation(&mut a, r);
            cp[i] = self.solve_1_group(&a, 99);
            xcp[i] = self.solve_2_group(&a, 99, cp[i]);
            xxcp[i] = self.solve_3_small(&a, 99, xcp[i]);
            xxxcp[i] = self.solve_4_small(&a, 99, xxcp[i]);
        }
        let mut out = Vec::with_capacity(4 * n);
        out.extend(cp);
        out.extend(xcp);
        out.extend(xxcp);
        out.extend(xxxcp);
        out
    }

    /// 单阶段 6 视角(stage 0=cross_pair / 1=xcross_pair / 2=xxcross_pair / 3=xxxcross_pair)。
    /// 两遍 UI 用:先单算 cross_pair 秒出,深阶段后台补。lower=0(单阶段不串 cascade 下界,仍正确)。
    pub fn get_stage_small(&self, alg: &[Move], rots: &[&str], stage: usize) -> Vec<u32> {
        let base: Vec<u8> = alg.iter().map(|m| m.index() as u8).collect();
        rots.iter()
            .map(|r| {
                let mut a = base.clone();
                alg_rotation(&mut a, r);
                match stage {
                    0 => self.solve_1_group(&a, 99),
                    1 => self.solve_2_group(&a, 99, 0),
                    2 => self.solve_3_small(&a, 99, 0),
                    _ => self.solve_4_small(&a, 99, 0),
                }
            })
            .collect()
    }

    /// 镜像 search_small,但收集 path 而非首解返回。path 存 raw m(search_small
    /// 用 cj[m][slot] 推坐标,raw m 即真实 rot 帧转动 → fmt 时直接前缀 rot 串,无需反共轭)。
    /// out 收满 cap 即停。depth==1 且全 prune<1 ⇒ 全槽已解 → 收一条最优解。
    #[allow(clippy::too_many_arguments)]
    fn enum_small(
        &self,
        p_im: usize,
        p_ic: usize,
        p_ie: usize,
        p_slot: usize,
        xc: &[(usize, usize, usize, usize)],
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
        let mt_e4 = self.mt_edge4.as_u32();
        let mt_c = self.mt_corn.as_u32();
        let mt_e = self.mt_edge.as_u32();
        let cj = conj_moves_flat();
        let n = xc.len();
        let mut nxc = [(0usize, 0usize, 0usize, 0usize); 3];
        for k in 0..count {
            if out.len() >= cap {
                return;
            }
            let m = row[k] as usize;
            let mc_p = cj[m][p_slot] as usize;
            let nim_p = mt_e4[p_im + mc_p] as usize;
            let nic_p = mt_c[p_ic + mc_p] as usize;
            if self.pt_cross_ins_c4.get((nim_p + nic_p) as u64) as u32 >= depth {
                continue;
            }
            let nie_p = mt_e[p_ie + mc_p] as usize;
            if self.pt_pair_c4e0.get((nie_p * 24 + nic_p) as u64) as u32 >= depth {
                continue;
            }
            let mut pruned = false;
            for j in 0..n {
                let (im, ic, ie, slot) = xc[j];
                let mc = cj[m][slot] as usize;
                let n1 = mt_e4[im + mc] as usize;
                let n2 = mt_c[ic + mc] as usize;
                let n3 = mt_e[ie + mc] as usize;
                if self.pt_cross_c4e0.get(((n1 + n2) * 24 + n3) as u64) as u32 >= depth {
                    pruned = true;
                    break;
                }
                nxc[j] = (n1, n2 * 18, n3 * 18, slot);
            }
            if pruned {
                continue;
            }
            path.push(m as u8);
            if depth == 1 {
                out.push(path.clone());
            } else {
                self.enum_small(nim_p, nic_p * 18, nie_p * 18, p_slot, &nxc[..n], depth - 1, m as u8, path, out, cap);
            }
            path.pop();
        }
    }

    /// 给定 stage(0=cross_pair / 1=xcross_pair / 2=xxcross_pair / 3=xxxcross_pair),
    /// 与 get_stage_small 同口径挑最优 (pair tgt + xcross 槽) task,枚举其
    /// best_len..best_len+extra 步全部解(rot 帧 move 索引路径,cap 封顶)。
    /// 返回 (best_len, combo 槽位[pair tgt 在首位,其后为 xcross 槽], 解集)。
    pub fn enumerate_small(
        &self,
        alg: &[Move],
        rot: &str,
        stage: usize,
        extra: u32,
        cap: usize,
    ) -> (u32, Vec<usize>, Vec<Vec<u8>>) {
        const PAIRS: [[usize; 2]; 6] = [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]];
        let mut a: Vec<u8> = alg.iter().map(|m| m.index() as u8).collect();
        alg_rotation(&mut a, rot);
        let st: [VirtState; 4] = std::array::from_fn(|s| self.get_virt(&a, s));

        // 候选 task:(pair tgt, xcross 槽集, 根启发式)。与 solve_{1..4} 同构。
        let mut tasks: Vec<(usize, Vec<usize>, u32)> = Vec::new();
        match stage {
            0 => {
                for tgt in 0..4 {
                    tasks.push((tgt, vec![], self.h_ins(&st[tgt])));
                }
            }
            1 => {
                for tgt in 0..4 {
                    for fix in 0..4 {
                        if fix == tgt {
                            continue;
                        }
                        tasks.push((tgt, vec![fix], self.h_ins(&st[tgt]).max(self.h_c4e0(&st[fix]))));
                    }
                }
            }
            2 => {
                for p in &PAIRS {
                    for tgt in 0..4 {
                        if tgt == p[0] || tgt == p[1] {
                            continue;
                        }
                        let h = self
                            .h_ins(&st[tgt])
                            .max(self.h_c4e0(&st[p[0]]))
                            .max(self.h_c4e0(&st[p[1]]));
                        tasks.push((tgt, vec![p[0], p[1]], h));
                    }
                }
            }
            _ => {
                for tgt in 0..4 {
                    let fix: Vec<usize> = (0..4).filter(|&k| k != tgt).collect();
                    let h = fix
                        .iter()
                        .fold(self.h_ins(&st[tgt]), |acc, &s| acc.max(self.h_c4e0(&st[s])));
                    tasks.push((tgt, fix, h));
                }
            }
        }
        tasks.sort_by_key(|t| t.2);

        // argmin:复用 solve_small_task 求每个 task 长度,取最短(其后枚举该 task)。
        let mut best_len = 99u32;
        let mut best: (usize, Vec<usize>) = (tasks[0].0, tasks[0].1.clone());
        for (tgt, xc_slots, h) in &tasks {
            if *h >= best_len {
                continue;
            }
            let res = self.solve_small_task(&st, *tgt, xc_slots, *h, 0, best_len);
            if res < best_len {
                best_len = res;
                best = (*tgt, xc_slots.clone());
            }
        }

        let mut out: Vec<Vec<u8>> = Vec::new();
        let (tgt, xc_slots) = best;
        let mut combo = vec![tgt];
        combo.extend(xc_slots.iter().copied());
        if best_len == 0 || best_len >= 99 {
            return (best_len.min(0), combo, out);
        }

        let sp = &st[tgt];
        let mut xc = [(0usize, 0usize, 0usize, 0usize); 3];
        for (j, &s) in xc_slots.iter().enumerate() {
            xc[j] = (
                st[s].im as usize,
                (st[s].ic as usize) * 18,
                (st[s].ie as usize) * 18,
                s,
            );
        }
        let n = xc_slots.len();
        let mut path = Vec::new();
        for d in best_len..=(best_len + extra).min(18) {
            self.enum_small(
                sp.im as usize,
                (sp.ic as usize) * 18,
                (sp.ie as usize) * 18,
                tgt,
                &xc[..n],
                d,
                18,
                &mut path,
                &mut out,
                cap,
            );
            if out.len() >= cap {
                break;
            }
        }
        (best_len, combo, out)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::cube_common::{string_to_alg, test_env_lock};
    use std::path::PathBuf;

    /// 小表模式(from_tables,无 huge)逐格 bit-exact 对照大表 golden
    /// (HangzhouOpen2026 前 3 条,值由 huge-table pair_analyzer 算出,见 stats/pair.csv)。
    /// 列序 z0 z2 z3 z1 x3 x1 = rots ["","z2","z'","z","x'","x"];4 阶段 ×6。
    /// 需 pt_cross_C4E0(52MB,mmap 复用)+ pt_cross_ins_C4 + pt_pair_C4E0,**不碰 huge**。
    /// 慢(xxxcross_pair 无 huge 启发式),故 #[ignore]:
    ///   `cargo test --release -- --ignored pair_small_matches_golden`
    #[test]
    #[ignore]
    fn pair_small_matches_golden() {
        let _lock = test_env_lock().lock().unwrap_or_else(|e| e.into_inner());
        let dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tables");
        std::env::set_var("CUBE_TABLE_DIR", &dir);

        let mtm = move_tables::instance();
        let ptm = prune_tables::instance();
        let solver = PairSolver::from_tables(
            mtm.ensure_edge4(),
            mtm.ensure_corn(),
            mtm.ensure_edge(),
            ptm.ensure_pt_cross_ins_c4(),
            ptm.ensure_pt_pair_c4e0(),
            ptm.ensure_pt_cross_c4e0(),
        );

        let rots = ["", "z2", "z'", "z", "x'", "x"];
        let cases: &[(&str, [u32; 24])] = &[
            (
                "U B' L R2 U B2 R2 U2 B2 U R2 U2 F2 B' R' B2 F' U2 L2 R",
                [6, 7, 6, 7, 6, 7, 7, 8, 8, 8, 7, 9, 10, 10, 10, 10, 9, 11, 13, 12, 13, 12, 11, 12],
            ),
            (
                "D2 L B2 R2 D R2 D R2 B2 R2 D2 L' D2 B D2 U2 R2 D' B2 R",
                [6, 6, 7, 6, 7, 7, 8, 8, 8, 7, 8, 8, 11, 10, 10, 10, 10, 10, 13, 12, 12, 11, 13, 11],
            ),
            (
                "B2 D' F2 L' U' R' D R2 F D' B2 L2 F2 R2 B' R2 L2 U2 L",
                [7, 7, 7, 6, 7, 6, 9, 8, 9, 7, 8, 7, 11, 9, 10, 10, 11, 10, 12, 11, 12, 13, 12, 13],
            ),
        ];

        for (scr, exp) in cases {
            let alg = string_to_alg(scr);
            let got = solver.get_stats_small(&alg, &rots);
            assert_eq!(
                got.as_slice(),
                exp.as_slice(),
                "pair small-mode mismatch for `{}`:\n got {:?}\n exp {:?}",
                scr,
                got,
                exp
            );
        }
    }

    /// enumerate_small 输出的 move 序列正确性:
    ///   1. best_len == golden 值(逐格 bit-exact,4 阶段 ×6 视角)
    ///   2. 每条解长度 == best_len(全是最优解)
    ///   3. 把(rot 后打乱 ++ 解)重新 get_virt 编码,断言 pair tgt 槽 cross_ins+pair
    ///      prune 全 0、各 xcross 槽 c4e0 prune 0 ⇒ 该序列真把所选 combo 解出。
    ///   `cargo test --release -- --ignored pair_enumerate_valid`
    #[test]
    #[ignore]
    fn pair_enumerate_valid() {
        let _lock = test_env_lock().lock().unwrap_or_else(|e| e.into_inner());
        let dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tables");
        std::env::set_var("CUBE_TABLE_DIR", &dir);

        let mtm = move_tables::instance();
        let ptm = prune_tables::instance();
        let solver = PairSolver::from_tables(
            mtm.ensure_edge4(),
            mtm.ensure_corn(),
            mtm.ensure_edge(),
            ptm.ensure_pt_cross_ins_c4(),
            ptm.ensure_pt_pair_c4e0(),
            ptm.ensure_pt_cross_c4e0(),
        );

        let rots = ["", "z2", "z'", "z", "x'", "x"];
        // 前 2 条打乱 + golden(同 pair_small_matches_golden,布局 [stage*6 + rot])。
        let cases: &[(&str, [u32; 24])] = &[
            (
                "U B' L R2 U B2 R2 U2 B2 U R2 U2 F2 B' R' B2 F' U2 L2 R",
                [6, 7, 6, 7, 6, 7, 7, 8, 8, 8, 7, 9, 10, 10, 10, 10, 9, 11, 13, 12, 13, 12, 11, 12],
            ),
            (
                "D2 L B2 R2 D R2 D R2 B2 R2 D2 L' D2 B D2 U2 R2 D' B2 R",
                [6, 6, 7, 6, 7, 7, 8, 8, 8, 7, 8, 8, 11, 10, 10, 10, 10, 10, 13, 12, 12, 11, 13, 11],
            ),
        ];

        for (scr, exp) in cases {
            let alg = string_to_alg(scr);
            for (ri, rot) in rots.iter().enumerate() {
                for stage in 0..4usize {
                    let want = exp[stage * 6 + ri];
                    let (len, combo, sols) = solver.enumerate_small(&alg, rot, stage, 0, 20);
                    assert_eq!(
                        len, want,
                        "len mismatch `{}` rot={} stage={}: got {} want {}",
                        scr, rot, stage, len, want
                    );
                    if len == 0 {
                        continue;
                    }
                    assert!(!sols.is_empty(), "no sols `{}` rot={} stage={}", scr, rot, stage);
                    // rot 后打乱基底。
                    let mut base: Vec<u8> = alg.iter().map(|m| m.index() as u8).collect();
                    alg_rotation(&mut base, rot);
                    let tgt = combo[0];
                    let xc_slots = &combo[1..];
                    for sol in &sols {
                        assert_eq!(
                            sol.len() as u32,
                            len,
                            "sol not optimal `{}` rot={} stage={}: {:?}",
                            scr, rot, stage, sol
                        );
                        let mut full = base.clone();
                        full.extend_from_slice(sol);
                        // pair tgt 槽:cross+corner(ins)与 corner+edge(pair)都解出。
                        let sp = solver.get_virt(&full, tgt);
                        assert_eq!(
                            solver.pt_cross_ins_c4.get((sp.im + sp.ic) as u64),
                            0,
                            "tgt cross_ins unsolved `{}` rot={} stage={} sol={:?}",
                            scr, rot, stage, sol
                        );
                        assert_eq!(
                            solver.pt_pair_c4e0.get((sp.ie * 24 + sp.ic) as u64),
                            0,
                            "tgt pair unsolved `{}` rot={} stage={} sol={:?}",
                            scr, rot, stage, sol
                        );
                        // 各 xcross 槽:cross+corner+edge(c4e0)解出。
                        for &s in xc_slots {
                            let sx = solver.get_virt(&full, s);
                            assert_eq!(
                                solver.pt_cross_c4e0.get(((sx.im + sx.ic) * 24 + sx.ie) as u64),
                                0,
                                "xc slot {} unsolved `{}` rot={} stage={} sol={:?}",
                                s, scr, rot, stage, sol
                            );
                        }
                    }
                }
            }
        }
    }
}
