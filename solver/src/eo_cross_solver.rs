//! EO Cross analyzer 求解器(Phase 8)。
//!
//! 移植自 C++ `eo_cross_analyzer.cpp`(1185 行)。
//!
//! 结构:
//!   - `EOCrossSolver`: Cross + EO 阶段(对应 C++ `CrossSolver`),12 sym 视角
//!   - `EOXCrossSolver`: XCross+EO / XXCross+EO / XXXCross+EO / XXXXCross+EO
//!     4 cascade 阶段(对应 C++ `XCrossSolver`,共 4 个 search_N)
//!
//! `get_stats` 输出 48 个值(12 sym × 4 阶段),wrapper 取 `min(2c, 2c+1)`
//! 把 12 sym 折叠成 6 rotation 视角输出。
//!
//! Cross+EO 解法上界 12 步;XC+EO 上界 20 步(C++ 同款)。
//!
//! 表依赖:
//!   - mt_edge / mt_edge2 / mt_corn / mt_edge4 / mt_edge6 / mt_corn2 / mt_ep4 /
//!     mt_eo12 / mt_eo12_alt
//!   - pt_cross (140 KB)
//!   - pt_cross_C4E0 (52 MB)
//!   - pt_cross_C4E0E1/E2/E3 (CEE,3 张)
//!   - pt_cross_C4C5E0 / C4C6E0 / C4C7E0 (CCE,3 张)
//!   - pt_cross_C4C5C6
//!   - pt_ep4eo12 (~12 MB)
//!   - pt_cross_C4C5E0E1 (huge ~10 GB)
//!   - pt_cross_C4C6E0E2 (huge ~10 GB,可选,`with_diagonal=false` 跳过)

use std::sync::Arc;

use crate::cube_common::{
    alg_rotation, array_to_index, conj_moves_flat, get_diagonal_view, get_neighbor_view,
    get_plus_table_idx, state_space, sym_moves_flat, valid_moves, Move,
};
use crate::executor::bump_node_count;
use crate::move_tables::{self, MoveTable};
use crate::prune_tables::{self, PackedPruneTable};

// ============================================================================
// EOCrossSolver: Cross + EO 阶段
// ============================================================================

pub struct EOCrossSolver {
    mt_edge2: Arc<MoveTable>,
    mt_eo12: Arc<MoveTable>,
    pt_cross: Arc<PackedPruneTable>,
}

impl EOCrossSolver {
    #[cfg(not(target_arch = "wasm32"))]
    pub fn new() -> Self {
        let mtm = move_tables::instance();
        let ptm = prune_tables::instance();
        EOCrossSolver {
            mt_edge2: mtm.ensure_edge2(),
            mt_eo12: mtm.ensure_eo12(),
            pt_cross: ptm.ensure_pt_cross(),
        }
    }

    fn get_indices_sym(&self, alg: &[u8], sym_idx: usize) -> (u32, u32, u32) {
        let mt2 = self.mt_edge2.as_u32();
        let mt_eo = self.mt_eo12.as_u32();
        let sm = sym_moves_flat();
        let mut i1 = state_space::EDGE2_A_SOLVED as u32;
        let mut i2 = state_space::EDGE2_B_SOLVED as u32;
        let mut ieo: u32 = 0;
        for &m in alg {
            let conj_m = sm[m as usize][sym_idx] as usize;
            i1 = mt2[(i1 as usize) * 18 + conj_m];
            i2 = mt2[(i2 as usize) * 18 + conj_m];
            ieo = mt_eo[(ieo as usize) + conj_m];
        }
        (i1, i2, ieo)
    }

    fn search(&self, i1: usize, i2: usize, i_eo: usize, depth: u32, prev: u8) -> bool {
        let (vmoves, vcnt) = valid_moves();
        let count = vcnt[prev as usize] as usize;
        let row = &vmoves[prev as usize];
        let mt2 = self.mt_edge2.as_u32();
        let mt_eo = self.mt_eo12.as_u32();

        let mut local: u64 = 0;
        for k in 0..count {
            let m = row[k] as usize;
            local += 1;
            let n1 = mt2[i1 + m] as usize;
            let n2 = mt2[i2 + m] as usize;
            let idx: u64 = n1 as u64 * state_space::EDGE2 as u64 + n2 as u64;
            let pr = self.pt_cross.get(idx) as u32;
            if pr >= depth {
                continue;
            }
            let neo = mt_eo[i_eo + m] as usize;
            if depth == 1 {
                if pr == 0 && neo == 0 {
                    bump_node_count(local);
                    return true;
                }
            } else if self.search(n1 * 18, n2 * 18, neo, depth - 1, m as u8) {
                bump_node_count(local);
                return true;
            }
        }
        bump_node_count(local);
        false
    }

    /// 12 sym 视角,返回 12 个 best 值。
    pub fn get_stats(&self, alg: &[u8]) -> Vec<u32> {
        let mut res = vec![99u32; 12];
        let mut tasks: Vec<(u32, usize)> = Vec::with_capacity(12);
        let mut sym_state: Vec<(u32, u32, u32)> = Vec::with_capacity(12);
        for s in 0..12 {
            let (i1, i2, ieo) = self.get_indices_sym(alg, s);
            sym_state.push((i1, i2, ieo));
            let idx: u64 = i1 as u64 * state_space::EDGE2 as u64 + i2 as u64;
            let mut h = self.pt_cross.get(idx) as u32;
            if h == 0 && ieo != 0 {
                h = 1;
            }
            if h == 0 && ieo == 0 {
                res[s] = 0;
                continue;
            }
            tasks.push((h, s));
        }
        tasks.sort();
        for &(h0, s) in &tasks {
            let (i1, i2, ieo) = sym_state[s];
            for d in h0..=12 {
                if self.search(i1 as usize * 18, i2 as usize * 18, ieo as usize, d, 18) {
                    res[s] = d;
                    break;
                }
            }
        }
        res
    }
}

// ============================================================================
// EOXCrossSolver: XCross+EO / XXCross+EO / XXXCross+EO / XXXXCross+EO
// ============================================================================

pub struct EOXCrossSolver {
    mt_edge4: Arc<MoveTable>,
    mt_corn: Arc<MoveTable>,
    mt_edge: Arc<MoveTable>,
    mt_edge6: Arc<MoveTable>,
    mt_corn2: Arc<MoveTable>,
    mt_ep4: Arc<MoveTable>,
    mt_eo12_alt: Arc<MoveTable>,
    pt_ep4eo12: Arc<PackedPruneTable>,
    pt_cross_c4e0: Arc<PackedPruneTable>,
    /// CEE = [pt_cross_C4E0E1, C4E0E2, C4E0E3]
    pt_cross_cee: [Arc<PackedPruneTable>; 3],
    /// CCE = [pt_cross_C4C5E0, C4C6E0, C4C7E0]
    pt_cross_cce: [Arc<PackedPruneTable>; 3],
    pt_cross_c4c5c6: Arc<PackedPruneTable>,
    pt_cross_c4c5e0e1: Arc<PackedPruneTable>,
    pt_cross_c4c6e0e2: Option<Arc<PackedPruneTable>>,

    // 解决态索引
    idx_solved_e6_nb: u32,
    idx_solved_e6_dg: u32,
    idx_solved_c2_nb: u32,
    idx_solved_c2_dg: u32,
}

#[derive(Debug, Clone, Copy, Default)]
struct SlotState {
    i1: u32, // Edge4
    i2: u32, // Corner
    i3: u32, // Edge
    idep: u32,
    ieo: u32,
    e_trk: [u32; 3],
    c_trk: [u32; 3],
    i_e6_nb: u32,
    i_c2_nb: u32,
    i_e6_dg: u32,
    i_c2_dg: u32,
}

#[derive(Debug, Clone, Copy, Default)]
struct ViewState {
    i1: u32,
    i2: u32,
    i3: u32,
    slot: u8,
    ex: [u32; 3],
    cx: [u32; 3],
    plus_tab: [u8; 3],
    has3corner: bool,
    /// 追踪槽位数(search_3 = 2,search_4 = 3)。当前 Rust 实现按 search 函数
    /// 上下文已知,字段保留为文档用途。
    #[allow(dead_code)]
    n_tracks: u8,
}

impl EOXCrossSolver {
    #[cfg(not(target_arch = "wasm32"))]
    pub fn new(with_diagonal: bool) -> Self {
        let mtm = move_tables::instance();
        let ptm = prune_tables::instance();

        let v_e6_nb: [i32; 6] = [0, 2, 16, 18, 20, 22];
        let v_e6_dg: [i32; 6] = [0, 4, 16, 18, 20, 22];
        let v_c2_nb: [i32; 2] = [12, 15];
        let v_c2_dg: [i32; 2] = [12, 18];

        let pt_cross_c4c6e0e2 = if with_diagonal {
            Some(ptm.ensure_pt_cross_c4c6e0e2())
        } else {
            None
        };

        EOXCrossSolver {
            mt_edge4: mtm.ensure_edge4(),
            mt_corn: mtm.ensure_corn(),
            mt_edge: mtm.ensure_edge(),
            mt_edge6: mtm.ensure_edge6(),
            mt_corn2: mtm.ensure_corn2(),
            mt_ep4: mtm.ensure_ep4(),
            mt_eo12_alt: mtm.ensure_eo12_alt(),
            pt_ep4eo12: ptm.ensure_pt_ep4eo12(),
            pt_cross_c4e0: ptm.ensure_pt_cross_c4e0(),
            pt_cross_cee: [
                ptm.ensure_pt_cross_c4e0e1(),
                ptm.ensure_pt_cross_c4e0e2(),
                ptm.ensure_pt_cross_c4e0e3(),
            ],
            pt_cross_cce: [
                ptm.ensure_pt_cross_c4c5e0(),
                ptm.ensure_pt_cross_c4c6e0(),
                ptm.ensure_pt_cross_c4c7e0(),
            ],
            pt_cross_c4c5c6: ptm.ensure_pt_cross_c4c5c6(),
            pt_cross_c4c5e0e1: ptm.ensure_pt_cross_c4c5e0e1(),
            pt_cross_c4c6e0e2,
            idx_solved_e6_nb: array_to_index(&v_e6_nb, 6, 2, 12) as u32,
            idx_solved_e6_dg: array_to_index(&v_e6_dg, 6, 2, 12) as u32,
            idx_solved_c2_nb: array_to_index(&v_c2_nb, 2, 3, 8) as u32,
            idx_solved_c2_dg: array_to_index(&v_c2_dg, 2, 3, 8) as u32,
        }
    }

    fn get_indices_conj_full(&self, alg: &[u8], sym_idx: usize, slot_idx: usize) -> SlotState {
        let mt_e4 = self.mt_edge4.as_u32();
        let mt_c = self.mt_corn.as_u32();
        let mt_e = self.mt_edge.as_u32();
        let mt_e6 = self.mt_edge6.as_u32();
        let mt_c2 = self.mt_corn2.as_u32();
        let mt_ep4 = self.mt_ep4.as_u32();
        let mt_eo = self.mt_eo12_alt.as_u32();
        let sm = sym_moves_flat();
        let cj = conj_moves_flat();

        let mut i1: u32 = (state_space::CROSS_SOLVED as u32) * (state_space::CORNER as u32);
        let mut i2: u32 = 12; // SOLVED_CORNER
        let mut i3: u32 = 0; // SOLVED_EDGE
        let mut idep: u32 = state_space::EP4_SOLVED as u32;
        let mut ieo: u32 = 0;

        let mut e_trk: [u32; 3] = [2, 4, 6];
        let mut c_trk: [u32; 3] = [15, 18, 21];
        let mut e6_nb = self.idx_solved_e6_nb;
        let mut c2_nb = self.idx_solved_c2_nb;
        let mut e6_dg = self.idx_solved_e6_dg;
        let mut c2_dg = self.idx_solved_c2_dg;

        for &m in alg {
            let m_global = sm[m as usize][sym_idx] as usize;
            let m_slot = cj[m_global][slot_idx] as usize;

            i1 = mt_e4[(i1 as usize) + m_slot];
            i2 = mt_c[(i2 as usize) * 18 + m_slot];
            i3 = mt_e[(i3 as usize) * 18 + m_slot];

            idep = mt_ep4[(idep as usize) * 18 + m_global];
            ieo = mt_eo[(ieo as usize) * 18 + m_global];

            for k in 0..3 {
                e_trk[k] = mt_e[(e_trk[k] as usize) * 18 + m_slot];
                c_trk[k] = mt_c[(c_trk[k] as usize) * 18 + m_slot];
            }
            e6_nb = mt_e6[(e6_nb as usize) * 18 + m_slot];
            c2_nb = mt_c2[(c2_nb as usize) * 18 + m_slot];
            e6_dg = mt_e6[(e6_dg as usize) * 18 + m_slot];
            c2_dg = mt_c2[(c2_dg as usize) * 18 + m_slot];
        }

        SlotState {
            i1,
            i2,
            i3,
            idep,
            ieo,
            e_trk,
            c_trk,
            i_e6_nb: e6_nb,
            i_c2_nb: c2_nb,
            i_e6_dg: e6_dg,
            i_c2_dg: c2_dg,
        }
    }

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
        let cj = conj_moves_flat();
        let mx = cj[m][conj as usize] as usize;
        let n_e6 = self.mt_edge6.as_u32()[(e6 as usize) * 18 + mx];
        let n_c2 = self.mt_corn2.as_u32()[(c2 as usize) * 18 + mx];
        let idx: u64 = n_e6 as u64 * state_space::CORNER2 as u64 + n_c2 as u64;
        (table.get(idx) as u32 >= depth, n_e6, n_c2)
    }

    // --- search_1: XCross+EO single slot ---
    #[allow(clippy::too_many_arguments)]
    fn search_1(
        &self,
        i1: usize,
        i2: usize,
        i3: usize,
        i_dep: usize,
        i_eo: usize,
        depth: u32,
        prev: u8,
        slot: usize,
        bound: u32,
    ) -> bool {
        if depth > bound {
            return false;
        }
        let (vmoves, vcnt) = valid_moves();
        let count = vcnt[prev as usize] as usize;
        let row = &vmoves[prev as usize];
        let mt_e4 = self.mt_edge4.as_u32();
        let mt_c = self.mt_corn.as_u32();
        let mt_e = self.mt_edge.as_u32();
        let mt_ep4 = self.mt_ep4.as_u32();
        let mt_eo = self.mt_eo12_alt.as_u32();
        let cj = conj_moves_flat();

        let mut local: u64 = 0;
        for k in 0..count {
            let m = row[k] as usize;
            local += 1;
            let nd = mt_ep4[i_dep + m] as usize;
            let neo = mt_eo[i_eo + m] as usize;
            let idx_de: u64 = nd as u64 * state_space::EO12 as u64 + neo as u64;
            if self.pt_ep4eo12.get(idx_de) as u32 >= depth {
                continue;
            }
            let m_slot = cj[m][slot] as usize;
            let n1 = mt_e4[i1 + m_slot] as usize;
            let n2 = mt_c[i2 + m_slot] as usize;
            let n3 = mt_e[i3 + m_slot] as usize;
            let idx_xc: u64 = (n1 as u64 + n2 as u64) * 24 + n3 as u64;
            if self.pt_cross_c4e0.get(idx_xc) as u32 >= depth {
                continue;
            }
            if depth == 1 {
                bump_node_count(local);
                return true;
            }
            if self.search_1(n1, n2 * 18, n3 * 18, nd * 18, neo * 18, depth - 1, m as u8, slot, bound) {
                bump_node_count(local);
                return true;
            }
        }
        bump_node_count(local);
        false
    }

    // --- search_2: XXCross+EO double slot ---
    #[allow(clippy::too_many_arguments)]
    fn search_2(
        &self,
        i1a: usize, i2a: usize, i3a: usize,
        i1b: usize, i2b: usize, i3b: usize,
        i_dep: usize, i_eo: usize,
        depth: u32, prev: u8,
        s1: usize, s2: usize, bound: u32,
        tab: usize, tba: usize,
        ea_rel: u32, ca_rel: u32,
        eb_rel: u32, cb_rel: u32,
        v_huge: i32,
        p_huge: Option<&PackedPruneTable>,
        i_e6: u32, i_c2: u32,
    ) -> bool {
        if depth > bound {
            return false;
        }
        let (vmoves, vcnt) = valid_moves();
        let count = vcnt[prev as usize] as usize;
        let row = &vmoves[prev as usize];
        let mt_e4 = self.mt_edge4.as_u32();
        let mt_c = self.mt_corn.as_u32();
        let mt_e = self.mt_edge.as_u32();
        let mt_ep4 = self.mt_ep4.as_u32();
        let mt_eo = self.mt_eo12_alt.as_u32();
        let cj = conj_moves_flat();

        let mut local: u64 = 0;
        for k in 0..count {
            let m = row[k] as usize;
            local += 1;
            // Huge
            let (pr, n_ie6, n_ic2) = self.huge_check(v_huge, p_huge, i_e6, i_c2, m, depth);
            if pr {
                continue;
            }
            // Dep+EO
            let nd = mt_ep4[i_dep + m] as usize;
            let neo = mt_eo[i_eo + m] as usize;
            let idx_de: u64 = nd as u64 * state_space::EO12 as u64 + neo as u64;
            if self.pt_ep4eo12.get(idx_de) as u32 >= depth {
                continue;
            }
            // View A
            let m1 = cj[m][s1] as usize;
            let n1a = mt_e4[i1a + m1] as usize;
            let n2a = mt_c[i2a + m1] as usize;
            let n3a = mt_e[i3a + m1] as usize;
            let idx_a: u64 = (n1a as u64 + n2a as u64) * 24 + n3a as u64;
            if self.pt_cross_c4e0.get(idx_a) as u32 >= depth {
                continue;
            }
            let n_ea_rel = mt_e[(ea_rel as usize) * 18 + m1];
            if self.pt_cross_cee[tab].get(idx_a * 24 + n_ea_rel as u64) as u32 >= depth {
                continue;
            }
            let n_ca_rel = mt_c[(ca_rel as usize) * 18 + m1];
            if self.pt_cross_cce[tab].get(idx_a * 24 + n_ca_rel as u64) as u32 >= depth {
                continue;
            }
            // View B
            let m2 = cj[m][s2] as usize;
            let n1b = mt_e4[i1b + m2] as usize;
            let n2b = mt_c[i2b + m2] as usize;
            let n3b = mt_e[i3b + m2] as usize;
            let idx_b: u64 = (n1b as u64 + n2b as u64) * 24 + n3b as u64;
            if self.pt_cross_c4e0.get(idx_b) as u32 >= depth {
                continue;
            }
            let n_eb_rel = mt_e[(eb_rel as usize) * 18 + m2];
            if self.pt_cross_cee[tba].get(idx_b * 24 + n_eb_rel as u64) as u32 >= depth {
                continue;
            }
            let n_cb_rel = mt_c[(cb_rel as usize) * 18 + m2];
            if self.pt_cross_cce[tba].get(idx_b * 24 + n_cb_rel as u64) as u32 >= depth {
                continue;
            }

            if depth == 1 {
                bump_node_count(local);
                return true;
            }
            let (ne6, nc2) = if v_huge != -1 { (n_ie6, n_ic2) } else { (0, 0) };
            if self.search_2(
                n1a, n2a * 18, n3a * 18,
                n1b, n2b * 18, n3b * 18,
                nd * 18, neo * 18,
                depth - 1, m as u8, s1, s2, bound,
                tab, tba,
                n_ea_rel, n_ca_rel,
                n_eb_rel, n_cb_rel,
                v_huge, p_huge, ne6, nc2,
            ) {
                bump_node_count(local);
                return true;
            }
        }
        bump_node_count(local);
        false
    }

    // --- search_3: XXXCross+EO (3 views,view_order 数据驱动)---
    #[allow(clippy::too_many_arguments)]
    fn search_3(
        &self,
        views: &[ViewState; 3],
        view_order: [usize; 3],
        i_dep: usize, i_eo: usize,
        depth: u32, prev: u8, bound: u32,
        v_huge: i32, p_huge: Option<&PackedPruneTable>,
        i_e6: u32, i_c2: u32,
    ) -> bool {
        if depth > bound {
            return false;
        }
        let (vmoves, vcnt) = valid_moves();
        let count = vcnt[prev as usize] as usize;
        let row = &vmoves[prev as usize];
        let mt_e4 = self.mt_edge4.as_u32();
        let mt_c = self.mt_corn.as_u32();
        let mt_e = self.mt_edge.as_u32();
        let mt_ep4 = self.mt_ep4.as_u32();
        let mt_eo = self.mt_eo12_alt.as_u32();
        let cj = conj_moves_flat();

        let mut local: u64 = 0;
        for k in 0..count {
            let m = row[k] as usize;
            local += 1;
            let (pr, n_ie6, n_ic2) = self.huge_check(v_huge, p_huge, i_e6, i_c2, m, depth);
            if pr {
                continue;
            }
            let nd = mt_ep4[i_dep + m] as usize;
            let neo = mt_eo[i_eo + m] as usize;
            let idx_de: u64 = nd as u64 * state_space::EO12 as u64 + neo as u64;
            if self.pt_ep4eo12.get(idx_de) as u32 >= depth {
                continue;
            }

            let mut nv: [ViewState; 3] = [ViewState::default(); 3];
            let mut pruned = false;
            for vi in 0..3 {
                let v = view_order[vi];
                let cur = &views[v];
                let mv = cj[m][cur.slot as usize] as usize;

                let n1 = mt_e4[(cur.i1 as usize) + mv] as u32;
                let n2 = mt_c[(cur.i2 as usize) + mv] as u32;
                let n3 = mt_e[(cur.i3 as usize) + mv] as u32;
                let idx: u64 = (n1 as u64 + n2 as u64) * 24 + n3 as u64;
                if self.pt_cross_c4e0.get(idx) as u32 >= depth {
                    pruned = true;
                    break;
                }
                let mut ne = [0u32; 2];
                let mut nc = [0u32; 2];
                let mut inner_pr = false;
                for t in 0..2 {
                    ne[t] = mt_e[(cur.ex[t] as usize) * 18 + mv];
                    if self.pt_cross_cee[cur.plus_tab[t] as usize]
                        .get(idx * 24 + ne[t] as u64) as u32
                        >= depth
                    {
                        inner_pr = true;
                        break;
                    }
                    nc[t] = mt_c[(cur.cx[t] as usize) * 18 + mv];
                    if self.pt_cross_cce[cur.plus_tab[t] as usize]
                        .get(idx * 24 + nc[t] as u64) as u32
                        >= depth
                    {
                        inner_pr = true;
                        break;
                    }
                }
                if inner_pr {
                    pruned = true;
                    break;
                }
                if cur.has3corner {
                    let idx_3c: u64 = ((n1 as u64 + n2 as u64) * 24 + nc[0] as u64) * 24 + nc[1] as u64;
                    if self.pt_cross_c4c5c6.get(idx_3c) as u32 >= depth {
                        pruned = true;
                        break;
                    }
                }
                nv[v] = ViewState {
                    i1: n1,
                    i2: n2 * 18,
                    i3: n3 * 18,
                    slot: cur.slot,
                    ex: [ne[0], ne[1], 0],
                    cx: [nc[0], nc[1], 0],
                    plus_tab: [cur.plus_tab[0], cur.plus_tab[1], 0],
                    has3corner: cur.has3corner,
                    n_tracks: 2,
                };
            }
            if pruned {
                continue;
            }
            if depth == 1 {
                bump_node_count(local);
                return true;
            }
            let (ne6, nc2) = if v_huge != -1 { (n_ie6, n_ic2) } else { (0, 0) };
            if self.search_3(
                &nv, view_order, nd * 18, neo * 18, depth - 1, m as u8, bound,
                v_huge, p_huge, ne6, nc2,
            ) {
                bump_node_count(local);
                return true;
            }
        }
        bump_node_count(local);
        false
    }

    // --- search_4: XXXXCross+EO (4 views,固定 plus_tab=[0,1,2],has3corner=true)---
    #[allow(clippy::too_many_arguments)]
    fn search_4(
        &self,
        views: &[ViewState; 4],
        view_order: [usize; 4],
        i_dep: usize, i_eo: usize,
        depth: u32, prev: u8, bound: u32,
        v_huge: i32, p_huge: Option<&PackedPruneTable>,
        i_e6: u32, i_c2: u32,
    ) -> bool {
        if depth > bound {
            return false;
        }
        let (vmoves, vcnt) = valid_moves();
        let count = vcnt[prev as usize] as usize;
        let row = &vmoves[prev as usize];
        let mt_e4 = self.mt_edge4.as_u32();
        let mt_c = self.mt_corn.as_u32();
        let mt_e = self.mt_edge.as_u32();
        let mt_ep4 = self.mt_ep4.as_u32();
        let mt_eo = self.mt_eo12_alt.as_u32();
        let cj = conj_moves_flat();

        let mut local: u64 = 0;
        for k in 0..count {
            let m = row[k] as usize;
            local += 1;
            let (pr, n_ie6, n_ic2) = self.huge_check(v_huge, p_huge, i_e6, i_c2, m, depth);
            if pr {
                continue;
            }
            let nd = mt_ep4[i_dep + m] as usize;
            let neo = mt_eo[i_eo + m] as usize;
            let idx_de: u64 = nd as u64 * state_space::EO12 as u64 + neo as u64;
            if self.pt_ep4eo12.get(idx_de) as u32 >= depth {
                continue;
            }

            let mut nv: [ViewState; 4] = [ViewState::default(); 4];
            let mut pruned = false;
            for vi in 0..4 {
                let v = view_order[vi];
                let cur = &views[v];
                let mv = cj[m][cur.slot as usize] as usize;
                let n1 = mt_e4[(cur.i1 as usize) + mv] as u32;
                let n2 = mt_c[(cur.i2 as usize) + mv] as u32;
                let n3 = mt_e[(cur.i3 as usize) + mv] as u32;
                let idx: u64 = (n1 as u64 + n2 as u64) * 24 + n3 as u64;
                if self.pt_cross_c4e0.get(idx) as u32 >= depth {
                    pruned = true;
                    break;
                }
                let mut ne = [0u32; 3];
                let mut nc = [0u32; 3];
                let mut inner_pr = false;
                for t in 0..3 {
                    ne[t] = mt_e[(cur.ex[t] as usize) * 18 + mv];
                    if self.pt_cross_cee[t].get(idx * 24 + ne[t] as u64) as u32 >= depth {
                        inner_pr = true;
                        break;
                    }
                    nc[t] = mt_c[(cur.cx[t] as usize) * 18 + mv];
                    if self.pt_cross_cce[t].get(idx * 24 + nc[t] as u64) as u32 >= depth {
                        inner_pr = true;
                        break;
                    }
                }
                if inner_pr {
                    pruned = true;
                    break;
                }
                let idx_3c: u64 = ((n1 as u64 + n2 as u64) * 24 + nc[0] as u64) * 24 + nc[1] as u64;
                if self.pt_cross_c4c5c6.get(idx_3c) as u32 >= depth {
                    pruned = true;
                    break;
                }
                nv[v] = ViewState {
                    i1: n1,
                    i2: n2 * 18,
                    i3: n3 * 18,
                    slot: cur.slot,
                    ex: ne,
                    cx: nc,
                    plus_tab: [0, 1, 2],
                    has3corner: true,
                    n_tracks: 3,
                };
            }
            if pruned {
                continue;
            }
            if depth == 1 {
                bump_node_count(local);
                return true;
            }
            let (ne6, nc2) = if v_huge != -1 { (n_ie6, n_ic2) } else { (0, 0) };
            if self.search_4(
                &nv, view_order, nd * 18, neo * 18, depth - 1, m as u8, bound,
                v_huge, p_huge, ne6, nc2,
            ) {
                bump_node_count(local);
                return true;
            }
        }
        bump_node_count(local);
        false
    }

    /// 计算指定 huge 表的 (v_huge, p_huge, init_e6, init_c2)。
    /// 优先用 Neighbor 视角(s1,s2),否则用 Diagonal(若开启)。
    fn pick_huge(
        &self,
        s1: usize,
        s2: usize,
        st: &[SlotState],
    ) -> (i32, Option<&PackedPruneTable>, u32, u32) {
        let v_nb = get_neighbor_view(s1 as i32, s2 as i32);
        if v_nb != -1 {
            let st_v = &st[v_nb as usize];
            return (
                v_nb,
                Some(&self.pt_cross_c4c5e0e1),
                st_v.i_e6_nb,
                st_v.i_c2_nb,
            );
        }
        if let Some(pt_dg) = &self.pt_cross_c4c6e0e2 {
            let v_dg = get_diagonal_view(s1 as i32, s2 as i32);
            if v_dg != -1 {
                let st_v = &st[v_dg as usize];
                return (v_dg, Some(pt_dg), st_v.i_e6_dg, st_v.i_c2_dg);
            }
        }
        (-1, None, 0, 0)
    }

    /// `get_stats` 返回 48 个值(12 sym × 4 阶段):
    /// [0..12] = XC, [12..24] = XXC, [24..36] = XXXC, [36..48] = XXXXC
    pub fn get_stats(&self, alg: &[u8]) -> Vec<u32> {
        let mut res = vec![99u32; 48];

        for sym in 0..12 {
            // Precompute 4 slot states
            let st: Vec<SlotState> = (0..4)
                .map(|s| self.get_indices_conj_full(alg, sym, s))
                .collect();

            // --- 1. XC + EO ---
            let mut tasks: Vec<(u32, usize)> = (0..4)
                .map(|s| {
                    let idx_xc: u64 = (st[s].i1 as u64 + st[s].i2 as u64) * 24 + st[s].i3 as u64;
                    let pr_xc = self.pt_cross_c4e0.get(idx_xc) as u32;
                    let pr_de = self.pt_ep4eo12.get(
                        st[s].idep as u64 * state_space::EO12 as u64 + st[s].ieo as u64,
                    ) as u32;
                    (pr_xc.max(pr_de), s)
                })
                .collect();
            tasks.sort();

            let pair_bound = if (sym & 1) != 0 { res[sym - 1] } else { 99 };
            let mut best = pair_bound;
            for &(h, s) in &tasks {
                if h >= best {
                    break;
                }
                if h == 0 {
                    best = 0;
                    break;
                }
                let max_d = std::cmp::min(20, best.saturating_sub(1));
                for d in h..=max_d {
                    if self.search_1(
                        st[s].i1 as usize,
                        (st[s].i2 as usize) * 18,
                        (st[s].i3 as usize) * 18,
                        (st[s].idep as usize) * 18,
                        (st[s].ieo as usize) * 18,
                        d,
                        18,
                        s,
                        best - 1,
                    ) {
                        best = d;
                        break;
                    }
                }
            }
            res[sym] = best;

            #[allow(unused_assignments)]
            let mut best_xx: u32 = 99;
            #[allow(unused_assignments)]
            let mut best_xxx: u32 = 99;

            // --- 2. XXC + EO ---
            {
                const PAIRS: [[usize; 2]; 6] =
                    [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]];
                let mut tasks_xx: Vec<(u32, usize)> = Vec::with_capacity(6);
                for (p, pair) in PAIRS.iter().enumerate() {
                    let s1 = pair[0];
                    let s2 = pair[1];
                    let t_ab = get_plus_table_idx(s1 as i32, s2 as i32) as usize;
                    let t_ba = get_plus_table_idx(s2 as i32, s1 as i32) as usize;

                    let idx1: u64 = (st[s1].i1 as u64 + st[s1].i2 as u64) * 24 + st[s1].i3 as u64;
                    let h1 = self.pt_cross_c4e0.get(idx1) as u32;
                    let h1_pe = self.pt_cross_cee[t_ab]
                        .get(idx1 * 24 + st[s1].e_trk[t_ab] as u64) as u32;
                    let h1_pc = self.pt_cross_cce[t_ab]
                        .get(idx1 * 24 + st[s1].c_trk[t_ab] as u64) as u32;

                    let idx2: u64 = (st[s2].i1 as u64 + st[s2].i2 as u64) * 24 + st[s2].i3 as u64;
                    let h2 = self.pt_cross_c4e0.get(idx2) as u32;
                    let h2_pe = self.pt_cross_cee[t_ba]
                        .get(idx2 * 24 + st[s2].e_trk[t_ba] as u64) as u32;
                    let h2_pc = self.pt_cross_cce[t_ba]
                        .get(idx2 * 24 + st[s2].c_trk[t_ba] as u64) as u32;

                    let h_de = self.pt_ep4eo12.get(
                        st[s1].idep as u64 * state_space::EO12 as u64 + st[s1].ieo as u64,
                    ) as u32;
                    let h = [h1, h1_pe, h1_pc, h2, h2_pe, h2_pc, h_de]
                        .iter()
                        .copied()
                        .max()
                        .unwrap();
                    tasks_xx.push((h, p));
                }
                tasks_xx.sort();

                best_xx = if (sym & 1) != 0 { res[12 + sym - 1] } else { 99 };
                for &(h, p) in &tasks_xx {
                    if h >= best_xx {
                        break;
                    }
                    if h == 0 {
                        best_xx = 0;
                        break;
                    }
                    let s1 = PAIRS[p][0];
                    let s2 = PAIRS[p][1];
                    let t_ab = get_plus_table_idx(s1 as i32, s2 as i32) as usize;
                    let t_ba = get_plus_table_idx(s2 as i32, s1 as i32) as usize;
                    let start_d = std::cmp::max(h, best);
                    let max_d = std::cmp::min(20, best_xx.saturating_sub(1));
                    let (v_huge, p_huge, init_e6, init_c2) = self.pick_huge(s1, s2, &st);
                    for d in start_d..=max_d {
                        if self.search_2(
                            st[s1].i1 as usize,
                            (st[s1].i2 as usize) * 18,
                            (st[s1].i3 as usize) * 18,
                            st[s2].i1 as usize,
                            (st[s2].i2 as usize) * 18,
                            (st[s2].i3 as usize) * 18,
                            (st[s1].idep as usize) * 18,
                            (st[s1].ieo as usize) * 18,
                            d,
                            18,
                            s1, s2,
                            best_xx - 1,
                            t_ab, t_ba,
                            st[s1].e_trk[t_ab], st[s1].c_trk[t_ab],
                            st[s2].e_trk[t_ba], st[s2].c_trk[t_ba],
                            v_huge, p_huge, init_e6, init_c2,
                        ) {
                            best_xx = d;
                            break;
                        }
                    }
                }
                res[12 + sym] = best_xx;
            }

            // --- 3. XXXC + EO ---
            {
                const TRIPS: [[usize; 3]; 4] =
                    [[0, 1, 2], [0, 1, 3], [0, 2, 3], [1, 2, 3]];
                let mut tasks_xxx: Vec<(u32, usize)> = Vec::with_capacity(4);
                for (tr, trip) in TRIPS.iter().enumerate() {
                    let s1 = trip[0];
                    let s2 = trip[1];
                    let s3 = trip[2];
                    let t_ab = get_plus_table_idx(s1 as i32, s2 as i32) as usize;
                    let t_ba = get_plus_table_idx(s2 as i32, s1 as i32) as usize;
                    let t_bc = get_plus_table_idx(s2 as i32, s3 as i32) as usize;
                    let t_cb = get_plus_table_idx(s3 as i32, s2 as i32) as usize;
                    let t_ac = get_plus_table_idx(s1 as i32, s3 as i32) as usize;
                    let t_ca = get_plus_table_idx(s3 as i32, s1 as i32) as usize;

                    let idx1: u64 = (st[s1].i1 as u64 + st[s1].i2 as u64) * 24 + st[s1].i3 as u64;
                    let h1 = [
                        self.pt_cross_c4e0.get(idx1) as u32,
                        self.pt_cross_cee[t_ab].get(idx1 * 24 + st[s1].e_trk[t_ab] as u64) as u32,
                        self.pt_cross_cce[t_ab].get(idx1 * 24 + st[s1].c_trk[t_ab] as u64) as u32,
                        self.pt_cross_cee[t_ac].get(idx1 * 24 + st[s1].e_trk[t_ac] as u64) as u32,
                        self.pt_cross_cce[t_ac].get(idx1 * 24 + st[s1].c_trk[t_ac] as u64) as u32,
                    ]
                    .iter()
                    .copied()
                    .max()
                    .unwrap();
                    let idx2: u64 = (st[s2].i1 as u64 + st[s2].i2 as u64) * 24 + st[s2].i3 as u64;
                    let h2 = [
                        self.pt_cross_c4e0.get(idx2) as u32,
                        self.pt_cross_cee[t_ba].get(idx2 * 24 + st[s2].e_trk[t_ba] as u64) as u32,
                        self.pt_cross_cce[t_ba].get(idx2 * 24 + st[s2].c_trk[t_ba] as u64) as u32,
                        self.pt_cross_cee[t_bc].get(idx2 * 24 + st[s2].e_trk[t_bc] as u64) as u32,
                        self.pt_cross_cce[t_bc].get(idx2 * 24 + st[s2].c_trk[t_bc] as u64) as u32,
                    ]
                    .iter()
                    .copied()
                    .max()
                    .unwrap();
                    let idx3: u64 = (st[s3].i1 as u64 + st[s3].i2 as u64) * 24 + st[s3].i3 as u64;
                    let h3 = [
                        self.pt_cross_c4e0.get(idx3) as u32,
                        self.pt_cross_cee[t_ca].get(idx3 * 24 + st[s3].e_trk[t_ca] as u64) as u32,
                        self.pt_cross_cce[t_ca].get(idx3 * 24 + st[s3].c_trk[t_ca] as u64) as u32,
                        self.pt_cross_cee[t_cb].get(idx3 * 24 + st[s3].e_trk[t_cb] as u64) as u32,
                        self.pt_cross_cce[t_cb].get(idx3 * 24 + st[s3].c_trk[t_cb] as u64) as u32,
                    ]
                    .iter()
                    .copied()
                    .max()
                    .unwrap();

                    // 3-Corner per-view check
                    let mut d_3c: u32 = 0;
                    let check_3c = |slot_s: usize, t_x: usize, t_y: usize| -> u32 {
                        if (t_x == 0 && t_y == 1) || (t_y == 0 && t_x == 1) {
                            let c_r = if t_x == 0 {
                                st[slot_s].c_trk[t_x]
                            } else {
                                st[slot_s].c_trk[t_y]
                            };
                            let c_d = if t_x == 0 {
                                st[slot_s].c_trk[t_y]
                            } else {
                                st[slot_s].c_trk[t_x]
                            };
                            let idx_3c: u64 = ((st[slot_s].i1 as u64 + st[slot_s].i2 as u64) * 24
                                + c_r as u64)
                                * 24
                                + c_d as u64;
                            self.pt_cross_c4c5c6.get(idx_3c) as u32
                        } else {
                            0
                        }
                    };
                    d_3c = d_3c.max(check_3c(s1, t_ab, t_ac));
                    d_3c = d_3c.max(check_3c(s2, t_ba, t_bc));
                    d_3c = d_3c.max(check_3c(s3, t_ca, t_cb));

                    let pr_de = self.pt_ep4eo12.get(
                        st[s1].idep as u64 * state_space::EO12 as u64 + st[s1].ieo as u64,
                    ) as u32;
                    let h = [h1, h2, h3, pr_de, d_3c].iter().copied().max().unwrap();
                    tasks_xxx.push((h, tr));
                }
                tasks_xxx.sort();

                best_xxx = if (sym & 1) != 0 { res[24 + sym - 1] } else { 99 };
                for &(h, tr) in &tasks_xxx {
                    if h >= best_xxx {
                        break;
                    }
                    if h == 0 {
                        best_xxx = 0;
                        break;
                    }
                    let s1 = TRIPS[tr][0];
                    let s2 = TRIPS[tr][1];
                    let s3 = TRIPS[tr][2];
                    let t_ab = get_plus_table_idx(s1 as i32, s2 as i32) as usize;
                    let t_ba = get_plus_table_idx(s2 as i32, s1 as i32) as usize;
                    let t_bc = get_plus_table_idx(s2 as i32, s3 as i32) as usize;
                    let t_cb = get_plus_table_idx(s3 as i32, s2 as i32) as usize;
                    let t_ac = get_plus_table_idx(s1 as i32, s3 as i32) as usize;
                    let t_ca = get_plus_table_idx(s3 as i32, s1 as i32) as usize;

                    let views3: [ViewState; 3] = [
                        ViewState {
                            i1: st[s1].i1,
                            i2: st[s1].i2 * 18,
                            i3: st[s1].i3 * 18,
                            slot: s1 as u8,
                            ex: [st[s1].e_trk[t_ab], st[s1].e_trk[t_ac], 0],
                            cx: [st[s1].c_trk[t_ab], st[s1].c_trk[t_ac], 0],
                            plus_tab: [t_ab as u8, t_ac as u8, 0],
                            has3corner: t_ab == 0 && t_ac == 1,
                            n_tracks: 2,
                        },
                        ViewState {
                            i1: st[s2].i1,
                            i2: st[s2].i2 * 18,
                            i3: st[s2].i3 * 18,
                            slot: s2 as u8,
                            ex: [st[s2].e_trk[t_ba], st[s2].e_trk[t_bc], 0],
                            cx: [st[s2].c_trk[t_ba], st[s2].c_trk[t_bc], 0],
                            plus_tab: [t_ba as u8, t_bc as u8, 0],
                            has3corner: t_ba == 0 && t_bc == 1,
                            n_tracks: 2,
                        },
                        ViewState {
                            i1: st[s3].i1,
                            i2: st[s3].i2 * 18,
                            i3: st[s3].i3 * 18,
                            slot: s3 as u8,
                            ex: [st[s3].e_trk[t_ca], st[s3].e_trk[t_cb], 0],
                            cx: [st[s3].c_trk[t_ca], st[s3].c_trk[t_cb], 0],
                            plus_tab: [t_ca as u8, t_cb as u8, 0],
                            has3corner: t_ca == 0 && t_cb == 1,
                            n_tracks: 2,
                        },
                    ];

                    // 计算每个 view 的 heuristic 用于排序
                    let mut vh = [0u32; 3];
                    for vi in 0..3 {
                        let vs = &views3[vi];
                        let sv = vs.slot as usize;
                        let idx: u64 = (st[sv].i1 as u64 + st[sv].i2 as u64) * 24 + st[sv].i3 as u64;
                        let mut v = self.pt_cross_c4e0.get(idx) as u32;
                        for tt in 0..2 {
                            v = v.max(
                                self.pt_cross_cee[vs.plus_tab[tt] as usize]
                                    .get(idx * 24 + vs.ex[tt] as u64) as u32,
                            );
                            v = v.max(
                                self.pt_cross_cce[vs.plus_tab[tt] as usize]
                                    .get(idx * 24 + vs.cx[tt] as u64) as u32,
                            );
                        }
                        if vs.has3corner {
                            let idx_3c: u64 = ((st[sv].i1 as u64 + st[sv].i2 as u64) * 24
                                + vs.cx[0] as u64)
                                * 24
                                + vs.cx[1] as u64;
                            v = v.max(self.pt_cross_c4c5c6.get(idx_3c) as u32);
                        }
                        vh[vi] = v;
                    }
                    let mut view_order = [0usize, 1, 2];
                    view_order.sort_by(|a, b| vh[*b].cmp(&vh[*a]));

                    let (v_huge, p_huge, init_e6, init_c2) = self.pick_huge(s1, s2, &st);
                    let start_d = std::cmp::max(h, best_xx);
                    let max_d = std::cmp::min(20, best_xxx.saturating_sub(1));
                    for d in start_d..=max_d {
                        if self.search_3(
                            &views3,
                            view_order,
                            (st[s1].idep as usize) * 18,
                            (st[s1].ieo as usize) * 18,
                            d,
                            18,
                            best_xxx - 1,
                            v_huge,
                            p_huge,
                            init_e6,
                            init_c2,
                        ) {
                            best_xxx = d;
                            break;
                        }
                    }
                }
                res[24 + sym] = best_xxx;
            }

            // --- 4. XXXXC + EO(始终启用,对应 C++ ENABLE_EO_SEARCH_4)---
            {
                let mut views: [ViewState; 4] = [ViewState::default(); 4];
                for s in 0..4 {
                    views[s] = ViewState {
                        i1: st[s].i1,
                        i2: st[s].i2 * 18,
                        i3: st[s].i3 * 18,
                        slot: s as u8,
                        ex: st[s].e_trk,
                        cx: st[s].c_trk,
                        plus_tab: [0, 1, 2],
                        has3corner: true,
                        n_tracks: 3,
                    };
                }
                let mut view_h = [0u32; 4];
                for v in 0..4 {
                    let idx: u64 = (st[v].i1 as u64 + st[v].i2 as u64) * 24 + st[v].i3 as u64;
                    let mut h = self.pt_cross_c4e0.get(idx) as u32;
                    for t in 0..3 {
                        h = h.max(
                            self.pt_cross_cee[t].get(idx * 24 + st[v].e_trk[t] as u64) as u32,
                        );
                        h = h.max(
                            self.pt_cross_cce[t].get(idx * 24 + st[v].c_trk[t] as u64) as u32,
                        );
                    }
                    let idx_3c: u64 = ((st[v].i1 as u64 + st[v].i2 as u64) * 24
                        + st[v].c_trk[0] as u64)
                        * 24
                        + st[v].c_trk[1] as u64;
                    h = h.max(self.pt_cross_c4c5c6.get(idx_3c) as u32);
                    view_h[v] = h;
                }
                let mut view_order = [0usize, 1, 2, 3];
                view_order.sort_by(|a, b| view_h[*b].cmp(&view_h[*a]));

                let h_de = self.pt_ep4eo12.get(
                    st[0].idep as u64 * state_space::EO12 as u64 + st[0].ieo as u64,
                ) as u32;
                let h_max = [h_de, view_h[0], view_h[1], view_h[2], view_h[3]]
                    .iter()
                    .copied()
                    .max()
                    .unwrap();

                let (v_huge, p_huge, init_e6, init_c2) = self.pick_huge(0, 1, &st);

                let mut best_xxxx = if (sym & 1) != 0 { res[36 + sym - 1] } else { 99 };
                if h_max == 0 {
                    best_xxxx = 0;
                } else {
                    let start_d = std::cmp::max(h_max, best_xxx);
                    let max_d = std::cmp::min(20, best_xxxx.saturating_sub(1));
                    for d in start_d..=max_d {
                        if self.search_4(
                            &views,
                            view_order,
                            (st[0].idep as usize) * 18,
                            (st[0].ieo as usize) * 18,
                            d,
                            18,
                            best_xxxx - 1,
                            v_huge,
                            p_huge,
                            init_e6,
                            init_c2,
                        ) {
                            best_xxxx = d;
                            break;
                        }
                    }
                }
                res[36 + sym] = best_xxxx;
            }
        }
        res
    }
}

/// 把 48 个 sym 结果折叠成 24 个 rotation 结果(每 2 个 sym 取 min)。
/// 输出顺序:[XC × 6, XXC × 6, XXXC × 6, XXXXC × 6]。
pub fn fold_sym_to_rot(sym48: &[u32]) -> Vec<u32> {
    assert_eq!(sym48.len(), 48);
    let mut out = Vec::with_capacity(24);
    for stage_base in [0usize, 12, 24, 36] {
        for c in 0..6 {
            out.push(std::cmp::min(sym48[stage_base + 2 * c], sym48[stage_base + 2 * c + 1]));
        }
    }
    out
}

/// 给 Cross+EO 单独折叠(12 sym → 6 rotation)。
pub fn fold_cross_sym_to_rot(sym12: &[u32]) -> Vec<u32> {
    assert_eq!(sym12.len(), 12);
    (0..6).map(|c| std::cmp::min(sym12[2 * c], sym12[2 * c + 1])).collect()
}

/// 整体便捷接口:对一个 `Move` slice,返回 30 个值(5 阶段 × 6 rotation)。
/// alg 不需要 alg_rotation —— eo_cross 内部用 sym_moves_flat 直接处理 12 sym。
#[cfg(not(target_arch = "wasm32"))]
pub fn eo_cross_get_stats(alg: &[Move], with_diagonal: bool) -> Vec<u32> {
    let cross = EOCrossSolver::new();
    let xcross = EOXCrossSolver::new(with_diagonal);
    let alg_idx: Vec<u8> = alg.iter().map(|m| m.index() as u8).collect();
    let cr12 = cross.get_stats(&alg_idx);
    let xr48 = xcross.get_stats(&alg_idx);
    let mut out = Vec::with_capacity(30);
    out.extend(fold_cross_sym_to_rot(&cr12));
    out.extend(fold_sym_to_rot(&xr48));
    out
}

// ============================================================================
// 小表 cascade(wasm 友好,无 huge / 无 1.3GB / 无 mt_edge6)
// ----------------------------------------------------------------------------
// 动机:大表 `EOXCrossSolver` 的 XXC/XXXC/XXXXC 阶段靠 1.3GB 的 CEE/CCE/C4C5C6
// 表 + 10GB 的 huge 表「联合」验证多槽目标(叶子只查 per-slot c4e0 + ep4eo12,
// 其余槽靠这些表 prune 归 0)。浏览器装不下 GB 级表。
//
// 关键洞察:那些大表只是**额外的可采纳下界**,并不改变目标判定集合。EOXXCross 的
// 真目标 = cross + 选定 n 个 F2L pair(角+棱)全归位 + 全局 EO 解出。这完全由:
//   - 每个选定槽 `pt_cross_C4E0 == 0`(该槽 cross+角+棱,含整个 cross 已解)
//   - `pt_ep4eo12 == 0`(EP4 即 cross 棱排列 + EO12 全 12 棱朝向)
// 编码。big 路径叶子 depth==1 时正是「全部 prune 归 0」⇒ 上面两条成立。故小表
// cascade **显式逐槽追踪** pt_cross_C4E0 + 全局 pt_ep4eo12,叶子要求二者全 < depth
// (==0)。两者都是真实距离的可采纳下界 ⇒ IDA* 首达深度 = 真最优,与 big 路径逐格
// bit-exact,仅访问更多节点(丢了 CEE/CCE/C4C5C6/huge 的剪枝力)。
//
// 阶段 0(eo_cross)big 本就只用 mt_edge2 + mt_eo12 + pt_cross 三张小表,直接复用
// `EOCrossSolver` 同款逻辑。
//
// 用表清单(全 wasm 可服):
//   mt_edge2(38KB)、mt_edge4(18MB)、mt_corn(1.7KB)、mt_edge(1.7KB)、
//   mt_eo12(147KB)、mt_eo12_alt(147KB)、mt_ep4(855KB)、
//   pt_cross(139KB)、pt_cross_C4E0(52MB)、pt_ep4eo12(12MB)。

/// 单槽在指定 (sym, slot) 共轭下推完 alg 后的虚拟状态。只跟踪小表 cascade 需要的量:
///   i1 = edge4(已 ×24 form,= e4*24)、i2 = corner(0..23)、i3 = edge(0..23)、
///   idep = EP4(0..11879)、ieo = EO12(0..2047)。
/// idep/ieo 与 slot 无关(走 m_global,跟 big `get_indices_conj_full` 一致),但每个
/// slot 都算出来便于取用;同一 sym 下 4 个 slot 的 idep/ieo 必然相同。
#[derive(Debug, Clone, Copy, Default)]
struct EoSlotSmall {
    i1: u32,
    i2: u32,
    i3: u32,
    idep: u32,
    ieo: u32,
}

/// 小表 EO cascade 求解器。stage 0 复用 cross+EO 小表逻辑,stage 1..4 显式逐槽
/// 追踪 pt_cross_C4E0 + pt_ep4eo12。可不经 manager 构造(`from_tables`,wasm 路径)。
pub struct EOSmallSolver {
    // stage 0(eo_cross)
    mt_edge2: Arc<MoveTable>,
    mt_eo12: Arc<MoveTable>,
    pt_cross: Arc<PackedPruneTable>,
    // stage 1..4
    mt_edge4: Arc<MoveTable>,
    mt_corn: Arc<MoveTable>,
    mt_edge: Arc<MoveTable>,
    mt_ep4: Arc<MoveTable>,
    mt_eo12_alt: Arc<MoveTable>,
    pt_cross_c4e0: Arc<PackedPruneTable>,
    pt_ep4eo12: Arc<PackedPruneTable>,
}

impl EOSmallSolver {
    /// native:经 manager ensure 全部(小)表。不碰 mt_edge6 / huge / 1.3GB 表。
    #[cfg(not(target_arch = "wasm32"))]
    pub fn new() -> Self {
        let mtm = move_tables::instance();
        let ptm = prune_tables::instance();
        EOSmallSolver {
            mt_edge2: mtm.ensure_edge2(),
            mt_eo12: mtm.ensure_eo12(),
            pt_cross: ptm.ensure_pt_cross(),
            mt_edge4: mtm.ensure_edge4(),
            mt_corn: mtm.ensure_corn(),
            mt_edge: mtm.ensure_edge(),
            mt_ep4: mtm.ensure_ep4(),
            mt_eo12_alt: mtm.ensure_eo12_alt(),
            pt_cross_c4e0: ptm.ensure_pt_cross_c4e0(),
            pt_ep4eo12: ptm.ensure_pt_ep4eo12(),
        }
    }

    /// 预建表直接构造(绕过 manager / 磁盘 / mmap),wasm 路径用。
    /// 表字节顺序见各参数;构造方式:
    ///   mt_edge2  = MoveTable::from_bin(b, 528, 18)
    ///   mt_eo12   = MoveTable::from_bin(b, 2048, 18)
    ///   mt_edge4  = MoveTable::from_bin(b, 190080, 24)
    ///   mt_corn   = MoveTable::from_bin(b, 24, 18)
    ///   mt_edge   = MoveTable::from_bin(b, 24, 18)
    ///   mt_ep4    = MoveTable::from_bin(b, 11880, 18)
    ///   mt_eo12_alt = MoveTable::from_bin(b, 2048, 18)
    ///   pt_cross / pt_cross_c4e0 / pt_ep4eo12 = PackedPruneTable::from_bin(b)
    #[allow(clippy::too_many_arguments)]
    pub fn from_tables(
        mt_edge2: Arc<MoveTable>,
        mt_eo12: Arc<MoveTable>,
        pt_cross: Arc<PackedPruneTable>,
        mt_edge4: Arc<MoveTable>,
        mt_corn: Arc<MoveTable>,
        mt_edge: Arc<MoveTable>,
        mt_ep4: Arc<MoveTable>,
        mt_eo12_alt: Arc<MoveTable>,
        pt_cross_c4e0: Arc<PackedPruneTable>,
        pt_ep4eo12: Arc<PackedPruneTable>,
    ) -> Self {
        EOSmallSolver {
            mt_edge2,
            mt_eo12,
            pt_cross,
            mt_edge4,
            mt_corn,
            mt_edge,
            mt_ep4,
            mt_eo12_alt,
            pt_cross_c4e0,
            pt_ep4eo12,
        }
    }

    // ===================== stage 0:cross + EO =====================
    // 与 `EOCrossSolver` 完全同款(mt_edge2 + mt_eo12 + pt_cross),只是内联进来以便
    // wasm from_tables 复用。

    fn cross_indices_sym(&self, alg: &[u8], sym_idx: usize) -> (u32, u32, u32) {
        let mt2 = self.mt_edge2.as_u32();
        let mt_eo = self.mt_eo12.as_u32();
        let sm = sym_moves_flat();
        let mut i1 = state_space::EDGE2_A_SOLVED as u32;
        let mut i2 = state_space::EDGE2_B_SOLVED as u32;
        let mut ieo: u32 = 0;
        for &m in alg {
            let conj_m = sm[m as usize][sym_idx] as usize;
            i1 = mt2[(i1 as usize) * 18 + conj_m];
            i2 = mt2[(i2 as usize) * 18 + conj_m];
            ieo = mt_eo[(ieo as usize) + conj_m];
        }
        (i1, i2, ieo)
    }

    fn cross_search(&self, i1: usize, i2: usize, i_eo: usize, depth: u32, prev: u8) -> bool {
        let (vmoves, vcnt) = valid_moves();
        let count = vcnt[prev as usize] as usize;
        let row = &vmoves[prev as usize];
        let mt2 = self.mt_edge2.as_u32();
        let mt_eo = self.mt_eo12.as_u32();

        let mut local: u64 = 0;
        for k in 0..count {
            let m = row[k] as usize;
            local += 1;
            let n1 = mt2[i1 + m] as usize;
            let n2 = mt2[i2 + m] as usize;
            let idx: u64 = n1 as u64 * state_space::EDGE2 as u64 + n2 as u64;
            let pr = self.pt_cross.get(idx) as u32;
            if pr >= depth {
                continue;
            }
            let neo = mt_eo[i_eo + m] as usize;
            if depth == 1 {
                if pr == 0 && neo == 0 {
                    bump_node_count(local);
                    return true;
                }
            } else if self.cross_search(n1 * 18, n2 * 18, neo, depth - 1, m as u8) {
                bump_node_count(local);
                return true;
            }
        }
        bump_node_count(local);
        false
    }

    /// stage 0(eo_cross)12 sym 视角。与 `EOCrossSolver::get_stats` 逐格相同。
    fn cross_stats_sym(&self, alg: &[u8]) -> Vec<u32> {
        let mut res = vec![99u32; 12];
        let mut tasks: Vec<(u32, usize)> = Vec::with_capacity(12);
        let mut sym_state: Vec<(u32, u32, u32)> = Vec::with_capacity(12);
        for s in 0..12 {
            let (i1, i2, ieo) = self.cross_indices_sym(alg, s);
            sym_state.push((i1, i2, ieo));
            let idx: u64 = i1 as u64 * state_space::EDGE2 as u64 + i2 as u64;
            let mut h = self.pt_cross.get(idx) as u32;
            if h == 0 && ieo != 0 {
                h = 1;
            }
            if h == 0 && ieo == 0 {
                res[s] = 0;
                continue;
            }
            tasks.push((h, s));
        }
        tasks.sort();
        for &(h0, s) in &tasks {
            let (i1, i2, ieo) = sym_state[s];
            for d in h0..=12 {
                if self.cross_search(i1 as usize * 18, i2 as usize * 18, ieo as usize, d, 18) {
                    res[s] = d;
                    break;
                }
            }
        }
        res
    }

    // ===================== stage 1..4:显式逐槽追踪 =====================

    /// 在 (sym, slot) 共轭下推完 alg 得到 EoSlotSmall。i1/i2/i3 走 slot-conj move,
    /// idep/ieo 走 global move(与 big `get_indices_conj_full` 同源)。
    fn slot_virt(&self, alg: &[u8], sym_idx: usize, slot_idx: usize) -> EoSlotSmall {
        let mt_e4 = self.mt_edge4.as_u32();
        let mt_c = self.mt_corn.as_u32();
        let mt_e = self.mt_edge.as_u32();
        let mt_ep4 = self.mt_ep4.as_u32();
        let mt_eo = self.mt_eo12_alt.as_u32();
        let sm = sym_moves_flat();
        let cj = conj_moves_flat();

        // i1 起始 = CROSS_SOLVED * CORNER(= e4*24 form),mt_edge4 值已 ×24。
        let mut i1: u32 = (state_space::CROSS_SOLVED as u32) * (state_space::CORNER as u32);
        let mut i2: u32 = 12; // SOLVED_CORNER
        let mut i3: u32 = 0; // SOLVED_EDGE
        let mut idep: u32 = state_space::EP4_SOLVED as u32;
        let mut ieo: u32 = 0;

        for &m in alg {
            let m_global = sm[m as usize][sym_idx] as usize;
            let m_slot = cj[m_global][slot_idx] as usize;

            i1 = mt_e4[(i1 as usize) + m_slot];
            i2 = mt_c[(i2 as usize) * 18 + m_slot];
            i3 = mt_e[(i3 as usize) * 18 + m_slot];

            idep = mt_ep4[(idep as usize) * 18 + m_global];
            ieo = mt_eo[(ieo as usize) * 18 + m_global];
        }
        EoSlotSmall { i1, i2, i3, idep, ieo }
    }

    /// per-slot pt_cross_C4E0 下界(idx = (e4*24 + corner)*24 + edge)。
    #[inline]
    fn h_c4e0(&self, s: &EoSlotSmall) -> u32 {
        self.pt_cross_c4e0
            .get((s.i1 as u64 + s.i2 as u64) * 24 + s.i3 as u64) as u32
    }
    /// EP4+EO12 联合下界。
    #[inline]
    fn h_ep4eo12(&self, s: &EoSlotSmall) -> u32 {
        self.pt_ep4eo12
            .get(s.idep as u64 * state_space::EO12 as u64 + s.ieo as u64) as u32
    }

    /// 一次深度尝试:N 个 xcross 槽(各 pt_cross_C4E0)+ 全局 EP4+EO(pt_ep4eo12)。
    /// 任一 prune ≥ depth 即剪;depth==1 全过 ⇒ 全部 == 0 ⇒ N-cross + EO 全解。
    /// xc[j] = (i1=e4*24 form, i2=corner*18, i3=edge*18, slot)。i_dep/i_eo = state*18 form。
    fn search_small(
        &self,
        xc: &[(usize, usize, usize, usize)],
        i_dep: usize,
        i_eo: usize,
        depth: u32,
        prev: u8,
    ) -> bool {
        let (vmoves, vcnt) = valid_moves();
        let count = vcnt[prev as usize] as usize;
        let row = &vmoves[prev as usize];
        let mt_e4 = self.mt_edge4.as_u32();
        let mt_c = self.mt_corn.as_u32();
        let mt_e = self.mt_edge.as_u32();
        let mt_ep4 = self.mt_ep4.as_u32();
        let mt_eo = self.mt_eo12_alt.as_u32();
        let cj = conj_moves_flat();
        let n = xc.len();

        let mut local: u64 = 0;
        let mut nxc = [(0usize, 0usize, 0usize, 0usize); 4];
        for k in 0..count {
            let m = row[k] as usize;
            local += 1;
            // 全局 EP4 + EO12(走 m,不共轭 —— alg 已在 sym 帧里)
            let nd = mt_ep4[i_dep + m] as usize;
            let neo = mt_eo[i_eo + m] as usize;
            let idx_de: u64 = nd as u64 * state_space::EO12 as u64 + neo as u64;
            if self.pt_ep4eo12.get(idx_de) as u32 >= depth {
                continue;
            }
            // 各 xcross 槽 pt_cross_C4E0
            let mut pruned = false;
            for j in 0..n {
                let (i1, i2, i3, slot) = xc[j];
                let m_slot = cj[m][slot] as usize;
                let n1 = mt_e4[i1 + m_slot] as usize;
                let n2 = mt_c[i2 + m_slot] as usize;
                let n3 = mt_e[i3 + m_slot] as usize;
                if self.pt_cross_c4e0.get((n1 as u64 + n2 as u64) * 24 + n3 as u64) as u32 >= depth {
                    pruned = true;
                    break;
                }
                nxc[j] = (n1, n2 * 18, n3 * 18, slot);
            }
            if pruned {
                continue;
            }
            if depth == 1 {
                // 全部 prune < 1 ⇒ N 槽 c4e0 == 0 且 ep4eo12 == 0 ⇒ 全解。
                bump_node_count(local);
                return true;
            }
            if self.search_small(&nxc[..n], nd * 18, neo * 18, depth - 1, m as u8) {
                bump_node_count(local);
                return true;
            }
        }
        bump_node_count(local);
        false
    }

    /// 解一个 task(slot 子集 `slots`,1..4 个)。h = 根 max 下界,lower = cascade 上一阶段。
    fn solve_subset(
        &self,
        st: &[EoSlotSmall; 4],
        slots: &[usize],
        h: u32,
        lower: u32,
        bound: u32,
    ) -> u32 {
        if h == 0 {
            // 根全解(各槽 c4e0 == 0 且 ep4eo12 == 0)。
            return 0;
        }
        let mut xc = [(0usize, 0usize, 0usize, 0usize); 4];
        for (j, &s) in slots.iter().enumerate() {
            xc[j] = (
                st[s].i1 as usize,
                (st[s].i2 as usize) * 18,
                (st[s].i3 as usize) * 18,
                s,
            );
        }
        let n = slots.len();
        // EP4/EO 任取一槽(同 sym 下都一样)。
        let i_dep = (st[slots[0]].idep as usize) * 18;
        let i_eo = (st[slots[0]].ieo as usize) * 18;
        let max_d = std::cmp::min(20, bound.saturating_sub(1));
        let start = std::cmp::max(h.max(lower), 1);
        for d in start..=max_d {
            if self.search_small(&xc[..n], i_dep, i_eo, d, 18) {
                return d;
            }
        }
        99
    }

    /// 单 sym 下指定阶段(stage 1=xc / 2=xxc / 3=xxxc / 4=xxxxc)的最优步数,min over combo。
    /// `lower` = 上一阶段(cascade 单调下界);`bound` = sym&1 配对早停上界。
    fn stage_for_sym(
        &self,
        st: &[EoSlotSmall; 4],
        stage: usize,
        lower: u32,
        bound: u32,
    ) -> u32 {
        const XC: [&[usize]; 4] = [&[0], &[1], &[2], &[3]];
        const XXC: [&[usize]; 6] = [&[0, 1], &[0, 2], &[0, 3], &[1, 2], &[1, 3], &[2, 3]];
        const XXXC: [&[usize]; 4] = [&[0, 1, 2], &[0, 1, 3], &[0, 2, 3], &[1, 2, 3]];
        const XXXXC: [&[usize]; 1] = [&[0, 1, 2, 3]];
        let combos: &[&[usize]] = match stage {
            1 => &XC,
            2 => &XXC,
            3 => &XXXC,
            _ => &XXXXC,
        };
        // EP4+EO 下界(slot 无关)。
        let h_de = self.h_ep4eo12(&st[0]);
        let mut scored: Vec<(u32, &[usize])> = combos
            .iter()
            .map(|&c| {
                let h = c
                    .iter()
                    .map(|&s| self.h_c4e0(&st[s]))
                    .max()
                    .unwrap()
                    .max(h_de);
                (h, c)
            })
            .collect();
        scored.sort_by_key(|t| t.0);
        let mut min_v = bound;
        for &(h, combo) in &scored {
            if h >= min_v {
                break;
            }
            let res = self.solve_subset(st, combo, h, lower, min_v);
            if res < min_v {
                min_v = res;
            }
        }
        min_v
    }

    /// 4 个深阶段 × 12 sym。返回 48 值 [XC×12, XXC×12, XXXC×12, XXXXC×12]。
    /// 与 big `EOXCrossSolver::get_stats` 逐格 bit-exact(IDA* 首达即真最优)。
    fn deep_stats_sym(&self, alg: &[u8]) -> Vec<u32> {
        let mut res = vec![99u32; 48];
        for sym in 0..12 {
            let st: [EoSlotSmall; 4] = std::array::from_fn(|s| self.slot_virt(alg, sym, s));
            // cascade 链:每阶段 lower = 上一阶段本 sym 的值;bound = sym&1 配对早停。
            let mut prev_stage = 0u32;
            for (si, stage) in (1..=4).enumerate() {
                let base = si * 12;
                let bound = if (sym & 1) != 0 { res[base + sym - 1] } else { 99 };
                let v = self.stage_for_sym(&st, stage, prev_stage, bound);
                res[base + sym] = v;
                prev_stage = v;
            }
        }
        res
    }

    /// 小表 30 值 [eo_cross×6, eo_xcross×6, eo_xxcross×6, eo_xxxcross×6, eo_xxxxcross×6],
    /// rots ["","z2","z'","z","x'","x"]。与 big `eo_cross_get_stats` 逐格 bit-exact。
    pub fn eo_get_stats_small(&self, alg: &[Move]) -> Vec<u32> {
        let alg_idx: Vec<u8> = alg.iter().map(|m| m.index() as u8).collect();
        let cr12 = self.cross_stats_sym(&alg_idx);
        let dr48 = self.deep_stats_sym(&alg_idx);
        let mut out = Vec::with_capacity(30);
        out.extend(fold_cross_sym_to_rot(&cr12));
        out.extend(fold_sym_to_rot(&dr48));
        out
    }

    /// 单阶段 6 视角(stage 0=eo_cross / 1=eo_xcross / 2=eo_xxcross / 3=eo_xxxcross /
    /// 4=eo_xxxxcross)。UI 两遍用:先单算 eo_cross 秒出,深阶段后台补。
    /// 单阶段不串 cascade 下界(lower=0),仍正确(IDA* 首达即最优)。
    pub fn eo_get_stage_small(&self, alg: &[Move], stage: usize) -> Vec<u32> {
        let alg_idx: Vec<u8> = alg.iter().map(|m| m.index() as u8).collect();
        if stage == 0 {
            let cr12 = self.cross_stats_sym(&alg_idx);
            return fold_cross_sym_to_rot(&cr12);
        }
        let mut sym12 = vec![99u32; 12];
        for sym in 0..12 {
            let st: [EoSlotSmall; 4] = std::array::from_fn(|s| self.slot_virt(&alg_idx, sym, s));
            let bound = if (sym & 1) != 0 { sym12[sym - 1] } else { 99 };
            sym12[sym] = self.stage_for_sym(&st, stage, 0, bound);
        }
        fold_cross_sym_to_rot(&sym12)
    }

    // ===================== 具体转动序列枚举(rot 帧,不走 sym)=====================
    //
    // 枚举不能复用 search_small(它在 12-sym 帧里跑,真实 move 难还原)。改成对每个
    // rotation 独立的直接 rot 帧 IDA*:把 alg 先 alg_rotation(rot),全局 EP4+EO 走
    // raw m、各 xcross 槽走 cj[m][slot](与 pair get_virt 同),path 收的 raw m 就是
    // 真实 rot 帧转动 → fmt 时前缀 rot 串即可,无需反共轭。per-rotation 最优与帧无关
    // (sym 只是配对早停优化),故 len 与 eo_get_stage_small bit-exact。

    /// rot 帧下推完(已 rotate 的)alg,得到单槽 i1/i2/i3 + 全局 idep/ieo。
    /// 槽量走 cj[m][slot],全局量走 raw m。
    fn rot_virt(&self, alg: &[u8], slot: usize) -> EoSlotSmall {
        let mt_e4 = self.mt_edge4.as_u32();
        let mt_c = self.mt_corn.as_u32();
        let mt_e = self.mt_edge.as_u32();
        let mt_ep4 = self.mt_ep4.as_u32();
        let mt_eo = self.mt_eo12_alt.as_u32();
        let cj = conj_moves_flat();

        let mut i1: u32 = (state_space::CROSS_SOLVED as u32) * (state_space::CORNER as u32);
        let mut i2: u32 = 12; // SOLVED_CORNER
        let mut i3: u32 = 0; // SOLVED_EDGE
        let mut idep: u32 = state_space::EP4_SOLVED as u32;
        let mut ieo: u32 = 0;
        for &m in alg {
            let m_slot = cj[m as usize][slot] as usize;
            i1 = mt_e4[(i1 as usize) + m_slot];
            i2 = mt_c[(i2 as usize) * 18 + m_slot];
            i3 = mt_e[(i3 as usize) * 18 + m_slot];
            idep = mt_ep4[(idep as usize) * 18 + (m as usize)];
            ieo = mt_eo[(ieo as usize) * 18 + (m as usize)];
        }
        EoSlotSmall { i1, i2, i3, idep, ieo }
    }

    /// stage 0 专用:rot 帧下推(已 rotate 的)alg,得到 edge2 cross 群 (i1,i2) + EO (ieo)。
    /// stage 0 目标是 WCA cross(edge2 群)+ EO,与 EP4 那条更严的「特定 cross 棱排列」
    /// 不同 ⇒ stage 0 必须用这套坐标(否则 len 多 1)。全走 raw m(rot 帧)。
    fn rot_virt_cross(&self, alg: &[u8]) -> (u32, u32, u32) {
        let mt2 = self.mt_edge2.as_u32();
        let mt_eo = self.mt_eo12.as_u32();
        let mut i1 = state_space::EDGE2_A_SOLVED as u32;
        let mut i2 = state_space::EDGE2_B_SOLVED as u32;
        let mut ieo: u32 = 0;
        for &m in alg {
            i1 = mt2[(i1 as usize) * 18 + (m as usize)];
            i2 = mt2[(i2 as usize) * 18 + (m as usize)];
            ieo = mt_eo[(ieo as usize) + (m as usize)];
        }
        (i1, i2, ieo)
    }

    /// 镜像 cross_search,但收集 path 而非首解返回。path 存 raw m(rot 帧真实转动)。
    /// depth==1 且 pt_cross==0 且 ieo==0 ⇒ cross+EO 全解,收一条最优解。
    #[allow(clippy::too_many_arguments)]
    fn enum_cross(
        &self,
        i1: usize,
        i2: usize,
        i_eo: usize,
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
        let mt2 = self.mt_edge2.as_u32();
        let mt_eo = self.mt_eo12.as_u32();
        for k in 0..count {
            if out.len() >= cap {
                return;
            }
            let m = row[k] as usize;
            let n1 = mt2[i1 + m] as usize;
            let n2 = mt2[i2 + m] as usize;
            let pr = self.pt_cross.get(n1 as u64 * state_space::EDGE2 as u64 + n2 as u64) as u32;
            if pr >= depth {
                continue;
            }
            let neo = mt_eo[i_eo + m] as usize;
            path.push(m as u8);
            if depth == 1 {
                if pr == 0 && neo == 0 {
                    out.push(path.clone());
                }
            } else if pr > 0 || neo != 0 {
                // cross+EO 全解(pr==0 && neo==0)却仍要走 depth-1 步 = 更短解 + 无效尾动,跳过。
                self.enum_cross(n1 * 18, n2 * 18, neo, depth - 1, m as u8, path, out, cap);
            }
            path.pop();
        }
    }

    /// 镜像 search_small,但 (a) 在 rot 帧(全局走 raw m),(b) 收集 path 而非首解返回。
    /// path 存 raw m(rot 帧真实转动)。depth==1 且全 prune<1 ⇒ 全槽 c4e0==0 且
    /// ep4eo12==0 → 收一条最优解。out 收满 cap 即停。
    #[allow(clippy::too_many_arguments)]
    fn enum_small(
        &self,
        xc: &[(usize, usize, usize, usize)],
        i_dep: usize,
        i_eo: usize,
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
        let mt_ep4 = self.mt_ep4.as_u32();
        let mt_eo = self.mt_eo12_alt.as_u32();
        let cj = conj_moves_flat();
        let n = xc.len();
        let mut nxc = [(0usize, 0usize, 0usize, 0usize); 4];
        for k in 0..count {
            if out.len() >= cap {
                return;
            }
            let m = row[k] as usize;
            let nd = mt_ep4[i_dep + m] as usize;
            let neo = mt_eo[i_eo + m] as usize;
            let idx_de: u64 = nd as u64 * state_space::EO12 as u64 + neo as u64;
            let h_de = self.pt_ep4eo12.get(idx_de) as u32;
            if h_de >= depth {
                continue;
            }
            let mut pruned = false;
            let mut max_h = h_de; // DE+EO 与各槽 cross 的启发式最大值;==0 ⟺ 全解
            for j in 0..n {
                let (i1, i2, i3, slot) = xc[j];
                let m_slot = cj[m][slot] as usize;
                let n1 = mt_e4[i1 + m_slot] as usize;
                let n2 = mt_c[i2 + m_slot] as usize;
                let n3 = mt_e[i3 + m_slot] as usize;
                let hs = self.pt_cross_c4e0.get((n1 as u64 + n2 as u64) * 24 + n3 as u64) as u32;
                if hs >= depth {
                    pruned = true;
                    break;
                }
                if hs > max_h {
                    max_h = hs;
                }
                nxc[j] = (n1, n2 * 18, n3 * 18, slot);
            }
            if pruned {
                continue;
            }
            path.push(m as u8);
            if depth == 1 {
                out.push(path.clone());
            } else if max_h > 0 {
                // max_h==0 ⟺ DE+EO 与全槽皆解;depth>1 还要走步 = 更短解 + 无效尾动,跳过。
                self.enum_small(&nxc[..n], nd * 18, neo * 18, depth - 1, m as u8, path, out, cap);
            }
            path.pop();
        }
    }

    /// 给定 stage(0=eo_cross / 1=eo_xcross / .. / 4=eo_xxxxcross),求 best_len(=最优步数)
    /// 并枚举**所有并列最优**(同一最小求解深度成功)的 (frame, combo) 的解,每条带自己的
    /// frame + combo 标签。返回 `(best_len, Vec<(frame, combo 槽位, move 路径)>)`。
    ///
    /// **不再单独调 eo_get_stage_small 求 best_len**(那会算全 6 视角的 12 sym,单 face 只
    /// 需 2 sym → ~6× 浪费)。枚举用的剪枝/叶子与 count 完全一致(可采纳下界)⇒ 首个出解的
    /// 深度 d 即真最优 = best_len。故从 root 下界起逐层加深,跨帧/跨 combo 按 h 升序探,首个
    /// 出解的深度 d 即 best_len;该深度成功的**全部** (frame, combo) 都是并列最优。
    ///
    /// **EO 特有:** EO 破坏 y-对称,best_len = `rot` 与 `rot·y` 两帧的 min,并列槽可能跨帧
    /// (rot vs rot·y)⇒ frame 必须**逐条**带(返回的 `frame` 串 `rot` 或 `{rot} y` 即该条解的
    /// 真实 rot 帧前缀,emit raw m)。两帧候选合在一起按 h 升序探(同 h 下 rot 帧优先,稳定
    /// 排序)。stage 0 无 slot(只 EO+cross),每条 combo 为空。
    ///
    /// best_len 后逐深度 d 外层、候选内层交错收集(跨候选也按长度升序);`cap` 是**总**条数上界。
    pub fn enumerate_small(
        &self,
        alg: &[Move],
        rot: &str,
        stage: usize,
        extra: u32,
        cap: usize,
    ) -> (u32, Vec<(String, Vec<usize>, Vec<u8>)>) {
        let alg_idx: Vec<u8> = alg.iter().map(|m| m.index() as u8).collect();
        let y_frame = if rot.is_empty() { "y".to_string() } else { format!("{} y", rot) };
        let frames = [rot.to_string(), y_frame];

        // stage 0(eo_cross):edge2 cross 群 + EO,无 slot。两帧各取 root 下界,统一加深。
        if stage == 0 {
            // (h, frame_idx, i1, i2, ieo);同 cross_stats_sym 的 root h:pt_cross + EO 兜 1。
            let mut roots: Vec<(u32, usize, usize, usize, usize)> = Vec::with_capacity(2);
            for (fi, fr) in frames.iter().enumerate() {
                let mut a = alg_idx.clone();
                alg_rotation(&mut a, fr);
                let (i1, i2, ieo) = self.rot_virt_cross(&a);
                let mut h =
                    self.pt_cross.get(i1 as u64 * state_space::EDGE2 as u64 + i2 as u64) as u32;
                if h == 0 && ieo != 0 {
                    h = 1;
                }
                roots.push((h, fi, i1 as usize, i2 as usize, ieo as usize));
            }
            roots.sort_by_key(|t| (t.0, t.1)); // 同 h 下 rot(frame 0)优先。
            let d0 = roots.iter().map(|t| t.0).min().unwrap_or(0);

            // 求 best_len(bd)= 首个有任一 root 出解的深度;并记录该深度成功的全部 root(并列)。
            let mut best_len = 99u32;
            let mut tied: Vec<usize> = Vec::new(); // root 在 roots 里的索引
            'find0: for d in d0..=12 {
                for (ri, &(h, _, i1, i2, ieo)) in roots.iter().enumerate() {
                    if h > d {
                        continue;
                    }
                    let mut probe: Vec<Vec<u8>> = Vec::new();
                    let mut path = Vec::new();
                    self.enum_cross(i1 * 18, i2 * 18, ieo, d, 18, &mut path, &mut probe, 1);
                    if !probe.is_empty() {
                        tied.push(ri);
                    }
                }
                if !tied.is_empty() {
                    best_len = d;
                    break 'find0;
                }
            }
            if best_len >= 99 {
                return (0, Vec::new());
            }

            // 逐深度 d 外层、tied root 内层交错收集,跨 root 也按长度升序;cap 控总条数。
            let mut items: Vec<(String, Vec<usize>, Vec<u8>)> = Vec::new();
            'collect0: for d in best_len..=(best_len + extra).min(12) {
                for &ri in &tied {
                    if items.len() >= cap {
                        break 'collect0;
                    }
                    let (_, fi, i1, i2, ieo) = roots[ri];
                    let mut out: Vec<Vec<u8>> = Vec::new();
                    let mut path = Vec::new();
                    self.enum_cross(i1 * 18, i2 * 18, ieo, d, 18, &mut path, &mut out, cap - items.len());
                    for sol in out {
                        items.push((frames[fi].clone(), vec![], sol));
                    }
                }
            }
            return (best_len, items);
        }

        // stage 1..4:每帧 4 槽 state + 候选 combos,跨帧统一按 h 升序迭代加深。
        const XC: [&[usize]; 4] = [&[0], &[1], &[2], &[3]];
        const XXC: [&[usize]; 6] = [&[0, 1], &[0, 2], &[0, 3], &[1, 2], &[1, 3], &[2, 3]];
        const XXXC: [&[usize]; 4] = [&[0, 1, 2], &[0, 1, 3], &[0, 2, 3], &[1, 2, 3]];
        const XXXXC: [&[usize]; 1] = [&[0, 1, 2, 3]];
        let combos: &[&[usize]] = match stage {
            1 => &XC,
            2 => &XXC,
            3 => &XXXC,
            _ => &XXXXC,
        };

        let mut ctxs: Vec<[EoSlotSmall; 4]> = Vec::with_capacity(2);
        let mut cands: Vec<(u32, usize, usize)> = Vec::new(); // (h, frame_idx, combo_idx)
        for (fi, fr) in frames.iter().enumerate() {
            let mut a = alg_idx.clone();
            alg_rotation(&mut a, fr);
            let st: [EoSlotSmall; 4] = std::array::from_fn(|s| self.rot_virt(&a, s));
            let h_de = self.h_ep4eo12(&st[0]);
            for (ci, c) in combos.iter().enumerate() {
                let h = c.iter().map(|&s| self.h_c4e0(&st[s])).max().unwrap_or(0).max(h_de);
                cands.push((h, fi, ci));
            }
            ctxs.push(st);
        }
        // 稳定排序:同 h 保留 (frame, combo) 原序 ⇒ rot 帧、stage_for_sym 同序优先。
        cands.sort_by_key(|t| t.0);

        let mk_xc = |st: &[EoSlotSmall; 4], combo: &[usize]| {
            let mut xc = [(0usize, 0usize, 0usize, 0usize); 4];
            for (j, &s) in combo.iter().enumerate() {
                xc[j] = (st[s].i1 as usize, (st[s].i2 as usize) * 18, (st[s].i3 as usize) * 18, s);
            }
            xc
        };

        let d0 = cands.iter().map(|t| t.0).min().unwrap_or(0);

        // 求 best_len(bd)= 首个有任一候选出解的深度;并记录该深度成功的全部候选(并列)。
        let mut best_len = 99u32;
        let mut tied: Vec<usize> = Vec::new(); // 候选在 cands 里的索引
        'find: for d in d0..=20 {
            for (ci, &(h, fi, cidx)) in cands.iter().enumerate() {
                if h > d {
                    continue;
                }
                let st = &ctxs[fi];
                let combo = combos[cidx];
                let n = combo.len();
                let xc = mk_xc(st, combo);
                let i_dep0 = (st[0].idep as usize) * 18;
                let i_eo0 = (st[0].ieo as usize) * 18;
                let mut probe: Vec<Vec<u8>> = Vec::new();
                let mut path = Vec::new();
                self.enum_small(&xc[..n], i_dep0, i_eo0, d, 18, &mut path, &mut probe, 1);
                if !probe.is_empty() {
                    tied.push(ci);
                }
            }
            if !tied.is_empty() {
                best_len = d;
                break 'find;
            }
        }
        if best_len >= 99 {
            return (0, Vec::new());
        }

        // 逐深度 d 外层、tied 候选内层交错收集,跨候选也按长度升序;cap 控总条数。
        let mut items: Vec<(String, Vec<usize>, Vec<u8>)> = Vec::new();
        'collect: for d in best_len..=(best_len + extra).min(20) {
            for &ci in &tied {
                if items.len() >= cap {
                    break 'collect;
                }
                let (_, fi, cidx) = cands[ci];
                let st = &ctxs[fi];
                let combo = combos[cidx];
                let n = combo.len();
                let xc = mk_xc(st, combo);
                let i_dep0 = (st[0].idep as usize) * 18;
                let i_eo0 = (st[0].ieo as usize) * 18;
                let mut out: Vec<Vec<u8>> = Vec::new();
                let mut path = Vec::new();
                self.enum_small(&xc[..n], i_dep0, i_eo0, d, 18, &mut path, &mut out, cap - items.len());
                for sol in out {
                    items.push((frames[fi].clone(), combo.to_vec(), sol));
                }
            }
        }
        (best_len, items)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::cube_common::{string_to_alg, test_env_lock};
    use std::path::PathBuf;

    /// 小表 EO cascade(from_tables,无 huge / 无 1.3GB / 无 mt_edge6)逐格 bit-exact
    /// 对照大表 golden(值由 huge-table eo_cross_analyzer 算出)。
    /// 30 值序 = [eo_cross×6, eo_xcross×6, eo_xxcross×6, eo_xxxcross×6, eo_xxxxcross×6],
    /// rots ["","z2","z'","z","x'","x"]。
    /// 需 pt_cross + pt_cross_C4E0(52MB)+ pt_ep4eo12(12MB)+ 7 张 move 表,**不碰 huge**。
    /// 慢(eo_xxxxcross 无 big 启发式),故 #[ignore]:
    ///   `cargo test --release --lib eo_small_matches_golden -- --ignored --nocapture`
    #[test]
    #[ignore]
    fn eo_small_matches_golden() {
        let _lock = test_env_lock().lock().unwrap_or_else(|e| e.into_inner());
        let dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tables");
        std::env::set_var("CUBE_TABLE_DIR", &dir);

        let mtm = move_tables::instance();
        let ptm = prune_tables::instance();
        let solver = EOSmallSolver::from_tables(
            mtm.ensure_edge2(),
            mtm.ensure_eo12(),
            ptm.ensure_pt_cross(),
            mtm.ensure_edge4(),
            mtm.ensure_corn(),
            mtm.ensure_edge(),
            mtm.ensure_ep4(),
            mtm.ensure_eo12_alt(),
            ptm.ensure_pt_cross_c4e0(),
            ptm.ensure_pt_ep4eo12(),
        );

        let cases: &[(&str, [u32; 30])] = &[
            (
                "U B' L R2 U B2 R2 U2 B2 U R2 U2 F2 B' R' B2 F' U2 L2 R",
                [
                    7, 8, 7, 8, 6, 8, 8, 9, 8, 9, 7, 9, 10, 11, 10, 9, 10, 11, 12, 11, 13, 12, 12,
                    13, 14, 15, 15, 14, 15, 14,
                ],
            ),
            (
                "D2 L B2 R2 D R2 D R2 B2 R2 D2 L' D2 B D2 U2 R2 D' B2 R",
                [
                    6, 8, 7, 7, 8, 8, 9, 8, 8, 9, 9, 9, 11, 11, 10, 11, 10, 10, 13, 12, 12, 13, 12,
                    13, 15, 15, 15, 14, 14, 15,
                ],
            ),
            (
                "B2 D' F2 L' U' R' D R2 F D' B2 L2 F2 R2 B' R2 L2 U2 L",
                [
                    7, 8, 8, 7, 8, 6, 8, 8, 9, 8, 8, 8, 9, 10, 11, 10, 10, 10, 12, 11, 12, 12, 12,
                    11, 14, 14, 15, 14, 15, 14,
                ],
            ),
        ];

        for (scr, exp) in cases {
            let alg = string_to_alg(scr);
            let t0 = std::time::Instant::now();
            let got = solver.eo_get_stats_small(&alg);
            let dt = t0.elapsed();
            eprintln!("scramble `{}` -> {:?}  ({:.2?})", scr, got, dt);
            assert_eq!(
                got.as_slice(),
                exp.as_slice(),
                "eo small-mode mismatch for `{}`:\n got {:?}\n exp {:?}",
                scr,
                got,
                exp
            );
        }
    }

    /// enumerate_small 输出 move 序列正确性:
    ///   1. best_len == golden 值(逐格 bit-exact,5 阶段 ×6 视角,布局 stage*6+rot)
    ///   2. 每条解长度 == best_len(全是最优解)
    ///   3. 把(返回**逐条 frame** 帧打乱 ++ 解)重编码:stage 0 查 edge2 pt_cross+EO,
    ///      stage 1..4 查全局 ep4eo12 prune==0(EP4 cross 排列 + 全 12 棱 EO 解出)
    ///      且各 combo 槽 c4e0 prune==0(该槽 cross+角+棱解出)⇒ 序列真把所选 combo 解出。
    ///      ⇒ 每条返回项的 combo 在该 stage 下都达成 best_len(都是合法并列)。
    ///   frame 可能是 `rot` 或 `rot y`(EO 破坏 y-对称,best_len 来自 y-配对的某一帧;并列项
    ///   可能跨帧 ⇒ frame 逐条带);emit 的就是该帧 raw m。
    /// eo_xxxxcross 最慢,故只测 1 条打乱;若单阶段超 ~120s 收到前 3 rot(见报告)。
    ///   `cargo test --release --lib eo_enumerate_valid -- --ignored --nocapture`
    #[test]
    #[ignore]
    fn eo_enumerate_valid() {
        let _lock = test_env_lock().lock().unwrap_or_else(|e| e.into_inner());
        let dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tables");
        std::env::set_var("CUBE_TABLE_DIR", &dir);

        let mtm = move_tables::instance();
        let ptm = prune_tables::instance();
        let solver = EOSmallSolver::from_tables(
            mtm.ensure_edge2(),
            mtm.ensure_eo12(),
            ptm.ensure_pt_cross(),
            mtm.ensure_edge4(),
            mtm.ensure_corn(),
            mtm.ensure_edge(),
            mtm.ensure_ep4(),
            mtm.ensure_eo12_alt(),
            ptm.ensure_pt_cross_c4e0(),
            ptm.ensure_pt_ep4eo12(),
        );

        let rots = ["", "z2", "z'", "z", "x'", "x"];
        // 1 条打乱 + golden(同 eo_small_matches_golden,布局 [stage*6 + rot])。
        let cases: &[(&str, [u32; 30])] = &[(
            "U B' L R2 U B2 R2 U2 B2 U R2 U2 F2 B' R' B2 F' U2 L2 R",
            [
                7, 8, 7, 8, 6, 8, 8, 9, 8, 9, 7, 9, 10, 11, 10, 9, 10, 11, 12, 11, 13, 12, 12,
                13, 14, 15, 15, 14, 15, 14,
            ],
        )];

        for (scr, exp) in cases {
            let alg = string_to_alg(scr);
            for (ri, rot) in rots.iter().enumerate() {
                for stage in 0..5usize {
                    let want = exp[stage * 6 + ri];
                    let t0 = std::time::Instant::now();
                    let (len, items) = solver.enumerate_small(&alg, rot, stage, 0, 20);
                    let dt = t0.elapsed();
                    eprintln!(
                        "rot={:>2} stage={} -> len={} items={} ({:.2?})",
                        rot, stage, len, items.len(), dt
                    );
                    assert_eq!(
                        len, want,
                        "len mismatch `{}` rot={} stage={}: got {} want {}",
                        scr, rot, stage, len, want
                    );
                    if len == 0 {
                        continue;
                    }
                    assert!(!items.is_empty(), "no sols `{}` rot={} stage={}", scr, rot, stage);
                    for (frame, combo, sol) in &items {
                        assert_eq!(
                            sol.len() as u32,
                            len,
                            "sol not optimal `{}` rot={} stage={}: frame='{}' {:?}",
                            scr, rot, stage, frame, sol
                        );
                        // 每条解带自己的 frame ⇒ 用该 frame 打乱基底(可能含尾随 y)。
                        let mut full: Vec<u8> = alg.iter().map(|m| m.index() as u8).collect();
                        alg_rotation(&mut full, frame);
                        full.extend_from_slice(sol);
                        if stage == 0 {
                            // eo_cross:edge2 cross 群 + EO 全解(pt_cross==0 && ieo==0)。
                            assert!(combo.is_empty(), "stage 0 combo must be empty, got {:?}", combo);
                            let (c1, c2, ceo) = solver.rot_virt_cross(&full);
                            let pr = solver
                                .pt_cross
                                .get(c1 as u64 * state_space::EDGE2 as u64 + c2 as u64);
                            assert_eq!(
                                (pr, ceo),
                                (0, 0),
                                "eo_cross unsolved `{}` rot={} frame='{}' sol={:?} (pt_cross={} ieo={})",
                                scr, rot, frame, sol, pr, ceo
                            );
                            continue;
                        }
                        // 全局 EP4+EO12:cross 棱排列 + 全 12 棱朝向解出。
                        // (slot 取 0 即可,全局量与 slot 无关。)
                        let sg = solver.rot_virt(&full, 0);
                        assert_eq!(
                            solver.h_ep4eo12(&sg),
                            0,
                            "ep4eo12 unsolved `{}` rot={} stage={} frame='{}' sol={:?}",
                            scr, rot, stage, frame, sol
                        );
                        // 各 combo 槽:cross+角+棱(c4e0)解出 ⇒ 该 combo 在 best_len 下确达成(合法并列)。
                        assert!(!combo.is_empty(), "stage {} combo must be non-empty", stage);
                        for &s in combo {
                            let sx = solver.rot_virt(&full, s);
                            assert_eq!(
                                solver.h_c4e0(&sx),
                                0,
                                "combo slot {} unsolved `{}` rot={} stage={} frame='{}' sol={:?}",
                                s, scr, rot, stage, frame, sol
                            );
                        }
                    }
                }
            }
        }
    }
}
