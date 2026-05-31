//! PseudoXXCross 阶段 IDA* 搜索器(Phase 6c)。
//!
//! 移植自 C++ `pseudo_analyzer.cpp` 的 `XCrossSolver::search_2` + `get_stats`
//! 第 2 段(PsXXC),包含 2-subset Aux 剪枝。
//!
//! **Phase 6c 取舍**:
//!   - 仅实现 2-subset Aux(Edge2 邻接/对角 + Corner2 邻接/对角),3-subset Aux
//!     和 search_3 留给 Phase 6d
//!   - **不实现** `pt_cross_C4C5E0E1` (10 GB) huge table 优化:仅影响 (cp=0,
//!     cp=1, d=0) 的初始 h_base 上界,跳过会让该 case 搜索慢但结果不变
//!
//! 依赖表:
//!   - mt_edge4 / mt_corn / mt_edge / mt_edge2 / mt_corn2
//!   - pt_pscross_C4E[0..3](4 × ~52 MB)
//!   - pt_pscross_E0E1 / E0E2(~48 MB 各)
//!   - pt_pscross_C4C5 / C4C6(~46 MB 各)
//!   总 ~410 MB,默认放行(不需要 CUBE_ALLOW_HUGE_TABLES)

use std::sync::{Arc, OnceLock};

use crate::cube_common::{
    alg_rotation, array_to_index, conj_moves_flat, rot_map, state_space, valid_moves, Move,
};
use crate::executor::bump_node_count;
use crate::move_tables::{self, MoveTable};
use crate::prune_tables::{self, PackedPruneTable};

const MAX_AUX: usize = 8;

/// 4 张 2-subset 辅助剪枝表的标识。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum AuxTable {
    PsCrossE0E1,
    PsCrossE0E2,
    PsCrossC4C5,
    PsCrossC4C6,
}

/// 单个 Aux 剪枝在搜索路径上的当前状态。
#[derive(Debug, Clone, Copy)]
struct AuxState {
    table: AuxTable,
    current_idx: u32,
    /// 虚拟 Cross 状态(已乘 24),配合 move_mapper 跟随子表自己的视角。
    current_cross_scaled: u32,
    /// rot_map 中的视角索引(0..3),设为 4 表示无效。
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

pub struct PseudoXXCrossSolver {
    mt_edge4: Arc<MoveTable>,
    mt_corn: Arc<MoveTable>,
    mt_edge: Arc<MoveTable>,
    mt_edge2: Arc<MoveTable>,
    mt_corn2: Arc<MoveTable>,
    pt_pscross_c4e: [Arc<PackedPruneTable>; 4],
    pt_pscross_e0e1: Arc<PackedPruneTable>,
    pt_pscross_e0e2: Arc<PackedPruneTable>,
    pt_pscross_c4c5: Arc<PackedPruneTable>,
    pt_pscross_c4c6: Arc<PackedPruneTable>,
    /// trans_moves[s1][s2][m_s1] = m_s2:slot s1 frame 中的 move 在 slot s2 frame 中是什么。
    trans_moves: &'static [[[u8; 18]; 4]; 4],
}

#[derive(Debug, Clone, Copy)]
struct ConjState {
    im: u32,
    ic_b: u32,
    ie_rel: [u32; 4],
}

/// PsXXC 单个 task:两个 corner slot + 两个 edge slot(c1, c2 配 e1, e2)。
struct PseudoTask2 {
    c1: usize,
    c2: usize,
    diff1: u32,
    diff2: u32,
    h: u32,
    num_aux: usize,
    aux_init: [AuxState; MAX_AUX],
}

impl PseudoXXCrossSolver {
    pub fn new() -> Self {
        let mtm = move_tables::instance();
        let ptm = prune_tables::instance();
        PseudoXXCrossSolver {
            mt_edge4: mtm.ensure_edge4(),
            mt_corn: mtm.ensure_corn(),
            mt_edge: mtm.ensure_edge(),
            mt_edge2: mtm.ensure_edge2(),
            mt_corn2: mtm.ensure_corn2(),
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
            trans_moves: trans_moves(),
        }
    }

    #[inline]
    fn aux_pt(&self, t: AuxTable) -> &PackedPruneTable {
        match t {
            AuxTable::PsCrossE0E1 => &self.pt_pscross_e0e1,
            AuxTable::PsCrossE0E2 => &self.pt_pscross_e0e2,
            AuxTable::PsCrossC4C5 => &self.pt_pscross_c4c5,
            AuxTable::PsCrossC4C6 => &self.pt_pscross_c4c6,
        }
    }

    #[inline]
    fn aux_mt(&self, t: AuxTable) -> &[u32] {
        match t {
            AuxTable::PsCrossE0E1 | AuxTable::PsCrossE0E2 => self.mt_edge2.as_u32(),
            AuxTable::PsCrossC4C5 | AuxTable::PsCrossC4C6 => self.mt_corn2.as_u32(),
        }
    }

    #[inline]
    fn aux_multiplier(t: AuxTable) -> u32 {
        match t {
            AuxTable::PsCrossE0E1 | AuxTable::PsCrossE0E2 => state_space::EDGE2 as u32,
            AuxTable::PsCrossC4C5 | AuxTable::PsCrossC4C6 => state_space::CORNER2 as u32,
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

    /// 4 corner slot 的 ConjState(cross + corner + 4 edges 在 slot 视角下推演)。
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

    /// 翻译 C++ `setup_aux_pruners_struct` 的 2-subset 部分。
    /// target_pieces 是 4 个元素:2 个 corner(4..=7)+ 2 个 edge(0..=3)。
    /// 只检查同类型对(edge-edge / corner-corner),最多 2 个 aux state。
    fn setup_aux_2subset(
        &self,
        target_pieces: &[u8; 4],
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

        for i in 0..4 {
            for j in (i + 1)..4 {
                if count >= MAX_AUX {
                    break;
                }
                let p1 = target_pieces[i];
                let p2 = target_pieces[j];

                if p1 < 4 && p2 < 4 {
                    // Edge-Edge: 用 E2 表(邻接 E0E1 / 对角 E0E2)
                    let r1 = ((p1 as i32 - slot_k as i32 + 4) & 3) as u32;
                    let r2 = ((p2 as i32 - slot_k as i32 + 4) & 3) as u32;
                    let (k1, k2) = if r1 < r2 { (r1, r2) } else { (r2, r1) };

                    let (table, rot_idx, target): (AuxTable, usize, [i32; 2]) =
                        if k2.wrapping_sub(k1) == 2 {
                            // 对角 {0,2} / {1,3}
                            let rot = if k1 == 0 { 0 } else { 1 };
                            (AuxTable::PsCrossE0E2, rot, [0, 4]) // E0(idx 0,eo 0) / E2(idx 2,eo 0)
                        } else {
                            // 邻接 {0,1} / {0,3} / {2,3} / {1,2}
                            let rot = match (k1, k2) {
                                (0, 1) => 0,
                                (0, 3) => 1,
                                (2, 3) => 2,
                                (1, 2) => 3,
                                _ => 0,
                            };
                            (AuxTable::PsCrossE0E1, rot, [0, 2]) // E0 / E1
                        };

                    let target_arr = [target[0], target[1]];
                    let init_idx =
                        array_to_index(&target_arr, 2, 2, 12) as u32;
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
                    // Corner-Corner: 用 C2 表(邻接 C4C5 / 对角 C4C6)
                    let r1 = (((p1 - 4) as i32 - slot_k as i32 + 4) & 3) as u32 + 4;
                    let r2 = (((p2 - 4) as i32 - slot_k as i32 + 4) & 3) as u32 + 4;
                    let (k1, k2) = if r1 < r2 { (r1, r2) } else { (r2, r1) };

                    let (table, rot_idx, target): (AuxTable, usize, [i32; 2]) =
                        if k2.wrapping_sub(k1) == 2 {
                            // 对角 {4,6} / {5,7}
                            let rot = if k1 == 4 { 0 } else { 3 };
                            (AuxTable::PsCrossC4C6, rot, [12, 18]) // C4(idx 4,co 0) / C6(idx 6,co 0)
                        } else {
                            // 邻接 {4,5} / {4,7} / {6,7} / {5,6}
                            let rot = match (k1, k2) {
                                (4, 5) => 0,
                                (4, 7) => 1,
                                (6, 7) => 2,
                                (5, 6) => 3,
                                _ => 0,
                            };
                            (AuxTable::PsCrossC4C5, rot, [12, 15]) // C4 / C5
                        };

                    let target_arr = [target[0], target[1]];
                    let init_idx =
                        array_to_index(&target_arr, 2, 3, 8) as u32;
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
                // mixed (1 corner + 1 edge): skipped
            }
        }
        (out, count)
    }

    /// IDA* 双路径搜索。side A 用 raw m,side B 用 tr_b[m] 翻译。
    /// 对应 C++ `search_2`(已忽略 huge_table 与 3-subset aux)。
    #[allow(clippy::too_many_arguments)]
    fn search_2(
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

            // 1. Aux Pruning(放最前面)。2-subset 下 aux 全部带 move_mapper,
            // 用 aux 自身的 virtual_cross 而非 side A 的 cross_state_idx。
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

                let idx_aux: u64 =
                    lookup_cross_idx * Self::aux_multiplier(cur.table) as u64
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

            // 2. Base Pruning Side A
            let n_i2a = mt_c[i2a + m] as usize;
            let n_i3a = mt_e[i3a + m] as usize;
            let idx1: u64 = (n_i1a as u64 + n_i2a as u64) * 24 + n_i3a as u64;
            if p1.get(idx1) as u32 >= depth {
                continue;
            }

            // 3. Base Pruning Side B(用 tr_b 翻译 m)
            let m_b = tr_b[m] as usize;
            let n_i1b = mt_e4[i1b + m_b] as usize;
            let n_i2b = mt_c[i2b + m_b] as usize;
            let n_i3b = mt_e[i3b + m_b] as usize;
            let idx2: u64 = (n_i1b as u64 + n_i2b as u64) * 24 + n_i3b as u64;
            if p2.get(idx2) as u32 >= depth {
                continue;
            }

            if depth == 1 {
                bump_node_count(local);
                return true;
            }
            if self.search_2(
                n_i1a,
                n_i2a * 18,
                n_i3a * 18,
                p1,
                n_i1b,
                n_i2b * 18,
                n_i3b * 18,
                tr_b,
                p2,
                depth - 1,
                m as u8,
                num_aux,
                &next_aux,
            ) {
                bump_node_count(local);
                return true;
            }
        }
        bump_node_count(local);
        false
    }

    /// 单视角(rotation)的 PsXXC 最少步数。
    /// `xc_result` 是该 rotation 的 PsXCross 解,作为跨阶段下界。
    fn solve_one(&self, alg: &[Move], rot: &str, xc_result: u32) -> u32 {
        let mut buf: Vec<u8> = alg.iter().map(|m| m.index() as u8).collect();
        alg_rotation(&mut buf, rot);
        let st = self.initial_states(&buf);

        const PAIRS: [(usize, usize); 6] =
            [(0, 1), (0, 2), (0, 3), (1, 2), (1, 3), (2, 3)];

        let mut tasks: Vec<PseudoTask2> = Vec::with_capacity(72);

        for &cp in &PAIRS {
            for &ep in &PAIRS {
                // 第一组:(ep.0 → cp.0, ep.1 → cp.1)
                let d1 = Self::get_diff(cp.0 as u32, ep.0 as u32);
                let d2 = Self::get_diff(cp.1 as u32, ep.1 as u32);
                let mut h_base = std::cmp::max(
                    self.get_h(&st[cp.0], d1),
                    self.get_h(&st[cp.1], d2),
                );
                let targets1: [u8; 4] = [
                    (cp.0 + 4) as u8,
                    (cp.1 + 4) as u8,
                    ep.0 as u8,
                    ep.1 as u8,
                ];
                let (aux1, n1) = self.setup_aux_2subset(&targets1, &buf, cp.0);
                for k in 0..n1 {
                    let cur = &aux1[k];
                    let lookup_c = if cur.is_valid() {
                        cur.current_cross_scaled / 24
                    } else {
                        st[cp.0].im / 24
                    };
                    let idx_aux: u64 = lookup_c as u64
                        * Self::aux_multiplier(cur.table) as u64
                        + cur.current_idx as u64;
                    let h = self.aux_pt(cur.table).get(idx_aux) as u32;
                    if h > h_base {
                        h_base = h;
                    }
                }
                tasks.push(PseudoTask2 {
                    c1: cp.0,
                    c2: cp.1,
                    diff1: d1,
                    diff2: d2,
                    h: h_base,
                    num_aux: n1,
                    aux_init: aux1,
                });

                // 第二组:edges swapped (ep.1 → cp.0, ep.0 → cp.1)
                let d1s = Self::get_diff(cp.0 as u32, ep.1 as u32);
                let d2s = Self::get_diff(cp.1 as u32, ep.0 as u32);
                let mut h_base2 = std::cmp::max(
                    self.get_h(&st[cp.0], d1s),
                    self.get_h(&st[cp.1], d2s),
                );
                let targets2: [u8; 4] = [
                    (cp.0 + 4) as u8,
                    (cp.1 + 4) as u8,
                    ep.1 as u8,
                    ep.0 as u8,
                ];
                let (aux2, n2) = self.setup_aux_2subset(&targets2, &buf, cp.0);
                for k in 0..n2 {
                    let cur = &aux2[k];
                    let lookup_c = if cur.is_valid() {
                        cur.current_cross_scaled / 24
                    } else {
                        st[cp.0].im / 24
                    };
                    let idx_aux: u64 = lookup_c as u64
                        * Self::aux_multiplier(cur.table) as u64
                        + cur.current_idx as u64;
                    let h = self.aux_pt(cur.table).get(idx_aux) as u32;
                    if h > h_base2 {
                        h_base2 = h;
                    }
                }
                tasks.push(PseudoTask2 {
                    c1: cp.0,
                    c2: cp.1,
                    diff1: d1s,
                    diff2: d2s,
                    h: h_base2,
                    num_aux: n2,
                    aux_init: aux2,
                });
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
                let start_d = std::cmp::max(t.h, xc_result);
                let s1 = &st[t.c1];
                let s2 = &st[t.c2];
                let p1 = &self.pt_pscross_c4e[t.diff1 as usize];
                let p2 = &self.pt_pscross_c4e[t.diff2 as usize];
                let tr_b = &self.trans_moves[t.c1][t.c2];
                let mut found = 99u32;
                for d in start_d..=max_search {
                    if self.search_2(
                        s1.im as usize,
                        (s1.ic_b as usize) * 18,
                        (s1.ie_rel[t.diff1 as usize] as usize) * 18,
                        p1,
                        s2.im as usize,
                        (s2.ic_b as usize) * 18,
                        (s2.ie_rel[t.diff2 as usize] as usize) * 18,
                        tr_b,
                        p2,
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

    /// 6 视角批量统计。`xc_results` 是同一 alg 在 6 视角下的 PsXCross 解。
    pub fn get_stats(&self, alg: &[Move], rots: &[&str], xc_results: &[u32]) -> Vec<u32> {
        assert_eq!(rots.len(), xc_results.len());
        rots.iter()
            .zip(xc_results.iter())
            .map(|(r, &x)| self.solve_one(alg, r, x))
            .collect()
    }
}

/// 全局 trans_moves 表:trans_moves[s1][s2][m_in_s1_frame] = m_in_s2_frame。
/// pub(crate) 以便 pseudo_xxxcross_solver 复用。
pub(crate) fn trans_moves() -> &'static [[[u8; 18]; 4]; 4] {
    static V: OnceLock<[[[u8; 18]; 4]; 4]> = OnceLock::new();
    V.get_or_init(|| {
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
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::cross_solver::CrossSolver;
    use crate::cube_common::{string_to_alg, test_env_lock};
    use crate::pseudo_xcross_solver::PseudoXCrossSolver;
    use std::path::PathBuf;

    fn setup_iso_dir(name: &str) -> PathBuf {
        let p = PathBuf::from("target").join("test-tables").join(name);
        let _ = std::fs::remove_dir_all(&p);
        std::fs::create_dir_all(&p).unwrap();
        p
    }

    fn cleanup(p: &PathBuf) {
        let _ = std::fs::remove_dir_all(p);
    }

    /// PsXXCross 6 列对照 golden(D:/cube/solver/golden/scramble_1000_pseudo.txt
    /// 前 3 行的 pseudo_xxcross_z0..pseudo_xxcross_x1 列):
    ///   id 22001: 8, 8, 8, 8, 9, 8
    ///   id 23001: 8, 7, 6, 9, 9, 7
    ///   id 24001: 9, 8, 10, 8, 8, 8
    ///
    /// 需 ~410 MB 表(4 pscross_C4E + E0E1 + E0E2 + C4C5 + C4C6),
    /// release 下生成约 2-3 分钟,首次跑后复用。默认 `#[ignore]`。
    #[test]
    #[ignore]
    fn pseudo_xxcross_matches_golden_first3() {
        let _lock = test_env_lock().lock().unwrap_or_else(|e| e.into_inner());
        let dir = setup_iso_dir("pseudo_xxcross_golden");
        std::env::set_var("CUBE_TABLE_DIR", &dir);

        let cases: &[(&str, &str, [u32; 6])] = &[
            (
                "22001",
                "B2 U' L2 U F2 L2 D2 L2 U F2 L F2 L D U L' D2 F' U2 B",
                [8, 8, 8, 8, 9, 8],
            ),
            (
                "23001",
                "D2 U L2 B2 R2 F2 R2 U2 R2 D' R' D B2 U B' R B' D B' L'",
                [8, 7, 6, 9, 9, 7],
            ),
            (
                "24001",
                "L2 D F2 D' B2 L2 R2 U2 F2 D L' U2 R2 B' R F R2 D' U F L' F'",
                [9, 8, 10, 8, 8, 8],
            ),
        ];

        let rots = ["", "z2", "z'", "z", "x'", "x"];
        let cross = CrossSolver::new(true);
        let xcross = PseudoXCrossSolver::new();
        let xxcross = PseudoXXCrossSolver::new();

        for (id, scramble, expected) in cases {
            let alg = string_to_alg(scramble);
            let cross_results = cross.get_stats(&alg, &rots);
            let xc_results = xcross.get_stats(&alg, &rots, &cross_results);
            let got = xxcross.get_stats(&alg, &rots, &xc_results);
            assert_eq!(
                got.as_slice(),
                expected,
                "pseudo_xxcross id {} mismatch: got {:?} expected {:?}",
                id,
                got,
                expected
            );
        }

        cleanup(&dir);
    }
}
