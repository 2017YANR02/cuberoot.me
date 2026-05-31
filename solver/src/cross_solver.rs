//! Cross 阶段 IDA* 搜索器(Std / Pseudo 共享)。
//!
//! 移植自 C++ `cross_solver.h`。Std 与 Pseudo 共享同一套搜索逻辑,
//! 仅剪枝表不同(pt_cross vs pt_pscross),用 `is_pseudo` 切换。
//!
//! 数学结构:Cross 状态 = (Edge2_A, Edge2_B) 两个 22*24 = 528 维棱二元组的笛卡尔积,
//! 总 528*528 = 278784 个 cell,4-bit packed = 139 392 字节。

use std::sync::Arc;

use crate::cube_common::{alg_rotation, state_space, valid_moves, Move};
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
    fn search(&self, i1: usize, i2: usize, depth: u32, prev: u8) -> bool {
        let (vmoves, vcnt) = valid_moves();
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
            if self.search(n_i1 * 18, n_i2 * 18, depth - 1, m as u8) {
                return true;
            }
        }
        false
    }

    /// 计算单个 (alg, rot) 视角下 Cross 最少步数。
    /// 内部:从 SOLVED 起跑 alg,再 IDA* 找最小 d。返回 0 表示已是 SOLVED。
    fn solve_one(&self, alg: &[Move], rot: &str) -> u32 {
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
        let idx = (i1 as u64) * (state_space::EDGE2 as u64) + i2 as u64;
        let d_min = self.pt.get(idx) as u32;
        if d_min == 0 {
            return 0;
        }
        for d in d_min..=8 {
            if self.search(i1 * 18, i2 * 18, d, 18) {
                return d;
            }
        }
        // Cross 最优 <= 8 一定成立(理论上界);若失败说明表有问题
        9
    }

    /// 多视角批量统计,顺序与 `rots` 一致。
    pub fn get_stats(&self, alg: &[Move], rots: &[&str]) -> Vec<u32> {
        rots.iter().map(|r| self.solve_one(alg, r)).collect()
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
            let n_i1 = mt[i1 + m] as usize;
            let n_i2 = mt[i2 + m] as usize;
            let idx = (n_i1 as u64) * (state_space::EDGE2 as u64) + n_i2 as u64;
            if self.pt.get(idx) as u32 >= depth {
                continue;
            }
            path.push(m as u8);
            if depth == 1 {
                // h < 1 ⟹ h==0 ⟹ 已解
                out.push(path.clone());
            } else {
                self.enumerate(n_i1 * 18, n_i2 * 18, depth - 1, m as u8, path, out, cap);
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
        let mut buf: Vec<u8> = alg.iter().map(|m| m.index() as u8).collect();
        alg_rotation(&mut buf, rot);
        let mt = self.mt_edge2.as_u32();
        let mut i1 = state_space::EDGE2_A_SOLVED;
        let mut i2 = state_space::EDGE2_B_SOLVED;
        for &m in &buf {
            i1 = mt[i1 * 18 + m as usize] as usize;
            i2 = mt[i2 * 18 + m as usize] as usize;
        }
        let idx = (i1 as u64) * (state_space::EDGE2 as u64) + i2 as u64;
        let d_min = self.pt.get(idx) as u32;
        let mut out = Vec::new();
        if d_min == 0 {
            return (0, out);
        }
        let mut path = Vec::new();
        for d in d_min..=(d_min + extra) {
            self.enumerate(i1 * 18, i2 * 18, d, 18, &mut path, &mut out, cap);
            if out.len() >= cap {
                break;
            }
        }
        (d_min, out)
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
}
