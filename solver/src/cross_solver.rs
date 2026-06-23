//! Cross 阶段 IDA* 搜索器(Std / Pseudo 共享)。
//!
//! 移植自 C++ `cross_solver.h`。Std 与 Pseudo 共享同一套搜索逻辑,
//! 仅剪枝表不同(pt_cross vs pt_pscross),用 `is_pseudo` 切换。
//!
//! 数学结构:Cross 状态 = (Edge2_A, Edge2_B) 两个 22*24 = 528 维棱二元组的笛卡尔积,
//! 总 528*528 = 278784 个 cell,4-bit packed = 139 392 字节。

use std::sync::Arc;

use crate::cube_common::{
    alg_rotation, state_space, valid_moves, valid_moves_masked, Move, MoveMask, ValidMovesTable,
};
use crate::move_tables::{self, MoveTable};
use crate::prune_tables::{self, PackedPruneTable};

pub struct CrossSolver {
    mt_edge2: Arc<MoveTable>,
    pt: Arc<PackedPruneTable>,
}

impl CrossSolver {
    /// `is_pseudo=false` 用 pt_cross,`is_pseudo=true` 用 pt_pscross。
    /// 调用前请确保对应表已可生成 / 已生成。native-only(走 manager);WASM 用 from_tables。
    #[cfg(not(target_arch = "wasm32"))]
    pub fn new(is_pseudo: bool) -> Self {
        let mt_mgr = move_tables::instance();
        let pt_mgr = prune_tables::instance();
        let mt_edge2 = mt_mgr.ensure_edge2();
        let pt = if is_pseudo {
            pt_mgr.ensure_pt_pscross()
        } else {
            pt_mgr.ensure_pt_cross()
        };
        CrossSolver { mt_edge2, pt }
    }

    /// 直接用预建表构造(绕过 manager / 磁盘 / mmap)。WASM 路径用。
    pub fn from_tables(mt_edge2: Arc<MoveTable>, pt: Arc<PackedPruneTable>) -> Self {
        CrossSolver { mt_edge2, pt }
    }

    /// IDA* 单次深度尝试。返回是否在 `depth` 步内可解。
    /// `i1` / `i2` 已是 "raw_idx * 18"(stride 18 的 move-table 读取偏移)。
    /// `prev` 是 0..=18 的 sentinel(18 = 无上一步)。
    /// `vm` 是要用的 valid-moves 表(全集 = `valid_moves()`,受限 = `valid_moves_masked`)。
    fn search(&self, i1: usize, i2: usize, depth: u32, prev: u8, vm: &ValidMovesTable) -> bool {
        let (vmoves, vcnt) = vm;
        let count = vcnt[prev as usize] as usize;
        let row = &vmoves[prev as usize];
        let mt = self.mt_edge2.as_u32();
        for k in 0..count {
            let m = row[k] as usize;
            let n_i1 = mt[i1 + m] as usize;
            let n_i2 = mt[i2 + m] as usize;
            let idx = (n_i1 as u64) * (state_space::EDGE2 as u64) + n_i2 as u64;
            if self.pt.get(idx) as u32 >= depth {
                continue;
            }
            if depth == 1 {
                return true;
            }
            if self.search(n_i1 * 18, n_i2 * 18, depth - 1, m as u8, vm) {
                return true;
            }
        }
        false
    }

    /// 从 SOLVED 跑 (alg, rot) 得到搜索起点 (i1, i2)(raw 索引,未乘 18)。
    fn start_indices(&self, alg: &[Move], rot: &str) -> (usize, usize) {
        // 把 alg 中每个 move 经过 rotation 变换
        let mut buf: Vec<u8> = alg.iter().map(|m| m.index() as u8).collect();
        alg_rotation(&mut buf, rot);
        let mt = self.mt_edge2.as_u32();
        let mut i1 = state_space::EDGE2_A_SOLVED;
        let mut i2 = state_space::EDGE2_B_SOLVED;
        for &m in &buf {
            i1 = mt[i1 * 18 + m as usize] as usize;
            i2 = mt[i2 * 18 + m as usize] as usize;
        }
        (i1, i2)
    }

    /// 计算单个 (alg, rot) 视角下 Cross 最少步数。
    /// 内部:从 SOLVED 起跑 alg,再 IDA* 找最小 d。返回 0 表示已是 SOLVED。
    fn solve_one(&self, alg: &[Move], rot: &str) -> u32 {
        let (i1, i2) = self.start_indices(alg, rot);
        let idx = (i1 as u64) * (state_space::EDGE2 as u64) + i2 as u64;
        let d_min = self.pt.get(idx) as u32;
        if d_min == 0 {
            return 0;
        }
        let vm = valid_moves();
        for d in d_min..=8 {
            if self.search(i1 * 18, i2 * 18, d, 18, vm) {
                return d;
            }
        }
        // Cross 最优 <= 8 一定成立(理论上界);若失败说明表有问题
        9
    }

    /// 受限 move 集单视角求解:只许 mask 内的 move,在 max_depth 步内找最优,找不到 None。
    /// pt 是全集距离 ⟹ 对任意 mask 仍可采纳。mask=MASK_ALL 且 max_depth>=8 时与 solve_one 一致。
    fn solve_one_masked(
        &self,
        alg: &[Move],
        rot: &str,
        mask: MoveMask,
        max_depth: u32,
    ) -> Option<u32> {
        let (i1, i2) = self.start_indices(alg, rot);
        let idx = (i1 as u64) * (state_space::EDGE2 as u64) + i2 as u64;
        let d_min = self.pt.get(idx) as u32;
        if d_min == 0 {
            return Some(0);
        }
        let vm = valid_moves_masked(mask);
        for d in d_min..=max_depth {
            if self.search(i1 * 18, i2 * 18, d, 18, &vm) {
                return Some(d);
            }
        }
        None
    }

    /// 多视角批量统计,顺序与 `rots` 一致。
    pub fn get_stats(&self, alg: &[Move], rots: &[&str]) -> Vec<u32> {
        rots.iter().map(|r| self.solve_one(alg, r)).collect()
    }

    /// 受限 move 集多视角批量统计;max_depth 内无解的视角为 None。
    pub fn get_stats_masked(
        &self,
        alg: &[Move],
        rots: &[&str],
        mask: MoveMask,
        max_depth: u32,
    ) -> Vec<Option<u32>> {
        rots.iter()
            .map(|r| self.solve_one_masked(alg, r, mask, max_depth))
            .collect()
    }

    /// 枚举 (i1,i2) 恰好 `depth` 步内的所有解,把 move 索引路径(rotated frame)收进 `out`。
    /// 与 `search` 同剪枝(pt 可采纳),但不在首个解 return,而是收集全部;cap 封顶。
    #[allow(clippy::too_many_arguments)]
    fn enumerate(
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
            let n_i1 = mt[i1 + m] as usize;
            let n_i2 = mt[i2 + m] as usize;
            let idx = (n_i1 as u64) * (state_space::EDGE2 as u64) + n_i2 as u64;
            let h = self.pt.get(idx) as u32;
            if h >= depth {
                continue;
            }
            path.push(m as u8);
            if depth == 1 {
                // h < 1 ⟹ h==0 ⟹ 已解
                out.push(path.clone());
            } else if h > 0 {
                // h==0 且 depth>1:子状态已解却还要再走 depth-1 步 → 该解 = 更短解 + 无效尾动
                // (如十字已成再多转一个 U),冗余,跳过不递归。
                self.enumerate(n_i1 * 18, n_i2 * 18, depth - 1, m as u8, path, out, cap, vm);
            }
            path.pop();
        }
    }

    /// 多解枚举:返回 (最优步数, 解集)。解是 rotated frame 的 move 索引路径。
    /// `extra` = 允许超出最优的步数(0=只最优长度全部解);`cap` = 最多收集条数。
    pub fn enumerate_solutions(
        &self,
        alg: &[Move],
        rot: &str,
        extra: u32,
        cap: usize,
    ) -> (u32, Vec<Vec<u8>>) {
        let (i1, i2) = self.start_indices(alg, rot);
        let idx = (i1 as u64) * (state_space::EDGE2 as u64) + i2 as u64;
        let d_min = self.pt.get(idx) as u32;
        let mut out = Vec::new();
        if d_min == 0 {
            return (0, out);
        }
        let vm = valid_moves();
        let mut path = Vec::new();
        for d in d_min..=(d_min + extra) {
            self.enumerate(i1 * 18, i2 * 18, d, 18, &mut path, &mut out, cap, vm);
            if out.len() >= cap {
                break;
            }
        }
        (d_min, out)
    }

    /// 受限 move 集多解枚举:从 pt 下界逐深加深到首个有解深度 best(<= max_depth,
    /// 否则 None),再收集 best..=best+extra,cap 截断(要求 cap >= 1)。
    /// mask=MASK_ALL 且 max_depth>=8 时与 enumerate_solutions 输出逐位一致。
    #[allow(clippy::too_many_arguments)]
    pub fn enumerate_solutions_masked(
        &self,
        alg: &[Move],
        rot: &str,
        extra: u32,
        cap: usize,
        mask: MoveMask,
        max_depth: u32,
    ) -> Option<(u32, Vec<Vec<u8>>)> {
        debug_assert!(cap >= 1);
        let (i1, i2) = self.start_indices(alg, rot);
        let idx = (i1 as u64) * (state_space::EDGE2 as u64) + i2 as u64;
        let d_min = self.pt.get(idx) as u32;
        let mut out = Vec::new();
        if d_min == 0 {
            return Some((0, out));
        }
        let vm = valid_moves_masked(mask);
        let mut path = Vec::new();
        let mut best = None;
        for d in d_min..=max_depth {
            self.enumerate(i1 * 18, i2 * 18, d, 18, &mut path, &mut out, cap, &vm);
            if !out.is_empty() {
                best = Some(d);
                break;
            }
        }
        let best = best?;
        for d in (best + 1)..=(best + extra) {
            if out.len() >= cap {
                break;
            }
            self.enumerate(i1 * 18, i2 * 18, d, 18, &mut path, &mut out, cap, &vm);
        }
        Some((best, out))
    }
}

/// 便捷入口:对单个打乱 + 单个视角求 Cross 最少步数。native-only(走 manager)。
#[cfg(not(target_arch = "wasm32"))]
pub fn search_cross(alg: &[Move], rot: &str, is_pseudo: bool) -> u32 {
    let s = CrossSolver::new(is_pseudo);
    s.solve_one(alg, rot)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::cube_common::{move_mask_of, string_to_alg, test_env_lock, State, MASK_ALL};
    use crate::htr_solver::G2_MOVES;
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

    // 5 个 Cross 视角的 golden 比对(只 cross 这一列,xcross+ 不在 cross_solver 范围)。
    // 数据来源:D:/cube/solver/golden/scramble_1000_std.txt 头 5 行 cross_z* 列。
    #[test]
    fn cross_matches_golden_first5() {
        let _lock = test_env_lock().lock().unwrap_or_else(|e| e.into_inner());
        let dir = setup_iso_dir("cross_golden");
        std::env::set_var("CUBE_TABLE_DIR", &dir);

        // (id, scramble, [cross_z0, cross_z2, cross_z3, cross_z1, cross_x3, cross_x1])
        // 列顺序对照 csv header:cross_z0/z2/z3/z1/x3/x1 对应 rot ""/z2/z'/z/x'/x
        let cases: &[(&str, &str, [u32; 6])] = &[
            ("22001", "B2 U' L2 U F2 L2 D2 L2 U F2 L F2 L D U L' D2 F' U2 B",
                [6, 6, 6, 5, 7, 5]),
            ("23001", "D2 U L2 B2 R2 F2 R2 U2 R2 D' R' D B2 U B' R B' D B' L'",
                [6, 6, 6, 6, 5, 5]),
            ("24001", "L2 D F2 D' B2 L2 R2 U2 F2 D L' U2 R2 B' R F R2 D' U F L' F'",
                [6, 6, 7, 7, 6, 6]),
            ("25001", "U' B2 U2 F2 L2 D' F2 L2 B' D2 B' L' F R D L' B2 L2 B2 D' L2 U",
                [6, 6, 5, 6, 6, 6]),
            ("26001", "U2 R2 U' F2 D' L2 F2 D L B2 F2 D' L' U2 L R F U2 B' D2 B R2",
                [3, 6, 6, 4, 6, 5]),
        ];

        let rots = ["", "z2", "z'", "z", "x'", "x"];
        let solver = CrossSolver::new(false);

        for (id, scramble, expected) in cases {
            let alg = string_to_alg(scramble);
            let got = solver.get_stats(&alg, &rots);
            assert_eq!(
                got.as_slice(),
                expected,
                "id {} mismatch: got {:?} expected {:?}",
                id, got, expected
            );
        }

        cleanup(&dir);
    }

    // ---------- move-mask(M1) ----------

    fn lcg(x: u64) -> u64 {
        x.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407)
    }

    /// 给定 move 池的确定性伪随机词。
    fn pseudo_word(seed: u64, len: usize, pool: &[u8]) -> Vec<Move> {
        let mut x = lcg(seed);
        let mut out = Vec::with_capacity(len);
        for _ in 0..len {
            x = lcg(x);
            out.push(Move::from_index(pool[(x >> 33) as usize % pool.len()] as usize));
        }
        out
    }

    /// State 级 cross 谓词(独立于 mt/pt 编码):D 层 4 棱归位且朝向正。
    fn cross_done(st: &State) -> bool {
        (8..12).all(|p| st.edges[p] == 2 * p as u8)
    }

    /// 独立暴力 DFS(MOVE_STATES 单件运动学,只剪同面相邻——最优词必无同面相邻):
    /// 是否存在恰好 depth 步、move 全在 pool 内、终态 cross 的词。
    fn brute_dfs(st: &State, depth: u32, prev: usize, pool: &[u8]) -> bool {
        if depth == 0 {
            return cross_done(st);
        }
        for &m in pool {
            let m = m as usize;
            if prev < 18 && m / 3 == prev / 3 {
                continue;
            }
            let ns = st.applied(Move::from_index(m));
            if brute_dfs(&ns, depth - 1, m, pool) {
                return true;
            }
        }
        false
    }

    /// mask=全集时,masked 入口与旧路径对一批固定打乱逐位相等
    /// (get_stats 步数、enumerate 解集/步数/顺序全同)。
    #[test]
    fn masked_full_mask_equals_unmasked_bitwise() {
        let _lock = test_env_lock().lock().unwrap_or_else(|e| e.into_inner());
        let dir = setup_iso_dir("cross_masked_full");
        std::env::set_var("CUBE_TABLE_DIR", &dir);

        let solver = CrossSolver::new(false);
        let rots = ["", "z2", "z'", "z", "x'", "x"];
        let all18: Vec<u8> = (0..18).collect();
        let mut scrambles: Vec<Vec<Move>> = [
            "B2 U' L2 U F2 L2 D2 L2 U F2 L F2 L D U L' D2 F' U2 B",
            "D2 U L2 B2 R2 F2 R2 U2 R2 D' R' D B2 U B' R B' D B' L'",
            "L2 D F2 D' B2 L2 R2 U2 F2 D L' U2 R2 B' R F R2 D' U F L' F'",
            "U' B2 U2 F2 L2 D' F2 L2 B' D2 B' L' F R D L' B2 L2 B2 D' L2 U",
            "U2 R2 U' F2 D' L2 F2 D L B2 F2 D' L' U2 L R F U2 B' D2 B R2",
        ]
        .iter()
        .map(|s| string_to_alg(s))
        .collect();
        for seed in 0..4u64 {
            scrambles.push(pseudo_word(40 + seed, 18, &all18));
        }

        for alg in &scrambles {
            let plain: Vec<Option<u32>> =
                solver.get_stats(alg, &rots).into_iter().map(Some).collect();
            assert_eq!(solver.get_stats_masked(alg, &rots, MASK_ALL, 8), plain);
            for rot in rots {
                let plain = solver.enumerate_solutions(alg, rot, 1, 32);
                assert_eq!(
                    solver.enumerate_solutions_masked(alg, rot, 1, 32, MASK_ALL, 8),
                    Some(plain),
                    "enumerate mismatch rot={}",
                    rot
                );
            }
        }

        cleanup(&dir);
    }

    /// mask 受限正确性:限 G2 10 步求 cross,与独立暴力对照一致,
    /// 且输出解只含 G2 步、State 级 replay 真到 cross。
    #[test]
    fn masked_g2_restricted_matches_brute_force() {
        let _lock = test_env_lock().lock().unwrap_or_else(|e| e.into_inner());
        let dir = setup_iso_dir("cross_masked_g2");
        std::env::set_var("CUBE_TABLE_DIR", &dir);

        let solver = CrossSolver::new(false);
        let g2_mask = move_mask_of(&G2_MOVES);

        // 谓词钉死:State 级 cross_done ⟺ solver 0 步(防两边各错一套)
        let all18: Vec<u8> = (0..18).collect();
        for seed in 0..30u64 {
            let alg = pseudo_word(900 + seed, (seed as usize) % 12, &all18);
            let mut st = State::SOLVED;
            for &m in &alg {
                st.apply(m);
            }
            assert_eq!(
                solver.get_stats(&alg, &[""])[0] == 0,
                cross_done(&st),
                "predicate pin seed={}",
                seed
            );
        }

        // G2 词(len<=6 ⟹ 受限最优 <= len,暴力 6 步内必找到)
        for seed in 0..12u64 {
            let len = 1 + (seed as usize) % 6;
            let alg = pseudo_word(7000 + seed, len, &G2_MOVES);
            let mut st = State::SOLVED;
            for &m in &alg {
                st.apply(m);
            }
            let mut brute = None;
            for d in 0..=6u32 {
                if brute_dfs(&st, d, 18, &G2_MOVES) {
                    brute = Some(d);
                    break;
                }
            }
            let brute = brute.expect("G2 word cross must solve within its length");

            assert_eq!(
                solver.solve_one_masked(&alg, "", g2_mask, 10),
                Some(brute),
                "solve seed={}",
                seed
            );
            assert_eq!(
                solver.get_stats_masked(&alg, &[""], g2_mask, 10),
                vec![Some(brute)]
            );
            // 受限最优 >= 全集最优
            assert!(brute >= solver.get_stats(&alg, &[""])[0]);

            let (best, sols) = solver
                .enumerate_solutions_masked(&alg, "", 1, 64, g2_mask, 10)
                .expect("must solve within 10");
            assert_eq!(best, brute, "enumerate best seed={}", seed);
            if best == 0 {
                assert!(sols.is_empty());
                continue;
            }
            assert!(!sols.is_empty());
            assert!(
                sols.iter().any(|s| s.len() as u32 == best),
                "optimal missing seed={}",
                seed
            );
            let uniq: std::collections::HashSet<&Vec<u8>> = sols.iter().collect();
            assert_eq!(uniq.len(), sols.len(), "dup solutions seed={}", seed);
            for sol in &sols {
                let l = sol.len() as u32;
                assert!(l >= best && l <= best + 1);
                assert!(
                    sol.iter().all(|m| G2_MOVES.contains(m)),
                    "non-G2 move in solution seed={}",
                    seed
                );
                let mut s2 = st;
                for &m in sol {
                    s2.apply(Move::from_index(m as usize));
                }
                assert!(cross_done(&s2), "solution doesn't reach cross seed={}", seed);
            }
        }

        cleanup(&dir);
    }
}
