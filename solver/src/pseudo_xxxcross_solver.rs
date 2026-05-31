//! PseudoXXXCross 阶段 IDA* 搜索器(Phase 6d)。
//!
//! 移植自 C++ `pseudo_analyzer.cpp` 的 `XCrossSolver::search_3` + `get_stats`
//! 第 3 段(PsXXXC),包含 3-subset Aux 剪枝(Corner3 + Edge3)。
//!
//! 与 Phase 6c 的差异:
//!   - 新增 `AuxTable::PsCrossE0E1E2` + `PsCrossC4C5C6`(各 ~800 MB,需 huge env)
//!   - 新增 mt_edge3 / mt_corn3 依赖
//!   - 新增 `setup_aux_3subset_first` 先处理 3-subset 并标记 covered 对
//!   - `search_3` 三路径(A 用 raw,B 用 tr_b,C 用 tr_c)
//!   - PseudoTask3 枚举:4 ct × 4 et × 6 perm,过滤 d1==d2==d3
//!
//! 依赖表(在 Phase 6c 基础上额外):
//!   - mt_edge3 / mt_corn3
//!   - pt_pscross_E0E1E2 (~957 MB) + pt_pscross_C4C5C6 (~822 MB)
//!     两张都需要 `CUBE_ALLOW_HUGE_TABLES=1`

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
    move_mapper_idx: u8,
}

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

pub struct PseudoXXXCrossSolver {
    mt_edge4: Arc<MoveTable>,
    mt_corn: Arc<MoveTable>,
    mt_edge: Arc<MoveTable>,
    mt_edge2: Arc<MoveTable>,
    mt_corn2: Arc<MoveTable>,
    mt_edge3: Arc<MoveTable>,
    mt_corn3: Arc<MoveTable>,
    pt_pscross_c4e: [Arc<PackedPruneTable>; 4],
    pt_pscross_e0e1: Arc<PackedPruneTable>,
    pt_pscross_e0e2: Arc<PackedPruneTable>,
    pt_pscross_c4c5: Arc<PackedPruneTable>,
    pt_pscross_c4c6: Arc<PackedPruneTable>,
    pt_pscross_e0e1e2: Arc<PackedPruneTable>,
    pt_pscross_c4c5c6: Arc<PackedPruneTable>,
    /// trans_moves[s1][s2][m_s1] = m_s2(共享 phase 6c 的全局表)
    trans_moves: &'static [[[u8; 18]; 4]; 4],
}

#[derive(Debug, Clone, Copy)]
struct ConjState {
    im: u32,
    ic_b: u32,
    ie_rel: [u32; 4],
}

struct PseudoTask3 {
    c1: usize,
    c2: usize,
    c3: usize,
    diff1: u32,
    diff2: u32,
    diff3: u32,
    h: u32,
    num_aux: usize,
    aux_init: [AuxState; MAX_AUX],
}

impl PseudoXXXCrossSolver {
    pub fn new() -> Self {
        let mtm = move_tables::instance();
        let ptm = prune_tables::instance();
        PseudoXXXCrossSolver {
            mt_edge4: mtm.ensure_edge4(),
            mt_corn: mtm.ensure_corn(),
            mt_edge: mtm.ensure_edge(),
            mt_edge2: mtm.ensure_edge2(),
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
            trans_moves: crate::pseudo_xxcross_solver::trans_moves(),
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

    #[inline]
    fn get_diff(sc: u32, se: u32) -> u32 {
        (se.wrapping_sub(sc).wrapping_add(4)) & 3
    }

    #[inline]
    fn get_h(&self, s: &ConjState, diff: u32) -> u32 {
        let idx: u64 = (s.im as u64 + s.ic_b as u64) * 24 + s.ie_rel[diff as usize] as u64;
        self.pt_pscross_c4e[diff as usize].get(idx) as u32
    }

    fn initial_states(&self, alg: &[u8]) -> [ConjState; 4] {
        let mt_e4 = self.mt_edge4.as_u32();
        let mt_c = self.mt_corn.as_u32();
        let mt_e = self.mt_edge.as_u32();
        let cj = conj_moves_flat();

        let mut out = [ConjState {
            im: 0,
            ic_b: 0,
            ie_rel: [0; 4],
        }; 4];
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
            out[slot_k] = ConjState {
                im: cur_mul,
                ic_b: cur_cn / 18,
                ie_rel: cur_e,
            };
        }
        out
    }

    /// 翻译 C++ `setup_aux_pruners_struct`:先 3-subset(标记 covered),再 2-subset
    /// 跳过已覆盖。target_pieces 大小 6(3 corner + 3 edge)或 4(2+2)。
    fn setup_aux(
        &self,
        target_pieces: &[u8],
        alg: &[u8],
        slot_k: usize,
    ) -> ([AuxState; MAX_AUX], usize) {
        let mut out = [AuxState::EMPTY; MAX_AUX];
        let mut count = 0;
        let mt_e4 = self.mt_edge4.as_u32();
        let cj = conj_moves_flat();
        let rm = rot_map();
        let virtual_cross_scaled =
            (state_space::CROSS_SOLVED as u32) * (state_space::CORNER as u32);

        // covered[a][b] = true 表示 (a, b) 对已被某 3-subset 覆盖,2-subset 跳过
        let mut covered = [[false; 8]; 8];

        // --- Step 1: 3-subset ---
        if target_pieces.len() >= 3 {
            let n = target_pieces.len();
            for i in 0..n {
                for j in (i + 1)..n {
                    for k in (j + 1)..n {
                        if count >= MAX_AUX {
                            break;
                        }
                        let p1 = target_pieces[i];
                        let p2 = target_pieces[j];
                        let p3 = target_pieces[k];

                        let is_corner3 = p1 >= 4 && p2 >= 4 && p3 >= 4;
                        let is_edge3 = p1 < 4 && p2 < 4 && p3 < 4;
                        if !is_corner3 && !is_edge3 {
                            continue;
                        }

                        let (table, target_arr, rot_idx, mt_n, mt_c, mt_pn) = if is_corner3 {
                            // Corner3: 规范化到 r ∈ {4..7},排序后映射到 {4,5,6}
                            let r1 = ((p1 - 4) as i32 - slot_k as i32 + 4).rem_euclid(4) as u32 + 4;
                            let r2 = ((p2 - 4) as i32 - slot_k as i32 + 4).rem_euclid(4) as u32 + 4;
                            let r3 = ((p3 - 4) as i32 - slot_k as i32 + 4).rem_euclid(4) as u32 + 4;
                            let mut keys = [r1, r2, r3];
                            keys.sort();
                            let rot_idx = match (keys[0], keys[1], keys[2]) {
                                (4, 5, 6) => 0,
                                (4, 5, 7) => 1,
                                (4, 6, 7) => 2,
                                (5, 6, 7) => 3,
                                _ => continue, // 不可能
                            };
                            (
                                AuxTable::PsCrossC4C5C6,
                                [12i32, 15, 18], // C4(idx=4 → 4*3+0=12) / C5(5*3=15) / C6(6*3=18)
                                rot_idx,
                                3i32, // n
                                3i32, // c (corner base)
                                8i32, // pn (8 corners total)
                            )
                        } else {
                            // Edge3: 规范化到 r ∈ {0..3},排序后映射到 {0,1,2}
                            let r1 = (p1 as i32 - slot_k as i32 + 4).rem_euclid(4) as u32;
                            let r2 = (p2 as i32 - slot_k as i32 + 4).rem_euclid(4) as u32;
                            let r3 = (p3 as i32 - slot_k as i32 + 4).rem_euclid(4) as u32;
                            let mut keys = [r1, r2, r3];
                            keys.sort();
                            let rot_idx = match (keys[0], keys[1], keys[2]) {
                                (0, 1, 2) => 0,
                                (0, 1, 3) => 1,
                                (0, 2, 3) => 2,
                                (1, 2, 3) => 3,
                                _ => continue,
                            };
                            (
                                AuxTable::PsCrossE0E1E2,
                                [0i32, 2, 4], // E0(idx=0,eo=0→0) / E1(1*2=2) / E2(2*2=4)
                                rot_idx,
                                3i32, // n
                                2i32, // c (edge base)
                                12i32, // pn (12 edges)
                            )
                        };

                        let init_idx =
                            array_to_index(&target_arr, mt_n, mt_c, mt_pn) as u32;
                        let mt = self.aux_mt(table);
                        let mut cur = init_idx;
                        let mut cur_cr = virtual_cross_scaled;
                        let mapper = &rm[rot_idx];
                        for &m in alg {
                            let m_p = cj[m as usize][slot_k] as usize;
                            let m_r = mapper[m_p] as usize;
                            cur = mt[(cur as usize) * 18 + m_r];
                            cur_cr = mt_e4[(cur_cr as usize) + m_r];
                        }
                        out[count] = AuxState {
                            table,
                            current_idx: cur,
                            current_cross_scaled: cur_cr,
                            move_mapper_idx: rot_idx as u8,
                        };
                        count += 1;

                        // mark pairs covered
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
                let p1 = target_pieces[i];
                let p2 = target_pieces[j];
                if p1 < 8 && p2 < 8 && covered[p1 as usize][p2 as usize] {
                    continue;
                }

                if p1 < 4 && p2 < 4 {
                    let r1 = ((p1 as i32 - slot_k as i32 + 4) & 3) as u32;
                    let r2 = ((p2 as i32 - slot_k as i32 + 4) & 3) as u32;
                    let (k1, k2) = if r1 < r2 { (r1, r2) } else { (r2, r1) };
                    let (table, rot_idx, target): (AuxTable, usize, [i32; 2]) =
                        if k2.wrapping_sub(k1) == 2 {
                            let rot = if k1 == 0 { 0 } else { 1 };
                            (AuxTable::PsCrossE0E2, rot, [0, 4])
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
                    let target_arr = [target[0], target[1]];
                    let init_idx = array_to_index(&target_arr, 2, 2, 12) as u32;
                    let mt = self.aux_mt(table);
                    let mut cur = init_idx;
                    let mut cur_cr = virtual_cross_scaled;
                    let mapper = &rm[rot_idx];
                    for &m in alg {
                        let m_p = cj[m as usize][slot_k] as usize;
                        let m_r = mapper[m_p] as usize;
                        cur = mt[(cur as usize) * 18 + m_r];
                        cur_cr = mt_e4[(cur_cr as usize) + m_r];
                    }
                    out[count] = AuxState {
                        table,
                        current_idx: cur,
                        current_cross_scaled: cur_cr,
                        move_mapper_idx: rot_idx as u8,
                    };
                    count += 1;
                } else if p1 >= 4 && p2 >= 4 {
                    let r1 = (((p1 - 4) as i32 - slot_k as i32 + 4) & 3) as u32 + 4;
                    let r2 = (((p2 - 4) as i32 - slot_k as i32 + 4) & 3) as u32 + 4;
                    let (k1, k2) = if r1 < r2 { (r1, r2) } else { (r2, r1) };
                    let (table, rot_idx, target): (AuxTable, usize, [i32; 2]) =
                        if k2.wrapping_sub(k1) == 2 {
                            let rot = if k1 == 4 { 0 } else { 3 };
                            (AuxTable::PsCrossC4C6, rot, [12, 18])
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
                    let target_arr = [target[0], target[1]];
                    let init_idx = array_to_index(&target_arr, 2, 3, 8) as u32;
                    let mt = self.aux_mt(table);
                    let mut cur = init_idx;
                    let mut cur_cr = virtual_cross_scaled;
                    let mapper = &rm[rot_idx];
                    for &m in alg {
                        let m_p = cj[m as usize][slot_k] as usize;
                        let m_r = mapper[m_p] as usize;
                        cur = mt[(cur as usize) * 18 + m_r];
                        cur_cr = mt_e4[(cur_cr as usize) + m_r];
                    }
                    out[count] = AuxState {
                        table,
                        current_idx: cur,
                        current_cross_scaled: cur_cr,
                        move_mapper_idx: rot_idx as u8,
                    };
                    count += 1;
                }
            }
        }

        (out, count)
    }

    /// IDA* 三路径搜索。对应 C++ `search_3`。
    #[allow(clippy::too_many_arguments)]
    fn search_3(
        &self,
        i1a: usize,
        i2a: usize,
        i3a: usize,
        p1: &PackedPruneTable,
        i1b: usize,
        i2b: usize,
        i3b: usize,
        tr_b: &[u8; 18],
        p2: &PackedPruneTable,
        i1c: usize,
        i2c: usize,
        i3c: usize,
        tr_c: &[u8; 18],
        p3: &PackedPruneTable,
        depth: u32,
        prev: u8,
        num_aux: usize,
        aux_states: &[AuxState; MAX_AUX],
    ) -> bool {
        let (vmoves, vcnt) = valid_moves();
        let count = vcnt[prev as usize] as usize;
        let row = &vmoves[prev as usize];
        let mt_e4 = self.mt_edge4.as_u32();
        let mt_c = self.mt_corn.as_u32();
        let mt_e = self.mt_edge.as_u32();
        let rm = rot_map();

        let mut local: u64 = 0;
        for k in 0..count {
            let m = row[k] as usize;
            local += 1;

            // 1. Aux
            let n_i1a = mt_e4[i1a + m] as usize;

            let mut aux_pruned = false;
            let mut next_aux = [AuxState::EMPTY; MAX_AUX];
            for i in 0..num_aux {
                let cur = &aux_states[i];
                if !cur.is_valid() {
                    continue;
                }
                let mapper = &rm[cur.move_mapper_idx as usize];
                let m_rot = mapper[m] as usize;
                let mt_aux = self.aux_mt(cur.table);
                let n_current_idx = mt_aux[(cur.current_idx as usize) * 18 + m_rot];
                let n_cross_scaled = mt_e4[(cur.current_cross_scaled as usize) + m_rot];
                let lookup_cross_idx = (n_cross_scaled / 24) as u64;
                let idx_aux: u64 = lookup_cross_idx
                    * Self::aux_multiplier(cur.table) as u64
                    + n_current_idx as u64;
                if self.aux_pt(cur.table).get(idx_aux) as u32 >= depth {
                    aux_pruned = true;
                    break;
                }
                next_aux[i] = AuxState {
                    table: cur.table,
                    current_idx: n_current_idx,
                    current_cross_scaled: n_cross_scaled,
                    move_mapper_idx: cur.move_mapper_idx,
                };
            }
            if aux_pruned {
                continue;
            }

            // 2. Side A
            let n_i2a = mt_c[i2a + m] as usize;
            let n_i3a = mt_e[i3a + m] as usize;
            let idx1: u64 = (n_i1a as u64 + n_i2a as u64) * 24 + n_i3a as u64;
            if p1.get(idx1) as u32 >= depth {
                continue;
            }

            // 3. Side B
            let m_b = tr_b[m] as usize;
            let n_i1b = mt_e4[i1b + m_b] as usize;
            let n_i2b = mt_c[i2b + m_b] as usize;
            let n_i3b = mt_e[i3b + m_b] as usize;
            let idx2: u64 = (n_i1b as u64 + n_i2b as u64) * 24 + n_i3b as u64;
            if p2.get(idx2) as u32 >= depth {
                continue;
            }

            // 4. Side C
            let m_c = tr_c[m] as usize;
            let n_i1c = mt_e4[i1c + m_c] as usize;
            let n_i2c = mt_c[i2c + m_c] as usize;
            let n_i3c = mt_e[i3c + m_c] as usize;
            let idx3: u64 = (n_i1c as u64 + n_i2c as u64) * 24 + n_i3c as u64;
            if p3.get(idx3) as u32 >= depth {
                continue;
            }

            if depth == 1 {
                bump_node_count(local);
                return true;
            }
            if self.search_3(
                n_i1a, n_i2a * 18, n_i3a * 18, p1,
                n_i1b, n_i2b * 18, n_i3b * 18, tr_b, p2,
                n_i1c, n_i2c * 18, n_i3c * 18, tr_c, p3,
                depth - 1, m as u8, num_aux, &next_aux,
            ) {
                bump_node_count(local);
                return true;
            }
        }
        bump_node_count(local);
        false
    }

    /// 6 排列(permutation of [0,1,2]),内联实现 std::next_permutation 的等价。
    fn perms_3() -> [[usize; 3]; 6] {
        [
            [0, 1, 2],
            [0, 2, 1],
            [1, 0, 2],
            [1, 2, 0],
            [2, 0, 1],
            [2, 1, 0],
        ]
    }

    fn solve_one(&self, alg: &[Move], rot: &str, xxc_result: u32) -> u32 {
        let mut buf: Vec<u8> = alg.iter().map(|m| m.index() as u8).collect();
        alg_rotation(&mut buf, rot);
        let st = self.initial_states(&buf);

        const TRIPLES: [[usize; 3]; 4] =
            [[0, 1, 2], [0, 1, 3], [0, 2, 3], [1, 2, 3]];

        let mut tasks: Vec<PseudoTask3> = Vec::with_capacity(16);

        for ct in &TRIPLES {
            for et in &TRIPLES {
                for p in &Self::perms_3() {
                    let d1 = Self::get_diff(ct[0] as u32, et[p[0]] as u32);
                    let d2 = Self::get_diff(ct[1] as u32, et[p[1]] as u32);
                    let d3 = Self::get_diff(ct[2] as u32, et[p[2]] as u32);
                    if d1 != d2 || d2 != d3 {
                        continue;
                    }
                    let mut h_base = std::cmp::max(
                        std::cmp::max(
                            self.get_h(&st[ct[0]], d1),
                            self.get_h(&st[ct[1]], d2),
                        ),
                        self.get_h(&st[ct[2]], d3),
                    );

                    let targets: [u8; 6] = [
                        (ct[0] + 4) as u8,
                        (ct[1] + 4) as u8,
                        (ct[2] + 4) as u8,
                        et[p[0]] as u8,
                        et[p[1]] as u8,
                        et[p[2]] as u8,
                    ];
                    let (aux, n_aux) = self.setup_aux(&targets, &buf, ct[0]);
                    for k in 0..n_aux {
                        let cur = &aux[k];
                        let lookup_c = if cur.is_valid() {
                            cur.current_cross_scaled / 24
                        } else {
                            st[ct[0]].im / 24
                        };
                        let idx_aux: u64 = lookup_c as u64
                            * Self::aux_multiplier(cur.table) as u64
                            + cur.current_idx as u64;
                        let h = self.aux_pt(cur.table).get(idx_aux) as u32;
                        if h > h_base {
                            h_base = h;
                        }
                    }
                    tasks.push(PseudoTask3 {
                        c1: ct[0],
                        c2: ct[1],
                        c3: ct[2],
                        diff1: d1,
                        diff2: d2,
                        diff3: d3,
                        h: h_base,
                        num_aux: n_aux,
                        aux_init: aux,
                    });
                }
            }
        }
        tasks.sort_by_key(|t| t.h);

        let mut current_best: u32 = 99;
        for t in &tasks {
            if t.h >= current_best {
                break;
            }
            let res: u32 = if t.h == 0 {
                0
            } else {
                let max_search = std::cmp::min(16, current_best.saturating_sub(1));
                let start_d = std::cmp::max(t.h, xxc_result);
                let s1 = &st[t.c1];
                let s2 = &st[t.c2];
                let s3 = &st[t.c3];
                let p1 = &self.pt_pscross_c4e[t.diff1 as usize];
                let p2 = &self.pt_pscross_c4e[t.diff2 as usize];
                let p3 = &self.pt_pscross_c4e[t.diff3 as usize];
                let tr_b = &self.trans_moves[t.c1][t.c2];
                let tr_c = &self.trans_moves[t.c1][t.c3];
                let mut found = 99u32;
                for d in start_d..=max_search {
                    if self.search_3(
                        s1.im as usize,
                        (s1.ic_b as usize) * 18,
                        (s1.ie_rel[t.diff1 as usize] as usize) * 18,
                        p1,
                        s2.im as usize,
                        (s2.ic_b as usize) * 18,
                        (s2.ie_rel[t.diff2 as usize] as usize) * 18,
                        tr_b,
                        p2,
                        s3.im as usize,
                        (s3.ic_b as usize) * 18,
                        (s3.ie_rel[t.diff3 as usize] as usize) * 18,
                        tr_c,
                        p3,
                        d,
                        18,
                        t.num_aux,
                        &t.aux_init,
                    ) {
                        found = d;
                        break;
                    }
                }
                found
            };
            if res < current_best {
                current_best = res;
            }
        }
        current_best
    }

    pub fn get_stats(&self, alg: &[Move], rots: &[&str], xxc_results: &[u32]) -> Vec<u32> {
        assert_eq!(rots.len(), xxc_results.len());
        rots.iter()
            .zip(xxc_results.iter())
            .map(|(r, &x)| self.solve_one(alg, r, x))
            .collect()
    }
}
