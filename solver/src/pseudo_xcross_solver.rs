//! PseudoXCross 阶段 IDA* 搜索器(Phase 6b)。
//!
//! 移植自 C++ `pseudo_analyzer.cpp` 的 `XCrossSolver::search_1` + `get_stats`
//! 第 1 段(PsXC)。
//!
//! 与 std XCross 的差异:
//!   - pseudo 用 4 张 `pt_pscross_C4E[diff]` 表(diff = (e - c + 4) & 3),
//!     std 只用 1 张 `pt_cross_C4E0`
//!   - 16 个 task = 4 corner slot × 4 edge slot,每个 task 选对应 diff 的表
//!   - **`search_1` 内不 conj**(conj 全部在 `initial_states` 完成),std 在
//!     search 内 conj。这是 C++ 端的设计选择,两者深度结论等价
//!   - `max_search = min(16, current_best - 1)`(std 是 min(12, ...))
//!   - 支持跨阶段 early-exit:startD = max(t.h, ps_cross_result_for_this_rot)
//!
//! 依赖表:
//!   - mt_edge4 (~17 MB, stride=24, 值=cross_idx*24)
//!   - mt_corn (~1.7 KB, stride=18)
//!   - mt_edge (~1.7 KB, stride=18)
//!   - pt_pscross_C4E[0..3](4 × ~52 MB, 4-bit packed)

use std::sync::Arc;
use std::sync::OnceLock;

use crate::cube_common::{
    alg_rotation, conj_moves_flat, state_space, valid_moves, valid_moves_masked, Move, MoveMask,
    ValidMovesTable,
};
use crate::executor::bump_node_count;
use crate::move_tables::{self, MoveTable};
use crate::prune_tables::{self, PackedPruneTable};

pub struct PseudoXCrossSolver {
    mt_edge4: Arc<MoveTable>,
    mt_corn: Arc<MoveTable>,
    mt_edge: Arc<MoveTable>,
    pt_pscross_c4e: [Arc<PackedPruneTable>; 4],
}

/// 单 corner slot 在指定 alg 下的初始状态。
/// 对应 C++ `ConjState`:im、ic_b、ie_rel[4]。
#[derive(Debug, Clone, Copy)]
struct ConjState {
    /// mt_edge4 当前状态(已乘 24,可直接喂 search_1 当 i1)
    im: u32,
    /// mt_corn 当前状态(0..23,search_1 入口要 * 18)
    ic_b: u32,
    /// 4 个 edge slot 的 mt_edge 当前状态(0..23,search_1 入口要 * 18)
    ie_rel: [u32; 4],
}

impl PseudoXCrossSolver {
    #[cfg(not(target_arch = "wasm32"))]
    pub fn new() -> Self {
        let mtm = move_tables::instance();
        let ptm = prune_tables::instance();
        PseudoXCrossSolver {
            mt_edge4: mtm.ensure_edge4(),
            mt_corn: mtm.ensure_corn(),
            mt_edge: mtm.ensure_edge(),
            pt_pscross_c4e: [
                ptm.ensure_pt_pscross_c4e(0),
                ptm.ensure_pt_pscross_c4e(1),
                ptm.ensure_pt_pscross_c4e(2),
                ptm.ensure_pt_pscross_c4e(3),
            ],
        }
    }

    /// IDA* 单层尝试。i1 是 mt_edge4 偏移(已含 *24),i2/i3 是 mt_corn/mt_edge
    /// 偏移(已含 *18)。`pt` 是预选的 pt_pscross_C4E[diff]。
    /// **注意**:与 std XCross 不同,这里 **不** 用 conj_moves_flat,直接用 raw m。
    fn search_1(
        &self,
        i1: usize,
        i2: usize,
        i3: usize,
        depth: u32,
        prev: u8,
        pt: &PackedPruneTable,
    ) -> bool {
        let (vmoves, vcnt) = valid_moves();
        let count = vcnt[prev as usize] as usize;
        let row = &vmoves[prev as usize];
        let mt_e4 = self.mt_edge4.as_u32();
        let mt_c = self.mt_corn.as_u32();
        let mt_e = self.mt_edge.as_u32();

        let mut local: u64 = 0;
        for k in 0..count {
            let m = row[k] as usize;
            local += 1;
            let n_i1 = mt_e4[i1 + m] as usize;
            let n_i2 = mt_c[i2 + m] as usize;
            let n_i3 = mt_e[i3 + m] as usize;
            let idx: u64 = (n_i1 as u64 + n_i2 as u64) * 24 + n_i3 as u64;
            if pt.get(idx) as u32 >= depth {
                continue;
            }
            if depth == 1 {
                bump_node_count(local);
                return true;
            }
            if self.search_1(n_i1, n_i2 * 18, n_i3 * 18, depth - 1, m as u8, pt) {
                bump_node_count(local);
                return true;
            }
        }
        bump_node_count(local);
        false
    }

    /// 计算 4 个 corner slot 的 ConjState(每个 slot 跟踪 cross + corner + 4 edges)。
    /// 对应 C++ `get_conjugated_indices_all`,对每个 slot_k 把 alg 用
    /// conj_moves_flat[m][slot_k] 推一遍。
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
            // 4 个 edge 起始 raw 状态:idx 0/1/2/3 各 *2 (eo=0) = 0/2/4/6
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

    /// `(se - sc + 4) & 3`,对应 C++ `get_diff`。
    #[inline]
    fn get_diff(sc: u32, se: u32) -> u32 {
        (se.wrapping_sub(sc).wrapping_add(4)) & 3
    }

    /// 当前 (corner_slot, edge_slot) pair 的 h 值。
    /// 对应 C++ get_h: `pt_pscross_C4E[diff].get((im + ic_b) * 24 + ie_rel[diff])`。
    #[inline]
    fn get_h(&self, s: &ConjState, diff: u32) -> u32 {
        let idx: u64 = (s.im as u64 + s.ic_b as u64) * 24 + s.ie_rel[diff as usize] as u64;
        self.pt_pscross_c4e[diff as usize].get(idx) as u32
    }

    /// 单视角(rotation)的 PsXCross 最少步数。
    /// `cross_result` 是该 rotation 的 PsCross 解,作为跨阶段下界:
    /// PsXC ≥ PsCross,所以搜索起点 startD = max(task.h, cross_result)。
    fn solve_one(&self, alg: &[Move], rot: &str, cross_result: u32) -> u32 {
        let mut buf: Vec<u8> = alg.iter().map(|m| m.index() as u8).collect();
        alg_rotation(&mut buf, rot);
        let st = self.initial_states(&buf);

        // 16 个 task:(c_idx, diff, h)。
        // C++ 内层是 c (corner slot) 外、e (edge slot) 内,Rust 保持顺序。
        let mut tasks: Vec<(usize, u32, u32)> = Vec::with_capacity(16);
        for c in 0..4u32 {
            for e in 0..4u32 {
                let diff = Self::get_diff(c, e);
                tasks.push((c as usize, diff, self.get_h(&st[c as usize], diff)));
            }
        }
        tasks.sort_by_key(|t| t.2);

        let mut current_best: u32 = 99;
        for &(c_idx, diff, h) in &tasks {
            if h >= current_best {
                break;
            }
            let res: u32 = if h == 0 {
                0
            } else {
                let max_search = std::cmp::min(16, current_best.saturating_sub(1));
                let start_d = std::cmp::max(h, cross_result);
                let pt = &self.pt_pscross_c4e[diff as usize];
                let s = &st[c_idx];
                let mut found = 99u32;
                for d in start_d..=max_search {
                    if self.search_1(
                        s.im as usize,
                        (s.ic_b as usize) * 18,
                        (s.ie_rel[diff as usize] as usize) * 18,
                        d,
                        18,
                        pt,
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

    /// 6 视角批量统计。`cross_results` 是同一 alg 在 6 视角下的 PsCross 解,
    /// 用于跨阶段 early-exit。
    pub fn get_stats(&self, alg: &[Move], rots: &[&str], cross_results: &[u32]) -> Vec<u32> {
        assert_eq!(
            rots.len(),
            cross_results.len(),
            "rots and cross_results must have same length"
        );
        rots.iter()
            .zip(cross_results.iter())
            .map(|(r, &cr)| self.solve_one(alg, r, cr))
            .collect()
    }
}

// ============================================================================
// 小表 cascade(wasm 友好,无 54MB pt_pscross_C4E)
// ----------------------------------------------------------------------------
// native PseudoX*CrossSolver 用 4 × 54MB `pt_pscross_C4E[diff]`(联合追踪
// cross+corner+edge,既剪枝又在叶子验证目标)+ 深阶段 ~1.8GB aux 表,浏览器装不下。
//
// 这里照 f2leo / pair 小表的思路:**现场 BFS 建一张 pseudo cross+corner 表**
// (CROSS×CORNER = 190080×24 = 4.56M 字节,~4.6MB RAM,构建 < 0.2s),作每个
// X-cross 槽(corner slot)的可采纳下界(丢掉 edge 约束只会让距离变小 ⇒ 可采纳),
// **edge 在叶子显式验证**到目标 `2*diff`。多槽阶段(xx/xxx)显式逐槽追踪,叶子要求
// 每槽 cross+corner==0(pseudo 4 朝向之一)且 edge==2*diff_i,等价于 cross + 这
// N 个 (corner,edge) pair 全归位 ⇒ N-pseudo-cross 解出。
//
// 与大表的等价性:
//   * 大表叶子 value==0 ⟺ (cross,corner,edge) 命中某个 seed ⟺ cross+corner 在 4
//     pseudo 朝向之一(cross+corner 表 ==0)且 edge==2*diff。两套叶子条件**完全相同**
//     (seed 把 edge 固定在 2*diff,只旋转 cross+corner)。
//   * cross+corner 表是真实 cross+corner+edge 距离的可采纳下界 ⇒ IDA* 首达深度即最优
//     ⇒ 与大表逐格 bit-exact,仅访问更多节点。
// pseudo_cross(stage 0)用 pt_pscross(140KB)+ mt_edge2,本就是小表,直接内联。
//
// 所需服务表(全小):
//   mt_edge2 (~37KB) / mt_edge4 (~17MB) / mt_corn (~1.7KB) / mt_edge (~1.7KB) /
//   pt_pscross (~140KB)。pscross cross+corner 表浏览器现场 BFS 建,不服。

/// pseudo cross+corner 表:`tbl[im + ic]`(im = mt_edge4 值 = cross_idx*24,ic = corner 0..23),
/// 值 = 从 4 个 pseudo-solved(C4 + cross 4 朝向)起的 BFS 距离(255 = 超 BFS_DEPTH)。
struct PsCcPrune {
    tbl: Vec<u8>,
}

/// BFS 深度上界。pseudo cross+corner 真实距离 ≤ 此值则全填;未填(255)仍是可采纳下界
/// (真实距离 ≥ 已展开层数)。取 12 足够覆盖任意 X-cross 的 cross+corner 子距离。
const PSCC_BFS_DEPTH: u8 = 12;

impl PsCcPrune {
    /// 从 mt_edge4(stride 24,值已 ×24)+ mt_corn(stride 18,值 0..23)BFS 建表。
    /// seed:C4(corner idx 12)+ cross_solved,外加 D/D2/D' 旋转的 3 个朝向(pseudo)。
    fn build(mt_edge4: &[u32], mt_corn: &[u32]) -> Self {
        let nc = state_space::CORNER; // 24
        let size = state_space::CROSS * nc; // 190080 * 24
        let mut tbl = vec![255u8; size];

        // pseudo seeds:identity + D(3)/D2(4)/D'(5),对 (cross, corner) 施加,corner=C4。
        let cross0 = state_space::CROSS_SOLVED * 24; // im 形式
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
                let im = (i / nc) * 24; // cross_idx*24
                let ic18 = (i % nc) * 18;
                for j in 0..18 {
                    let ni = mt_edge4[im + j] as usize + mt_corn[ic18 + j] as usize;
                    if tbl[ni] == 255 {
                        tbl[ni] = d + 1;
                    }
                }
            }
        }
        PsCcPrune { tbl }
    }

    /// im = mt_edge4 值(cross_idx*24),ic = corner 0..23。
    #[inline]
    fn h(&self, im: u32, ic: u32) -> u32 {
        self.tbl[(im as usize) + (ic as usize)] as u32
    }
}

/// 本地 trans_moves[s1][s2][m_in_s1_frame] = m_in_s2_frame(自包含,不跨 native-only
/// 模块借 — 与 pseudo_xxcross_solver::trans_moves 同构,只为让本模块 wasm 可编)。
fn local_trans_moves() -> &'static [[[u8; 18]; 4]; 4] {
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

/// 单个 X-cross 槽(corner slot c + edge slot,绑定 diff)在 alg 下的根状态。
/// im/ic 在 corner slot c 视角下推演;edge 取该视角的 ie_rel[diff],目标 2*diff。
#[derive(Debug, Clone, Copy)]
struct PsPair {
    /// mt_edge4 当前值(cross_idx*24)
    im: u32,
    /// corner 0..23
    ic: u32,
    /// edge 0..23(= ie_rel[diff])
    ie: u32,
    /// corner slot(共轭视角 / trans_moves 用)
    slot: usize,
    /// (edge_slot - corner_slot)&3,edge 目标 = 2*diff
    diff: u32,
}

/// 小表 pseudo cascade。持有现场建的 cross+corner 表 + 必要 move/cross 表。
/// pseudo_cross 用 mt_edge2 + pt_pscross;xcross+ 用 mt_edge4/corn/edge + cc 表。
pub struct PseudoSmallSolver {
    mt_edge2: Arc<MoveTable>,
    mt_edge4: Arc<MoveTable>,
    mt_corn: Arc<MoveTable>,
    mt_edge: Arc<MoveTable>,
    pt_pscross: Arc<PackedPruneTable>,
    cc: PsCcPrune,
    trans: &'static [[[u8; 18]; 4]; 4],
}

impl PseudoSmallSolver {
    /// 预建小表直接构造(绕过 manager / 磁盘 / mmap)。wasm 路径用:
    /// integrator 在外面 `MoveTable::from_bin` / `PackedPruneTable::from_bin` 后传入。
    /// 现场 BFS 建一张 pseudo cross+corner 表(~4.6MB,构建一次 < 0.2s)。
    ///
    /// 参数(from_bin 规格):
    ///   - mt_edge2:`MoveTable::from_bin(bytes, EDGE2=528, 18)`(stride 18)
    ///   - mt_edge4:`MoveTable::from_bin(bytes, CROSS=190080, 24)`(stride 24,值 ×24)
    ///   - mt_corn :`MoveTable::from_bin(bytes, CORNER=24, 18)`
    ///   - mt_edge :`MoveTable::from_bin(bytes, EDGE=24, 18)`
    ///   - pt_pscross:`PackedPruneTable::from_bin(bytes)`(pt_pscross.bin,~140KB)
    pub fn from_tables(
        mt_edge2: Arc<MoveTable>,
        mt_edge4: Arc<MoveTable>,
        mt_corn: Arc<MoveTable>,
        mt_edge: Arc<MoveTable>,
        pt_pscross: Arc<PackedPruneTable>,
    ) -> Self {
        let cc = PsCcPrune::build(mt_edge4.as_u32(), mt_corn.as_u32());
        PseudoSmallSolver {
            mt_edge2,
            mt_edge4,
            mt_corn,
            mt_edge,
            pt_pscross,
            cc,
            trans: local_trans_moves(),
        }
    }

    // ---------------- pseudo_cross(stage 0)----------------
    // 复用 cross_solver 逻辑:两棱组 (i1,i2) + pt_pscross。

    fn cross_search(&self, i1: usize, i2: usize, depth: u32, prev: u8) -> bool {
        let (vmoves, vcnt) = valid_moves();
        let count = vcnt[prev as usize] as usize;
        let row = &vmoves[prev as usize];
        let mt = self.mt_edge2.as_u32();
        for k in 0..count {
            let m = row[k] as usize;
            let n1 = mt[i1 + m] as usize;
            let n2 = mt[i2 + m] as usize;
            let idx = (n1 as u64) * (state_space::EDGE2 as u64) + n2 as u64;
            if self.pt_pscross.get(idx) as u32 >= depth {
                continue;
            }
            if depth == 1 {
                return true;
            }
            if self.cross_search(n1 * 18, n2 * 18, depth - 1, m as u8) {
                return true;
            }
        }
        false
    }

    fn solve_cross(&self, alg: &[u8]) -> u32 {
        let mt = self.mt_edge2.as_u32();
        let mut i1 = state_space::EDGE2_A_SOLVED;
        let mut i2 = state_space::EDGE2_B_SOLVED;
        for &m in alg {
            i1 = mt[i1 * 18 + m as usize] as usize;
            i2 = mt[i2 * 18 + m as usize] as usize;
        }
        let idx = (i1 as u64) * (state_space::EDGE2 as u64) + i2 as u64;
        let d_min = self.pt_pscross.get(idx) as u32;
        if d_min == 0 {
            return 0;
        }
        for d in d_min..=8 {
            if self.cross_search(i1 * 18, i2 * 18, d, 18) {
                return d;
            }
        }
        9
    }

    // ---------------- xcross+ 共用基础设施 ----------------

    /// 4 corner slot 的 ConjState(cross + corner + 4 edges 在各自视角下推演)。
    /// 与 native `initial_states` 完全一致。
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

    #[inline]
    fn get_diff(sc: u32, se: u32) -> u32 {
        (se.wrapping_sub(sc).wrapping_add(4)) & 3
    }

    /// 一个 X-cross 槽的根可采纳下界 = cross+corner 表查值(忽略 edge ⇒ 可采纳)。
    #[inline]
    fn pair_h(&self, p: &PsPair) -> u32 {
        self.cc.h(p.im, p.ic)
    }

    /// N 个 X-cross pair 的多槽 IDA* 单层。参考帧 = pairs[0].slot;move 在参考帧用 raw m,
    /// 其它 pair 用 trans[ref][slot] 翻译。任一 pair 的 cross+corner 表 >= depth ⇒ 剪。
    /// depth==1 且全过 ⇒ 还需每 pair cross+corner==0 且 edge==2*diff。
    fn search_pairs(&self, pairs: &[PsPair], depth: u32, prev: u8) -> bool {
        let (vmoves, vcnt) = valid_moves();
        let count = vcnt[prev as usize] as usize;
        let row = &vmoves[prev as usize];
        let mt_e4 = self.mt_edge4.as_u32();
        let mt_c = self.mt_corn.as_u32();
        let mt_e = self.mt_edge.as_u32();
        let n = pairs.len();
        let ref_slot = pairs[0].slot;

        let mut local: u64 = 0;
        let mut next = [PsPair {
            im: 0,
            ic: 0,
            ie: 0,
            slot: 0,
            diff: 0,
        }; 3];
        for k in 0..count {
            let m = row[k] as usize;
            local += 1;
            let mut pruned = false;
            let mut leaf_ok = depth == 1;
            for (j, p) in pairs.iter().enumerate() {
                // 参考帧 raw m → 该 pair 视角 m_p
                let m_p = self.trans[ref_slot][p.slot][m] as usize;
                let n_im = mt_e4[p.im as usize + m_p] as u32;
                let n_ic = mt_c[p.ic as usize * 18 + m_p] as u32;
                if self.cc.h(n_im, n_ic) >= depth {
                    pruned = true;
                    break;
                }
                let n_ie = mt_e[p.ie as usize * 18 + m_p] as u32;
                if leaf_ok {
                    // cross+corner 已 < 1 ⇒ ==0(pseudo 4 朝向之一);还需 edge 到位。
                    if n_ie != 2 * p.diff {
                        leaf_ok = false;
                    }
                }
                next[j] = PsPair {
                    im: n_im,
                    ic: n_ic,
                    ie: n_ie,
                    slot: p.slot,
                    diff: p.diff,
                };
            }
            if pruned {
                continue;
            }
            if depth == 1 {
                if leaf_ok {
                    bump_node_count(local);
                    return true;
                }
            } else if self.search_pairs(&next[..n], depth - 1, m as u8) {
                bump_node_count(local);
                return true;
            }
        }
        bump_node_count(local);
        false
    }

    /// 解一个 task(N pair),h=根 max 下界,lower=上一阶段 cascade 下界,bound=当前最优封顶。
    fn solve_pairs_task(&self, pairs: &[PsPair], h: u32, lower: u32, bound: u32) -> u32 {
        // 根全解?每 pair cross+corner==0 且 edge==2*diff。
        let root_solved = pairs
            .iter()
            .all(|p| self.cc.h(p.im, p.ic) == 0 && p.ie == 2 * p.diff);
        if root_solved {
            return 0;
        }
        let max_d = std::cmp::min(16, bound.saturating_sub(1));
        let start = std::cmp::max(h.max(lower), 1);
        for d in start..=max_d {
            if self.search_pairs(pairs, d, 18) {
                return d;
            }
        }
        99
    }

    // ---------------- stage 1: pseudo_xcross(1 corner + 1 edge,16 task)----------------

    fn solve_xcross(&self, st: &[ConjState; 4], lower: u32) -> u32 {
        let mut tasks: Vec<(PsPair, u32)> = Vec::with_capacity(16);
        for c in 0..4u32 {
            for e in 0..4u32 {
                let diff = Self::get_diff(c, e);
                let s = &st[c as usize];
                let p = PsPair {
                    im: s.im,
                    ic: s.ic_b,
                    ie: s.ie_rel[diff as usize],
                    slot: c as usize,
                    diff,
                };
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
            let res = self.solve_pairs_task(std::slice::from_ref(p), *h, lower, best);
            best = best.min(res);
        }
        best
    }

    // ---------------- stage 2: pseudo_xxcross(2 corner + 2 edge)----------------

    fn solve_xxcross(&self, st: &[ConjState; 4], lower: u32) -> u32 {
        const PAIRS: [(usize, usize); 6] =
            [(0, 1), (0, 2), (0, 3), (1, 2), (1, 3), (2, 3)];

        // task:2 corner slot × 2 edge slot,edge 两种配对(直/交叉)。
        let mut tasks: Vec<([PsPair; 2], u32)> = Vec::with_capacity(72);
        for &cp in &PAIRS {
            for &ep in &PAIRS {
                for swap in 0..2 {
                    let (e0, e1) = if swap == 0 { (ep.0, ep.1) } else { (ep.1, ep.0) };
                    let d0 = Self::get_diff(cp.0 as u32, e0 as u32);
                    let d1 = Self::get_diff(cp.1 as u32, e1 as u32);
                    let p0 = PsPair {
                        im: st[cp.0].im,
                        ic: st[cp.0].ic_b,
                        ie: st[cp.0].ie_rel[d0 as usize],
                        slot: cp.0,
                        diff: d0,
                    };
                    let p1 = PsPair {
                        im: st[cp.1].im,
                        ic: st[cp.1].ic_b,
                        ie: st[cp.1].ie_rel[d1 as usize],
                        slot: cp.1,
                        diff: d1,
                    };
                    let h = self.pair_h(&p0).max(self.pair_h(&p1));
                    tasks.push(([p0, p1], h));
                }
            }
        }
        tasks.sort_by_key(|t| t.1);

        let mut best = 99u32;
        for (ps, h) in &tasks {
            if *h >= best {
                break;
            }
            let res = self.solve_pairs_task(ps, *h, lower, best);
            best = best.min(res);
        }
        best
    }

    // ---------------- stage 3: pseudo_xxxcross(3 corner + 3 edge)----------------

    fn solve_xxxcross(&self, st: &[ConjState; 4], lower: u32) -> u32 {
        const TRIPLES: [[usize; 3]; 4] =
            [[0, 1, 2], [0, 1, 3], [0, 2, 3], [1, 2, 3]];
        const PERMS: [[usize; 3]; 6] = [
            [0, 1, 2],
            [0, 2, 1],
            [1, 0, 2],
            [1, 2, 0],
            [2, 0, 1],
            [2, 1, 0],
        ];

        let mut tasks: Vec<([PsPair; 3], u32)> = Vec::with_capacity(96);
        for ct in &TRIPLES {
            for et in &TRIPLES {
                for p in &PERMS {
                    let d0 = Self::get_diff(ct[0] as u32, et[p[0]] as u32);
                    let d1 = Self::get_diff(ct[1] as u32, et[p[1]] as u32);
                    let d2 = Self::get_diff(ct[2] as u32, et[p[2]] as u32);
                    let pr0 = PsPair {
                        im: st[ct[0]].im,
                        ic: st[ct[0]].ic_b,
                        ie: st[ct[0]].ie_rel[d0 as usize],
                        slot: ct[0],
                        diff: d0,
                    };
                    let pr1 = PsPair {
                        im: st[ct[1]].im,
                        ic: st[ct[1]].ic_b,
                        ie: st[ct[1]].ie_rel[d1 as usize],
                        slot: ct[1],
                        diff: d1,
                    };
                    let pr2 = PsPair {
                        im: st[ct[2]].im,
                        ic: st[ct[2]].ic_b,
                        ie: st[ct[2]].ie_rel[d2 as usize],
                        slot: ct[2],
                        diff: d2,
                    };
                    let h = self
                        .pair_h(&pr0)
                        .max(self.pair_h(&pr1))
                        .max(self.pair_h(&pr2));
                    tasks.push(([pr0, pr1, pr2], h));
                }
            }
        }
        tasks.sort_by_key(|t| t.1);

        let mut best = 99u32;
        for (ps, h) in &tasks {
            if *h >= best {
                break;
            }
            let res = self.solve_pairs_task(ps, *h, lower, best);
            best = best.min(res);
        }
        best
    }

    // ---------------- 公共入口 ----------------

    /// 单视角 4 阶段(pseudo_cross / xcross / xxcross / xxxcross)。cascade 串下界。
    fn solve_one_all(&self, alg: &[u8]) -> [u32; 4] {
        let cross = self.solve_cross(alg);
        let st = self.initial_states(alg);
        let xc = self.solve_xcross(&st, cross);
        let xxc = self.solve_xxcross(&st, xc);
        let xxxc = self.solve_xxxcross(&st, xxc);
        [cross, xc, xxc, xxxc]
    }

    /// 小表 6 视角 × 4 阶段,返回 24 值,顺序
    /// [pseudo_cross×6, pseudo_xcross×6, pseudo_xxcross×6, pseudo_xxxcross×6]。
    /// rots = ["", "z2", "z'", "z", "x'", "x"]。与大表逐格 bit-exact。
    pub fn pseudo_get_stats_small(&self, alg: &[Move]) -> Vec<u32> {
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

    /// 单阶段 6 视角(stage 0=cross / 1=xcross / 2=xxcross / 3=xxxcross)。
    /// 两遍 UI 用:cross 秒出,深阶段后台补。lower=0(单阶段不串 cascade 仍正确)。
    pub fn pseudo_get_stage_small(&self, alg: &[Move], stage: usize) -> Vec<u32> {
        const ROTS: [&str; 6] = ["", "z2", "z'", "z", "x'", "x"];
        let base: Vec<u8> = alg.iter().map(|m| m.index() as u8).collect();
        ROTS.iter()
            .map(|r| {
                let mut a = base.clone();
                alg_rotation(&mut a, r);
                match stage {
                    0 => self.solve_cross(&a),
                    1 => {
                        let st = self.initial_states(&a);
                        self.solve_xcross(&st, 0)
                    }
                    2 => {
                        let st = self.initial_states(&a);
                        self.solve_xxcross(&st, 0)
                    }
                    _ => {
                        let st = self.initial_states(&a);
                        self.solve_xxxcross(&st, 0)
                    }
                }
            })
            .collect()
    }

    // ---------------- 具体步骤枚举(enumerate)----------------

    /// 镜像 cross_search,但收集 path 而非首解返回。stage 0 在自然 rot 帧 raw m
    /// 推坐标 → 收的 raw m 即真实 rot 帧转动,fmt 时直接前缀 rot 串。
    fn enum_cross(
        &self,
        i1: usize,
        i2: usize,
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
        let mt = self.mt_edge2.as_u32();
        for k in 0..count {
            if out.len() >= cap {
                return;
            }
            let m = row[k] as usize;
            let n1 = mt[i1 + m] as usize;
            let n2 = mt[i2 + m] as usize;
            let idx = (n1 as u64) * (state_space::EDGE2 as u64) + n2 as u64;
            let h = self.pt_pscross.get(idx) as u32;
            if h >= depth {
                continue;
            }
            path.push(m as u8);
            if depth == 1 {
                out.push(path.clone());
            } else if h > 0 {
                // h==0 且 depth>1:已解却还要再走 depth-1 步 → 更短解 + 无效尾动,跳过。
                self.enum_cross(n1 * 18, n2 * 18, depth - 1, m as u8, path, out, cap);
            }
            path.pop();
        }
    }

    /// 镜像 search_pairs,但收集 path 而非首解返回。
    /// **帧**:search_pairs 在参考帧 ref_slot 的 **共轭帧** 内用 raw m 推坐标(共轭已 baked
    /// 进 initial_states),所以 raw 搜索 m 对应真实 rot 帧 move = cj^{-1}[m][ref_slot]
    /// = cj[m][(4-ref_slot)&3]。这里 path 收转换后的真实 move,fmt 时直接前缀 rot 串。
    fn enum_pairs(
        &self,
        pairs: &[PsPair],
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
        let n = pairs.len();
        let ref_slot = pairs[0].slot;
        let inv_ref = (4 - ref_slot) & 3;

        let mut next = [PsPair {
            im: 0,
            ic: 0,
            ie: 0,
            slot: 0,
            diff: 0,
        }; 3];
        for k in 0..count {
            if out.len() >= cap {
                return;
            }
            let m = row[k] as usize;
            let mut pruned = false;
            let mut all_cc0 = true; // 所有 pair 的 cross+corner 表皆 0
            let mut eo_ok = true; // 所有 pair 伪棱归位(n_ie == 2*diff)
            for (j, p) in pairs.iter().enumerate() {
                let m_p = self.trans[ref_slot][p.slot][m] as usize;
                let n_im = mt_e4[p.im as usize + m_p] as u32;
                let n_ic = mt_c[p.ic as usize * 18 + m_p] as u32;
                let h = self.cc.h(n_im, n_ic);
                if h >= depth {
                    pruned = true;
                    break;
                }
                if h != 0 {
                    all_cc0 = false;
                }
                let n_ie = mt_e[p.ie as usize * 18 + m_p] as u32;
                if n_ie != 2 * p.diff {
                    eo_ok = false;
                }
                next[j] = PsPair {
                    im: n_im,
                    ic: n_ic,
                    ie: n_ie,
                    slot: p.slot,
                    diff: p.diff,
                };
            }
            if pruned {
                continue;
            }
            let solved = all_cc0 && eo_ok; // 全 pair cc 解且伪棱归位 ⟺ 该子集已解
            // raw 搜索 m(ref 共轭帧)→ 真实 rot 帧 move。
            let real_m = cj[m][inv_ref];
            path.push(real_m);
            if depth == 1 {
                if solved {
                    out.push(path.clone());
                }
            } else if !solved {
                // 全解却仍要走 depth-1 步 = 更短解 + 无效尾动,跳过。
                self.enum_pairs(&next[..n], depth - 1, m as u8, path, out, cap);
            }
            path.pop();
        }
    }

    /// 构造某 stage 的全部候选 task(N 个 PsPair),与 solve_{xcross,xxcross,xxxcross}
    /// 同构,返回 (pairs, 根启发式 h)。stage 0(cross)单独处理,不走此路。
    fn build_tasks(&self, st: &[ConjState; 4], stage: usize) -> Vec<(Vec<PsPair>, u32)> {
        const PAIRS: [(usize, usize); 6] =
            [(0, 1), (0, 2), (0, 3), (1, 2), (1, 3), (2, 3)];
        const TRIPLES: [[usize; 3]; 4] = [[0, 1, 2], [0, 1, 3], [0, 2, 3], [1, 2, 3]];
        const PERMS: [[usize; 3]; 6] = [
            [0, 1, 2],
            [0, 2, 1],
            [1, 0, 2],
            [1, 2, 0],
            [2, 0, 1],
            [2, 1, 0],
        ];
        let mk = |c: usize, diff: u32| PsPair {
            im: st[c].im,
            ic: st[c].ic_b,
            ie: st[c].ie_rel[diff as usize],
            slot: c,
            diff,
        };
        let mut tasks: Vec<(Vec<PsPair>, u32)> = Vec::new();
        match stage {
            1 => {
                for c in 0..4u32 {
                    for e in 0..4u32 {
                        let diff = Self::get_diff(c, e);
                        let p = mk(c as usize, diff);
                        let h = self.pair_h(&p);
                        tasks.push((vec![p], h));
                    }
                }
            }
            2 => {
                for &cp in &PAIRS {
                    for &ep in &PAIRS {
                        for swap in 0..2 {
                            let (e0, e1) =
                                if swap == 0 { (ep.0, ep.1) } else { (ep.1, ep.0) };
                            let d0 = Self::get_diff(cp.0 as u32, e0 as u32);
                            let d1 = Self::get_diff(cp.1 as u32, e1 as u32);
                            let p0 = mk(cp.0, d0);
                            let p1 = mk(cp.1, d1);
                            let h = self.pair_h(&p0).max(self.pair_h(&p1));
                            tasks.push((vec![p0, p1], h));
                        }
                    }
                }
            }
            _ => {
                for ct in &TRIPLES {
                    for et in &TRIPLES {
                        for p in &PERMS {
                            let d0 = Self::get_diff(ct[0] as u32, et[p[0]] as u32);
                            let d1 = Self::get_diff(ct[1] as u32, et[p[1]] as u32);
                            let d2 = Self::get_diff(ct[2] as u32, et[p[2]] as u32);
                            let pr0 = mk(ct[0], d0);
                            let pr1 = mk(ct[1], d1);
                            let pr2 = mk(ct[2], d2);
                            let h = self
                                .pair_h(&pr0)
                                .max(self.pair_h(&pr1))
                                .max(self.pair_h(&pr2));
                            tasks.push((vec![pr0, pr1, pr2], h));
                        }
                    }
                }
            }
        }
        tasks
    }

    /// 给定 stage(0=cross / 1=xcross / 2=xxcross / 3=xxxcross),与 pseudo_get_stage_small
    /// 同口径挑最优 task(corner slot 集),枚举**所有并列最优**(在同一 best_len 解出)的
    /// combo,各自 best_len..best_len+extra 步全部解(真实 rot 帧 move 索引路径,cap 封顶)。
    /// pseudo 系无 frame:每条解的 frame = 传入的 `rot`。
    /// 返回 (best_len, 每条解 (frame=rot, combo corner 槽位, move 路径))。
    /// `force`:用户指定的目标槽位集合(索引 ⊂ {0,1,2,3},0=BL/1=BR/2=FR/3=FL);空 =
    /// 自动挑最优槽(逐位与原先一致)。非空时只枚举"目标槽位集合 == force"的候选(pseudo
    /// source 仍在幸存里自动择优),不与其它槽组合比较。
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

        // ---- stage 0:pseudo_cross(自然 rot 帧,raw m)----
        if stage == 0 {
            let mt = self.mt_edge2.as_u32();
            let mut i1 = state_space::EDGE2_A_SOLVED;
            let mut i2 = state_space::EDGE2_B_SOLVED;
            for &m in &a {
                i1 = mt[i1 * 18 + m as usize] as usize;
                i2 = mt[i2 * 18 + m as usize] as usize;
            }
            let best_len = self.solve_cross(&a);
            let mut out: Vec<(String, Vec<usize>, Vec<u8>)> = Vec::new();
            if best_len == 0 {
                return (0, Vec::new());
            }
            let mut path = Vec::new();
            for d in best_len..=(best_len + extra).min(18) {
                let mut cross_out: Vec<Vec<u8>> = Vec::new();
                self.enum_cross(i1 * 18, i2 * 18, d, 18, &mut path, &mut cross_out, cap - out.len());
                for sol in cross_out {
                    out.push((rot.to_string(), vec![], sol));
                }
                if out.len() >= cap {
                    break;
                }
            }
            return (best_len, out);
        }

        // ---- stage 1/2/3:多槽 pair cascade ----
        let st = self.initial_states(&a);
        let mut tasks = self.build_tasks(&st, stage);
        tasks.sort_by_key(|t| t.1);

        // 用户指定槽位:只留"目标槽位集合 == force"的候选(pseudo source 仍自动择优)。
        // 空 force 不进此分支 ⇒ 逐字节与原先一致。过滤后空 → 下方 best_len 保持 99,
        // 落到 `best_len >= 99` 返回 (0, 空),即现有无解形态。
        if !force.is_empty() {
            let want: std::collections::BTreeSet<usize> = force.iter().copied().collect();
            tasks.retain(|(pairs, _)| {
                pairs.iter().map(|p| p.slot).collect::<std::collections::BTreeSet<usize>>() == want
            });
        }

        // 复用 solve_pairs_task 求每 task 长度,取 best_len = min,并收集**所有**并列最优
        // (长度 == best_len)的 task。用 `>`(非 `>=`)以便 h == best_len 的候选也被评估
        // (可能恰好并列);h 是可采纳下界,h == best_len 至多产出 best_len,不会改写 best_len
        // ⇒ best_len 逻辑(任一候选首次成功的深度)bit-exact 不变。
        let mut best_len = 99u32;
        let mut evaluated: Vec<(Vec<PsPair>, u32)> = Vec::new();
        for (pairs, h) in &tasks {
            if *h > best_len {
                break;
            }
            // bound=99(走内部满 cap 16),不传收缩的 best_len:否则真长==best_len 的并列 task
            // 会被 max_d=best_len-1 搜空返回 99 而漏掉。满 cap 不改 best_len(min 不变),只让并列被检出。
            let res = self.solve_pairs_task(pairs, *h, 0, 99);
            if res < best_len {
                best_len = res;
            }
            evaluated.push((pairs.clone(), res));
        }

        let mut out: Vec<(String, Vec<usize>, Vec<u8>)> = Vec::new();
        if best_len == 0 || best_len >= 99 {
            return (best_len.min(0), out);
        }

        // 并列最优的 task(长度 == best_len)。逐深度 d 外层、task 内层交错枚举,
        // 使跨 combo 也按长度升序;每条解带 frame=rot + 自己的 combo;cap 控总条数。
        let tied: Vec<Vec<PsPair>> = evaluated
            .into_iter()
            .filter(|(_, l)| *l == best_len)
            .map(|(pairs, _)| pairs)
            .collect();
        let mut path = Vec::new();
        'outer: for d in best_len..=(best_len + extra).min(18) {
            for pairs in &tied {
                if out.len() >= cap {
                    break 'outer;
                }
                let combo: Vec<usize> = pairs.iter().map(|p| p.slot).collect();
                let mut task_out: Vec<Vec<u8>> = Vec::new();
                self.enum_pairs(pairs, d, 18, &mut path, &mut task_out, cap - out.len());
                for sol in task_out {
                    out.push((rot.to_string(), combo.clone(), sol));
                }
            }
        }
        (best_len, out)
    }
}

// ============================================================================
// 受限步法 Pseudo cascade(Phase 3:move mask)
// ----------------------------------------------------------------------------
// 与上面无限制小表 cascade 同结构、同剪枝(pt_pscross + 现场 BFS cross+corner 表),仅把
// `valid_moves()` 换成 `valid_moves_masked(mask)` 并加 `max_depth` 上限。正确性:cc 表与
// pt_pscross 是无限制距离的可采纳下界,对任意 mask 仍可采纳 ⇒ IDA* 首达即真·受限最优
// (≤ max_depth),超界返回 99 哨兵。pseudo 系无 frame:每条解 frame = 传入 rot。
impl PseudoSmallSolver {
    fn cross_search_masked(&self, i1: usize, i2: usize, depth: u32, prev: u8, vm: &ValidMovesTable) -> bool {
        let (vmoves, vcnt) = vm;
        let count = vcnt[prev as usize] as usize;
        let row = &vmoves[prev as usize];
        let mt = self.mt_edge2.as_u32();
        for k in 0..count {
            let m = row[k] as usize;
            let n1 = mt[i1 + m] as usize;
            let n2 = mt[i2 + m] as usize;
            let idx = (n1 as u64) * (state_space::EDGE2 as u64) + n2 as u64;
            if self.pt_pscross.get(idx) as u32 >= depth {
                continue;
            }
            if depth == 1 {
                return true;
            }
            if self.cross_search_masked(n1 * 18, n2 * 18, depth - 1, m as u8, vm) {
                return true;
            }
        }
        false
    }

    fn solve_cross_masked(&self, alg: &[u8], vm: &ValidMovesTable, max_depth: u32) -> u32 {
        let mt = self.mt_edge2.as_u32();
        let mut i1 = state_space::EDGE2_A_SOLVED;
        let mut i2 = state_space::EDGE2_B_SOLVED;
        for &m in alg {
            i1 = mt[i1 * 18 + m as usize] as usize;
            i2 = mt[i2 * 18 + m as usize] as usize;
        }
        let idx = (i1 as u64) * (state_space::EDGE2 as u64) + i2 as u64;
        let d_min = self.pt_pscross.get(idx) as u32;
        if d_min == 0 {
            return 0;
        }
        for d in d_min..=max_depth {
            if self.cross_search_masked(i1 * 18, i2 * 18, d, 18, vm) {
                return d;
            }
        }
        99
    }

    fn search_pairs_masked(&self, pairs: &[PsPair], depth: u32, prev: u8, vm: &ValidMovesTable) -> bool {
        let (vmoves, vcnt) = vm;
        let count = vcnt[prev as usize] as usize;
        let row = &vmoves[prev as usize];
        let mt_e4 = self.mt_edge4.as_u32();
        let mt_c = self.mt_corn.as_u32();
        let mt_e = self.mt_edge.as_u32();
        let n = pairs.len();
        let ref_slot = pairs[0].slot;

        let mut local: u64 = 0;
        let mut next = [PsPair { im: 0, ic: 0, ie: 0, slot: 0, diff: 0 }; 3];
        for k in 0..count {
            let m = row[k] as usize;
            local += 1;
            let mut pruned = false;
            let mut leaf_ok = depth == 1;
            for (j, p) in pairs.iter().enumerate() {
                let m_p = self.trans[ref_slot][p.slot][m] as usize;
                let n_im = mt_e4[p.im as usize + m_p] as u32;
                let n_ic = mt_c[p.ic as usize * 18 + m_p] as u32;
                if self.cc.h(n_im, n_ic) >= depth {
                    pruned = true;
                    break;
                }
                let n_ie = mt_e[p.ie as usize * 18 + m_p] as u32;
                if leaf_ok && n_ie != 2 * p.diff {
                    leaf_ok = false;
                }
                next[j] = PsPair { im: n_im, ic: n_ic, ie: n_ie, slot: p.slot, diff: p.diff };
            }
            if pruned {
                continue;
            }
            if depth == 1 {
                if leaf_ok {
                    bump_node_count(local);
                    return true;
                }
            } else if self.search_pairs_masked(&next[..n], depth - 1, m as u8, vm) {
                bump_node_count(local);
                return true;
            }
        }
        bump_node_count(local);
        false
    }

    fn solve_pairs_task_masked(&self, pairs: &[PsPair], h: u32, lower: u32, max_d: u32, vm: &ValidMovesTable) -> u32 {
        let root_solved = pairs
            .iter()
            .all(|p| self.cc.h(p.im, p.ic) == 0 && p.ie == 2 * p.diff);
        if root_solved {
            return 0;
        }
        let start = std::cmp::max(h.max(lower), 1);
        for d in start..=max_d {
            if self.search_pairs_masked(pairs, d, 18, vm) {
                return d;
            }
        }
        99
    }

    /// 受限版单阶段(stage 0=cross / 1=xcross / 2=xxcross / 3=xxxcross)6 视角;无解视角为 None。
    pub fn pseudo_get_stage_small_masked(
        &self,
        alg: &[Move],
        stage: usize,
        mask: MoveMask,
        max_depth: u32,
    ) -> Vec<Option<u32>> {
        const ROTS: [&str; 6] = ["", "z2", "z'", "z", "x'", "x"];
        let vm = valid_moves_masked(mask);
        let base: Vec<u8> = alg.iter().map(|m| m.index() as u8).collect();
        ROTS.iter()
            .map(|r| {
                let mut a = base.clone();
                alg_rotation(&mut a, r);
                let v = if stage == 0 {
                    self.solve_cross_masked(&a, &vm, 8u32.min(max_depth))
                } else {
                    let st = self.initial_states(&a);
                    let tasks = self.build_tasks(&st, stage);
                    let mut sorted = tasks;
                    sorted.sort_by_key(|t| t.1);
                    let max_d = 16u32.min(max_depth);
                    let mut best = 99u32;
                    for (pairs, h) in &sorted {
                        if *h > best {
                            break;
                        }
                        let res = self.solve_pairs_task_masked(pairs, *h, 0, max_d, &vm);
                        best = best.min(res);
                    }
                    best
                };
                if v >= 99 { None } else { Some(v) }
            })
            .collect()
    }

    #[allow(clippy::too_many_arguments)]
    fn enum_cross_masked(
        &self,
        i1: usize,
        i2: usize,
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
        let mt = self.mt_edge2.as_u32();
        for k in 0..count {
            if out.len() >= cap {
                return;
            }
            let m = row[k] as usize;
            let n1 = mt[i1 + m] as usize;
            let n2 = mt[i2 + m] as usize;
            let idx = (n1 as u64) * (state_space::EDGE2 as u64) + n2 as u64;
            let h = self.pt_pscross.get(idx) as u32;
            if h >= depth {
                continue;
            }
            path.push(m as u8);
            if depth == 1 {
                out.push(path.clone());
            } else if h > 0 {
                self.enum_cross_masked(n1 * 18, n2 * 18, depth - 1, m as u8, path, out, cap, vm);
            }
            path.pop();
        }
    }

    #[allow(clippy::too_many_arguments)]
    fn enum_pairs_masked(
        &self,
        pairs: &[PsPair],
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
        let mt_e4 = self.mt_edge4.as_u32();
        let mt_c = self.mt_corn.as_u32();
        let mt_e = self.mt_edge.as_u32();
        let cj = conj_moves_flat();
        let n = pairs.len();
        let ref_slot = pairs[0].slot;
        let inv_ref = (4 - ref_slot) & 3;

        let mut next = [PsPair { im: 0, ic: 0, ie: 0, slot: 0, diff: 0 }; 3];
        for k in 0..count {
            if out.len() >= cap {
                return;
            }
            let m = row[k] as usize;
            let mut pruned = false;
            let mut all_cc0 = true;
            let mut eo_ok = true;
            for (j, p) in pairs.iter().enumerate() {
                let m_p = self.trans[ref_slot][p.slot][m] as usize;
                let n_im = mt_e4[p.im as usize + m_p] as u32;
                let n_ic = mt_c[p.ic as usize * 18 + m_p] as u32;
                let h = self.cc.h(n_im, n_ic);
                if h >= depth {
                    pruned = true;
                    break;
                }
                if h != 0 {
                    all_cc0 = false;
                }
                let n_ie = mt_e[p.ie as usize * 18 + m_p] as u32;
                if n_ie != 2 * p.diff {
                    eo_ok = false;
                }
                next[j] = PsPair { im: n_im, ic: n_ic, ie: n_ie, slot: p.slot, diff: p.diff };
            }
            if pruned {
                continue;
            }
            let solved = all_cc0 && eo_ok;
            let real_m = cj[m][inv_ref];
            path.push(real_m);
            if depth == 1 {
                if solved {
                    out.push(path.clone());
                }
            } else if !solved {
                self.enum_pairs_masked(&next[..n], depth - 1, m as u8, path, out, cap, vm);
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
        let mut a: Vec<u8> = alg.iter().map(|m| m.index() as u8).collect();
        alg_rotation(&mut a, rot);

        // ---- stage 0:pseudo_cross ----
        if stage == 0 {
            let cap_d = 18u32.min(max_depth);
            let mt = self.mt_edge2.as_u32();
            let mut i1 = state_space::EDGE2_A_SOLVED;
            let mut i2 = state_space::EDGE2_B_SOLVED;
            for &m in &a {
                i1 = mt[i1 * 18 + m as usize] as usize;
                i2 = mt[i2 * 18 + m as usize] as usize;
            }
            let best_len = self.solve_cross_masked(&a, &vm, cap_d);
            if best_len == 0 {
                return (0, Vec::new());
            }
            if best_len >= 99 {
                return (99, Vec::new());
            }
            let mut out: Vec<(String, Vec<usize>, Vec<u8>)> = Vec::new();
            let mut path = Vec::new();
            for d in best_len..=(best_len + extra).min(cap_d) {
                let mut cross_out: Vec<Vec<u8>> = Vec::new();
                self.enum_cross_masked(i1 * 18, i2 * 18, d, 18, &mut path, &mut cross_out, cap - out.len(), &vm);
                for sol in cross_out {
                    out.push((rot.to_string(), vec![], sol));
                }
                if out.len() >= cap {
                    break;
                }
            }
            return (best_len, out);
        }

        // ---- stage 1/2/3:多槽 pair cascade ----
        let st = self.initial_states(&a);
        let mut tasks = self.build_tasks(&st, stage);
        tasks.sort_by_key(|t| t.1);

        if !force.is_empty() {
            let want: std::collections::BTreeSet<usize> = force.iter().copied().collect();
            tasks.retain(|(pairs, _)| {
                pairs.iter().map(|p| p.slot).collect::<std::collections::BTreeSet<usize>>() == want
            });
        }
        let cap_d = 18u32.min(max_depth);

        let mut best_len = 99u32;
        let mut evaluated: Vec<(Vec<PsPair>, u32)> = Vec::new();
        for (pairs, h) in &tasks {
            if *h > best_len {
                break;
            }
            let res = self.solve_pairs_task_masked(pairs, *h, 0, cap_d, &vm);
            if res < best_len {
                best_len = res;
            }
            evaluated.push((pairs.clone(), res));
        }

        let mut out: Vec<(String, Vec<usize>, Vec<u8>)> = Vec::new();
        if best_len == 0 {
            return (0, Vec::new());
        }
        if best_len >= 99 {
            return (99, Vec::new());
        }

        let tied: Vec<Vec<PsPair>> = evaluated
            .into_iter()
            .filter(|(_, l)| *l == best_len)
            .map(|(pairs, _)| pairs)
            .collect();
        let mut path = Vec::new();
        'outer: for d in best_len..=(best_len + extra).min(cap_d) {
            for pairs in &tied {
                if out.len() >= cap {
                    break 'outer;
                }
                let combo: Vec<usize> = pairs.iter().map(|p| p.slot).collect();
                let mut task_out: Vec<Vec<u8>> = Vec::new();
                self.enum_pairs_masked(pairs, d, 18, &mut path, &mut task_out, cap - out.len(), &vm);
                for sol in task_out {
                    out.push((rot.to_string(), combo.clone(), sol));
                }
            }
        }
        (best_len, out)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::cross_solver::CrossSolver;
    use crate::cube_common::{string_to_alg, test_env_lock};
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

    /// PseudoXCross 6 列对照 golden(D:/cube/solver/golden/scramble_1000_pseudo.txt
    /// 前 3 行的 pseudo_xcross_z0..pseudo_xcross_x1 列):
    ///   id 22001: 6, 7, 7, 5, 8, 6
    ///   id 23001: 6, 6, 5, 7, 6, 5
    ///   id 24001: 7, 6, 8, 6, 7, 6
    ///
    /// 需 4 × 52MB pscross_C4E 表 + 17MB mt_edge4,默认 `#[ignore]`;
    /// release 下生成约 60-90s,首次跑后复用。
    #[test]
    #[ignore]
    fn pseudo_xcross_matches_golden_first3() {
        let _lock = test_env_lock().lock().unwrap_or_else(|e| e.into_inner());
        let dir = setup_iso_dir("pseudo_xcross_golden");
        std::env::set_var("CUBE_TABLE_DIR", &dir);

        let cases: &[(&str, &str, [u32; 6])] = &[
            (
                "22001",
                "B2 U' L2 U F2 L2 D2 L2 U F2 L F2 L D U L' D2 F' U2 B",
                [6, 7, 7, 5, 8, 6],
            ),
            (
                "23001",
                "D2 U L2 B2 R2 F2 R2 U2 R2 D' R' D B2 U B' R B' D B' L'",
                [6, 6, 5, 7, 6, 5],
            ),
            (
                "24001",
                "L2 D F2 D' B2 L2 R2 U2 F2 D L' U2 R2 B' R F R2 D' U F L' F'",
                [7, 6, 8, 6, 7, 6],
            ),
        ];

        let rots = ["", "z2", "z'", "z", "x'", "x"];
        let cross = CrossSolver::new(true);
        let xcross = PseudoXCrossSolver::new();

        for (id, scramble, expected) in cases {
            let alg = string_to_alg(scramble);
            let cross_results = cross.get_stats(&alg, &rots);
            let got = xcross.get_stats(&alg, &rots, &cross_results);
            assert_eq!(
                got.as_slice(),
                expected,
                "pseudo_xcross id {} mismatch: got {:?} expected {:?}",
                id,
                got,
                expected
            );
        }

        cleanup(&dir);
    }

    /// 小表 pseudo cascade(from_tables,现场 BFS cross+corner,无 54MB / 无 huge)
    /// 24 列逐格 bit-exact 对照大表 golden(huge-table pseudo_analyzer 算出)。
    /// 列序 z0 z2 z3 z1 x3 x1 = rots ["","z2","z'","z","x'","x"];4 阶段 ×6
    /// = [pseudo_cross×6, pseudo_xcross×6, pseudo_xxcross×6, pseudo_xxxcross×6]。
    ///
    /// 只读 5 张小表(mt_edge2/4/corn/edge + pt_pscross),全部 from_bin;**不碰
    /// 54MB pt_pscross_C4E / 不碰 ~1.8GB huge**。慢(xxxcross 弱启发式),故 #[ignore]:
    ///   cargo test --release --lib pseudo_small_matches_golden -- --ignored --nocapture
    #[test]
    #[ignore]
    fn pseudo_small_matches_golden() {
        use crate::move_tables::MoveTable;
        use crate::prune_tables::PackedPruneTable;
        use std::time::Instant;

        let _lock = test_env_lock().lock().unwrap_or_else(|e| e.into_inner());
        let dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tables");
        std::env::set_var("CUBE_TABLE_DIR", &dir);

        let read = |name: &str| std::fs::read(dir.join(name)).expect(name);
        let mt_edge2 = Arc::new(MoveTable::from_bin(
            &read("mt_edge2.bin"),
            state_space::EDGE2 as u32,
            18,
        ));
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
        let pt_pscross = Arc::new(PackedPruneTable::from_bin(&read("pt_pscross.bin")));

        let t_build = Instant::now();
        let solver = PseudoSmallSolver::from_tables(
            mt_edge2, mt_edge4, mt_corn, mt_edge, pt_pscross,
        );
        eprintln!(
            "[pseudo-small] cross+corner BFS built in {:.1}ms ({:.1}MB RAM)",
            t_build.elapsed().as_secs_f64() * 1e3,
            (state_space::CROSS * state_space::CORNER) as f64 / 1e6
        );

        // 24 值 = [pseudo_cross×6, pseudo_xcross×6, pseudo_xxcross×6, pseudo_xxxcross×6]
        let cases: &[(&str, [u32; 24])] = &[
            (
                "U B' L R2 U B2 R2 U2 B2 U R2 U2 F2 B' R' B2 F' U2 L2 R",
                [6, 6, 6, 6, 5, 6, 6, 7, 7, 7, 6, 7, 8, 8, 8, 9, 7, 9, 11, 10, 10, 10, 9, 11],
            ),
            (
                "D2 L B2 R2 D R2 D R2 B2 R2 D2 L' D2 B D2 U2 R2 D' B2 R",
                [6, 5, 6, 4, 5, 5, 8, 5, 7, 5, 6, 6, 9, 5, 9, 8, 9, 9, 11, 8, 11, 10, 11, 11],
            ),
            (
                "B2 D' F2 L' U' R' D R2 F D' B2 L2 F2 R2 B' R2 L2 U2 L",
                [6, 6, 6, 6, 6, 5, 7, 6, 6, 6, 7, 6, 9, 8, 8, 7, 9, 9, 10, 10, 11, 10, 10, 11],
            ),
        ];

        for (scr, exp) in cases {
            let alg = string_to_alg(scr);
            let t = Instant::now();
            let got = solver.pseudo_get_stats_small(&alg);
            eprintln!(
                "[pseudo-small] `{}` 24 cols in {:.1}ms (deepest xxxcross stage incl.)",
                scr,
                t.elapsed().as_secs_f64() * 1e3
            );
            assert_eq!(
                got.as_slice(),
                exp.as_slice(),
                "pseudo small-mode mismatch for `{}`:\n got {:?}\n exp {:?}",
                scr,
                got,
                exp
            );
        }
    }

    /// 小表加载(同 pseudo_small_matches_golden,抽出复用)。
    fn load_small_solver() -> PseudoSmallSolver {
        use crate::move_tables::MoveTable;
        use crate::prune_tables::PackedPruneTable;
        let dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tables");
        std::env::set_var("CUBE_TABLE_DIR", &dir);
        let read = |name: &str| std::fs::read(dir.join(name)).expect(name);
        let mt_edge2 = Arc::new(MoveTable::from_bin(
            &read("mt_edge2.bin"),
            state_space::EDGE2 as u32,
            18,
        ));
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
        let pt_pscross = Arc::new(PackedPruneTable::from_bin(&read("pt_pscross.bin")));
        PseudoSmallSolver::from_tables(mt_edge2, mt_edge4, mt_corn, mt_edge, pt_pscross)
    }

    /// enumerate_small 输出的 move 序列正确性(新返回形状 (best_len, Vec<(frame, combo, sol)>)):
    ///   1. best_len == golden(逐格 bit-exact,4 阶段 ×6 视角)
    ///   2. 每条解长度 == best_len(全是最优解)
    ///   3. pseudo 系无 frame ⇒ 每条解 frame == rot
    ///   4. 把(frame 帧打乱 ++ 真实 move 解)经 solve_cross / initial_states 重新编码,
    ///      stage 0 断言 pscross prune==0;stage 1/2/3 断言该条自己的 combo 内每个 corner 槽
    ///      存在某 diff 使叶子条件 cc.h==0 && ie_rel[diff]==2*diff 成立 ⇒ 该序列真把所选
    ///      combo 解出(即每条并列解都是合法 best_len 解)。
    ///   cargo test --release --lib --manifest-path D:\cube\solver-rust\Cargo.toml \
    ///     -- --ignored pseudo_enumerate_valid --nocapture
    #[test]
    #[ignore]
    fn pseudo_enumerate_valid() {
        use std::time::Instant;
        let _lock = test_env_lock().lock().unwrap_or_else(|e| e.into_inner());
        let solver = load_small_solver();

        let rots = ["", "z2", "z'", "z", "x'", "x"];
        // 第 1 条(同 pseudo_small_matches_golden,布局 [stage*6 + rot])。
        let cases: &[(&str, [u32; 24])] = &[(
            "U B' L R2 U B2 R2 U2 B2 U R2 U2 F2 B' R' B2 F' U2 L2 R",
            [6, 6, 6, 6, 5, 6, 6, 7, 7, 7, 6, 7, 8, 8, 8, 9, 7, 9, 11, 10, 10, 10, 9, 11],
        )];

        for (scr, exp) in cases {
            let alg = string_to_alg(scr);
            for (ri, rot) in rots.iter().enumerate() {
                for stage in 0..4usize {
                    let want = exp[stage * 6 + ri];
                    let t = Instant::now();
                    let (len, results) = solver.enumerate_small(&alg, rot, stage, 0, 20, &[]);
                    eprintln!(
                        "[enum] `{}` rot={:<3} stage={} len={} sols={} in {:.1}ms",
                        scr,
                        rot,
                        stage,
                        len,
                        results.len(),
                        t.elapsed().as_secs_f64() * 1e3
                    );
                    assert_eq!(
                        len, want,
                        "len mismatch `{}` rot={} stage={}: got {} want {}",
                        scr, rot, stage, len, want
                    );
                    if len == 0 {
                        continue;
                    }
                    assert!(!results.is_empty(), "no sols `{}` rot={} stage={}", scr, rot, stage);

                    for (frame, combo, sol) in &results {
                        // pseudo 无 frame:每条解 frame 必为传入 rot。
                        assert_eq!(
                            frame.as_str(), *rot,
                            "frame mismatch `{}` rot={} stage={}: got '{}'",
                            scr, rot, stage, frame
                        );
                        assert_eq!(
                            sol.len() as u32,
                            len,
                            "sol not optimal `{}` rot={} stage={}: {:?}",
                            scr, rot, stage, sol
                        );

                        // frame(=rot)帧打乱基底。
                        let mut full: Vec<u8> = alg.iter().map(|m| m.index() as u8).collect();
                        alg_rotation(&mut full, frame);
                        full.extend_from_slice(sol);

                        if stage == 0 {
                            // pseudo_cross:两棱组 pt_pscross == 0。combo 必空。
                            assert!(combo.is_empty(), "cross combo nonempty `{}` rot={}", scr, rot);
                            let mt = solver.mt_edge2.as_u32();
                            let mut i1 = state_space::EDGE2_A_SOLVED;
                            let mut i2 = state_space::EDGE2_B_SOLVED;
                            for &m in &full {
                                i1 = mt[i1 * 18 + m as usize] as usize;
                                i2 = mt[i2 * 18 + m as usize] as usize;
                            }
                            let idx = (i1 as u64) * (state_space::EDGE2 as u64) + i2 as u64;
                            assert_eq!(
                                solver.pt_pscross.get(idx),
                                0,
                                "cross unsolved `{}` rot={} sol={:?}",
                                scr, rot, sol
                            );
                            continue;
                        }

                        // stage 1/2/3:重编码 ConjState,该条自己的 combo 每个 corner 槽叶子
                        // 条件成立 ⇒ 这条并列解确是合法 best_len 解。
                        let st = solver.initial_states(&full);
                        for &c in combo {
                            let s = &st[c];
                            let solved = (0..4u32).any(|diff| {
                                solver.cc.h(s.im, s.ic_b) == 0
                                    && s.ie_rel[diff as usize] == 2 * diff
                            });
                            assert!(
                                solved,
                                "slot {} unsolved `{}` rot={} stage={} sol={:?} (im_h={} ie_rel={:?})",
                                c,
                                scr,
                                rot,
                                stage,
                                sol,
                                solver.cc.h(s.im, s.ic_b),
                                s.ie_rel
                            );
                        }
                    }
                }
            }
        }
    }
}
