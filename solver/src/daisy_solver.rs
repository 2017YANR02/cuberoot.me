//! daisy_solver:三阶小花(Daisy)全空间最优求解器。
//!
//! 规范目标:四条 D 色棱位于 U 面四个棱位(UB/UR/UF/UL),且 D 色贴纸朝 U；
//! 四条棱的环上排列不限。坐标直接复用 edge4 的 190,080 态,以 24 个目标做多源 BFS，
//! 因而距离表给出严格 HTM 最优步数与完整状态空间分布。

use std::sync::{Arc, OnceLock};

use crate::block222_solver::{face_map, ROTS6};
use crate::cube_common::{alg_rotation, array_to_index, state_space, valid_moves, Move};
use crate::move_tables::MoveTable;

const FACE_U: u8 = 0;
const FACE_D: u8 = 1;
const FACE_CHARS: [char; 6] = ['U', 'D', 'L', 'R', 'F', 'B'];
const U_EDGE_POSITIONS: [i32; 4] = [4, 5, 6, 7];

#[derive(Clone, Debug)]
pub struct DaisySol {
    pub len: u32,
    pub moves: Vec<u8>,
}

/// 指定视角实际求的「花瓣色→中心色」标签，如 D→U。
pub fn daisy_label(rot_idx: usize) -> &'static str {
    static LABELS: OnceLock<[String; 6]> = OnceLock::new();
    &LABELS.get_or_init(|| {
        std::array::from_fn(|ri| {
            let map = face_map(ROTS6[ri], 0);
            let petal = (0..6).find(|&f| map[f] == FACE_D).unwrap();
            let center = (0..6).find(|&f| map[f] == FACE_U).unwrap();
            format!("{}→{}", FACE_CHARS[petal], FACE_CHARS[center])
        })
    })[rot_idx.min(5)]
}

pub struct DaisySolver {
    mt_edge4: Arc<MoveTable>,
    /// edge4 全空间精确距离；24 个 Daisy 排列都是深度 0。
    pt: Vec<u8>,
}

impl DaisySolver {
    #[cfg(not(target_arch = "wasm32"))]
    pub fn new() -> Self {
        Self::from_table(crate::move_tables::instance().ensure_edge4())
    }

    pub fn from_table(mt_edge4: Arc<MoveTable>) -> Self {
        assert_eq!(mt_edge4.state_count as usize, state_space::CROSS);
        assert_eq!(mt_edge4.stride, 24);

        let mut pt = vec![u8::MAX; state_space::CROSS];
        let mut frontier = Vec::with_capacity(24);
        for &a in &U_EDGE_POSITIONS {
            for &b in &U_EDGE_POSITIONS {
                if b == a {
                    continue;
                }
                for &c in &U_EDGE_POSITIONS {
                    if c == a || c == b {
                        continue;
                    }
                    for &d in &U_EDGE_POSITIONS {
                        if d == a || d == b || d == c {
                            continue;
                        }
                        let idx = array_to_index(&[2 * a, 2 * b, 2 * c, 2 * d], 4, 2, 12) as usize;
                        if pt[idx] == u8::MAX {
                            pt[idx] = 0;
                            frontier.push(idx as u32);
                        }
                    }
                }
            }
        }
        assert_eq!(frontier.len(), 24, "Daisy 应有 4! = 24 个零层状态");

        let mt = mt_edge4.as_u32();
        let mut depth = 0u8;
        while !frontier.is_empty() {
            let mut next = Vec::new();
            for &idx in &frontier {
                let base = idx as usize * 24;
                for m in 0..18 {
                    let ni = (mt[base + m] / 24) as usize;
                    if pt[ni] == u8::MAX {
                        pt[ni] = depth + 1;
                        next.push(ni as u32);
                    }
                }
            }
            depth += 1;
            frontier = next;
        }
        assert!(pt.iter().all(|&v| v != u8::MAX), "Daisy 距离表未覆盖全空间");

        Self { mt_edge4, pt }
    }

    pub fn max_depth(&self) -> u8 {
        self.pt.iter().copied().max().unwrap_or(0)
    }

    pub fn histogram(&self) -> Vec<u64> {
        let mut out = vec![0u64; self.max_depth() as usize + 1];
        for &d in &self.pt {
            out[d as usize] += 1;
        }
        out
    }

    fn walk(&self, alg: &[Move], rot: &str) -> usize {
        let mut buf: Vec<u8> = alg.iter().map(|m| m.index() as u8).collect();
        alg_rotation(&mut buf, rot);
        let mt = self.mt_edge4.as_u32();
        let mut idx = state_space::CROSS_SOLVED;
        for m in buf {
            idx = (mt[idx * 24 + m as usize] / 24) as usize;
        }
        idx
    }

    pub fn solve_one(&self, alg: &[Move], rot: &str) -> u32 {
        self.pt[self.walk(alg, rot)] as u32
    }

    pub fn get_stats(&self, alg: &[Move], rots: &[&str]) -> Vec<u32> {
        rots.iter().map(|rot| self.solve_one(alg, rot)).collect()
    }

    #[allow(clippy::too_many_arguments)]
    fn enumerate_at(
        &self,
        idx: usize,
        depth: u32,
        prev: u8,
        path: &mut Vec<u8>,
        out: &mut Vec<DaisySol>,
        cap: usize,
    ) {
        if out.len() >= cap || depth == 0 {
            return;
        }
        let (vmoves, vcnt) = valid_moves();
        let mt = self.mt_edge4.as_u32();
        let row = &vmoves[prev as usize];
        for k in 0..vcnt[prev as usize] as usize {
            if out.len() >= cap {
                return;
            }
            let m = row[k] as usize;
            let ni = (mt[idx * 24 + m] / 24) as usize;
            let h = self.pt[ni] as u32;
            if h >= depth {
                continue;
            }
            path.push(m as u8);
            if depth == 1 {
                out.push(DaisySol {
                    len: path.len() as u32,
                    moves: path.clone(),
                });
            } else if h > 0 {
                self.enumerate_at(ni, depth - 1, m as u8, path, out, cap);
            }
            path.pop();
        }
    }

    /// 单视角枚举最优到 opt+extra 的解；Daisy 对 y 转不变，无重复 y 分支。
    pub fn enumerate_face(
        &self,
        alg: &[Move],
        rot: &str,
        extra: u32,
        cap: usize,
    ) -> (u32, Vec<DaisySol>) {
        let idx = self.walk(alg, rot);
        let best = self.pt[idx] as u32;
        if best == 0 || cap == 0 {
            return (best, Vec::new());
        }

        let mut out = Vec::new();
        let mut path = Vec::new();
        for depth in best..=best.saturating_add(extra) {
            self.enumerate_at(idx, depth, 18, &mut path, &mut out, cap);
            if out.len() >= cap {
                break;
            }
        }
        out.sort_by_key(|s| s.len);
        out.truncate(cap);
        (best, out)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::cube_common::{string_to_alg, State};
    use crate::roux_s1_solver::tests::pseudo_scramble;

    fn state_daisy_done(st: &State) -> bool {
        let (ep, eo) = st.ep_eo();
        (4..8).all(|p| (8..12).contains(&(ep[p] as usize)) && eo[p] == 0)
    }

    fn dfs_state(st: &State, depth: u32, prev: usize) -> bool {
        if depth == 0 {
            return state_daisy_done(st);
        }
        let (vmoves, vcnt) = valid_moves();
        let row = &vmoves[prev];
        for k in 0..vcnt[prev] as usize {
            let m = row[k] as usize;
            if dfs_state(&st.applied(Move::from_index(m)), depth - 1, m) {
                return true;
            }
        }
        false
    }

    #[test]
    fn full_space_distribution_and_known_states() {
        let s = DaisySolver::from_table(crate::mt_gen::get("mt_edge4"));
        assert_eq!(s.histogram().iter().sum::<u64>(), state_space::CROSS as u64);
        assert_eq!(s.histogram()[0], 24);
        assert_eq!(s.solve_one(&string_to_alg("F2 R2 B2 L2"), ""), 0);
        assert_eq!(s.solve_one(&string_to_alg("F2 R2 B2 L2 U"), ""), 0);
        assert_eq!(s.solve_one(&[], ""), 4);
        assert_eq!(
            s.histogram(),
            [24, 288, 2640, 16080, 56184, 89256, 25128, 480]
        );
        assert_eq!(
            (0..6).map(daisy_label).collect::<Vec<_>>(),
            ["D→U", "U→D", "L→R", "R→L", "F→B", "B→F"]
        );
    }

    /// 完整 State + 穷举 IDDFS，不复用 edge4 坐标/距离表，独立核对短状态最优性。
    #[test]
    fn optimality_matches_independent_state_iddfs() {
        let s = DaisySolver::from_table(crate::mt_gen::get("mt_edge4"));
        let base = string_to_alg("F2 R2 B2 L2");
        for seed in 40..52u64 {
            let mut alg = base.clone();
            alg.extend(pseudo_scramble(seed, 4));
            let mut st = State::SOLVED;
            for &m in &alg {
                st.apply(m);
            }
            let got = s.solve_one(&alg, "");
            let want = (0..=got).find(|&d| dfs_state(&st, d, 18)).unwrap();
            assert_eq!(got, want, "seed={seed}");
        }
    }

    #[test]
    fn enumerated_solutions_finish_the_physical_daisy() {
        let s = DaisySolver::from_table(crate::mt_gen::get("mt_edge4"));
        for seed in 80..90u64 {
            let alg = pseudo_scramble(seed, 18);
            let (best, sols) = s.enumerate_face(&alg, "", 1, 24);
            assert_eq!(best, s.solve_one(&alg, ""));
            assert!(!sols.is_empty());
            assert!(sols.iter().any(|sol| sol.len == best));
            for sol in sols {
                let mut st = State::SOLVED;
                for &m in &alg {
                    st.apply(m);
                }
                for &m in &sol.moves {
                    st.apply(Move::from_index(m as usize));
                }
                assert!(
                    state_daisy_done(&st),
                    "seed={seed}, solution={:?}",
                    sol.moves
                );
            }
        }
    }
}
