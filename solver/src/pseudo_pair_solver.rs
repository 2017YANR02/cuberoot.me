//! Pseudo Pair analyzer 求解器(Phase 9)。
//!
//! 移植自 C++ `pseudo_pair_analyzer.cpp`(1592 行)。
//!
//! 4 cascade 阶段(C++ 命名约定:列名 cross/xcross/... 实际是搜索算法的 search_1..4):
//!   - xcross_analyze   (CSV "pseudo_cross_pseudo_pair"):search_1,Cross+Pair on 1 (slot, pslot)
//!   - xxcross_analyze  (CSV "pseudo_xcross_pseudo_pair"):search_2,+ XC2 prune
//!   - xxxcross_analyze (CSV "pseudo_xxcross_pseudo_pair"):search_3,+ XC3 + 2-subset Aux
//!   - xxxxcross_analyze(CSV "pseudo_xxxcross_pseudo_pair"):search_4,+ XC4 + 3-subset Aux
//!
//! 与 pseudo_analyzer 的核心差异:多了 16 张 pt_pscross_ins_C_diff(C × diff 矩阵)
//! 和 16 张 pt_pspair_CE,即 corner slot/edge slot 独立可变。
//!
//! Aux 体系复用 pseudo_xxxcross_solver 的设计:E0E1/E0E2/C4C5/C4C6/E0E1E2/C4C5C6。

use std::sync::Arc;

use crate::cube_common::{
    alg_rotation, array_to_index, conj_moves_flat, rot_map, state_space, valid_moves, Move,
};
use crate::executor::bump_node_count;
use crate::move_tables::{self, MoveTable};
use crate::prune_tables::{self, PackedPruneTable};

const MAX_AUX: usize = 8;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum AuxTable {
    PsCrossE0E1,
    PsCrossE0E2,
    PsCrossC4C5,
    PsCrossC4C6,
    PsCrossE0E1E2,
    PsCrossC4C5C6,
}

#[derive(Debug, Clone, Copy)]
struct AuxState {
    table: AuxTable,
    current_idx: u32,
    current_cross_scaled: u32,
    move_mapper_idx: u8, // 0..3 valid; 4 = none
    slot_k: u8,
}

impl AuxState {
    const EMPTY: AuxState = AuxState {
        table: AuxTable::PsCrossE0E1,
        current_idx: 0,
        current_cross_scaled: 0,
        move_mapper_idx: 4,
        slot_k: 0,
    };

    #[inline]
    fn is_valid(&self) -> bool {
        self.move_mapper_idx < 4
    }
}

#[derive(Debug, Clone, Copy)]
struct ConjStateXC {
    cross: u32,
    corner: u32,
    edge: [u32; 4],
}

pub struct PseudoPairSolver {
    mt_edge: Arc<MoveTable>,
    mt_corn: Arc<MoveTable>,
    mt_edge4: Arc<MoveTable>,
    mt_edge2: Arc<MoveTable>,
    mt_edge3: Arc<MoveTable>,
    mt_corn2: Arc<MoveTable>,
    mt_corn3: Arc<MoveTable>,
    // 4 × Cross+C (per pslot)
    pt_pscross_c: [Arc<PackedPruneTable>; 4],
    // 16 × XCross InsC diff (per (slot, pslot))
    pt_pscross_ins_c_diff: [Arc<PackedPruneTable>; 16],
    // 16 × Pair CE (per (slot, pslot))
    pt_pspair_ce: [Arc<PackedPruneTable>; 16],
    // 4 × C4E (per diff,复用 pseudo 用的 base)
    pt_pscross_c4e: [Arc<PackedPruneTable>; 4],
    // Aux 表
    pt_pscross_e0e1: Arc<PackedPruneTable>,
    pt_pscross_e0e2: Arc<PackedPruneTable>,
    pt_pscross_c4c5: Arc<PackedPruneTable>,
    pt_pscross_c4c6: Arc<PackedPruneTable>,
    pt_pscross_e0e1e2: Arc<PackedPruneTable>,
    pt_pscross_c4c5c6: Arc<PackedPruneTable>,
}

impl PseudoPairSolver {
    #[cfg(not(target_arch = "wasm32"))]
    pub fn new() -> Self {
        let mtm = move_tables::instance();
        let ptm = prune_tables::instance();

        // 16 张表数组初始化用 try_into 比较啰嗦,直接逐个 clone
        let pt_pscross_c = [
            ptm.ensure_pt_pscross_c(0),
            ptm.ensure_pt_pscross_c(1),
            ptm.ensure_pt_pscross_c(2),
            ptm.ensure_pt_pscross_c(3),
        ];
        // 布局必须 edge-major(position = e*4 + c),与 C++ 一致:访问端用
        // `slot1*4 + pslot1`(slot1=edge slot,pslot1=corner pslot),所以数组下标
        // 的高位是 edge、低位是 corner。外层 e 内层 c 入栈即得 position e*4+c。
        let mut ins_vec: Vec<Arc<PackedPruneTable>> = Vec::with_capacity(16);
        for e in 0..4 {
            for c in 0..4 {
                ins_vec.push(ptm.ensure_pt_pscross_ins_c_diff(c, e));
            }
        }
        let pt_pscross_ins_c_diff: [Arc<PackedPruneTable>; 16] = ins_vec.try_into().unwrap();

        let mut ce_vec: Vec<Arc<PackedPruneTable>> = Vec::with_capacity(16);
        for e in 0..4 {
            for c in 0..4 {
                ce_vec.push(ptm.ensure_pt_pspair_ce(c, e));
            }
        }
        let pt_pspair_ce: [Arc<PackedPruneTable>; 16] = ce_vec.try_into().unwrap();

        PseudoPairSolver {
            mt_edge: mtm.ensure_edge(),
            mt_corn: mtm.ensure_corn(),
            mt_edge4: mtm.ensure_edge4(),
            mt_edge2: mtm.ensure_edge2(),
            mt_edge3: mtm.ensure_edge3(),
            mt_corn2: mtm.ensure_corn2(),
            mt_corn3: mtm.ensure_corn3(),
            pt_pscross_c,
            pt_pscross_ins_c_diff,
            pt_pspair_ce,
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

    /// 翻译 C++ `get_rotated_indices`:从 SOLVED 起跑 alg(physical moves),得到
    /// (idx1=cross_idx*24, idx2=corner state, idx3=edge state)。
    /// `s1`/`ps1` 是边/角槽位编号,起始 idx2 = corner_index[ps1],idx3 = single_edge_index[s1]。
    fn get_rotated_indices(&self, alg: &[u8], s1: usize, ps1: usize) -> (u32, u32, u32) {
        // edge_index 都是 CROSS_SOLVED * 24(已乘 stride)的常量
        let mt_e4 = self.mt_edge4.as_u32();
        let mt_c = self.mt_corn.as_u32();
        let mt_e = self.mt_edge.as_u32();

        let single_edge_index: [u32; 4] = [0, 2, 4, 6];
        let corner_index: [u32; 4] = [12, 15, 18, 21];

        let mut idx1: u32 = state_space::CROSS_SOLVED as u32 * 24; // = state_space::CROSS_SOLVED * 24
        let mut idx2: u32 = corner_index[ps1];
        let mut idx3: u32 = single_edge_index[s1];

        for &m in alg {
            let m = m as usize;
            idx1 = mt_e4[(idx1 as usize) + m];
            idx2 = mt_c[(idx2 as usize) * 18 + m];
            idx3 = mt_e[(idx3 as usize) * 18 + m];
        }
        (idx1, idx2, idx3)
    }

    /// 翻译 C++ `get_conj_state_xc`:在 pslot 视角下推 alg,得到 (cross, corner, 4 edges)。
    fn get_conj_state_xc(&self, alg: &[u8], pslot: usize) -> ConjStateXC {
        let mt_e4 = self.mt_edge4.as_u32();
        let mt_c = self.mt_corn.as_u32();
        let mt_e = self.mt_edge.as_u32();
        let cj = conj_moves_flat();

        let mut cur_mul: u32 =
            state_space::CROSS_SOLVED as u32 * state_space::CORNER as u32;
        let mut cur_cn: u32 = 12; // C4 起始
        let mut cur_e: [u32; 4] = [0, 2, 4, 6];

        for &m in alg {
            let mc = cj[m as usize][pslot] as usize;
            cur_mul = mt_e4[(cur_mul as usize) + mc];
            cur_cn = mt_c[(cur_cn as usize) * 18 + mc];
            for k in 0..4 {
                cur_e[k] = mt_e[(cur_e[k] as usize) * 18 + mc];
            }
        }
        ConjStateXC {
            cross: cur_mul,
            corner: cur_cn,
            edge: cur_e,
        }
    }

    // --- Aux setup: search_3 (Corner2 + Edge2,2-subset)---
    fn setup_aux_pruners_for_search3(
        &self,
        pslot1: usize,
        slot2: usize,
        slot3: usize,
        pslot2: usize,
        pslot3: usize,
        alg: &[u8],
    ) -> ([AuxState; MAX_AUX], usize) {
        let mut out = [AuxState::EMPTY; MAX_AUX];
        let mut count = 0usize;
        let slot_k = pslot1;
        let mt_e4 = self.mt_edge4.as_u32();
        let cj = conj_moves_flat();
        let rm = rot_map();
        let virt_cross =
            state_space::CROSS_SOLVED as u32 * state_space::CORNER as u32;

        // 1. Corner2
        {
            let r1 = (((pslot2 as i32 - slot_k as i32 + 4) & 3) + 4) as u32;
            let r2 = (((pslot3 as i32 - slot_k as i32 + 4) & 3) + 4) as u32;
            let (k1, k2) = if r1 < r2 { (r1, r2) } else { (r2, r1) };
            let is_diag = k2.wrapping_sub(k1) == 2;
            let table = if is_diag { AuxTable::PsCrossC4C6 } else { AuxTable::PsCrossC4C5 };
            let (rot_idx, target): (usize, [i32; 2]) = if is_diag {
                let rot = if k1 == 4 { 0 } else { 3 };
                (rot, [12, 18])
            } else {
                let rot = match (k1, k2) {
                    (4, 5) => 0,
                    (4, 7) => 1,
                    (6, 7) => 2,
                    (5, 6) => 3,
                    _ => 0,
                };
                (rot, [12, 15])
            };
            let mapper = &rm[rot_idx];
            let mt = self.aux_mt(table);
            let init_idx = array_to_index(&target, 2, 3, 8) as u32;
            let mut cur = init_idx;
            let mut cur_cr = virt_cross;
            for &m in alg {
                let m_conj = cj[m as usize][slot_k] as usize;
                let m_rot = mapper[m_conj] as usize;
                cur = mt[(cur as usize) * 18 + m_rot];
                cur_cr = mt_e4[(cur_cr as usize) + m_rot];
            }
            out[count] = AuxState {
                table,
                current_idx: cur,
                current_cross_scaled: cur_cr,
                move_mapper_idx: rot_idx as u8,
                slot_k: slot_k as u8,
            };
            count += 1;
        }

        // 2. Edge2
        {
            let r1 = ((slot2 as i32 - slot_k as i32 + 4) & 3) as u32;
            let r2 = ((slot3 as i32 - slot_k as i32 + 4) & 3) as u32;
            let (k1, k2) = if r1 < r2 { (r1, r2) } else { (r2, r1) };
            let is_diag = k2.wrapping_sub(k1) == 2;
            let table = if is_diag { AuxTable::PsCrossE0E2 } else { AuxTable::PsCrossE0E1 };
            let (rot_idx, target): (usize, [i32; 2]) = if is_diag {
                let rot = if k1 == 0 { 0 } else { 1 };
                (rot, [0, 4])
            } else {
                let rot = match (k1, k2) {
                    (0, 1) => 0,
                    (0, 3) => 1,
                    (2, 3) => 2,
                    (1, 2) => 3,
                    _ => 0,
                };
                (rot, [0, 2])
            };
            let mapper = &rm[rot_idx];
            let mt = self.aux_mt(table);
            let init_idx = array_to_index(&target, 2, 2, 12) as u32;
            let mut cur = init_idx;
            let mut cur_cr = virt_cross;
            for &m in alg {
                let m_conj = cj[m as usize][slot_k] as usize;
                let m_rot = mapper[m_conj] as usize;
                cur = mt[(cur as usize) * 18 + m_rot];
                cur_cr = mt_e4[(cur_cr as usize) + m_rot];
            }
            out[count] = AuxState {
                table,
                current_idx: cur,
                current_cross_scaled: cur_cr,
                move_mapper_idx: rot_idx as u8,
                slot_k: slot_k as u8,
            };
            count += 1;
        }
        (out, count)
    }

    // --- Aux setup: search_4 (Corner3 + Edge3,3-subset)---
    fn setup_aux_pruners_for_search4(
        &self,
        pslot1: usize,
        slot2: usize,
        slot3: usize,
        slot4: usize,
        pslot2: usize,
        pslot3: usize,
        pslot4: usize,
        alg: &[u8],
    ) -> ([AuxState; MAX_AUX], usize) {
        let mut out = [AuxState::EMPTY; MAX_AUX];
        let mut count = 0usize;
        let slot_k = pslot1;
        let mt_e4 = self.mt_edge4.as_u32();
        let cj = conj_moves_flat();
        let rm = rot_map();
        let virt_cross =
            state_space::CROSS_SOLVED as u32 * state_space::CORNER as u32;

        // 1. Corner3
        {
            let r1 = (((pslot2 as i32 - slot_k as i32 + 4) & 3) + 4) as u32;
            let r2 = (((pslot3 as i32 - slot_k as i32 + 4) & 3) + 4) as u32;
            let r3 = (((pslot4 as i32 - slot_k as i32 + 4) & 3) + 4) as u32;
            let mut keys = [r1, r2, r3];
            keys.sort();
            let rot_idx = match (keys[0], keys[1], keys[2]) {
                (4, 5, 6) => 0,
                (4, 5, 7) => 1,
                (4, 6, 7) => 2,
                (5, 6, 7) => 3,
                _ => 0,
            };
            let mapper = &rm[rot_idx];
            let target: [i32; 3] = [12, 15, 18];
            let init_idx = array_to_index(&target, 3, 3, 8) as u32;
            let mt = self.aux_mt(AuxTable::PsCrossC4C5C6);
            let mut cur = init_idx;
            let mut cur_cr = virt_cross;
            for &m in alg {
                let m_conj = cj[m as usize][slot_k] as usize;
                let m_rot = mapper[m_conj] as usize;
                cur = mt[(cur as usize) * 18 + m_rot];
                cur_cr = mt_e4[(cur_cr as usize) + m_rot];
            }
            out[count] = AuxState {
                table: AuxTable::PsCrossC4C5C6,
                current_idx: cur,
                current_cross_scaled: cur_cr,
                move_mapper_idx: rot_idx as u8,
                slot_k: slot_k as u8,
            };
            count += 1;
        }

        // 2. Edge3
        {
            let r1 = ((slot2 as i32 - slot_k as i32 + 4) & 3) as u32;
            let r2 = ((slot3 as i32 - slot_k as i32 + 4) & 3) as u32;
            let r3 = ((slot4 as i32 - slot_k as i32 + 4) & 3) as u32;
            let mut keys = [r1, r2, r3];
            keys.sort();
            let rot_idx = match (keys[0], keys[1], keys[2]) {
                (0, 1, 2) => 0,
                (0, 1, 3) => 1,
                (0, 2, 3) => 2,
                (1, 2, 3) => 3,
                _ => 0,
            };
            let mapper = &rm[rot_idx];
            let target: [i32; 3] = [0, 2, 4];
            let init_idx = array_to_index(&target, 3, 2, 12) as u32;
            let mt = self.aux_mt(AuxTable::PsCrossE0E1E2);
            let mut cur = init_idx;
            let mut cur_cr = virt_cross;
            for &m in alg {
                let m_conj = cj[m as usize][slot_k] as usize;
                let m_rot = mapper[m_conj] as usize;
                cur = mt[(cur as usize) * 18 + m_rot];
                cur_cr = mt_e4[(cur_cr as usize) + m_rot];
            }
            out[count] = AuxState {
                table: AuxTable::PsCrossE0E1E2,
                current_idx: cur,
                current_cross_scaled: cur_cr,
                move_mapper_idx: rot_idx as u8,
                slot_k: slot_k as u8,
            };
            count += 1;
        }
        (out, count)
    }

    // --- search_1: Cross + Pair on 1 slot ---
    fn search_1(
        &self,
        i1: usize, i2: usize, i3: usize,
        depth: u32, prev: u8,
        prune1: &PackedPruneTable, edge_prune: &PackedPruneTable,
    ) -> bool {
        let (vmoves, vcnt) = valid_moves();
        let count = vcnt[prev as usize] as usize;
        let row = &vmoves[prev as usize];
        let mt_e4 = self.mt_edge4.as_u32();
        let mt_c = self.mt_corn.as_u32();
        let mt_e = self.mt_edge.as_u32();

        let mut local: u64 = 0;
        for k in 0..count {
            let i = row[k] as usize;
            local += 1;
            let n1 = mt_e4[i1 + i] as usize;
            let n2 = mt_c[i2 + i] as usize;
            let p1 = prune1.get((n1 + n2) as u64) as u32;
            if p1 >= depth {
                continue;
            }
            let n3 = mt_e[i3 + i] as usize;
            let pe = edge_prune.get((n3 * 24 + n2) as u64) as u32;
            if pe >= depth {
                continue;
            }
            if depth == 1 {
                if p1 == 0 && pe == 0 {
                    bump_node_count(local);
                    return true;
                }
            } else if self.search_1(n1, n2 * 18, n3 * 18, depth - 1, i as u8, prune1, edge_prune) {
                bump_node_count(local);
                return true;
            }
        }
        bump_node_count(local);
        false
    }

    // --- search_2: + XC2 prune ---
    #[allow(clippy::too_many_arguments)]
    fn search_2(
        &self,
        i1: usize, i2: usize, i4: usize, i5: usize, i6: usize,
        depth: u32, prev: u8,
        pslot2: usize,
        prune1: &PackedPruneTable, edge_prune1: &PackedPruneTable,
        prune_xc2: &PackedPruneTable,
        xc2_cr: usize, xc2_cn: usize,
        xc2_e0: usize, xc2_e1: usize, xc2_e2: usize, xc2_e3: usize,
        diff2: u32,
        edge_solved2: u32,
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
            let i = row[k] as usize;
            local += 1;
            // 1. XC2 conj
            let mc = cj[i][pslot2] as usize;
            let xc2_cr_n = mt_e4[xc2_cr + mc] as usize;
            let xc2_cn_n = mt_c[xc2_cn + mc] as usize;
            let xc2_e_n: [usize; 4] = [
                mt_e[xc2_e0 + mc] as usize,
                mt_e[xc2_e1 + mc] as usize,
                mt_e[xc2_e2 + mc] as usize,
                mt_e[xc2_e3 + mc] as usize,
            ];
            let xc2_e_sel = xc2_e_n[diff2 as usize];
            let idx_xc2: u64 = (xc2_cr_n as u64 + xc2_cn_n as u64) * 24 + xc2_e_sel as u64;
            let p_xc2 = prune_xc2.get(idx_xc2) as u32;
            if p_xc2 >= depth {
                continue;
            }

            // 2. prune1
            let n1 = mt_e4[i1 + i] as usize;
            let n2 = mt_c[i2 + i] as usize;
            let p1 = prune1.get((n1 + n2) as u64) as u32;
            if p1 >= depth {
                continue;
            }
            let n4 = mt_c[i4 + i] as usize;
            // 3. edge_prune1
            let n5 = mt_e[i5 + i] as usize;
            let pe1 = edge_prune1.get((n5 * 24 + n2) as u64) as u32;
            if pe1 >= depth {
                continue;
            }
            let n6 = mt_e[i6 + i] as usize;
            if depth == 1 {
                if p1 == 0 && pe1 == 0 && p_xc2 == 0 && n6 as u32 == edge_solved2 {
                    bump_node_count(local);
                    return true;
                }
            } else if self.search_2(
                n1, n2 * 18, n4 * 18, n5 * 18, n6 * 18,
                depth - 1, i as u8, pslot2,
                prune1, edge_prune1, prune_xc2,
                xc2_cr_n, xc2_cn_n * 18,
                xc2_e_n[0] * 18, xc2_e_n[1] * 18,
                xc2_e_n[2] * 18, xc2_e_n[3] * 18,
                diff2, edge_solved2,
            ) {
                bump_node_count(local);
                return true;
            }
        }
        bump_node_count(local);
        false
    }

    // --- search_3: + XC3 + 2-subset Aux ---
    #[allow(clippy::too_many_arguments)]
    fn search_3(
        &self,
        i1: usize, i2: usize, i7: usize, i8: usize, i9: usize,
        depth: u32, prev: u8,
        pslot3: usize,
        prune1: &PackedPruneTable, edge_prune1: &PackedPruneTable,
        prune_xc3: &PackedPruneTable,
        num_aux: usize, aux_states: &[AuxState; MAX_AUX],
        xc3_cr: usize, xc3_cn: usize,
        xc3_e0: usize, xc3_e1: usize, xc3_e2: usize, xc3_e3: usize,
        diff3: u32,
        edge_solved2: u32, edge_solved3: u32,
    ) -> bool {
        let (vmoves, vcnt) = valid_moves();
        let count = vcnt[prev as usize] as usize;
        let row = &vmoves[prev as usize];
        let mt_e4 = self.mt_edge4.as_u32();
        let mt_c = self.mt_corn.as_u32();
        let mt_e = self.mt_edge.as_u32();
        let cj = conj_moves_flat();
        let rm = rot_map();

        let mut local: u64 = 0;
        for k in 0..count {
            let i = row[k] as usize;
            local += 1;

            let n1 = mt_e4[i1 + i] as usize;
            let cross_state_idx = (n1 / 24) as u64;

            // Aux pruning
            let mut aux_pruned = false;
            let mut next_aux = [AuxState::EMPTY; MAX_AUX];
            for a in 0..num_aux {
                let cur = &aux_states[a];
                if !cur.is_valid() {
                    continue;
                }
                let mapper = &rm[cur.move_mapper_idx as usize];
                let m_conj = cj[i][cur.slot_k as usize] as usize;
                let m_rot = mapper[m_conj] as usize;
                let mt_aux = self.aux_mt(cur.table);
                let n_idx = mt_aux[(cur.current_idx as usize) * 18 + m_rot];
                let n_cr = mt_e4[(cur.current_cross_scaled as usize) + m_rot];
                let lookup_cross = (n_cr / 24) as u64;
                let idx_aux: u64 = lookup_cross * Self::aux_multiplier(cur.table) as u64 + n_idx as u64;
                if self.aux_pt(cur.table).get(idx_aux) as u32 >= depth {
                    aux_pruned = true;
                    break;
                }
                next_aux[a] = AuxState {
                    table: cur.table,
                    current_idx: n_idx,
                    current_cross_scaled: n_cr,
                    move_mapper_idx: cur.move_mapper_idx,
                    slot_k: cur.slot_k,
                };
            }
            if aux_pruned {
                let _ = cross_state_idx;
                continue;
            }

            // XC3 conj
            let mc = cj[i][pslot3] as usize;
            let xc3_cr_n = mt_e4[xc3_cr + mc] as usize;
            let xc3_cn_n = mt_c[xc3_cn + mc] as usize;
            let xc3_e_n: [usize; 4] = [
                mt_e[xc3_e0 + mc] as usize,
                mt_e[xc3_e1 + mc] as usize,
                mt_e[xc3_e2 + mc] as usize,
                mt_e[xc3_e3 + mc] as usize,
            ];
            let xc3_e_sel = xc3_e_n[diff3 as usize];
            let idx_xc3: u64 = (xc3_cr_n as u64 + xc3_cn_n as u64) * 24 + xc3_e_sel as u64;
            let p_xc3 = prune_xc3.get(idx_xc3) as u32;
            if p_xc3 >= depth {
                continue;
            }

            // prune1
            let n2 = mt_c[i2 + i] as usize;
            let p1 = prune1.get((n1 + n2) as u64) as u32;
            if p1 >= depth {
                continue;
            }
            // edge prune1
            let n7 = mt_e[i7 + i] as usize;
            let pe1 = edge_prune1.get((n7 * 24 + n2) as u64) as u32;
            if pe1 >= depth {
                continue;
            }
            let n8 = mt_e[i8 + i] as usize;
            let n9 = mt_e[i9 + i] as usize;
            if depth == 1 {
                if p1 == 0 && pe1 == 0 && p_xc3 == 0 && n8 as u32 == edge_solved2 && n9 as u32 == edge_solved3 {
                    bump_node_count(local);
                    return true;
                }
            } else if self.search_3(
                n1, n2 * 18, n7 * 18, n8 * 18, n9 * 18,
                depth - 1, i as u8, pslot3,
                prune1, edge_prune1, prune_xc3,
                num_aux, &next_aux,
                xc3_cr_n, xc3_cn_n * 18,
                xc3_e_n[0] * 18, xc3_e_n[1] * 18,
                xc3_e_n[2] * 18, xc3_e_n[3] * 18,
                diff3, edge_solved2, edge_solved3,
            ) {
                bump_node_count(local);
                return true;
            }
        }
        bump_node_count(local);
        false
    }

    // --- search_4: + XC4 + 3-subset Aux ---
    #[allow(clippy::too_many_arguments)]
    fn search_4(
        &self,
        i1: usize, i2: usize, i4: usize, i6: usize, i8: usize,
        i9: usize, i10: usize, i11: usize, i12: usize,
        depth: u32, prev: u8,
        pslot4: usize,
        prune1: &PackedPruneTable, edge_prune1: &PackedPruneTable,
        prune_xc4: &PackedPruneTable,
        num_aux: usize, aux_states: &[AuxState; MAX_AUX],
        xc4_cr: usize, xc4_cn: usize,
        xc4_e0: usize, xc4_e1: usize, xc4_e2: usize, xc4_e3: usize,
        diff4: u32,
        edge_solved2: u32, edge_solved3: u32, edge_solved4: u32,
    ) -> bool {
        let (vmoves, vcnt) = valid_moves();
        let count = vcnt[prev as usize] as usize;
        let row = &vmoves[prev as usize];
        let mt_e4 = self.mt_edge4.as_u32();
        let mt_c = self.mt_corn.as_u32();
        let mt_e = self.mt_edge.as_u32();
        let cj = conj_moves_flat();
        let rm = rot_map();

        let mut local: u64 = 0;
        for k in 0..count {
            let i = row[k] as usize;
            local += 1;

            let n1 = mt_e4[i1 + i] as usize;
            let cross_state_idx = (n1 / 24) as u64;

            // Aux
            let mut aux_pruned = false;
            let mut next_aux = [AuxState::EMPTY; MAX_AUX];
            for a in 0..num_aux {
                let cur = &aux_states[a];
                if !cur.is_valid() {
                    continue;
                }
                let mapper = &rm[cur.move_mapper_idx as usize];
                let m_conj = cj[i][cur.slot_k as usize] as usize;
                let m_rot = mapper[m_conj] as usize;
                let mt_aux = self.aux_mt(cur.table);
                let n_idx = mt_aux[(cur.current_idx as usize) * 18 + m_rot];
                let n_cr = mt_e4[(cur.current_cross_scaled as usize) + m_rot];
                let lookup_cross = (n_cr / 24) as u64;
                let idx_aux: u64 = lookup_cross * Self::aux_multiplier(cur.table) as u64 + n_idx as u64;
                if self.aux_pt(cur.table).get(idx_aux) as u32 >= depth {
                    aux_pruned = true;
                    break;
                }
                next_aux[a] = AuxState {
                    table: cur.table,
                    current_idx: n_idx,
                    current_cross_scaled: n_cr,
                    move_mapper_idx: cur.move_mapper_idx,
                    slot_k: cur.slot_k,
                };
            }
            if aux_pruned {
                let _ = cross_state_idx;
                continue;
            }

            let n2 = mt_c[i2 + i] as usize;

            // XC4 conj
            let mc = cj[i][pslot4] as usize;
            let xc4_cr_n = mt_e4[xc4_cr + mc] as usize;
            let xc4_cn_n = mt_c[xc4_cn + mc] as usize;
            let xc4_e_n: [usize; 4] = [
                mt_e[xc4_e0 + mc] as usize,
                mt_e[xc4_e1 + mc] as usize,
                mt_e[xc4_e2 + mc] as usize,
                mt_e[xc4_e3 + mc] as usize,
            ];
            let xc4_e_sel = xc4_e_n[diff4 as usize];
            let idx_xc4: u64 = (xc4_cr_n as u64 + xc4_cn_n as u64) * 24 + xc4_e_sel as u64;
            let p_xc4 = prune_xc4.get(idx_xc4) as u32;
            if p_xc4 >= depth {
                continue;
            }

            // edge_prune1 + prune1(仅 depth==1 用作验证)
            let n9 = mt_e[i9 + i] as usize;
            let pe1 = edge_prune1.get((n9 * 24 + n2) as u64) as u32;
            let p1 = prune1.get((n1 + n2) as u64) as u32;

            let n4 = mt_c[i4 + i] as usize;
            let n6 = mt_c[i6 + i] as usize;
            let n8 = mt_c[i8 + i] as usize;
            let n10 = mt_e[i10 + i] as usize;
            let n11 = mt_e[i11 + i] as usize;
            let n12 = mt_e[i12 + i] as usize;

            if depth == 1 {
                if p1 == 0 && pe1 == 0 && p_xc4 == 0
                    && n10 as u32 == edge_solved2
                    && n11 as u32 == edge_solved3
                    && n12 as u32 == edge_solved4
                {
                    bump_node_count(local);
                    return true;
                }
            } else if self.search_4(
                n1, n2 * 18, n4 * 18, n6 * 18, n8 * 18,
                n9 * 18, n10 * 18, n11 * 18, n12 * 18,
                depth - 1, i as u8, pslot4,
                prune1, edge_prune1, prune_xc4,
                num_aux, &next_aux,
                xc4_cr_n, xc4_cn_n * 18,
                xc4_e_n[0] * 18, xc4_e_n[1] * 18,
                xc4_e_n[2] * 18, xc4_e_n[3] * 18,
                diff4, edge_solved2, edge_solved3, edge_solved4,
            ) {
                bump_node_count(local);
                return true;
            }
        }
        bump_node_count(local);
        false
    }

    // --- xcross_analyze: 4×4 (slot, pslot) 组合 × 6 视角 ---
    fn xcross_analyze(&self, base_alg: &[u8], rotations: &[&str]) -> Vec<u32> {
        let mut min_xc = vec![u32::MAX; rotations.len()];

        for slot1 in 0..4 {
            for pslot1 in 0..4 {
                let idx = slot1 * 4 + pslot1;
                let prune1 = &self.pt_pscross_ins_c_diff[idx];
                let edge_prune = &self.pt_pspair_ce[idx];

                let single_edge_index: [u32; 4] = [0, 2, 4, 6];

                // Per-rotation task ordering
                struct Task { rot_idx: usize, h: u32 }
                let mut tasks: Vec<Task> = Vec::with_capacity(rotations.len());
                for (r, rot) in rotations.iter().enumerate() {
                    let mut a: Vec<u8> = base_alg.to_vec();
                    alg_rotation(&mut a, rot);
                    let (idx1, idx2, idx3) = self.get_rotated_indices(&a, slot1, pslot1);
                    let h1 = prune1.get((idx1 + idx2) as u64) as u32;
                    let h2 = edge_prune.get((idx3 * 24 + idx2) as u64) as u32;
                    tasks.push(Task { rot_idx: r, h: h1.max(h2) });
                }
                tasks.sort_by_key(|t| t.h);

                for t in &tasks {
                    let r = t.rot_idx;
                    let cur_best = min_xc[r];
                    if t.h >= cur_best {
                        continue;
                    }
                    let max_depth = std::cmp::min(20, cur_best.saturating_sub(1));
                    let mut a: Vec<u8> = base_alg.to_vec();
                    alg_rotation(&mut a, rotations[r]);
                    let (idx1, idx2, idx3) = self.get_rotated_indices(&a, slot1, pslot1);
                    let p1_tmp = prune1.get((idx1 + idx2) as u64) as u32;
                    let pe_tmp = edge_prune.get((idx3 * 24 + idx2) as u64) as u32;
                    if p1_tmp == 0 && pe_tmp == 0 {
                        min_xc[r] = 0;
                        let _ = single_edge_index;
                        continue;
                    }
                    let start_d = std::cmp::max(p1_tmp, pe_tmp);
                    for d in start_d..=max_depth {
                        if self.search_1(
                            idx1 as usize,
                            (idx2 as usize) * 18,
                            (idx3 as usize) * 18,
                            d,
                            18,
                            prune1,
                            edge_prune,
                        ) {
                            min_xc[r] = d;
                            break;
                        }
                    }
                }
            }
        }
        min_xc
    }

    // --- xxcross_analyze: 4×4×3×3 (slot2, pslot2, slot1, pslot1) 配置 ---
    fn xxcross_analyze(&self, base_alg: &[u8], rotations: &[&str], min_xc: &[u32]) -> Vec<u32> {
        let mut min_xxc = vec![u32::MAX; rotations.len()];
        let single_edge_index: [u32; 4] = [0, 2, 4, 6];

        for slot2 in 0..4 {
            for pslot2 in 0..4 {
                for slot1 in 0..4 {
                    if slot1 == slot2 {
                        continue;
                    }
                    for pslot1 in 0..4 {
                        if pslot1 == pslot2 {
                            continue;
                        }
                        let prune1 = &self.pt_pscross_ins_c_diff[slot1 * 4 + pslot1];
                        let _prune2 = &self.pt_pscross_c[pslot2]; // 仅启发计算用
                        let edge_prune1 = &self.pt_pspair_ce[slot1 * 4 + pslot1];

                        let diff2 = ((slot2 as i32 - pslot2 as i32 + 4) & 3) as u32;
                        let prune_xc2 = &self.pt_pscross_c4e[diff2 as usize];

                        struct Task { rot_idx: usize, h: u32 }
                        let mut tasks: Vec<Task> = Vec::with_capacity(rotations.len());
                        for (r, rot) in rotations.iter().enumerate() {
                            let mut a: Vec<u8> = base_alg.to_vec();
                            alg_rotation(&mut a, rot);
                            let (idx1, idx2, idx5) =
                                self.get_rotated_indices(&a, slot1, pslot1);
                            let (_, idx4, _) =
                                self.get_rotated_indices(&a, slot2, pslot2);
                            let h1 = prune1.get((idx1 + idx2) as u64) as u32;
                            let h2 = _prune2.get((idx1 + idx4) as u64) as u32;
                            let h3 = edge_prune1.get((idx5 * 24 + idx2) as u64) as u32;
                            let st = self.get_conj_state_xc(&a, pslot2);
                            let conj_idx_xc2: u64 =
                                (st.cross as u64 + st.corner as u64) * 24
                                    + st.edge[diff2 as usize] as u64;
                            let h4 = prune_xc2.get(conj_idx_xc2) as u32;
                            tasks.push(Task { rot_idx: r, h: h1.max(h2).max(h3).max(h4) });
                        }
                        tasks.sort_by_key(|t| t.h);

                        for t in &tasks {
                            let r = t.rot_idx;
                            let cur_best = min_xxc[r];
                            if t.h >= cur_best {
                                continue;
                            }
                            let max_depth = std::cmp::min(20, cur_best.saturating_sub(1));
                            let mut a: Vec<u8> = base_alg.to_vec();
                            alg_rotation(&mut a, rotations[r]);
                            let (idx1, idx2, idx5) =
                                self.get_rotated_indices(&a, slot1, pslot1);
                            let (_, idx4, idx6) =
                                self.get_rotated_indices(&a, slot2, pslot2);
                            let edge_solved2 = single_edge_index[slot2];
                            let p1_tmp = prune1.get((idx1 + idx2) as u64) as u32;
                            let p2_tmp = _prune2.get((idx1 + idx4) as u64) as u32;
                            let pe_tmp = edge_prune1.get((idx5 * 24 + idx2) as u64) as u32;
                            let st = self.get_conj_state_xc(&a, pslot2);
                            let conj_idx_xc2: u64 =
                                (st.cross as u64 + st.corner as u64) * 24
                                    + st.edge[diff2 as usize] as u64;
                            let pxc2_tmp = prune_xc2.get(conj_idx_xc2) as u32;
                            if p1_tmp == 0 && p2_tmp == 0 && pe_tmp == 0 && pxc2_tmp == 0
                                && idx6 == edge_solved2
                            {
                                min_xxc[r] = 0;
                                continue;
                            }
                            let mut start_d =
                                p1_tmp.max(p2_tmp).max(pe_tmp).max(pxc2_tmp);
                            // 跨阶段下界
                            if min_xc[r] != u32::MAX {
                                start_d = start_d.max(min_xc[r]);
                            }
                            for d in start_d..=max_depth {
                                if self.search_2(
                                    idx1 as usize,
                                    (idx2 as usize) * 18,
                                    (idx4 as usize) * 18,
                                    (idx5 as usize) * 18,
                                    (idx6 as usize) * 18,
                                    d, 18,
                                    pslot2,
                                    prune1, edge_prune1, prune_xc2,
                                    st.cross as usize,
                                    (st.corner as usize) * 18,
                                    (st.edge[0] as usize) * 18,
                                    (st.edge[1] as usize) * 18,
                                    (st.edge[2] as usize) * 18,
                                    (st.edge[3] as usize) * 18,
                                    diff2,
                                    edge_solved2,
                                ) {
                                    min_xxc[r] = d;
                                    break;
                                }
                            }
                        }
                    }
                }
            }
        }
        min_xxc
    }

    // --- xxxcross_analyze: pairs/complements 模式 × 6 rots ---
    fn xxxcross_analyze(
        &self,
        base_alg: &[u8],
        rotations: &[&str],
        min_xxc: &[u32],
    ) -> Vec<u32> {
        let mut min_xxxc = vec![u32::MAX; rotations.len()];
        let single_edge_index: [u32; 4] = [0, 2, 4, 6];

        const PAIRS: [[usize; 2]; 6] = [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]];
        const COMPLEMENTS: [[usize; 2]; 6] = [[2, 3], [1, 3], [1, 2], [0, 3], [0, 2], [0, 1]];

        for i in 0..6 {
            for j in 0..6 {
                for ci in 0..2 {
                    let slot1 = COMPLEMENTS[i][ci];
                    for cj_ in 0..2 {
                        let pslot1 = COMPLEMENTS[j][cj_];
                        let slot2 = PAIRS[i][0];
                        let slot3 = PAIRS[i][1];
                        let pslot2 = PAIRS[j][0];
                        let pslot3 = PAIRS[j][1];

                        let prune1 = &self.pt_pscross_ins_c_diff[slot1 * 4 + pslot1];
                        let edge_prune1 = &self.pt_pspair_ce[slot1 * 4 + pslot1];

                        let diff3 = ((slot3 as i32 - pslot3 as i32 + 4) & 3) as u32;
                        let prune_xc3 = &self.pt_pscross_c4e[diff3 as usize];

                        struct Task { rot_idx: usize, h: u32 }
                        let mut tasks: Vec<Task> = Vec::with_capacity(rotations.len());
                        for (r, rot) in rotations.iter().enumerate() {
                            let mut a: Vec<u8> = base_alg.to_vec();
                            alg_rotation(&mut a, rot);
                            let (idx1, idx2, idx7) =
                                self.get_rotated_indices(&a, slot1, pslot1);
                            let h1 = prune1.get((idx1 + idx2) as u64) as u32;
                            let h4 = edge_prune1.get((idx7 * 24 + idx2) as u64) as u32;
                            let st = self.get_conj_state_xc(&a, pslot3);
                            let conj_idx_xc3: u64 =
                                (st.cross as u64 + st.corner as u64) * 24
                                    + st.edge[diff3 as usize] as u64;
                            let h5 = prune_xc3.get(conj_idx_xc3) as u32;
                            tasks.push(Task { rot_idx: r, h: h1.max(h4).max(h5) });
                        }
                        tasks.sort_by_key(|t| t.h);

                        for t in &tasks {
                            let r = t.rot_idx;
                            let cur_best = min_xxxc[r];
                            if t.h >= cur_best {
                                continue;
                            }
                            let max_depth = std::cmp::min(20, cur_best.saturating_sub(1));
                            let mut a: Vec<u8> = base_alg.to_vec();
                            alg_rotation(&mut a, rotations[r]);
                            let (idx1, idx2, idx7) =
                                self.get_rotated_indices(&a, slot1, pslot1);
                            let (_, _idx4, idx8) =
                                self.get_rotated_indices(&a, slot2, pslot2);
                            let (_, _idx6, idx9) =
                                self.get_rotated_indices(&a, slot3, pslot3);
                            let edge_solved2 = single_edge_index[slot2];
                            let edge_solved3 = single_edge_index[slot3];
                            let p1_tmp = prune1.get((idx1 + idx2) as u64) as u32;
                            let pe_tmp = edge_prune1.get((idx7 * 24 + idx2) as u64) as u32;
                            let st = self.get_conj_state_xc(&a, pslot3);
                            let conj_idx_xc3: u64 =
                                (st.cross as u64 + st.corner as u64) * 24
                                    + st.edge[diff3 as usize] as u64;
                            let pxc3_tmp = prune_xc3.get(conj_idx_xc3) as u32;

                            if p1_tmp == 0 && pe_tmp == 0 && pxc3_tmp == 0
                                && idx8 == edge_solved2 && idx9 == edge_solved3
                            {
                                min_xxxc[r] = 0;
                                continue;
                            }
                            let (aux_init, num_aux) = self.setup_aux_pruners_for_search3(
                                pslot1, slot2, slot3, pslot2, pslot3, &a,
                            );
                            let mut start_d = p1_tmp.max(pe_tmp).max(pxc3_tmp);
                            if min_xxc[r] != u32::MAX {
                                start_d = start_d.max(min_xxc[r]);
                            }
                            for d in start_d..=max_depth {
                                if self.search_3(
                                    idx1 as usize,
                                    (idx2 as usize) * 18,
                                    (idx7 as usize) * 18,
                                    (idx8 as usize) * 18,
                                    (idx9 as usize) * 18,
                                    d, 18,
                                    pslot3,
                                    prune1, edge_prune1, prune_xc3,
                                    num_aux, &aux_init,
                                    st.cross as usize,
                                    (st.corner as usize) * 18,
                                    (st.edge[0] as usize) * 18,
                                    (st.edge[1] as usize) * 18,
                                    (st.edge[2] as usize) * 18,
                                    (st.edge[3] as usize) * 18,
                                    diff3,
                                    edge_solved2, edge_solved3,
                                ) {
                                    min_xxxc[r] = d;
                                    break;
                                }
                            }
                        }
                    }
                }
            }
        }
        min_xxxc
    }

    // --- xxxxcross_analyze: 4×4 (i, j) → complement3 ---
    fn xxxxcross_analyze(
        &self,
        base_alg: &[u8],
        rotations: &[&str],
        min_xxxc: &[u32],
    ) -> Vec<u32> {
        let mut min_xxxxc = vec![u32::MAX; rotations.len()];
        let single_edge_index: [u32; 4] = [0, 2, 4, 6];
        const COMPLEMENT3: [[usize; 3]; 4] = [
            [1, 2, 3], [0, 2, 3], [0, 1, 3], [0, 1, 2],
        ];

        // i 从 3 到 0(对应 C++ 中的 for i = 3; i >= 0; --i)
        for i in (0..4).rev() {
            for j in 0..4 {
                let s_rem = COMPLEMENT3[i];
                let p_rem = COMPLEMENT3[j];
                let slot1 = i;
                let pslot1 = j;
                let slot2 = s_rem[0];
                let slot3 = s_rem[1];
                let slot4 = s_rem[2];
                let pslot2 = p_rem[0];
                let pslot3 = p_rem[1];
                let pslot4 = p_rem[2];

                let prune1 = &self.pt_pscross_ins_c_diff[slot1 * 4 + pslot1];
                let _prune2 = &self.pt_pscross_c[pslot2];
                let _prune3 = &self.pt_pscross_c[pslot3];
                let _prune4 = &self.pt_pscross_c[pslot4];
                let edge_prune1 = &self.pt_pspair_ce[slot1 * 4 + pslot1];

                let diff4 = ((slot4 as i32 - pslot4 as i32 + 4) & 3) as u32;
                let prune_xc4 = &self.pt_pscross_c4e[diff4 as usize];

                struct Task { rot_idx: usize, h: u32 }
                let mut tasks: Vec<Task> = Vec::with_capacity(rotations.len());
                for (r, rot) in rotations.iter().enumerate() {
                    let mut a: Vec<u8> = base_alg.to_vec();
                    alg_rotation(&mut a, rot);
                    let (idx1, idx2, idx9) = self.get_rotated_indices(&a, slot1, pslot1);
                    let (_, idx4, _) = self.get_rotated_indices(&a, slot2, pslot2);
                    let (_, idx6, _) = self.get_rotated_indices(&a, slot3, pslot3);
                    let (_, idx8, _) = self.get_rotated_indices(&a, slot4, pslot4);
                    let h1 = prune1.get((idx1 + idx2) as u64) as u32;
                    let h2 = _prune2.get((idx1 + idx4) as u64) as u32;
                    let h3 = _prune3.get((idx1 + idx6) as u64) as u32;
                    let h4 = _prune4.get((idx1 + idx8) as u64) as u32;
                    let h5 = edge_prune1.get((idx9 * 24 + idx2) as u64) as u32;
                    let st = self.get_conj_state_xc(&a, pslot4);
                    let conj_idx_xc4: u64 = (st.cross as u64 + st.corner as u64) * 24
                        + st.edge[diff4 as usize] as u64;
                    let h6 = prune_xc4.get(conj_idx_xc4) as u32;
                    tasks.push(Task { rot_idx: r, h: h1.max(h2).max(h3).max(h4).max(h5).max(h6) });
                }
                tasks.sort_by_key(|t| t.h);

                for t in &tasks {
                    let r = t.rot_idx;
                    let cur_best = min_xxxxc[r];
                    if t.h >= cur_best {
                        continue;
                    }
                    let max_depth = std::cmp::min(20, cur_best.saturating_sub(1));
                    let mut a: Vec<u8> = base_alg.to_vec();
                    alg_rotation(&mut a, rotations[r]);
                    let (idx1, idx2, idx9) = self.get_rotated_indices(&a, slot1, pslot1);
                    let (_, idx4, idx10) = self.get_rotated_indices(&a, slot2, pslot2);
                    let (_, idx6, idx11) = self.get_rotated_indices(&a, slot3, pslot3);
                    let (_, idx8, idx12) = self.get_rotated_indices(&a, slot4, pslot4);
                    let edge_solved2 = single_edge_index[slot2];
                    let edge_solved3 = single_edge_index[slot3];
                    let edge_solved4 = single_edge_index[slot4];
                    let p1_tmp = prune1.get((idx1 + idx2) as u64) as u32;
                    let p2_tmp = _prune2.get((idx1 + idx4) as u64) as u32;
                    let p3_tmp = _prune3.get((idx1 + idx6) as u64) as u32;
                    let p4_tmp = _prune4.get((idx1 + idx8) as u64) as u32;
                    let pe_tmp = edge_prune1.get((idx9 * 24 + idx2) as u64) as u32;
                    let st = self.get_conj_state_xc(&a, pslot4);
                    let conj_idx_xc4: u64 = (st.cross as u64 + st.corner as u64) * 24
                        + st.edge[diff4 as usize] as u64;
                    let pxc4_tmp = prune_xc4.get(conj_idx_xc4) as u32;

                    if p1_tmp == 0 && p2_tmp == 0 && p3_tmp == 0 && p4_tmp == 0
                        && pe_tmp == 0 && pxc4_tmp == 0
                        && idx10 == edge_solved2 && idx11 == edge_solved3 && idx12 == edge_solved4
                    {
                        min_xxxxc[r] = 0;
                        continue;
                    }
                    let (aux_init, num_aux) = self.setup_aux_pruners_for_search4(
                        pslot1, slot2, slot3, slot4, pslot2, pslot3, pslot4, &a,
                    );
                    let mut start_d = [p1_tmp, p2_tmp, p3_tmp, p4_tmp, pe_tmp, pxc4_tmp]
                        .iter()
                        .copied()
                        .max()
                        .unwrap();
                    if min_xxxc[r] != u32::MAX {
                        start_d = start_d.max(min_xxxc[r]);
                    }
                    for d in start_d..=max_depth {
                        if self.search_4(
                            idx1 as usize,
                            (idx2 as usize) * 18,
                            (idx4 as usize) * 18,
                            (idx6 as usize) * 18,
                            (idx8 as usize) * 18,
                            (idx9 as usize) * 18,
                            (idx10 as usize) * 18,
                            (idx11 as usize) * 18,
                            (idx12 as usize) * 18,
                            d, 18,
                            pslot4,
                            prune1, edge_prune1, prune_xc4,
                            num_aux, &aux_init,
                            st.cross as usize,
                            (st.corner as usize) * 18,
                            (st.edge[0] as usize) * 18,
                            (st.edge[1] as usize) * 18,
                            (st.edge[2] as usize) * 18,
                            (st.edge[3] as usize) * 18,
                            diff4,
                            edge_solved2, edge_solved3, edge_solved4,
                        ) {
                            min_xxxxc[r] = d;
                            break;
                        }
                    }
                }
            }
        }
        min_xxxxc
    }

    /// 整体接口:返回 24 个值(4 阶段 × 6 视角),u32::MAX 表示未找到(对外应映射为 0)。
    pub fn get_stats(&self, alg: &[Move], rotations: &[&str]) -> Vec<u32> {
        let base_alg: Vec<u8> = alg.iter().map(|m| m.index() as u8).collect();
        let xc = self.xcross_analyze(&base_alg, rotations);
        let xxc = self.xxcross_analyze(&base_alg, rotations, &xc);
        let xxxc = self.xxxcross_analyze(&base_alg, rotations, &xxc);
        let xxxxc = self.xxxxcross_analyze(&base_alg, rotations, &xxxc);
        let mut out = Vec::with_capacity(4 * rotations.len());
        for v in xc { out.push(if v == u32::MAX { 0 } else { v }); }
        for v in xxc { out.push(if v == u32::MAX { 0 } else { v }); }
        for v in xxxc { out.push(if v == u32::MAX { 0 } else { v }); }
        for v in xxxxc { out.push(if v == u32::MAX { 0 } else { v }); }
        out
    }
}

// ============================================================================
// 小表 cascade(wasm 友好,无 957MB pscross_E0E1E2 / 822MB C4C5C6 / 54MB×4 C4E)
// ----------------------------------------------------------------------------
// native PseudoPairSolver 用:
//   * 16 × pt_pscross_ins_C_diff (2.28MB 各)  —— pair 槽 cross+corner(含插入 seed)
//   * 16 × pt_pspair_CE (304B 各)             —— pair 槽 corner+edge 成对
//   * 4  × pt_pscross_C4E[diff] (54MB 各)      —— xcross 槽 cross+corner+edge 联合验证
//   * 957MB + 822MB aux                        —— search_3/4 多槽联合剪枝
// 浏览器全装不下。这里照 pair_solver / PseudoSmallSolver 小表思路:
//
//   xcross 槽:用现场 BFS 的 cross+corner 表 (PsCcPrune,~4.6MB,4 个 pseudo D 朝向 seed)
//     作可采纳下界,edge 在叶子显式验证 `ie == 2*diff`(与 PseudoSmallSolver 完全一致,
//     已对 pt_pscross_C4E 逐格 bit-exact)。
//   pair 槽:现场 BFS 重建 4 个 diff-canonical 的 ins_c_diff (cross+corner,含插入 seed)
//     和 4 个 diff-canonical 的 pspair (corner+edge,含成对 seed),用 corner 槽视角(共轭)
//     追踪 ⇒ corner 固定 C4、edge 起点 2*diff,等价于大表 16 张里同 diff 的那张。
//     pruning + 叶子 `ins==0 && pspair==0` 与大表完全一致。
//
// 等价性:每个 (pair 槽 + N 个 xcross 槽) 的 task 用「显式逐槽追踪」,任一槽下界 ≥ depth
// 即剪;叶子要求 pair 槽 (ins==0 && pspair==0) 且 N 个 xcross 槽 (cross+corner==0 且
// edge==2*diff)。所有下界均可采纳 ⇒ IDA* 首达深度即最优 ⇒ 与大表逐格 bit-exact,仅访问
// 更多节点。stage 列序、rots、min over task 集与 analyzer 完全一致(取所有合法槽位指派的 min)。
//
// 所需服务表(全小):mt_edge4 (~17MB) / mt_corn (~1.7KB) / mt_edge (~1.7KB)。其余全部现场
// BFS 建,不服任何 >60MB 的表。

use crate::cube_common::string_to_alg;

const PSCC_BFS_DEPTH: u8 = 12;

/// cross+corner 表(共享,xcross 槽用)。seed = 4 个 pseudo D 朝向的 (cross_solved, C4)。
/// tbl[(cross_idx)*24 + corner],值 = BFS 距离(255 = 超 BFS_DEPTH,仍是可采纳下界)。
/// 与 pseudo_xcross_solver::PsCcPrune 同构(自包含,不跨模块借)。
struct PpCcPrune {
    tbl: Vec<u8>,
}

impl PpCcPrune {
    fn build(mt_edge4: &[u32], mt_corn: &[u32]) -> Self {
        let nc = state_space::CORNER; // 24
        let size = state_space::CROSS * nc;
        let mut tbl = vec![255u8; size];
        let cross0 = state_space::CROSS_SOLVED * 24;
        let corn0 = 12usize; // C4
        let d_moves = [usize::MAX, 3, 4, 5];
        for (k, &mv) in d_moves.iter().enumerate() {
            let (im, ic) = if k == 0 {
                (cross0, corn0)
            } else {
                (mt_edge4[cross0 + mv] as usize, mt_corn[corn0 * 18 + mv] as usize)
            };
            tbl[im + ic] = 0;
        }
        for d in 0..PSCC_BFS_DEPTH {
            for i in 0..size {
                if tbl[i] != d {
                    continue;
                }
                let im = (i / nc) * 24;
                let ic18 = (i % nc) * 18;
                for j in 0..18 {
                    let ni = mt_edge4[im + j] as usize + mt_corn[ic18 + j] as usize;
                    if tbl[ni] == 255 {
                        tbl[ni] = d + 1;
                    }
                }
            }
        }
        PpCcPrune { tbl }
    }

    #[inline]
    fn h(&self, im: u32, ic: u32) -> u32 {
        self.tbl[(im as usize) + (ic as usize)] as u32
    }
}

/// pair 槽 cross+corner 表(含插入 seed),diff-canonical(corner=C4=12,edge slot=diff)。
/// 复刻 prune_create::create_pt_pscross_ins_c,但 corner 固定 C4。size = CROSS*CORNER。
/// tbl[cross_idx*24 + corner],值 = BFS 距离(255 = 未填,仍是可采纳下界)。
struct PpInsPrune {
    tbl: Vec<u8>,
}

const PP_INS_BFS_DEPTH: u8 = 11;

impl PpInsPrune {
    /// diff = edge slot 相对 corner(0..3)。edge_index = 2*diff,corner_index = 12(C4)。
    fn build(diff: usize, mt_edge4: &[u32], mt_corn: &[u32]) -> Self {
        let nc = state_space::CORNER; // 24
        let size = state_space::CROSS * nc;
        let mut tbl = vec![255u8; size];

        let index3 = (2 * diff) as u64; // EDGE_INDICES[diff]
        let index2: usize = 12; // CORNER_INDICES[0] = C4
        // 与 create_pt_pscross_ins_c 完全一致的 seed 选择
        let (am, tmp_moves): (&[&str], &[i32]) = match index3 {
            0 => (&["L U L'", "L U' L'", "B' U B", "B' U' B"], &[0, 3, 4, 5]),
            2 => (&["R' U R", "R' U' R", "B U B'", "B U' B'"], &[5, 0, 3, 4]),
            4 => (&["R U R'", "R U' R'", "F' U F", "F' U' F"], &[4, 5, 0, 3]),
            6 => (&["L' U L", "L' U' L", "F U F'", "F U' F'"], &[3, 4, 5, 0]),
            _ => unreachable!(),
        };

        let a = [16i32, 18, 20, 22];
        let index1 = array_to_index(&a, 4, 2, 12) as usize; // cross idx
        let im0 = index1 * 24; // mt_edge4 形式(值已 ×24)
        let total = size;
        // 主 seed
        tbl[im0 + index2] = 0;
        for k in 3..=5usize {
            let ni = mt_edge4[im0 + k] as usize + mt_corn[index2 * 18 + k] as usize;
            if ni < total {
                tbl[ni] = 0;
            }
        }

        let sel = (index2 / 3 - 4) as usize; // = 0 (C4)
        for i in 0..4 {
            let mut i1 = im0; // cross*24
            let mut i2 = index2;
            let mv0 = tmp_moves[sel] as usize;
            i1 = mt_edge4[i1 + mv0] as usize;
            i2 = mt_corn[i2 * 18 + mv0] as usize;
            for m in string_to_alg(am[i]) {
                i1 = mt_edge4[i1 + m.index()] as usize;
                i2 = mt_corn[i2 * 18 + m.index()] as usize;
            }
            let ni = i1 + i2;
            if ni < total {
                tbl[ni] = 0;
            }
            for k in 3..=5usize {
                let ni2 = mt_edge4[i1 + k] as usize + mt_corn[i2 * 18 + k] as usize;
                if ni2 < total {
                    tbl[ni2] = 0;
                }
                let ni3 = mt_edge4[(mt_edge4[i1] as usize) + k] as usize
                    + mt_corn[(mt_corn[i2 * 18] as usize) * 18 + k] as usize;
                if ni3 < total {
                    tbl[ni3] = 0;
                }
            }
            for off in [1usize, 2] {
                let base1 = mt_edge4[i1 + off] as usize;
                let base2 = mt_corn[i2 * 18 + off] as usize;
                let ni_a = base1 + base2;
                if ni_a < total {
                    tbl[ni_a] = 0;
                }
                for k in 3..=5usize {
                    let ni_b = mt_edge4[base1 + k] as usize + mt_corn[base2 * 18 + k] as usize;
                    if ni_b < total {
                        tbl[ni_b] = 0;
                    }
                }
            }
        }

        for d in 0..PP_INS_BFS_DEPTH {
            for i in 0..size {
                if tbl[i] != d {
                    continue;
                }
                let im = (i / nc) * 24;
                let ic18 = (i % nc) * 18;
                for j in 0..18 {
                    let ni = mt_edge4[im + j] as usize + mt_corn[ic18 + j] as usize;
                    if ni < total && tbl[ni] == 255 {
                        tbl[ni] = d + 1;
                    }
                }
            }
        }
        PpInsPrune { tbl }
    }

    /// im = mt_edge4 值(cross_idx*24),ic = corner 0..23。
    #[inline]
    fn h(&self, im: u32, ic: u32) -> u32 {
        self.tbl[(im as usize) + (ic as usize)] as u32
    }
}

/// pair 槽 corner+edge 成对表,diff-canonical(corner=C4=12,edge=2*diff)。
/// 复刻 prune_create::create_pt_pspair。size = EDGE(24)*CORNER(24) = 576。
/// tbl[edge*24 + corner],值 = BFS 距离。
struct PpPairPrune {
    tbl: Vec<u8>,
}

const PP_PAIR_BFS_DEPTH: u8 = 8;

impl PpPairPrune {
    fn build(diff: usize, mt_edge: &[u32], mt_corn: &[u32]) -> Self {
        let size2 = state_space::CORNER; // 24
        let total = state_space::EDGE * size2; // 576
        let index1 = (2 * diff) as usize; // EDGE_INDICES[diff]
        let index2: usize = 12; // C4
        let mut tbl = vec![255u8; total];

        tbl[index1 * size2 + index2] = 0;
        for k in 3..=5usize {
            let n_ed = mt_edge[index1 * 18 + k] as usize;
            let n_cn = mt_corn[index2 * 18 + k] as usize;
            tbl[n_ed * size2 + n_cn] = 0;
        }
        let (am, tmp_moves): (&[&str], &[i32]) = match index1 {
            0 => (&["L U L'", "L U' L'", "B' U B", "B' U' B"], &[0, 3, 4, 5]),
            2 => (&["R' U R", "R' U' R", "B U B'", "B U' B'"], &[5, 0, 3, 4]),
            4 => (&["R U R'", "R U' R'", "F' U F", "F' U' F"], &[4, 5, 0, 3]),
            6 => (&["L' U L", "L' U' L", "F U F'", "F U' F'"], &[3, 4, 5, 0]),
            _ => unreachable!(),
        };
        let sel = (index2 / 3 - 4) as usize; // 0
        for i in 0..4 {
            let mut i1 = index1;
            let mut i2 = index2;
            let mv0 = tmp_moves[sel] as usize;
            i1 = mt_edge[i1 * 18 + mv0] as usize;
            i2 = mt_corn[i2 * 18 + mv0] as usize;
            for m in string_to_alg(am[i]) {
                i1 = mt_edge[i1 * 18 + m.index()] as usize;
                i2 = mt_corn[i2 * 18 + m.index()] as usize;
            }
            tbl[i1 * size2 + i2] = 0;
            for k in 3..=5usize {
                let n_ed = mt_edge[i1 * 18 + k] as usize;
                let n_cn = mt_corn[i2 * 18 + k] as usize;
                tbl[n_ed * size2 + n_cn] = 0;
            }
            // U(0) chain
            let i1_u = mt_edge[i1 * 18] as usize;
            let i2_u = mt_corn[i2 * 18] as usize;
            tbl[i1_u * size2 + i2_u] = 0;
            for k in 3..=5usize {
                let n_ed = mt_edge[i1_u * 18 + k] as usize;
                let n_cn = mt_corn[i2_u * 18 + k] as usize;
                tbl[n_ed * size2 + n_cn] = 0;
            }
            for off in [1usize, 2] {
                let i1_o = mt_edge[i1 * 18 + off] as usize;
                let i2_o = mt_corn[i2 * 18 + off] as usize;
                tbl[i1_o * size2 + i2_o] = 0;
                for k in 3..=5usize {
                    let n_ed = mt_edge[i1_o * 18 + k] as usize;
                    let n_cn = mt_corn[i2_o * 18 + k] as usize;
                    tbl[n_ed * size2 + n_cn] = 0;
                }
            }
        }

        for d in 0..PP_PAIR_BFS_DEPTH {
            for i in 0..total {
                if tbl[i] != d {
                    continue;
                }
                let i1 = (i / size2) * 18;
                let i2 = (i % size2) * 18;
                for j in 0..18 {
                    let ni = mt_edge[i1 + j] as usize * size2 + mt_corn[i2 + j] as usize;
                    if tbl[ni] == 255 {
                        tbl[ni] = d + 1;
                    }
                }
            }
        }
        PpPairPrune { tbl }
    }

    /// ie = edge 0..23,ic = corner 0..23。
    #[inline]
    fn h(&self, ie: u32, ic: u32) -> u32 {
        self.tbl[(ie as usize) * state_space::CORNER + ic as usize] as u32
    }
}

/// 本地 trans_moves[s1][s2][m_in_s1_frame] = m_in_s2_frame(自包含)。
fn pp_trans_moves() -> [[[u8; 18]; 4]; 4] {
    let cj = conj_moves_flat();
    let mut tbl = [[[0u8; 18]; 4]; 4];
    for s1 in 0..4 {
        for s2 in 0..4 {
            for m_phys in 0..18 {
                let m_s1 = cj[m_phys][s1] as usize;
                let m_s2 = cj[m_phys][s2];
                tbl[s1][s2][m_s1] = m_s2;
            }
        }
    }
    tbl
}

/// 单 corner-slot 视角的 cross+corner+4edge 起始态(与 PseudoSmallSolver::initial_states 一致)。
#[derive(Debug, Clone, Copy)]
struct PpConjState {
    im: u32,
    ic: u32,
    ie_rel: [u32; 4],
}

/// xcross 槽:(im, ic*18, ie*18, slot, diff)。edge 目标 2*diff。
#[derive(Debug, Clone, Copy, Default)]
struct PpXc {
    im: u32,
    ic: u32, // 0..23
    ie: u32, // 0..23 (= ie_rel[diff])
    slot: usize,
    diff: u32,
}

/// pair 槽:(im, ic, ie, slot, diff)。叶子要 ins==0 && pspair==0。
#[derive(Debug, Clone, Copy, Default)]
struct PpPair {
    im: u32,
    ic: u32,
    ie: u32,
    slot: usize,
    diff: u32,
}

/// 小表 pseudo-pair cascade。持有现场建的 cross+corner / ins / pspair 表 + move 表。
pub struct PseudoPairSmallSolver {
    mt_edge4: Arc<MoveTable>,
    mt_corn: Arc<MoveTable>,
    mt_edge: Arc<MoveTable>,
    cc: PpCcPrune,
    ins: [PpInsPrune; 4],
    pair: [PpPairPrune; 4],
    trans: [[[u8; 18]; 4]; 4],
}

impl PseudoPairSmallSolver {
    /// 预建小表直接构造(wasm 路径)。integrator 在外面 `MoveTable::from_bin` 后传入,
    /// 现场 BFS 建 1 张 cross+corner (~4.6MB) + 4 张 ins (~4.6MB 各) + 4 张 pspair (576B 各)。
    ///
    /// 参数(from_bin 规格):
    ///   - mt_edge4:`MoveTable::from_bin(bytes, CROSS=190080, 24)`(stride 24,值 ×24)
    ///   - mt_corn :`MoveTable::from_bin(bytes, CORNER=24, 18)`
    ///   - mt_edge :`MoveTable::from_bin(bytes, EDGE=24, 18)`
    pub fn from_tables(
        mt_edge4: Arc<MoveTable>,
        mt_corn: Arc<MoveTable>,
        mt_edge: Arc<MoveTable>,
    ) -> Self {
        let e4 = mt_edge4.as_u32();
        let c = mt_corn.as_u32();
        let e = mt_edge.as_u32();
        let cc = PpCcPrune::build(e4, c);
        let ins = [
            PpInsPrune::build(0, e4, c),
            PpInsPrune::build(1, e4, c),
            PpInsPrune::build(2, e4, c),
            PpInsPrune::build(3, e4, c),
        ];
        let pair = [
            PpPairPrune::build(0, e, c),
            PpPairPrune::build(1, e, c),
            PpPairPrune::build(2, e, c),
            PpPairPrune::build(3, e, c),
        ];
        PseudoPairSmallSolver {
            mt_edge4,
            mt_corn,
            mt_edge,
            cc,
            ins,
            pair,
            trans: pp_trans_moves(),
        }
    }

    #[inline]
    fn get_diff(sc: u32, se: u32) -> u32 {
        (se.wrapping_sub(sc).wrapping_add(4)) & 3
    }

    /// 4 corner-slot 的共轭起始态(cross + corner + 4 edges 各自视角推演)。
    fn initial_states(&self, alg: &[u8]) -> [PpConjState; 4] {
        let mt_e4 = self.mt_edge4.as_u32();
        let mt_c = self.mt_corn.as_u32();
        let mt_e = self.mt_edge.as_u32();
        let cj = conj_moves_flat();

        let mut out = [PpConjState { im: 0, ic: 0, ie_rel: [0; 4] }; 4];
        for slot_k in 0..4 {
            let mut cur_mul: u32 =
                (state_space::CROSS_SOLVED as u32) * (state_space::CORNER as u32);
            let mut cur_cn: u32 = 12 * 18;
            let mut cur_e: [u32; 4] = [0, 2, 4, 6];
            for &m in alg {
                let mc = cj[m as usize][slot_k] as usize;
                cur_mul = mt_e4[(cur_mul as usize) + mc];
                cur_cn = mt_c[(cur_cn as usize) + mc] * 18;
                for k in 0..4 {
                    cur_e[k] = mt_e[(cur_e[k] as usize) * 18 + mc];
                }
            }
            out[slot_k] = PpConjState { im: cur_mul, ic: cur_cn / 18, ie_rel: cur_e };
        }
        out
    }

    /// 多槽 IDA* 单层。参考帧 = pair.slot;move 在参考帧用 raw m,其它槽用 trans 翻译。
    /// pair 槽:ins[diff] + pspair[diff] 两表;xcross 槽:cc 表。任一 ≥ depth ⇒ 剪。
    /// depth==1 全过 ⇒ 还需 pair (ins==0 && pspair==0) 且每 xcross (cc==0 && ie==2*diff)。
    fn search(&self, p: &PpPair, xc: &[PpXc], depth: u32, prev: u8) -> bool {
        let (vmoves, vcnt) = valid_moves();
        let count = vcnt[prev as usize] as usize;
        let row = &vmoves[prev as usize];
        let mt_e4 = self.mt_edge4.as_u32();
        let mt_c = self.mt_corn.as_u32();
        let mt_e = self.mt_edge.as_u32();
        let ref_slot = p.slot;
        let n = xc.len();

        let mut local: u64 = 0;
        let mut nxc = [PpXc::default(); 3];
        for k in 0..count {
            let m = row[k] as usize;
            local += 1;

            // pair 槽(参考帧 raw m)
            let n_im = mt_e4[p.im as usize + m] as u32;
            let n_ic = mt_c[p.ic as usize * 18 + m] as u32;
            if self.ins[p.diff as usize].h(n_im, n_ic) >= depth {
                continue;
            }
            let n_ie = mt_e[p.ie as usize * 18 + m] as u32;
            if self.pair[p.diff as usize].h(n_ie, n_ic) >= depth {
                continue;
            }

            // xcross 槽
            let mut pruned = false;
            for (j, q) in xc.iter().enumerate() {
                let m_q = self.trans[ref_slot][q.slot][m] as usize;
                let q_im = mt_e4[q.im as usize + m_q] as u32;
                let q_ic = mt_c[q.ic as usize * 18 + m_q] as u32;
                if self.cc.h(q_im, q_ic) >= depth {
                    pruned = true;
                    break;
                }
                let q_ie = mt_e[q.ie as usize * 18 + m_q] as u32;
                nxc[j] = PpXc {
                    im: q_im,
                    ic: q_ic,
                    ie: q_ie,
                    slot: q.slot,
                    diff: q.diff,
                };
            }
            if pruned {
                continue;
            }

            if depth == 1 {
                // pair: ins<1 && pspair<1 ⇒ ==0;xcross: cc<1 ⇒ ==0,且 edge 到位。
                let mut leaf = self.pair[p.diff as usize].h(n_ie, n_ic) == 0
                    && self.ins[p.diff as usize].h(n_im, n_ic) == 0;
                if leaf {
                    for q in nxc.iter().take(n) {
                        if self.cc.h(q.im, q.ic) != 0 || q.ie != 2 * q.diff {
                            leaf = false;
                            break;
                        }
                    }
                }
                if leaf {
                    bump_node_count(local);
                    return true;
                }
            } else {
                let np = PpPair {
                    im: n_im,
                    ic: n_ic,
                    ie: n_ie,
                    slot: p.slot,
                    diff: p.diff,
                };
                if self.search(&np, &nxc[..n], depth - 1, m as u8) {
                    bump_node_count(local);
                    return true;
                }
            }
        }
        bump_node_count(local);
        false
    }

    /// 解一个 task。h = 根 max 下界,lower = 上一阶段 cascade 下界,bound = 当前最优封顶。
    fn solve_task(&self, p: &PpPair, xc: &[PpXc], h: u32, lower: u32, bound: u32) -> u32 {
        // 根全解?
        let root_solved = self.ins[p.diff as usize].h(p.im, p.ic) == 0
            && self.pair[p.diff as usize].h(p.ie, p.ic) == 0
            && xc
                .iter()
                .all(|q| self.cc.h(q.im, q.ic) == 0 && q.ie == 2 * q.diff);
        if root_solved {
            return 0;
        }
        let max_d = std::cmp::min(20, bound.saturating_sub(1));
        let start = std::cmp::max(h.max(lower), 1);
        for d in start..=max_d {
            if self.search(p, xc, d, 18) {
                return d;
            }
        }
        99
    }

    /// pair 槽根下界:max(ins, pspair)。
    #[inline]
    fn pair_h(&self, p: &PpPair) -> u32 {
        self.ins[p.diff as usize]
            .h(p.im, p.ic)
            .max(self.pair[p.diff as usize].h(p.ie, p.ic))
    }

    #[inline]
    fn xc_h(&self, q: &PpXc) -> u32 {
        self.cc.h(q.im, q.ic)
    }

    #[inline]
    fn mk_pair(st: &[PpConjState; 4], cs: usize, es: usize) -> PpPair {
        let diff = Self::get_diff(cs as u32, es as u32);
        PpPair {
            im: st[cs].im,
            ic: st[cs].ic,
            ie: st[cs].ie_rel[diff as usize],
            slot: cs,
            diff,
        }
    }

    #[inline]
    fn mk_xc(st: &[PpConjState; 4], cs: usize, es: usize) -> PpXc {
        let diff = Self::get_diff(cs as u32, es as u32);
        PpXc {
            im: st[cs].im,
            ic: st[cs].ic,
            ie: st[cs].ie_rel[diff as usize],
            slot: cs,
            diff,
        }
    }

    // ---------------- stage 0: cross + pair (1 槽) ----------------
    // pair 槽 = (corner-slot cs, edge-slot es)。16 task。
    fn solve_stage0(&self, st: &[PpConjState; 4], lower: u32) -> u32 {
        let mut tasks: Vec<(PpPair, u32)> = Vec::with_capacity(16);
        for cs in 0..4 {
            for es in 0..4 {
                let p = Self::mk_pair(st, cs, es);
                let h = self.pair_h(&p);
                tasks.push((p, h));
            }
        }
        tasks.sort_by_key(|t| t.1);
        let mut best = 99u32;
        for (p, h) in &tasks {
            if *h >= best {
                break;
            }
            let res = self.solve_task(p, &[], *h, lower, best);
            best = best.min(res);
        }
        best
    }

    // ---------------- stage 1: pair + 1 xcross ----------------
    fn solve_stage1(&self, st: &[PpConjState; 4], lower: u32) -> u32 {
        let mut best = 99u32;
        let mut tasks: Vec<(PpPair, PpXc, u32)> = Vec::new();
        for pc in 0..4 {
            for pe in 0..4 {
                for xc_c in 0..4 {
                    if xc_c == pc {
                        continue;
                    }
                    for xc_e in 0..4 {
                        if xc_e == pe {
                            continue;
                        }
                        let p = Self::mk_pair(st, pc, pe);
                        let q = Self::mk_xc(st, xc_c, xc_e);
                        let h = self.pair_h(&p).max(self.xc_h(&q));
                        tasks.push((p, q, h));
                    }
                }
            }
        }
        tasks.sort_by_key(|t| t.2);
        for (p, q, h) in &tasks {
            if *h >= best {
                break;
            }
            let res = self.solve_task(p, std::slice::from_ref(q), *h, lower, best);
            best = best.min(res);
        }
        best
    }

    // ---------------- stage 2: pair + 2 xcross ----------------
    fn solve_stage2(&self, st: &[PpConjState; 4], lower: u32) -> u32 {
        let mut best = 99u32;
        // pair corner pc + edge pe;剩余 3 corner / 3 edge 中选 2 个 xcross(各自配)。
        let mut tasks: Vec<(PpPair, [PpXc; 2], u32)> = Vec::new();
        for pc in 0..4 {
            for pe in 0..4 {
                let rem_c: Vec<usize> = (0..4).filter(|&x| x != pc).collect();
                let rem_e: Vec<usize> = (0..4).filter(|&x| x != pe).collect();
                // 从 3 个剩余 corner 选 2 个有序,edge 同
                for &c0 in &rem_c {
                    for &c1 in &rem_c {
                        if c1 == c0 {
                            continue;
                        }
                        for &e0 in &rem_e {
                            for &e1 in &rem_e {
                                if e1 == e0 {
                                    continue;
                                }
                                // c0<c1 去重(无序 xcross 集)
                                if c0 > c1 {
                                    continue;
                                }
                                let p = Self::mk_pair(st, pc, pe);
                                let q0 = Self::mk_xc(st, c0, e0);
                                let q1 = Self::mk_xc(st, c1, e1);
                                let h = self
                                    .pair_h(&p)
                                    .max(self.xc_h(&q0))
                                    .max(self.xc_h(&q1));
                                tasks.push((p, [q0, q1], h));
                            }
                        }
                    }
                }
            }
        }
        tasks.sort_by_key(|t| t.2);
        for (p, qs, h) in &tasks {
            if *h >= best {
                break;
            }
            let res = self.solve_task(p, qs, *h, lower, best);
            best = best.min(res);
        }
        best
    }

    // ---------------- stage 3: pair + 3 xcross (全 4 槽) ----------------
    fn solve_stage3(&self, st: &[PpConjState; 4], lower: u32) -> u32 {
        let mut best = 99u32;
        // pair corner pc + edge pe;剩余 3 corner 配剩余 3 edge 的所有排列(6 种)。
        let mut tasks: Vec<(PpPair, [PpXc; 3], u32)> = Vec::new();
        const PERMS: [[usize; 3]; 6] = [
            [0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0],
        ];
        for pc in 0..4 {
            for pe in 0..4 {
                let rem_c: Vec<usize> = (0..4).filter(|&x| x != pc).collect();
                let rem_e: Vec<usize> = (0..4).filter(|&x| x != pe).collect();
                for perm in &PERMS {
                    let p = Self::mk_pair(st, pc, pe);
                    let q0 = Self::mk_xc(st, rem_c[0], rem_e[perm[0]]);
                    let q1 = Self::mk_xc(st, rem_c[1], rem_e[perm[1]]);
                    let q2 = Self::mk_xc(st, rem_c[2], rem_e[perm[2]]);
                    let h = self
                        .pair_h(&p)
                        .max(self.xc_h(&q0))
                        .max(self.xc_h(&q1))
                        .max(self.xc_h(&q2));
                    tasks.push((p, [q0, q1, q2], h));
                }
            }
        }
        tasks.sort_by_key(|t| t.2);
        for (p, qs, h) in &tasks {
            if *h >= best {
                break;
            }
            let res = self.solve_task(p, qs, *h, lower, best);
            best = best.min(res);
        }
        best
    }

    /// 单视角 4 阶段。cascade 串下界(每阶段 ≥ 上一阶段)。
    fn solve_one_all(&self, alg: &[u8]) -> [u32; 4] {
        let st = self.initial_states(alg);
        let s0 = self.solve_stage0(&st, 0);
        let s1 = self.solve_stage1(&st, s0);
        let s2 = self.solve_stage2(&st, s1);
        let s3 = self.solve_stage3(&st, s2);
        [s0, s1, s2, s3]
    }

    /// 小表 6 视角 × 4 阶段,返回 24 值,顺序
    /// [stage0×6, stage1×6, stage2×6, stage3×6]。rots = ["","z2","z'","z","x'","x"]。
    /// 列序与 pseudo_pair_analyzer 完全一致,与大表逐格 bit-exact。
    pub fn pseudo_pair_get_stats_small(&self, alg: &[Move]) -> Vec<u32> {
        const ROTS: [&str; 6] = ["", "z2", "z'", "z", "x'", "x"];
        let base: Vec<u8> = alg.iter().map(|m| m.index() as u8).collect();
        let mut cols: [[u32; 6]; 4] = [[0; 6]; 4];
        for (i, r) in ROTS.iter().enumerate() {
            let mut a = base.clone();
            alg_rotation(&mut a, r);
            let v = self.solve_one_all(&a);
            for (stage, &x) in v.iter().enumerate() {
                cols[stage][i] = x;
            }
        }
        let mut out = Vec::with_capacity(24);
        for stage in 0..4 {
            out.extend_from_slice(&cols[stage]);
        }
        out
    }

    /// 单阶段 6 视角(stage 0..3)。两遍 UI 用。lower=0(单阶段不串 cascade 仍正确)。
    pub fn pseudo_pair_get_stage_small(&self, alg: &[Move], stage: usize) -> Vec<u32> {
        const ROTS: [&str; 6] = ["", "z2", "z'", "z", "x'", "x"];
        let base: Vec<u8> = alg.iter().map(|m| m.index() as u8).collect();
        ROTS.iter()
            .map(|r| {
                let mut a = base.clone();
                alg_rotation(&mut a, r);
                let st = self.initial_states(&a);
                match stage {
                    0 => self.solve_stage0(&st, 0),
                    1 => self.solve_stage1(&st, 0),
                    2 => self.solve_stage2(&st, 0),
                    _ => self.solve_stage3(&st, 0),
                }
            })
            .collect()
    }

    /// 镜像 search,但收集 path 而非首解返回。path 存 ref_slot 帧的 raw 搜索 move
    /// (search 在 pair 槽 ref_slot 共轭帧推坐标 raw m,xcross 槽用 trans 翻译;共轭已烘进
    /// initial_states)。fmt 时把 raw 搜索 move 反共轭回真实 rot 帧:cj^{-1}[m][ref_slot]
    /// = cj[m][(4-ref_slot)%4]。out 收满 cap 即停。叶子条件与 search depth==1 完全一致。
    #[allow(clippy::too_many_arguments)]
    fn enum_collect(
        &self,
        p: &PpPair,
        xc: &[PpXc],
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
        let ref_slot = p.slot;
        let inv = (4 - ref_slot) % 4;
        let cj = conj_moves_flat();
        let n = xc.len();
        let mut nxc = [PpXc::default(); 3];
        for k in 0..count {
            if out.len() >= cap {
                return;
            }
            let m = row[k] as usize;

            // pair 槽(参考帧 raw m)
            let n_im = mt_e4[p.im as usize + m] as u32;
            let n_ic = mt_c[p.ic as usize * 18 + m] as u32;
            if self.ins[p.diff as usize].h(n_im, n_ic) >= depth {
                continue;
            }
            let n_ie = mt_e[p.ie as usize * 18 + m] as u32;
            if self.pair[p.diff as usize].h(n_ie, n_ic) >= depth {
                continue;
            }

            // xcross 槽
            let mut pruned = false;
            for (j, q) in xc.iter().enumerate() {
                let m_q = self.trans[ref_slot][q.slot][m] as usize;
                let q_im = mt_e4[q.im as usize + m_q] as u32;
                let q_ic = mt_c[q.ic as usize * 18 + m_q] as u32;
                if self.cc.h(q_im, q_ic) >= depth {
                    pruned = true;
                    break;
                }
                let q_ie = mt_e[q.ie as usize * 18 + m_q] as u32;
                nxc[j] = PpXc {
                    im: q_im,
                    ic: q_ic,
                    ie: q_ie,
                    slot: q.slot,
                    diff: q.diff,
                };
            }
            if pruned {
                continue;
            }

            // raw 搜索 move m 反共轭回真实 rot 帧。
            path.push(cj[m][inv]);
            // 子状态是否已全解(pair 解 ∧ 各 xcross 槽 cc 解且伪棱归位)——与叶子同一判据。
            let mut solved = self.pair[p.diff as usize].h(n_ie, n_ic) == 0
                && self.ins[p.diff as usize].h(n_im, n_ic) == 0;
            if solved {
                for q in nxc.iter().take(n) {
                    if self.cc.h(q.im, q.ic) != 0 || q.ie != 2 * q.diff {
                        solved = false;
                        break;
                    }
                }
            }
            if depth == 1 {
                if solved {
                    out.push(path.clone());
                }
            } else if !solved {
                // 全解却仍要走 depth-1 步 = 更短解 + 无效尾动,跳过。
                let np = PpPair {
                    im: n_im,
                    ic: n_ic,
                    ie: n_ie,
                    slot: p.slot,
                    diff: p.diff,
                };
                self.enum_collect(&np, &nxc[..n], depth - 1, m as u8, path, out, cap);
            }
            path.pop();
        }
    }

    /// 给定 stage(0=cross+pair / 1=+1xcross / 2=+2xcross / 3=+3xcross),与
    /// pseudo_pair_get_stage_small 同口径挑最优 combo(pair 槽 + xcross 槽集),枚举其
    /// best_len..best_len+extra 步全部解(真实 rot 帧 move 索引路径,cap 封顶)。
    /// 返回 (best_len, combo 槽位[首位 pair corner-slot,后跟各 xcross corner-slot], 解集)。
    /// `force`:用户指定的目标槽位集合(索引 0..3,0=BL/1=BR/2=FR/3=FL);空 = 自动挑最优槽
    /// (逐位与原先一致)。非空时只保留"目标槽位集合 == force"的候选(pseudo 的 source 件仍自动),
    /// 不与其它槽集比较。
    pub fn enumerate_small(
        &self,
        alg: &[Move],
        rot: &str,
        stage: usize,
        extra: u32,
        cap: usize,
        force: &[usize],
    ) -> (u32, Vec<(String, Vec<usize>, Vec<u8>)>) {
        let mut a: Vec<u8> = alg.iter().map(|m| m.index() as u8).collect();
        alg_rotation(&mut a, rot);
        let st = self.initial_states(&a);

        // 与 solve_stageN 同构构建候选 task:(pair, xcross 集, 根启发式)。
        let mut tasks: Vec<(PpPair, Vec<PpXc>, u32)> = Vec::new();
        match stage {
            0 => {
                for cs in 0..4 {
                    for es in 0..4 {
                        let p = Self::mk_pair(&st, cs, es);
                        let h = self.pair_h(&p);
                        tasks.push((p, vec![], h));
                    }
                }
            }
            1 => {
                for pc in 0..4 {
                    for pe in 0..4 {
                        for xc_c in 0..4 {
                            if xc_c == pc {
                                continue;
                            }
                            for xc_e in 0..4 {
                                if xc_e == pe {
                                    continue;
                                }
                                let p = Self::mk_pair(&st, pc, pe);
                                let q = Self::mk_xc(&st, xc_c, xc_e);
                                let h = self.pair_h(&p).max(self.xc_h(&q));
                                tasks.push((p, vec![q], h));
                            }
                        }
                    }
                }
            }
            2 => {
                for pc in 0..4 {
                    for pe in 0..4 {
                        let rem_c: Vec<usize> = (0..4).filter(|&x| x != pc).collect();
                        let rem_e: Vec<usize> = (0..4).filter(|&x| x != pe).collect();
                        for &c0 in &rem_c {
                            for &c1 in &rem_c {
                                if c1 == c0 {
                                    continue;
                                }
                                for &e0 in &rem_e {
                                    for &e1 in &rem_e {
                                        if e1 == e0 {
                                            continue;
                                        }
                                        if c0 > c1 {
                                            continue;
                                        }
                                        let p = Self::mk_pair(&st, pc, pe);
                                        let q0 = Self::mk_xc(&st, c0, e0);
                                        let q1 = Self::mk_xc(&st, c1, e1);
                                        let h = self
                                            .pair_h(&p)
                                            .max(self.xc_h(&q0))
                                            .max(self.xc_h(&q1));
                                        tasks.push((p, vec![q0, q1], h));
                                    }
                                }
                            }
                        }
                    }
                }
            }
            _ => {
                const PERMS: [[usize; 3]; 6] = [
                    [0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0],
                ];
                for pc in 0..4 {
                    for pe in 0..4 {
                        let rem_c: Vec<usize> = (0..4).filter(|&x| x != pc).collect();
                        let rem_e: Vec<usize> = (0..4).filter(|&x| x != pe).collect();
                        for perm in &PERMS {
                            let p = Self::mk_pair(&st, pc, pe);
                            let q0 = Self::mk_xc(&st, rem_c[0], rem_e[perm[0]]);
                            let q1 = Self::mk_xc(&st, rem_c[1], rem_e[perm[1]]);
                            let q2 = Self::mk_xc(&st, rem_c[2], rem_e[perm[2]]);
                            let h = self
                                .pair_h(&p)
                                .max(self.xc_h(&q0))
                                .max(self.xc_h(&q1))
                                .max(self.xc_h(&q2));
                            tasks.push((p, vec![q0, q1, q2], h));
                        }
                    }
                }
            }
        }
        // 用户指定槽位:只保留"目标槽位集合 == force"的候选(pair 的 source 件仍自动)。
        // 目标槽位集合 = pair 槽 ∪ 各 xcross 槽(与下方 combo 标签同口径)。空 force 不过滤。
        if !force.is_empty() {
            let want: std::collections::BTreeSet<usize> = force.iter().copied().collect();
            tasks.retain(|(p, xc, _)| {
                let got: std::collections::BTreeSet<usize> =
                    std::iter::once(p.slot).chain(xc.iter().map(|q| q.slot)).collect();
                got == want
            });
        }
        tasks.sort_by_key(|t| t.2);

        // best_len:每 task 各自最优长度的 min(逻辑不变)。solve_task 与 solve_stageN 同搜索
        // ⇒ best_len bit-exact;可采纳下界 ⇒ argmin 即真最优。
        // 与原版差异:break 用 `>`(非 `>=`)以便 h == best_len 的 task 也被评估(可能恰好并列);
        // bound 传满阶段上界 21(⇒ max_d=min(20,20)=20)而非 best_len,使并列 task 的真实长度
        // 可被检出(否则 bound=best_len 会让恰好 best_len 的 task 返回 99)。两处改动均不影响
        // best_len 的取值:h==best_len 的 task 下界即 best_len,真实长度 >= best_len,只能并列、
        // 永不拉低 best_len。
        let mut best_len = 99u32;
        let mut evaluated: Vec<(PpPair, Vec<PpXc>, u32)> = Vec::new();
        for (p, xc, h) in &tasks {
            if *h > best_len {
                break; // tasks 按 h 升序,后续 h 只增;> best_len 不可能并列。
            }
            let res = self.solve_task(p, xc, *h, 0, 21);
            if res < best_len {
                best_len = res;
            }
            evaluated.push((*p, xc.clone(), res));
        }

        let mut out: Vec<(String, Vec<usize>, Vec<u8>)> = Vec::new();
        if best_len == 0 || best_len >= 99 {
            return (0, Vec::new()); // 已解(0 步)/ 异常:无 moves。
        }

        // 并列最优(长度 == best_len)的全部 (pair, xcross 集)。逐深度 d 外层、候选内层交错
        // 枚举,使跨候选也按长度升序;每条解带它自己的 frame(= rot,本 solver 无 frame)+ combo;
        // cap 控总条数。
        let tied: Vec<(PpPair, Vec<PpXc>)> = evaluated
            .into_iter()
            .filter(|(_, _, l)| *l == best_len)
            .map(|(p, xc, _)| (p, xc))
            .collect();
        let frame = rot.to_string(); // 本 solver 无 frame:每条解 frame = 传入 rot 前缀。

        let mut path = Vec::new();
        'outer: for d in best_len..=(best_len + extra).min(20) {
            for (p, xc) in &tied {
                if out.len() >= cap {
                    break 'outer;
                }
                let mut combo: Vec<usize> = Vec::with_capacity(1 + xc.len());
                combo.push(p.slot);
                combo.extend(xc.iter().map(|q| q.slot));
                let mut combo_out: Vec<Vec<u8>> = Vec::new();
                self.enum_collect(p, xc, d, 18, &mut path, &mut combo_out, cap - out.len());
                for sol in combo_out {
                    out.push((frame.clone(), combo.clone(), sol));
                }
            }
        }
        (best_len, out)
    }
}

#[cfg(test)]
mod small_tests {
    use super::*;
    use crate::cube_common::{string_to_alg, test_env_lock};
    use std::path::PathBuf;

    /// 小表 pseudo-pair cascade(from_tables,现场 BFS,无 huge / 无 54MB C4E)逐格
    /// bit-exact 对照大表 golden(huge-table pseudo_pair_analyzer 算出)。
    /// 列序 z0 z2 z3 z1 x3 x1 = rots ["","z2","z'","z","x'","x"];4 阶段 ×6
    /// = [stage0×6, stage1×6, stage2×6, stage3×6]。
    ///
    /// 只读 3 张 move 表(mt_edge4/corn/edge),全 from_bin;cross+corner / ins / pspair
    /// 全部现场 BFS。**不碰 957MB/822MB aux / 不碰 54MB C4E / 不碰 36MB ins_c_diff**。
    ///   cargo test --release --lib pseudo_pair_small_matches_golden -- --ignored --nocapture
    #[test]
    #[ignore]
    fn pseudo_pair_small_matches_golden() {
        use crate::move_tables::MoveTable;
        use std::time::Instant;

        let _lock = test_env_lock().lock().unwrap_or_else(|e| e.into_inner());
        let dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tables");

        let read = |name: &str| std::fs::read(dir.join(name)).expect(name);
        let mt_edge4 = Arc::new(MoveTable::from_bin(
            &read("mt_edge4.bin"),
            state_space::CROSS as u32,
            24,
        ));
        let mt_corn = Arc::new(MoveTable::from_bin(
            &read("mt_corn.bin"),
            state_space::CORNER as u32,
            18,
        ));
        let mt_edge = Arc::new(MoveTable::from_bin(
            &read("mt_edge.bin"),
            state_space::EDGE as u32,
            18,
        ));

        let t_build = Instant::now();
        let solver = PseudoPairSmallSolver::from_tables(mt_edge4, mt_corn, mt_edge);
        eprintln!(
            "[pp-small] tables built in {:.1}ms",
            t_build.elapsed().as_secs_f64() * 1e3
        );

        let cases: &[(&str, [u32; 24])] = &[
            (
                "U B' L R2 U B2 R2 U2 B2 U R2 U2 F2 B' R' B2 F' U2 L2 R",
                [6, 6, 6, 7, 5, 6, 6, 7, 7, 7, 6, 8, 9, 9, 8, 9, 7, 10, 11, 12, 11, 11, 10, 11],
            ),
            (
                "D2 L B2 R2 D R2 D R2 B2 R2 D2 L' D2 B D2 U2 R2 D' B2 R",
                [6, 5, 6, 4, 5, 5, 8, 5, 7, 5, 7, 7, 9, 5, 9, 8, 9, 9, 12, 10, 12, 10, 12, 11],
            ),
            (
                "B2 D' F2 L' U' R' D R2 F D' B2 L2 F2 R2 B' R2 L2 U2 L",
                [6, 6, 6, 6, 6, 5, 7, 7, 7, 6, 7, 6, 9, 9, 9, 8, 9, 9, 11, 11, 12, 11, 11, 11],
            ),
        ];

        for (scr, exp) in cases {
            let alg = string_to_alg(scr);
            let t = Instant::now();
            let got = solver.pseudo_pair_get_stats_small(&alg);
            eprintln!(
                "[pp-small] `{}` 24 cols in {:.1}ms",
                scr,
                t.elapsed().as_secs_f64() * 1e3
            );
            assert_eq!(
                got.as_slice(),
                exp.as_slice(),
                "pseudo_pair small-mode mismatch for `{}`:\n got {:?}\n exp {:?}",
                scr,
                got,
                exp
            );
        }
    }

    /// enumerate_small 输出的 move 序列正确性:
    ///   1. best_len == golden 值(逐格 bit-exact,4 阶段 ×6 视角)
    ///   2. 每条解长度 == best_len(全是最优解)
    ///   3. 把(rot 后打乱 ++ 解)重新 initial_states 编码,对 combo 每个 corner-slot
    ///      恢复唯一可解的 diff(pair: ins==0 && pspair==0;xcross: cc==0 && ie==2*diff),
    ///      断言存在且各 slot 的 edge-slot=(cs+diff)%4 互不相同(合法 pseudo-pair combo)。
    ///   cargo test --release --lib -- --ignored pseudo_pair_enumerate_valid --nocapture
    #[test]
    #[ignore]
    fn pseudo_pair_enumerate_valid() {
        use crate::move_tables::MoveTable;

        let _lock = test_env_lock().lock().unwrap_or_else(|e| e.into_inner());
        let dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tables");

        let read = |name: &str| std::fs::read(dir.join(name)).expect(name);
        let mt_edge4 = Arc::new(MoveTable::from_bin(
            &read("mt_edge4.bin"),
            state_space::CROSS as u32,
            24,
        ));
        let mt_corn = Arc::new(MoveTable::from_bin(
            &read("mt_corn.bin"),
            state_space::CORNER as u32,
            18,
        ));
        let mt_edge = Arc::new(MoveTable::from_bin(
            &read("mt_edge.bin"),
            state_space::EDGE as u32,
            18,
        ));
        let solver = PseudoPairSmallSolver::from_tables(mt_edge4, mt_corn, mt_edge);

        let rots = ["", "z2", "z'", "z", "x'", "x"];
        // 第 1 条打乱 + golden(同 pseudo_pair_small_matches_golden,布局 [stage*6 + rot])。
        let cases: &[(&str, [u32; 24])] = &[(
            "U B' L R2 U B2 R2 U2 B2 U R2 U2 F2 B' R' B2 F' U2 L2 R",
            [6, 6, 6, 7, 5, 6, 6, 7, 7, 7, 6, 8, 9, 9, 8, 9, 7, 10, 11, 12, 11, 11, 10, 11],
        )];

        for (scr, exp) in cases {
            let alg = string_to_alg(scr);
            for (ri, rot) in rots.iter().enumerate() {
                for stage in 0..4usize {
                    let want = exp[stage * 6 + ri];
                    let t = std::time::Instant::now();
                    let (len, items) = solver.enumerate_small(&alg, rot, stage, 0, 20, &[]);
                    eprintln!(
                        "[pp-enum] rot={:?} stage={} len={} sols={} {:.0}ms",
                        rot, stage, len, items.len(), t.elapsed().as_secs_f64() * 1e3
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

                    // rot 后打乱基底。
                    let mut base: Vec<u8> = alg.iter().map(|m| m.index() as u8).collect();
                    alg_rotation(&mut base, rot);

                    // 无 frame solver:每条解 frame 必为传入 rot。
                    for (frame, _, _) in &items {
                        assert_eq!(
                            frame.as_str(),
                            *rot,
                            "frame must equal rot `{}` rot={} stage={}: got {:?}",
                            scr, rot, stage, frame
                        );
                    }

                    // 每条解带自己的 combo;按 combo 各自 replay 校验,确保都是合法并列(都达成 best_len)。
                    for (_, combo, sol) in &items {
                        let tgt = combo[0];
                        let xc_slots = &combo[1..];
                        assert_eq!(
                            sol.len() as u32,
                            len,
                            "sol not optimal `{}` rot={} stage={}: {:?}",
                            scr, rot, stage, sol
                        );
                        let mut full = base.clone();
                        full.extend_from_slice(sol);
                        let st = solver.initial_states(&full);

                        // edge-slot 占用,确保是合法 pseudo-pair combo(各 corner 配不同 edge)。
                        let mut used_e = [false; 4];

                        // pair tgt 槽:存在 diff 使 ins==0 && pspair==0。
                        let mut pair_ok = false;
                        for d in 0..4u32 {
                            if solver.ins[d as usize].h(st[tgt].im, st[tgt].ic) == 0
                                && solver.pair[d as usize]
                                    .h(st[tgt].ie_rel[d as usize], st[tgt].ic)
                                    == 0
                            {
                                let es = ((tgt as u32 + d) % 4) as usize;
                                assert!(
                                    !used_e[es],
                                    "dup edge-slot `{}` rot={} stage={} sol={:?}",
                                    scr, rot, stage, sol
                                );
                                used_e[es] = true;
                                pair_ok = true;
                                break;
                            }
                        }
                        assert!(
                            pair_ok,
                            "pair tgt {} unsolved `{}` rot={} stage={} sol={:?}",
                            tgt, scr, rot, stage, sol
                        );

                        // 各 xcross 槽:cc==0 且存在 diff 使 ie_rel[diff]==2*diff。
                        for &s in xc_slots {
                            assert_eq!(
                                solver.cc.h(st[s].im, st[s].ic),
                                0,
                                "xc slot {} cc unsolved `{}` rot={} stage={} sol={:?}",
                                s, scr, rot, stage, sol
                            );
                            let mut xc_ok = false;
                            for d in 0..4u32 {
                                if st[s].ie_rel[d as usize] == 2 * d {
                                    let es = ((s as u32 + d) % 4) as usize;
                                    if !used_e[es] {
                                        used_e[es] = true;
                                        xc_ok = true;
                                        break;
                                    }
                                }
                            }
                            assert!(
                                xc_ok,
                                "xc slot {} edge unsolved `{}` rot={} stage={} sol={:?}",
                                s, scr, rot, stage, sol
                            );
                        }
                    }
                }
            }
        }
    }
}
