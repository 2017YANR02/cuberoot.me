//! XCross 阶段 IDA* 搜索器(Std),对应 C++ `std_analyzer.cpp` 的 `XCrossSolver`。
//!
//! 5 个 cross 阶段中本模块负责后 4 个(Cross 由 cross_solver 负责):
//!   - XCross   (search_1):pt_cross_C4E0,1 个 F2L 槽
//!   - XXCross  (search_2):1 张 huge 表,2 个相邻/对角槽
//!   - XXXCross (search_3):3 张 huge 表(三元组的 3 个 pair),3 个槽
//!   - XXXXCross(search_4):4 张 neighbor + 2 张 diagonal huge 表,F2L 全 4 槽
//!
//! 关键事实(对照 C++):search_2/3/4 仅用 huge 表(pt_cross_C4C5E0E1 相邻 /
//! pt_cross_C4C6E0E2 对角)剪枝;C++ 里那些逐槽 `SlotView` 的 move-table
//! 查表是重构残留的死代码(只赋值、从不参与剪枝或叶子判定),故本移植直接省去,
//! 等价且更快。huge 表本身是对应子集的精确 BFS 距离表 → 单表 XXCross 的解
//! 恒等于该表查值 h;多槽阶段则要求所有 pair 同时 < depth 才继续。
//!
//! 依赖表:
//!   - mt_edge4 / mt_corn / mt_edge(XCross)
//!   - pt_cross_C4E0(~52 MB,XCross h + search_1)
//!   - mt_edge6(~3 GB)/ mt_corn2 + pt_cross_C4C5E0E1 / pt_cross_C4C6E0E2
//!     (各 ~10 GB,XXCross+;均 mmap 载入,solve 期不占常驻 RAM)

use std::sync::Arc;

use crate::cube_common::{
    alg_rotation, array_to_index, conj_moves_flat, get_diagonal_view, get_neighbor_view,
    state_space, valid_moves, Move,
};
use crate::executor::bump_node_count;
use crate::move_tables::{self, MoveTable};
use crate::prune_tables::{self, PackedPruneTable};

/// XCross 求解器。线程局部构造(内部仅持 Arc,无可变状态)。
pub struct XCrossSolver {
    mt_edge4: Arc<MoveTable>,
    mt_corn: Arc<MoveTable>,
    mt_edge: Arc<MoveTable>,
    pt_cross_c4e0: Arc<PackedPruneTable>,
    // XXCross+ 所需(huge 关闭时为 None,后 18 列输出 0)
    mt_edge6: Option<Arc<MoveTable>>,
    mt_corn2: Option<Arc<MoveTable>>,
    pt_cross_c4c5e0e1: Option<Arc<PackedPruneTable>>, // neighbor
    pt_cross_c4c6e0e2: Option<Arc<PackedPruneTable>>, // diagonal
    idx_solved_e6_nb: u32,
    idx_solved_c2_nb: u32,
    idx_solved_e6_dg: u32,
    idx_solved_c2_dg: u32,
}

/// 单槽位在 alg 下的虚拟状态。im/ic/ie 用于 XCross;ie6_*/ic2_* 用于 huge 阶段。
/// 对应 C++ `get_conjugated_indices_all`(去掉死代码的 e2/e4/e6/c5/c6/c7)。
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

impl XCrossSolver {
    /// `with_huge=false`:仅 XCross(52 MB 表);`true`:额外 ensure mt_edge6 +
    /// mt_corn2 + 两张 ~10 GB huge 表(需 CUBE_ALLOW_HUGE_TABLES=1)。
    /// native-only(走 manager);WASM 用 from_small_tables。
    #[cfg(not(target_arch = "wasm32"))]
    pub fn new(with_huge: bool) -> Self {
        let mtm = move_tables::instance();
        let ptm = prune_tables::instance();

        let v_e6_nb: [i32; 6] = [0, 2, 16, 18, 20, 22];
        let v_e6_dg: [i32; 6] = [0, 4, 16, 18, 20, 22];
        let v_c2_nb: [i32; 2] = [12, 15];
        let v_c2_dg: [i32; 2] = [12, 18];

        let (mt_edge6, mt_corn2, pt_nb, pt_dg) = if with_huge {
            (
                Some(mtm.ensure_edge6()),
                Some(mtm.ensure_corn2()),
                Some(ptm.ensure_pt_cross_c4c5e0e1()),
                Some(ptm.ensure_pt_cross_c4c6e0e2()),
            )
        } else {
            (None, None, None, None)
        };

        XCrossSolver {
            mt_edge4: mtm.ensure_edge4(),
            mt_corn: mtm.ensure_corn(),
            mt_edge: mtm.ensure_edge(),
            pt_cross_c4e0: ptm.ensure_pt_cross_c4e0(),
            mt_edge6,
            mt_corn2,
            pt_cross_c4c5e0e1: pt_nb,
            pt_cross_c4c6e0e2: pt_dg,
            idx_solved_e6_nb: array_to_index(&v_e6_nb, 6, 2, 12) as u32,
            idx_solved_c2_nb: array_to_index(&v_c2_nb, 2, 3, 8) as u32,
            idx_solved_e6_dg: array_to_index(&v_e6_dg, 6, 2, 12) as u32,
            idx_solved_c2_dg: array_to_index(&v_c2_dg, 2, 3, 8) as u32,
        }
    }

    /// 直接用预建小表构造(绕过 manager / 磁盘 / mmap),仅小表 cascade 用。
    /// huge 字段全 None;idx_solved_* 仅 huge=Some 时被读,这里照常算以备一致性。
    /// WASM 路径用。
    pub fn from_small_tables(
        mt_edge4: Arc<MoveTable>,
        mt_corn: Arc<MoveTable>,
        mt_edge: Arc<MoveTable>,
        pt_cross_c4e0: Arc<PackedPruneTable>,
    ) -> Self {
        let v_e6_nb: [i32; 6] = [0, 2, 16, 18, 20, 22];
        let v_e6_dg: [i32; 6] = [0, 4, 16, 18, 20, 22];
        let v_c2_nb: [i32; 2] = [12, 15];
        let v_c2_dg: [i32; 2] = [12, 18];
        XCrossSolver {
            mt_edge4,
            mt_corn,
            mt_edge,
            pt_cross_c4e0,
            mt_edge6: None,
            mt_corn2: None,
            pt_cross_c4c5e0e1: None,
            pt_cross_c4c6e0e2: None,
            idx_solved_e6_nb: array_to_index(&v_e6_nb, 6, 2, 12) as u32,
            idx_solved_c2_nb: array_to_index(&v_c2_nb, 2, 3, 8) as u32,
            idx_solved_e6_dg: array_to_index(&v_e6_dg, 6, 2, 12) as u32,
            idx_solved_c2_dg: array_to_index(&v_c2_dg, 2, 3, 8) as u32,
        }
    }

    /// 在 slot_k 视角下推 alg。对应 C++ `get_conjugated_indices_all`。
    fn get_virt(&self, alg: &[u8], slot_k: usize) -> VirtState {
        let mt_e4 = self.mt_edge4.as_u32();
        let mt_c = self.mt_corn.as_u32();
        let mt_e = self.mt_edge.as_u32();
        let cj = conj_moves_flat();

        let mut cur_mul: u32 = (state_space::CROSS_SOLVED as u32) * (state_space::CORNER as u32);
        let mut cur_corn: u32 = IDX_C4 * 18;
        let mut cur_e0: u32 = 0;

        // huge 阶段才需要 edge6/corn2 的两套(nb/dg)共轭轨迹
        let huge = self.mt_edge6.as_ref().map(|m6| {
            let mt_e6 = m6.as_u32();
            let mt_c2 = self.mt_corn2.as_ref().unwrap().as_u32();
            (mt_e6, mt_c2)
        });
        let mut cur_e6_n = self.idx_solved_e6_nb * 18;
        let mut cur_c2_n = self.idx_solved_c2_nb * 18;
        let mut cur_e6_d = self.idx_solved_e6_dg * 18;
        let mut cur_c2_d = self.idx_solved_c2_dg * 18;

        for &m in alg {
            let mc = cj[m as usize][slot_k] as usize;
            cur_mul = mt_e4[(cur_mul as usize) + mc];
            cur_corn = mt_c[(cur_corn as usize) + mc] * 18;
            cur_e0 = mt_e[(cur_e0 as usize) * 18 + mc];
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
            ie: cur_e0,
            ie6_nb: cur_e6_n / 18,
            ic2_nb: cur_c2_n / 18,
            ie6_dg: cur_e6_d / 18,
            ic2_dg: cur_c2_d / 18,
        }
    }

    /// 翻译 C++ `hugeTablePrunes`。返回 (剪枝?, new_e6, new_c2)。
    /// conj=-1 或 table=None → (false, 0, 0)。
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
        let n_e6 = self.mt_edge6.as_ref().unwrap().as_u32()[(e6 as usize) * 18 + mx];
        let n_c2 = self.mt_corn2.as_ref().unwrap().as_u32()[(c2 as usize) * 18 + mx];
        let idx: u64 = n_e6 as u64 * state_space::CORNER2 as u64 + n_c2 as u64;
        (table.get(idx) as u32 >= depth, n_e6, n_c2)
    }

    // --- search_1: XCross(1 槽,pt_cross_C4E0)---
    fn search_1(&self, i1: usize, i2: usize, i3: usize, s1: usize, depth: u32, prev: u8) -> bool {
        let (vmoves, vcnt) = valid_moves();
        let count = vcnt[prev as usize] as usize;
        let row = &vmoves[prev as usize];
        let mt_e4 = self.mt_edge4.as_u32();
        let mt_c = self.mt_corn.as_u32();
        let mt_e = self.mt_edge.as_u32();
        let cj = conj_moves_flat();
        let pt = &self.pt_cross_c4e0;

        let mut local: u64 = 0;
        for k in 0..count {
            let m = row[k] as usize;
            local += 1;
            let m1 = cj[m][s1] as usize;
            let n_i1 = mt_e4[i1 + m1] as usize;
            let n_i2 = mt_c[i2 + m1] as usize;
            let n_i3 = mt_e[i3 + m1] as usize;
            let idx: u64 = (n_i1 as u64 + n_i2 as u64) * 24 + n_i3 as u64;
            if pt.get(idx) as u32 >= depth {
                continue;
            }
            if depth == 1 {
                bump_node_count(local);
                return true;
            }
            if self.search_1(n_i1, n_i2 * 18, n_i3 * 18, s1, depth - 1, m as u8) {
                bump_node_count(local);
                return true;
            }
        }
        bump_node_count(local);
        false
    }

    // --- search_2: XXCross(1 张 huge 表)---
    fn search_2(
        &self,
        e6: u32,
        c2: u32,
        conj: i32,
        table: &PackedPruneTable,
        depth: u32,
        prev: u8,
    ) -> bool {
        let (vmoves, vcnt) = valid_moves();
        let count = vcnt[prev as usize] as usize;
        let row = &vmoves[prev as usize];

        let mut local: u64 = 0;
        for k in 0..count {
            let m = row[k] as usize;
            local += 1;
            let (pruned, n_e6, n_c2) = self.huge_check(conj, Some(table), e6, c2, m, depth);
            if pruned {
                continue;
            }
            if depth == 1 {
                bump_node_count(local);
                return true;
            }
            if self.search_2(n_e6, n_c2, conj, table, depth - 1, m as u8) {
                bump_node_count(local);
                return true;
            }
        }
        bump_node_count(local);
        false
    }

    // --- search_3: XXXCross(三元组的 3 个 pair,3 张 huge 表)---
    fn search_3(
        &self,
        e6: [u32; 3],
        c2: [u32; 3],
        conj: [i32; 3],
        table: [Option<&PackedPruneTable>; 3],
        depth: u32,
        prev: u8,
    ) -> bool {
        let (vmoves, vcnt) = valid_moves();
        let count = vcnt[prev as usize] as usize;
        let row = &vmoves[prev as usize];

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
            if depth == 1 {
                bump_node_count(local);
                return true;
            }
            if self.search_3(n_e6, n_c2, conj, table, depth - 1, m as u8) {
                bump_node_count(local);
                return true;
            }
        }
        bump_node_count(local);
        false
    }

    // --- search_4: XXXXCross / F2L(4 张 neighbor + 2 张 diagonal huge 表)---
    // conj slot 即数组下标:nb[i] conj=i (i=0..3),dg[i] conj=i (i=0,1)。
    fn search_4(
        &self,
        nb_e6: [u32; 4],
        nb_c2: [u32; 4],
        dg_e6: [u32; 2],
        dg_c2: [u32; 2],
        depth: u32,
        prev: u8,
    ) -> bool {
        let (vmoves, vcnt) = valid_moves();
        let count = vcnt[prev as usize] as usize;
        let row = &vmoves[prev as usize];
        let nb_table = self.pt_cross_c4c5e0e1.as_deref();
        let dg_table = self.pt_cross_c4c6e0e2.as_deref();

        let mut local: u64 = 0;
        for k in 0..count {
            let m = row[k] as usize;
            local += 1;

            let mut n_nb_e6 = [0u32; 4];
            let mut n_nb_c2 = [0u32; 4];
            let mut pruned = false;
            for i in 0..4 {
                let (pr, ne6, nc2) =
                    self.huge_check(i as i32, nb_table, nb_e6[i], nb_c2[i], m, depth);
                if pr {
                    pruned = true;
                    break;
                }
                n_nb_e6[i] = ne6;
                n_nb_c2[i] = nc2;
            }
            if pruned {
                continue;
            }

            let mut n_dg_e6 = [0u32; 2];
            let mut n_dg_c2 = [0u32; 2];
            for i in 0..2 {
                let (pr, ne6, nc2) =
                    self.huge_check(i as i32, dg_table, dg_e6[i], dg_c2[i], m, depth);
                if pr {
                    pruned = true;
                    break;
                }
                n_dg_e6[i] = ne6;
                n_dg_c2[i] = nc2;
            }
            if pruned {
                continue;
            }

            if depth == 1 {
                bump_node_count(local);
                return true;
            }
            if self.search_4(n_nb_e6, n_nb_c2, n_dg_e6, n_dg_c2, depth - 1, m as u8) {
                bump_node_count(local);
                return true;
            }
        }
        bump_node_count(local);
        false
    }

    /// 单视角 huge 表查值:pair (a,b) 的 (e6, c2, conj, table)。
    /// 优先 neighbor(C4C5E0E1),否则 diagonal(C4C6E0E2)。
    fn pair_huge<'a>(
        &'a self,
        st: &[VirtState; 4],
        a: usize,
        b: usize,
        nb: &'a PackedPruneTable,
        dg: &'a PackedPruneTable,
    ) -> (u32, u32, i32, &'a PackedPruneTable) {
        let v_nb = get_neighbor_view(a as i32, b as i32);
        if v_nb != -1 {
            let s = &st[v_nb as usize];
            (s.ie6_nb, s.ic2_nb, v_nb, nb)
        } else {
            let v_dg = get_diagonal_view(a as i32, b as i32);
            let s = &st[v_dg as usize];
            (s.ie6_dg, s.ic2_dg, v_dg, dg)
        }
    }

    /// 6 视角 × 4 阶段(XC/XXC/XXXC/F2L),返回 24 值,顺序
    /// [xcross×6, xxcross×6, xxxcross×6, xxxxcross×6]。
    pub fn get_stats(&self, alg: &[Move], rots: &[&str]) -> Vec<u32> {
        let n = rots.len();
        let mut xc = vec![0u32; n];
        let mut xxc = vec![0u32; n];
        let mut xxxc = vec![0u32; n];
        let mut f2l = vec![0u32; n];

        let base: Vec<u8> = alg.iter().map(|m| m.index() as u8).collect();
        let huge = match (&self.pt_cross_c4c5e0e1, &self.pt_cross_c4c6e0e2) {
            (Some(nb), Some(dg)) => Some((nb.as_ref(), dg.as_ref())),
            _ => None,
        };

        for (r, rot) in rots.iter().enumerate() {
            let mut a = base.clone();
            alg_rotation(&mut a, rot);
            let st: [VirtState; 4] = std::array::from_fn(|k| self.get_virt(&a, k));

            // --- 1. XCross ---
            let mut tasks: [(usize, u32); 4] = std::array::from_fn(|k| {
                let s = &st[k];
                let idx = (s.im as u64 + s.ic as u64) * 24 + s.ie as u64;
                (k, self.pt_cross_c4e0.get(idx) as u32)
            });
            tasks.sort_by_key(|t| t.1);
            let mut best = 99u32;
            for &(id, h) in &tasks {
                if h >= best {
                    break;
                }
                let res = if h == 0 {
                    0
                } else {
                    let max_d = std::cmp::min(12, best.saturating_sub(1));
                    let mut found = 99;
                    for d in h..=max_d {
                        if self.search_1(
                            st[id].im as usize,
                            (st[id].ic as usize) * 18,
                            (st[id].ie as usize) * 18,
                            id,
                            d,
                            18,
                        ) {
                            found = d;
                            break;
                        }
                    }
                    found
                };
                best = best.min(res);
            }
            xc[r] = best;

            let (nb, dg) = match huge {
                Some(t) => t,
                None => continue, // huge 关闭:xxc/xxxc/f2l 保持 0
            };

            // --- 2. XXCross ---
            const PAIRS: [(usize, usize); 6] =
                [(0, 1), (0, 2), (0, 3), (1, 2), (1, 3), (2, 3)];
            let mut t2: [(usize, usize, u32); 6] = std::array::from_fn(|i| {
                let (a, b) = PAIRS[i];
                let (e6, c2, conj, table) = self.pair_huge(&st, a, b, nb, dg);
                let h = table.get(e6 as u64 * state_space::CORNER2 as u64 + c2 as u64) as u32;
                let _ = conj;
                (a, b, h)
            });
            t2.sort_by_key(|t| t.2);
            let mut best = 99u32;
            for &(a, b, h) in &t2 {
                if h >= best {
                    break;
                }
                let res = if h == 0 {
                    0
                } else {
                    let (e6, c2, conj, table) = self.pair_huge(&st, a, b, nb, dg);
                    let max_d = std::cmp::min(14, best.saturating_sub(1));
                    let start = h.max(xc[r]);
                    let mut found = 99;
                    for d in start..=max_d {
                        if self.search_2(e6, c2, conj, table, d, 18) {
                            found = d;
                            break;
                        }
                    }
                    found
                };
                best = best.min(res);
            }
            xxc[r] = best;

            // --- 3. XXXCross ---
            const TRIPS: [(usize, usize, usize); 4] =
                [(0, 1, 2), (0, 1, 3), (0, 2, 3), (1, 2, 3)];
            let mut t3: [(usize, usize, usize, u32); 4] = std::array::from_fn(|i| {
                let (a, b, c) = TRIPS[i];
                let h = [(a, b), (b, c), (c, a)]
                    .iter()
                    .map(|&(x, y)| {
                        let (e6, c2, _, table) = self.pair_huge(&st, x, y, nb, dg);
                        table.get(e6 as u64 * state_space::CORNER2 as u64 + c2 as u64) as u32
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
                let res = if h == 0 {
                    0
                } else {
                    let mut e6 = [0u32; 3];
                    let mut c2 = [0u32; 3];
                    let mut conj = [-1i32; 3];
                    let mut table: [Option<&PackedPruneTable>; 3] = [None; 3];
                    for (i, &(x, y)) in [(a, b), (b, c), (c, a)].iter().enumerate() {
                        let (pe6, pc2, pconj, pt) = self.pair_huge(&st, x, y, nb, dg);
                        e6[i] = pe6;
                        c2[i] = pc2;
                        conj[i] = pconj;
                        table[i] = Some(pt);
                    }
                    let max_d = std::cmp::min(16, best.saturating_sub(1));
                    let start = h.max(xxc[r]);
                    let mut found = 99;
                    for d in start..=max_d {
                        if self.search_3(e6, c2, conj, table, d, 18) {
                            found = d;
                            break;
                        }
                    }
                    found
                };
                best = best.min(res);
            }
            xxxc[r] = best;

            // --- 4. XXXXCross / F2L ---
            let nb_e6: [u32; 4] = std::array::from_fn(|i| st[i].ie6_nb);
            let nb_c2: [u32; 4] = std::array::from_fn(|i| st[i].ic2_nb);
            let dg_e6: [u32; 2] = std::array::from_fn(|i| st[i].ie6_dg);
            let dg_c2: [u32; 2] = std::array::from_fn(|i| st[i].ic2_dg);
            let mut max_h = 0u32;
            for i in 0..4 {
                let v = nb.get(nb_e6[i] as u64 * state_space::CORNER2 as u64 + nb_c2[i] as u64);
                max_h = max_h.max(v as u32);
            }
            for i in 0..2 {
                let v = dg.get(dg_e6[i] as u64 * state_space::CORNER2 as u64 + dg_c2[i] as u64);
                max_h = max_h.max(v as u32);
            }
            f2l[r] = if max_h > 16 {
                17
            } else if max_h == 0 {
                0
            } else {
                let start = max_h.max(xxxc[r]);
                let mut found = 0;
                for d in start..=16 {
                    if self.search_4(nb_e6, nb_c2, dg_e6, dg_c2, d, 18) {
                        found = d;
                        break;
                    }
                }
                found
            };
        }

        let mut out = Vec::with_capacity(4 * n);
        out.extend(xc);
        out.extend(xxc);
        out.extend(xxxc);
        out.extend(f2l);
        out
    }
}

// ============================================================================
// 小表 cascade(WASM 友好,候选 A:单槽 max admissible heuristic)
// ----------------------------------------------------------------------------
// 动机:big 路径的 XXCross/XXXCross/XXXXCross 依赖 EDGE6×CORNER2 的 ~10 GB
// 精确 pair 表,WASM 装不下。这里用 `pt_cross_C4E0`(52 MB,单槽 XCross 精确距离)
// 做可采纳下界:K 槽问题的 IDA* 在每个节点取 max_k(单槽距离) 作 h。
//
// 正确性:解 K 个槽 ≥ 解其中最难的单槽 → max 单槽距离是可采纳下界(admissible)。
// 目标判定 = 所有 K 槽各自 XCross 已解(h_k==0)⟺ cross + 这 K 个 pair 全归位
// ⟺ K-cross 解出。从可采纳下界起步的 IDA* 迭代加深 → 首个成功深度即真最优。
// 故输出与 big 路径(精确 pair 表)逐格 bit-exact,只是搜索访问更多节点。
//
// 复用:`XCrossSolver::new(false)` 已 ensure mt_edge4/corn/edge + pt_cross_C4E0;
// `get_virt` 的 im/ic/ie 在 huge=None 下照常算。本块不碰任何 huge 表。
impl XCrossSolver {
    /// K 槽多槽 IDA* 单次深度尝试。coords[j] = (i1=im, i2=ic*18, i3=ie*18, slot)。
    /// 推进逻辑逐槽等同 search_1;prune = 任一槽 pt_cross_C4E0 >= depth(即 max >= depth)。
    /// depth==1 且未被剪 ⟹ 所有槽 h==0 ⟹ 全解。
    fn search_multi(&self, coords: &[(usize, usize, usize, usize)], depth: u32, prev: u8) -> bool {
        let (vmoves, vcnt) = valid_moves();
        let count = vcnt[prev as usize] as usize;
        let row = &vmoves[prev as usize];
        let mt_e4 = self.mt_edge4.as_u32();
        let mt_c = self.mt_corn.as_u32();
        let mt_e = self.mt_edge.as_u32();
        let cj = conj_moves_flat();
        let pt = &self.pt_cross_c4e0;
        let n = coords.len();

        let mut local: u64 = 0;
        let mut next = [(0usize, 0usize, 0usize, 0usize); 4];
        for ki in 0..count {
            let m = row[ki] as usize;
            local += 1;
            let mut pruned = false;
            for (j, &(i1, i2, i3, slot)) in coords.iter().enumerate() {
                let m1 = cj[m][slot] as usize;
                let n_i1 = mt_e4[i1 + m1] as usize;
                let n_i2 = mt_c[i2 + m1] as usize;
                let n_i3 = mt_e[i3 + m1] as usize;
                let idx: u64 = (n_i1 as u64 + n_i2 as u64) * 24 + n_i3 as u64;
                if pt.get(idx) as u32 >= depth {
                    pruned = true;
                    break;
                }
                next[j] = (n_i1, n_i2 * 18, n_i3 * 18, slot);
            }
            if pruned {
                continue;
            }
            if depth == 1 {
                bump_node_count(local);
                return true;
            }
            if self.search_multi(&next[..n], depth - 1, m as u8) {
                bump_node_count(local);
                return true;
            }
        }
        bump_node_count(local);
        false
    }

    /// 单槽 XCross 距离(pt_cross_C4E0 查值),作 per-slot 启发式。
    #[inline]
    fn slot_h(&self, s: &VirtState) -> u32 {
        let idx = (s.im as u64 + s.ic as u64) * 24 + s.ie as u64;
        self.pt_cross_c4e0.get(idx) as u32
    }

    /// 解一个 slot 子集的 K-cross 最优步数。subset_h = max 单槽下界;
    /// start = subset_h.max(prev_stage)(cascade 单调);搜到 max_d 为止。
    fn solve_subset(
        &self,
        st: &[VirtState; 4],
        slots: &[usize],
        subset_h: u32,
        prev_stage: u32,
        max_d: u32,
    ) -> u32 {
        if subset_h == 0 {
            return 0; // 根状态各槽已解
        }
        let n = slots.len();
        let mut coords = [(0usize, 0usize, 0usize, 0usize); 4];
        for (j, &k) in slots.iter().enumerate() {
            coords[j] = (
                st[k].im as usize,
                (st[k].ic as usize) * 18,
                (st[k].ie as usize) * 18,
                k,
            );
        }
        let start = subset_h.max(prev_stage);
        for d in start..=max_d {
            if self.search_multi(&coords[..n], d, 18) {
                return d;
            }
        }
        99
    }

    /// K 槽多解枚举:把 `coords` 对应的子集在恰好 `depth` 步内的所有解(rotated frame
    /// 的 move 索引路径)收进 `out`。与 `search_multi` 同剪枝,但不首解 return;cap 封顶。
    #[allow(clippy::too_many_arguments)]
    fn enumerate_multi(
        &self,
        coords: &[(usize, usize, usize, usize)],
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
        let pt = &self.pt_cross_c4e0;
        let n = coords.len();
        let mut next = [(0usize, 0usize, 0usize, 0usize); 4];
        for ki in 0..count {
            if out.len() >= cap {
                return;
            }
            let m = row[ki] as usize;
            let mut pruned = false;
            for (j, &(i1, i2, i3, slot)) in coords.iter().enumerate() {
                let m1 = cj[m][slot] as usize;
                let n_i1 = mt_e4[i1 + m1] as usize;
                let n_i2 = mt_c[i2 + m1] as usize;
                let n_i3 = mt_e[i3 + m1] as usize;
                let idx: u64 = (n_i1 as u64 + n_i2 as u64) * 24 + n_i3 as u64;
                if pt.get(idx) as u32 >= depth {
                    pruned = true;
                    break;
                }
                next[j] = (n_i1, n_i2 * 18, n_i3 * 18, slot);
            }
            if pruned {
                continue;
            }
            path.push(m as u8);
            if depth == 1 {
                out.push(path.clone());
            } else {
                self.enumerate_multi(&next[..n], depth - 1, m as u8, path, out, cap);
            }
            path.pop();
        }
    }

    /// 给定变体槽数 `k`(1=xc,2=xxc,3=xxxc,4=xxxxc),挑最优 combo 后枚举其多解。
    /// 返回 (最优步数, 最优 combo 槽位, 解集)。解是 rotated frame move 索引路径。
    /// `extra`=允许超出最优步数;`cap`=最多收集条数。与 `get_stats_small` 同口径(min over combos)。
    pub fn enumerate_best(
        &self,
        alg: &[Move],
        rot: &str,
        k: usize,
        extra: u32,
        cap: usize,
    ) -> (u32, Vec<usize>, Vec<Vec<u8>>) {
        const PAIRS: [(usize, usize); 6] = [(0, 1), (0, 2), (0, 3), (1, 2), (1, 3), (2, 3)];
        const TRIPS: [(usize, usize, usize); 4] = [(0, 1, 2), (0, 1, 3), (0, 2, 3), (1, 2, 3)];

        let base: Vec<u8> = alg.iter().map(|m| m.index() as u8).collect();
        let mut a = base.clone();
        alg_rotation(&mut a, rot);
        let st: [VirtState; 4] = std::array::from_fn(|j| self.get_virt(&a, j));
        let h0: [u32; 4] = std::array::from_fn(|j| self.slot_h(&st[j]));

        let combos: Vec<Vec<usize>> = match k {
            1 => vec![vec![0], vec![1], vec![2], vec![3]],
            2 => PAIRS.iter().map(|&(x, y)| vec![x, y]).collect(),
            3 => TRIPS.iter().map(|&(x, y, z)| vec![x, y, z]).collect(),
            _ => vec![vec![0, 1, 2, 3]],
        };
        let max_d = match k {
            1 => 12,
            2 => 14,
            _ => 16,
        };

        // 按启发式排序,solve_subset 求每个 combo 长度,取 argmin(= get_stats_small 口径)。
        let mut scored: Vec<(u32, Vec<usize>)> = combos
            .into_iter()
            .map(|c| (c.iter().map(|&s| h0[s]).max().unwrap(), c))
            .collect();
        scored.sort_by_key(|t| t.0);

        let mut best_len = 99u32;
        let mut best_combo = scored[0].1.clone();
        for (h, c) in &scored {
            if *h >= best_len {
                break;
            }
            let res = self.solve_subset(&st, c, *h, 0, max_d);
            if res < best_len {
                best_len = res;
                best_combo = c.clone();
            }
        }

        let mut out: Vec<Vec<u8>> = Vec::new();
        if best_len == 0 || best_len >= 99 {
            return (best_len.min(0), best_combo, out);
        }

        // 枚举 best_combo:best_len .. best_len+extra,逐层收集。
        let n = best_combo.len();
        let mut coords = [(0usize, 0usize, 0usize, 0usize); 4];
        for (j, &s) in best_combo.iter().enumerate() {
            coords[j] = (
                st[s].im as usize,
                (st[s].ic as usize) * 18,
                (st[s].ie as usize) * 18,
                s,
            );
        }
        let mut path = Vec::new();
        for d in best_len..=(best_len + extra).min(16) {
            self.enumerate_multi(&coords[..n], d, 18, &mut path, &mut out, cap);
            if out.len() >= cap {
                break;
            }
        }
        (best_len, best_combo, out)
    }

    /// 小表版 6 视角 × 4 阶段,返回 24 值,顺序 [xc×6, xxc×6, xxxc×6, xxxxc×6]。
    /// 与 `get_stats`(big)同口径但全程仅用 pt_cross_C4E0(52 MB),不依赖 huge 表。
    /// `max_v`:封顶阶段(0=只到 xc,1=xxc,2=xxxc,3=xxxxc);超过的阶段不计算,留 0。
    /// WASM 据用户选的变体封顶,避免没要 xxxxc 时白跑最慢阶段。
    pub fn get_stats_small(&self, alg: &[Move], rots: &[&str], max_v: usize) -> Vec<u32> {
        const PAIRS: [(usize, usize); 6] = [(0, 1), (0, 2), (0, 3), (1, 2), (1, 3), (2, 3)];
        const TRIPS: [(usize, usize, usize); 4] = [(0, 1, 2), (0, 1, 3), (0, 2, 3), (1, 2, 3)];

        let n = rots.len();
        let mut xc = vec![0u32; n];
        let mut xxc = vec![0u32; n];
        let mut xxxc = vec![0u32; n];
        let mut f2l = vec![0u32; n];
        let base: Vec<u8> = alg.iter().map(|m| m.index() as u8).collect();

        for (r, rot) in rots.iter().enumerate() {
            let mut a = base.clone();
            alg_rotation(&mut a, rot);
            let st: [VirtState; 4] = std::array::from_fn(|k| self.get_virt(&a, k));
            let h0: [u32; 4] = std::array::from_fn(|k| self.slot_h(&st[k]));

            // --- XCross:min over 4 单槽 ---
            let mut order: [usize; 4] = [0, 1, 2, 3];
            order.sort_by_key(|&k| h0[k]);
            let mut best = 99u32;
            for &k in &order {
                if h0[k] >= best {
                    break;
                }
                let res = self.solve_subset(&st, &[k], h0[k], 0, 12);
                best = best.min(res);
            }
            xc[r] = best;
            if max_v == 0 {
                continue;
            }

            // --- XXCross:min over 6 pair ---
            let mut t2: [(usize, usize, u32); 6] =
                std::array::from_fn(|i| (PAIRS[i].0, PAIRS[i].1, h0[PAIRS[i].0].max(h0[PAIRS[i].1])));
            t2.sort_by_key(|t| t.2);
            let mut best = 99u32;
            for &(a0, b0, h) in &t2 {
                if h >= best {
                    break;
                }
                let res = self.solve_subset(&st, &[a0, b0], h, xc[r], 14);
                best = best.min(res);
            }
            xxc[r] = best;
            if max_v == 1 {
                continue;
            }

            // --- XXXCross:min over 4 triple ---
            let mut t3: [(usize, usize, usize, u32); 4] = std::array::from_fn(|i| {
                let (x, y, z) = TRIPS[i];
                (x, y, z, h0[x].max(h0[y]).max(h0[z]))
            });
            t3.sort_by_key(|t| t.3);
            let mut best = 99u32;
            for &(x, y, z, h) in &t3 {
                if h >= best {
                    break;
                }
                let res = self.solve_subset(&st, &[x, y, z], h, xxc[r], 16);
                best = best.min(res);
            }
            xxxc[r] = best;
            if max_v == 2 {
                continue;
            }

            // --- XXXXCross / F2L:全 4 槽 ---
            let h4 = h0[0].max(h0[1]).max(h0[2]).max(h0[3]);
            f2l[r] = self.solve_subset(&st, &[0, 1, 2, 3], h4, xxxc[r], 16);
        }

        let mut out = Vec::with_capacity(4 * n);
        out.extend(xc);
        out.extend(xxc);
        out.extend(xxxc);
        out.extend(f2l);
        out
    }
}

#[cfg(test)]
mod tests {
    use super::*;
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

    /// XCross 6 列对照 D:/cube/solver/golden/scramble_1000_std.txt 前 3 行
    /// (列顺序 _z0 _z2 _z3 _z1 _x3 _x1 对应 rot ""/z2/z'/z/x'/x)。
    /// 仅 XCross(new(false)),不碰 ~10 GB huge 表;`cargo test --release -- --ignored`。
    #[test]
    #[ignore]
    fn xcross_matches_golden_first3() {
        let _lock = test_env_lock().lock().unwrap_or_else(|e| e.into_inner());
        let dir = setup_iso_dir("xcross_golden");
        std::env::set_var("CUBE_TABLE_DIR", &dir);

        let cases: &[(&str, &str, [u32; 6])] = &[
            (
                "22001",
                "B2 U' L2 U F2 L2 D2 L2 U F2 L F2 L D U L' D2 F' U2 B",
                [7, 7, 8, 7, 9, 7],
            ),
            (
                "23001",
                "D2 U L2 B2 R2 F2 R2 U2 R2 D' R' D B2 U B' R B' D B' L'",
                [7, 7, 6, 8, 7, 5],
            ),
            (
                "24001",
                "L2 D F2 D' B2 L2 R2 U2 F2 D L' U2 R2 B' R F R2 D' U F L' F'",
                [8, 7, 8, 8, 8, 7],
            ),
        ];

        let rots = ["", "z2", "z'", "z", "x'", "x"];
        let solver = XCrossSolver::new(false);

        for (id, scramble, expected) in cases {
            let alg = string_to_alg(scramble);
            let got = solver.get_stats(&alg, &rots);
            assert_eq!(
                &got[0..6],
                expected.as_slice(),
                "xcross id {} mismatch: got {:?} expected {:?}",
                id,
                &got[0..6],
                expected
            );
        }

        cleanup(&dir);
    }

    /// 小表 cascade(get_stats_small)24 列对照 scramble_5 golden(全 5 行,
    /// xcross/xxcross/xxxcross/xxxxcross)。验小表 admissible 启发式仍返回最优
    /// ⟹ 与 big(huge pair 表)逐格 bit-exact。
    ///
    /// 用真实 `./tables/`(pt_cross_C4E0 52MB mmap 复用,不重生成,不碰 huge)。
    /// 慢(xxxxcross 松启发式),故 #[ignore];跑:
    ///   `cargo test --release -- --ignored small_cascade_matches_golden_scramble5`
    #[test]
    #[ignore]
    fn small_cascade_matches_golden_scramble5() {
        let _lock = test_env_lock().lock().unwrap_or_else(|e| e.into_inner());
        let dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tables");
        std::env::set_var("CUBE_TABLE_DIR", &dir);

        // 每行 24 值 = [xcross×6, xxcross×6, xxxcross×6, xxxxcross×6]
        let cases: &[(&str, &str, [u32; 24])] = &[
            ("22001", "B2 U' L2 U F2 L2 D2 L2 U F2 L F2 L D U L' D2 F' U2 B",
                [7,7,8,7,9,7, 9,10,10,9,10,9, 11,11,11,12,12,10, 14,14,14,13,14,14]),
            ("23001", "D2 U L2 B2 R2 F2 R2 U2 R2 D' R' D B2 U B' R B' D B' L'",
                [7,7,6,8,7,5, 10,9,8,9,9,8, 12,11,11,11,12,11, 13,13,12,13,14,12]),
            ("24001", "L2 D F2 D' B2 L2 R2 U2 F2 D L' U2 R2 B' R F R2 D' U F L' F'",
                [8,7,8,8,8,7, 10,9,10,9,10,9, 12,11,11,11,12,11, 14,14,14,13,13,14]),
            ("25001", "U' B2 U2 F2 L2 D' F2 L2 B' D2 B' L' F R D L' B2 L2 B2 D' L2 U",
                [8,7,7,7,7,7, 10,9,9,10,9,9, 12,10,12,12,12,12, 14,13,15,14,14,15]),
            ("26001", "U2 R2 U' F2 D' L2 F2 D L B2 F2 D' L' U2 L R F U2 B' D2 B R2",
                [3,8,7,4,6,5, 5,10,10,5,8,7, 9,11,11,8,10,9, 12,14,13,11,13,12]),
        ];

        let rots = ["", "z2", "z'", "z", "x'", "x"];
        let solver = XCrossSolver::new(false);

        for (id, scramble, expected) in cases {
            let alg = string_to_alg(scramble);
            let got = solver.get_stats_small(&alg, &rots, 3);
            assert_eq!(
                got.as_slice(),
                expected.as_slice(),
                "small cascade id {} mismatch:\n got {:?}\n exp {:?}",
                id, got, expected
            );
        }
    }

    /// 多解枚举锚定:对 scramble_5 的 22001,rot=""(Rotation None),全 4 槽 xxxxcross,
    /// 最优深度必须 = 14,且 or18 给的那条解必须在枚举集合里。
    /// (来源:or18 F2L Lite solver 截图,Slot=BL BR FR FL,Current Depth 14。)
    /// 跑:`cargo test --release -- --ignored enumerate_xxxxcross_matches_or18`
    #[test]
    #[ignore]
    fn enumerate_xxxxcross_matches_or18() {
        use crate::cube_common::MOVE_NAMES;
        let _lock = test_env_lock().lock().unwrap_or_else(|e| e.into_inner());
        let dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tables");
        std::env::set_var("CUBE_TABLE_DIR", &dir);

        let scramble = "B2 U' L2 U F2 L2 D2 L2 U F2 L F2 L D U L' D2 F' U2 B";
        let alg = string_to_alg(scramble);
        let solver = XCrossSolver::new(false);

        // k=4 = 全 4 槽 = xxxxcross;cap 拉高确保 14 步全部解都枚举出来
        let (best_len, combo, sols) = solver.enumerate_best(&alg, "", 4, 0, 100_000);
        assert_eq!(best_len, 14, "xxxxcross optimal must be 14, got {}", best_len);
        assert_eq!(combo, vec![0, 1, 2, 3], "全 4 槽 combo");

        let strs: Vec<String> = sols
            .iter()
            .map(|p| {
                p.iter()
                    .map(|&m| MOVE_NAMES[m as usize])
                    .collect::<Vec<_>>()
                    .join(" ")
            })
            .collect();

        // 每条解长度都必须 = 14
        for s in &sols {
            assert_eq!(s.len(), 14, "all enumerated sols must be length 14");
        }

        let target = "L D2 B L2 U' B R2 U' F2 B D R U2 L'";
        assert!(
            strs.iter().any(|s| s == target),
            "or18 solution `{}` must be in the {} enumerated optimal solutions",
            target,
            strs.len()
        );
        eprintln!("enumerated {} optimal (14-move) xxxxcross solutions; or18 ref found ✓", strs.len());
    }

    /// 节点天花板:用 huge 表(完美 pair 启发式)跑 25001 的 6 视角 xxxxc,报告节点。
    /// 对比小表 max-单槽 的 325M,判断 reduced 表能压到什么量级。
    /// 跑:`cargo test --release -- --ignored --nocapture bench_xxxxc_huge_ceiling`
    #[test]
    #[ignore]
    fn bench_xxxxc_huge_ceiling() {
        use crate::executor::GLOBAL_NODES;
        use std::sync::atomic::Ordering;
        use std::time::Instant;

        let _lock = test_env_lock().lock().unwrap_or_else(|e| e.into_inner());
        let dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tables");
        std::env::set_var("CUBE_TABLE_DIR", &dir);

        let scrambles: &[(&str, &str)] = &[
            ("26001", "U2 R2 U' F2 D' L2 F2 D L B2 F2 D' L' U2 L R F U2 B' D2 B R2"),
            ("25001", "U' B2 U2 F2 L2 D' F2 L2 B' D2 B' L' F R D L' B2 L2 B2 D' L2 U"),
        ];
        let rots = ["", "z2", "z'", "z", "x'", "x"];
        eprintln!("\n=== xxxxcross HUGE-path node ceiling (perfect pair heuristic) ===");
        let solver = XCrossSolver::new(true);
        for (id, scr) in scrambles {
            let alg = string_to_alg(scr);
            GLOBAL_NODES.store(0, Ordering::Relaxed);
            let t = Instant::now();
            let out = solver.get_stats(&alg, &rots);
            let ms = t.elapsed().as_secs_f64() * 1e3;
            let nodes = GLOBAL_NODES.load(Ordering::Relaxed);
            eprintln!("{}: {:>8.1}ms  nodes={:>12}  f2l={:?}", id, ms, nodes, &out[18..24]);
        }
    }

    /// xxxxcross 逐打乱基准:scramble_5 每条跑 6 视角 xxxxc,报告 ms + 节点。
    /// 这是 UI 实际口径(get_stats_small max_v=3 取 f2l 6 视角)。
    /// 跑:`cargo test --release -- --ignored --nocapture bench_xxxxc_per_scramble`
    #[test]
    #[ignore]
    fn bench_xxxxc_per_scramble() {
        use crate::executor::GLOBAL_NODES;
        use std::sync::atomic::Ordering;
        use std::time::Instant;

        let _lock = test_env_lock().lock().unwrap_or_else(|e| e.into_inner());
        let dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tables");
        std::env::set_var("CUBE_TABLE_DIR", &dir);

        let scrambles: &[(&str, &str)] = &[
            ("22001", "B2 U' L2 U F2 L2 D2 L2 U F2 L F2 L D U L' D2 F' U2 B"),
            ("23001", "D2 U L2 B2 R2 F2 R2 U2 R2 D' R' D B2 U B' R B' D B' L'"),
            ("24001", "L2 D F2 D' B2 L2 R2 U2 F2 D L' U2 R2 B' R F R2 D' U F L' F'"),
            ("25001", "U' B2 U2 F2 L2 D' F2 L2 B' D2 B' L' F R D L' B2 L2 B2 D' L2 U"),
            ("26001", "U2 R2 U' F2 D' L2 F2 D L B2 F2 D' L' U2 L R F U2 B' D2 B R2"),
        ];
        let rots = ["", "z2", "z'", "z", "x'", "x"];
        let solver = XCrossSolver::new(false);

        eprintln!("\n=== xxxxcross per-scramble bench (6 rotations) ===");
        let mut tot_ms = 0.0;
        let mut tot_nodes = 0u64;
        for (id, scr) in scrambles {
            let alg = string_to_alg(scr);
            GLOBAL_NODES.store(0, Ordering::Relaxed);
            let t = Instant::now();
            let out = solver.get_stats_small(&alg, &rots, 3);
            let ms = t.elapsed().as_secs_f64() * 1e3;
            let nodes = GLOBAL_NODES.load(Ordering::Relaxed);
            let f2l = &out[18..24];
            tot_ms += ms;
            tot_nodes += nodes;
            eprintln!("{}: {:>8.1}ms  nodes={:>12}  f2l={:?}", id, ms, nodes, f2l);
        }
        eprintln!("TOTAL: {:.1}ms  nodes={}  (avg {:.1}ms/scramble)\n", tot_ms, tot_nodes, tot_ms / 5.0);
    }

    /// Phase 2 基准:小表 cascade 逐变体(cross/xc/xxc/xxxc/xxxxc)单视角(rot="")
    /// 的墙钟 + 节点数,scramble_5 全 5 条。打印表格,不做断言。
    /// 跑:`cargo test --release -- --ignored --nocapture bench_small_per_stage`
    #[test]
    #[ignore]
    fn bench_small_per_stage() {
        use crate::cross_solver::CrossSolver;
        use crate::executor::GLOBAL_NODES;
        use std::sync::atomic::Ordering;
        use std::time::Instant;

        let _lock = test_env_lock().lock().unwrap_or_else(|e| e.into_inner());
        let dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tables");
        std::env::set_var("CUBE_TABLE_DIR", &dir);

        let scrambles: &[(&str, &str)] = &[
            ("22001", "B2 U' L2 U F2 L2 D2 L2 U F2 L F2 L D U L' D2 F' U2 B"),
            ("23001", "D2 U L2 B2 R2 F2 R2 U2 R2 D' R' D B2 U B' R B' D B' L'"),
            ("24001", "L2 D F2 D' B2 L2 R2 U2 F2 D L' U2 R2 B' R F R2 D' U F L' F'"),
            ("25001", "U' B2 U2 F2 L2 D' F2 L2 B' D2 B' L' F R D L' B2 L2 B2 D' L2 U"),
            ("26001", "U2 R2 U' F2 D' L2 F2 D L B2 F2 D' L' U2 L R F U2 B' D2 B R2"),
        ];
        const PAIRS: [(usize, usize); 6] = [(0, 1), (0, 2), (0, 3), (1, 2), (1, 3), (2, 3)];
        const TRIPS: [(usize, usize, usize); 4] =
            [(0, 1, 2), (0, 1, 3), (0, 2, 3), (1, 2, 3)];

        let cross_solver = CrossSolver::new(false);
        let solver = XCrossSolver::new(false);

        // (stage, total_ms, total_nodes)
        let mut agg: [(f64, u64); 5] = [(0.0, 0); 5];

        eprintln!("\n=== small cascade per-stage bench (rot=\"\", single rotation) ===");
        eprintln!("{:<7} {:>10} {:>10} {:>10} {:>10} {:>10}", "id", "cross", "xc", "xxc", "xxxc", "xxxxc");
        for (id, scr) in scrambles {
            let alg = string_to_alg(scr);
            let st: [VirtState; 4] = std::array::from_fn(|k| solver.get_virt(
                &alg.iter().map(|m| m.index() as u8).collect::<Vec<_>>(), k));
            let h0: [u32; 4] = std::array::from_fn(|k| solver.slot_h(&st[k]));
            let mut ms = [0.0f64; 5];

            // cross
            let t = Instant::now();
            let _ = cross_solver.get_stats(&alg, &[""]);
            ms[0] = t.elapsed().as_secs_f64() * 1e3;

            // xc: min over 4 single slots
            GLOBAL_NODES.store(0, Ordering::Relaxed);
            let t = Instant::now();
            let mut order = [0usize, 1, 2, 3];
            order.sort_by_key(|&k| h0[k]);
            let mut best = 99u32;
            for &k in &order {
                if h0[k] >= best { break; }
                best = best.min(solver.solve_subset(&st, &[k], h0[k], 0, 12));
            }
            let xc = best;
            ms[1] = t.elapsed().as_secs_f64() * 1e3;
            agg[1].1 += GLOBAL_NODES.load(Ordering::Relaxed);

            // xxc: min over 6 pairs
            GLOBAL_NODES.store(0, Ordering::Relaxed);
            let t = Instant::now();
            let mut t2: [(usize, usize, u32); 6] = std::array::from_fn(|i|
                (PAIRS[i].0, PAIRS[i].1, h0[PAIRS[i].0].max(h0[PAIRS[i].1])));
            t2.sort_by_key(|t| t.2);
            let mut best = 99u32;
            for &(a, b, h) in &t2 {
                if h >= best { break; }
                best = best.min(solver.solve_subset(&st, &[a, b], h, xc, 14));
            }
            let xxc = best;
            ms[2] = t.elapsed().as_secs_f64() * 1e3;
            agg[2].1 += GLOBAL_NODES.load(Ordering::Relaxed);

            // xxxc: min over 4 triples
            GLOBAL_NODES.store(0, Ordering::Relaxed);
            let t = Instant::now();
            let mut t3: [(usize, usize, usize, u32); 4] = std::array::from_fn(|i| {
                let (x, y, z) = TRIPS[i];
                (x, y, z, h0[x].max(h0[y]).max(h0[z]))
            });
            t3.sort_by_key(|t| t.3);
            let mut best = 99u32;
            for &(x, y, z, h) in &t3 {
                if h >= best { break; }
                best = best.min(solver.solve_subset(&st, &[x, y, z], h, xxc, 16));
            }
            let xxxc = best;
            ms[3] = t.elapsed().as_secs_f64() * 1e3;
            agg[3].1 += GLOBAL_NODES.load(Ordering::Relaxed);

            // xxxxc: all 4
            GLOBAL_NODES.store(0, Ordering::Relaxed);
            let t = Instant::now();
            let h4 = h0[0].max(h0[1]).max(h0[2]).max(h0[3]);
            let _ = solver.solve_subset(&st, &[0, 1, 2, 3], h4, xxxc, 16);
            ms[4] = t.elapsed().as_secs_f64() * 1e3;
            agg[4].1 += GLOBAL_NODES.load(Ordering::Relaxed);

            for i in 0..5 { agg[i].0 += ms[i]; }
            eprintln!("{:<7} {:>9.1}ms {:>9.1}ms {:>9.1}ms {:>9.1}ms {:>9.1}ms",
                id, ms[0], ms[1], ms[2], ms[3], ms[4]);
        }
        eprintln!("{:<7} {:>9.1}ms {:>9.1}ms {:>9.1}ms {:>9.1}ms {:>9.1}ms", "TOTAL",
            agg[0].0, agg[1].0, agg[2].0, agg[3].0, agg[4].0);
        eprintln!("nodes:  cross={} xc={} xxc={} xxxc={} xxxxc={}",
            agg[0].1, agg[1].1, agg[2].1, agg[3].1, agg[4].1);
        eprintln!("(单视角;analyzer 实际 ×6 视角。WASM 预估 ×1.5-3。)\n");
    }
}
