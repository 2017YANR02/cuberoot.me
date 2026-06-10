//! dr_solver: DR(domino reduction)求解器 = Kociemba phase-1 最优。
//!
//! 规范目标(视角 UD 轴):角全定向(co=0)+ 棱全定向(eo=0,FB 轴)+ E 层 4 棱归层,
//! 即把魔方降到 ⟨U,D,L2,R2,F2,B2⟩ 陪集。全空间 2048×2187×495 ≈ 2.2G 放不下,
//! 走分解坐标 + 可采纳启发式 IDA*:
//!   h = max( pt_eo_slice[eo,slice](2048×495 精确),pt_co_slice[co,slice](2187×495 精确) )
//! 两者皆为子目标精确距离 ⇒ 首达即最优;h==0 ⟺ DR 已成。
//!
//! 全自包含:三张微 move 表(eo12 / co8 2187×18 / slice 495×18)+ 两张 ~1M 距离表
//! 全部现场从 MOVE_STATES 构建,零 mmap 依赖,wasm 可直接 new()。
//!
//! 视角:DR 目标对 y 共轭不变(⟨U,D,L2,R2,F2,B2⟩ 的 y 共轭 = 自身)⇒ 4 个 yk
//! 全同目标,每视角只算 yk=0;对面底色同轴(z0 与 z2 同值),全局共 3 个轴目标。

use std::sync::OnceLock;

use crate::block222_solver::{face_map, ROTS6};
use crate::cube_common::{move_state, state_space, valid_moves, Move};
use crate::eoline_solver::{build_mt_eo12, edge_pos_dst};
use crate::roux_s1_solver::{build_pt_product, conj_buf, S1Sol};

/// 角全定向坐标空间(3^7,第 8 角宇称补位)。
pub const CO8: usize = 2187;
/// E 层 4 棱组合坐标空间 C(12,4)。
pub const SLICE: usize = 495;
/// 规范 E 层棱:BL(0), BR(1), FR(2), FL(3);colex rank({0,1,2,3}) = 0。
pub const SLICE_SOLVED: usize = 0;

const FACE_U: u8 = 0;
const FACE_CHARS: [char; 6] = ['U', 'D', 'L', 'R', 'F', 'B'];

/// IDA* 深度上限(phase-1 God's number = 12)。
const MAX_DEPTH: u32 = 14;

fn comb(n: usize, k: usize) -> usize {
    if k > n {
        return 0;
    }
    let mut r = 1usize;
    for i in 0..k {
        r = r * (n - i) / (i + 1);
    }
    r
}

fn slice_rank(pos: &[usize; 4]) -> usize {
    comb(pos[0], 1) + comb(pos[1], 2) + comb(pos[2], 3) + comb(pos[3], 4)
}

fn slice_unrank(mut r: usize) -> [usize; 4] {
    let mut pos = [0usize; 4];
    for k in (1..=4).rev() {
        let mut p = k - 1;
        while comb(p + 1, k) <= r {
            p += 1;
        }
        pos[k - 1] = p;
        r -= comb(p, k);
    }
    pos
}

/// CO8 move 表(2187×18):index = co[0..6] 基 3 数(按位置),co[7] 宇称补位。
pub(crate) fn build_mt_co8() -> Vec<u32> {
    let mut pco: [([u8; 8], [u8; 8]); 18] = [([0; 8], [0; 8]); 18];
    for m in Move::ALL {
        pco[m.index()] = move_state(m).cp_co();
    }
    let mut t = vec![0u32; CO8 * 18];
    for idx in 0..CO8 {
        let mut co = [0u8; 8];
        let mut x = idx;
        let mut s = 0usize;
        for v in co.iter_mut().take(7) {
            *v = (x % 3) as u8;
            x /= 3;
            s += *v as usize;
        }
        co[7] = ((3 - s % 3) % 3) as u8;
        for m in 0..18 {
            let (mcp, mco) = pco[m];
            let mut nidx = 0usize;
            let mut mul = 1usize;
            for p in 0..7 {
                nidx += ((co[mcp[p] as usize] + mco[p]) % 3) as usize * mul;
                mul *= 3;
            }
            t[idx * 18 + m] = nidx as u32;
        }
    }
    t
}

/// slice move 表(495×18):E 层 4 棱位置组合联动。
pub(crate) fn build_mt_slice() -> Vec<u32> {
    let dst = edge_pos_dst();
    let mut t = vec![0u32; SLICE * 18];
    for r in 0..SLICE {
        let pos = slice_unrank(r);
        for (m, dm) in dst.iter().enumerate() {
            let mut np = [
                dm[pos[0]] as usize,
                dm[pos[1]] as usize,
                dm[pos[2]] as usize,
                dm[pos[3]] as usize,
            ];
            np.sort_unstable();
            t[r * 18 + m] = slice_rank(&np) as u32;
        }
    }
    t
}

/// (rot,yk) 的 DR 轴标签(U/D 面原像对,如 "UD"/"LR"/"FB",低位面在前)。
pub fn dr_axis_label(rot_idx: usize, yk: usize) -> &'static str {
    static V: OnceLock<[[String; 4]; 6]> = OnceLock::new();
    let t = V.get_or_init(|| {
        std::array::from_fn(|ri| {
            std::array::from_fn(|k| {
                let map = face_map(ROTS6[ri], k);
                let u = (0..6).find(|&t| map[t] == FACE_U).unwrap();
                let pair = [u.min(u ^ 1), u.max(u ^ 1)];
                format!("{}{}", FACE_CHARS[pair[0]], FACE_CHARS[pair[1]])
            })
        })
    });
    &t[rot_idx][yk]
}

pub struct DrSolver {
    mt_eo: Vec<u32>,
    mt_co: Vec<u32>,
    mt_slice: Vec<u32>,
    /// (eo, slice) 精确距离,idx = eo*495 + slice。
    pt_eo_slice: Vec<u8>,
    /// (co, slice) 精确距离,idx = co*495 + slice。
    pt_co_slice: Vec<u8>,
}

impl Default for DrSolver {
    fn default() -> Self {
        Self::new()
    }
}

impl DrSolver {
    /// 全自包含构造(native/wasm 同路径,两张 ~1M BFS 亚秒级)。
    pub fn new() -> Self {
        let mt_eo = build_mt_eo12();
        let mt_co = build_mt_co8();
        let mt_slice = build_mt_slice();
        let pt_eo_slice = build_pt_product(
            &mt_eo,
            &mt_slice,
            SLICE,
            state_space::EO12 * SLICE,
            SLICE_SOLVED,
        );
        let pt_co_slice =
            build_pt_product(&mt_co, &mt_slice, SLICE, CO8 * SLICE, SLICE_SOLVED);
        DrSolver { mt_eo, mt_co, mt_slice, pt_eo_slice, pt_co_slice }
    }

    /// 两张剪枝表最大深度(信息用)。
    pub fn max_depths(&self) -> (u8, u8) {
        let a = self.pt_eo_slice.iter().copied().filter(|&v| v != 255).max().unwrap_or(0);
        let b = self.pt_co_slice.iter().copied().filter(|&v| v != 255).max().unwrap_or(0);
        (a, b)
    }

    /// 从 SOLVED 走 buf,返回 (eo, co, slice)。
    fn walk(&self, buf: &[u8]) -> (usize, usize, usize) {
        let mut eo = 0usize;
        let mut co = 0usize;
        let mut sl = SLICE_SOLVED;
        for &m in buf {
            let m = m as usize;
            eo = self.mt_eo[eo * 18 + m] as usize;
            co = self.mt_co[co * 18 + m] as usize;
            sl = self.mt_slice[sl * 18 + m] as usize;
        }
        (eo, co, sl)
    }

    /// 可采纳下界;== 0 ⟺ DR 已成。
    #[inline]
    fn h(&self, eo: usize, co: usize, sl: usize) -> u32 {
        let a = self.pt_eo_slice[eo * SLICE + sl];
        let b = self.pt_co_slice[co * SLICE + sl];
        a.max(b) as u32
    }

    /// IDA* 一层。
    fn search(&self, eo: usize, co: usize, sl: usize, depth: u32, prev: u8) -> bool {
        let (vmoves, vcnt) = valid_moves();
        let count = vcnt[prev as usize] as usize;
        let row = &vmoves[prev as usize];
        for k in 0..count {
            let m = row[k] as usize;
            let neo = self.mt_eo[eo * 18 + m] as usize;
            let nsl = self.mt_slice[sl * 18 + m] as usize;
            if self.pt_eo_slice[neo * SLICE + nsl] as u32 >= depth {
                continue;
            }
            let nco = self.mt_co[co * 18 + m] as usize;
            if self.pt_co_slice[nco * SLICE + nsl] as u32 >= depth {
                continue;
            }
            if depth == 1 || self.search(neo, nco, nsl, depth - 1, m as u8) {
                return true;
            }
        }
        false
    }

    /// 单 (视角, yk) 最优步数(IDA*,首达即最优)。
    pub fn solve_one(&self, alg: &[Move], rot: &str, yk: usize) -> u32 {
        let (eo, co, sl) = self.walk(&conj_buf(alg, rot, yk));
        let h = self.h(eo, co, sl);
        if h == 0 {
            return 0;
        }
        for d in h..=MAX_DEPTH {
            if self.search(eo, co, sl, d, 18) {
                return d;
            }
        }
        99
    }

    /// 单视角:DR 对 y 不变,只算 yk=0。
    pub fn solve_face(&self, alg: &[Move], rot: &str) -> u32 {
        self.solve_one(alg, rot, 0)
    }

    /// 多视角批量统计,顺序与 `rots` 一致。
    pub fn get_stats(&self, alg: &[Move], rots: &[&str]) -> Vec<u32> {
        rots.iter().map(|r| self.solve_face(alg, r)).collect()
    }

    /// 枚举恰好 depth 步的解。
    #[allow(clippy::too_many_arguments)]
    fn enum_paths(
        &self,
        eo: usize,
        co: usize,
        sl: usize,
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
        for k in 0..count {
            if out.len() >= cap {
                return;
            }
            let m = row[k] as usize;
            let neo = self.mt_eo[eo * 18 + m] as usize;
            let nsl = self.mt_slice[sl * 18 + m] as usize;
            if self.pt_eo_slice[neo * SLICE + nsl] as u32 >= depth {
                continue;
            }
            let nco = self.mt_co[co * 18 + m] as usize;
            if self.pt_co_slice[nco * SLICE + nsl] as u32 >= depth {
                continue;
            }
            path.push(m as u8);
            if depth == 1 {
                out.push(path.clone());
            } else {
                self.enum_paths(neo, nco, nsl, depth - 1, m as u8, path, out, cap);
            }
            path.pop();
        }
    }

    /// 单视角多解(yk=0,DR 对 y 不变):预算 = 最优 + extra,cap 截断。
    pub fn enumerate_face(
        &self,
        alg: &[Move],
        rot: &str,
        extra: u32,
        cap: usize,
    ) -> (u32, Vec<S1Sol>) {
        let (eo, co, sl) = self.walk(&conj_buf(alg, rot, 0));
        let best = {
            let h = self.h(eo, co, sl);
            if h == 0 {
                0
            } else {
                let mut v = 99;
                for d in h..=MAX_DEPTH {
                    if self.search(eo, co, sl, d, 18) {
                        v = d;
                        break;
                    }
                }
                v
            }
        };
        let mut sols: Vec<S1Sol> = Vec::new();
        if best == 0 {
            return (0, sols);
        }
        let mut out = Vec::new();
        let mut path = Vec::new();
        for d in best..=(best + extra) {
            self.enum_paths(eo, co, sl, d, 18, &mut path, &mut out, cap);
            if out.len() >= cap {
                break;
            }
        }
        sols.extend(out.into_iter().map(|moves| S1Sol {
            yk: 0,
            len: moves.len() as u32,
            moves,
        }));
        sols.sort_by_key(|s| s.len);
        sols.truncate(cap);
        (best, sols)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::cube_common::{rot_map, string_to_alg, State};
    use crate::eoline_solver::EOLineSolver;
    use crate::roux_s1_solver::tests::pseudo_scramble;

    /// State 级 DR 判定(独立于坐标编码):co 全 0 + eo 全 0 + E 层棱(0..3)归层。
    fn state_dr_done(st: &State) -> bool {
        let (_, co) = st.cp_co();
        let (ep, eo) = st.ep_eo();
        co.iter().all(|&v| v == 0)
            && eo.iter().all(|&v| v == 0)
            && (0..4).all(|i| ep[i] < 4)
    }

    #[test]
    fn basics_subgroup_and_labels() {
        let s = DrSolver::new();

        // 可达性:两张剪枝表全可达
        assert!(s.pt_eo_slice.iter().all(|&v| v != 255));
        assert!(s.pt_co_slice.iter().all(|&v| v != 255));
        let (a, b) = s.max_depths();
        assert!((6..=11).contains(&a), "suspicious eo_slice depth {}", a);
        assert!((6..=11).contains(&b), "suspicious co_slice depth {}", b);

        // 子群测试:⟨U,D,L2,R2,F2,B2⟩ 随机序列 → dist 0
        let dr_moves = [0usize, 1, 2, 3, 4, 5, 7, 10, 13, 16];
        let mut x = 12345u64;
        for _ in 0..30 {
            let mut alg = Vec::new();
            for _ in 0..15 {
                x = x.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
                alg.push(Move::from_index(dr_moves[(x >> 33) as usize % dr_moves.len()]));
            }
            assert_eq!(s.solve_one(&alg, "", 0), 0, "DR-subgroup alg not dist 0");
        }

        // 单 move:四分之一 L/R/F/B → 1;U/D/双层 → 0
        let one = |scr: &str| s.solve_one(&string_to_alg(scr), "", 0);
        assert_eq!(one("U"), 0);
        assert_eq!(one("D'"), 0);
        assert_eq!(one("L2"), 0);
        assert_eq!(one("F2"), 0);
        assert_eq!(one("L"), 1);
        assert_eq!(one("R'"), 1);
        assert_eq!(one("F"), 1);
        assert_eq!(one("B"), 1);

        // y 不变性:4 个 yk 全同
        for seed in 0..10u64 {
            let alg = pseudo_scramble(seed, 18);
            for rot in ROTS6 {
                let d0 = s.solve_one(&alg, rot, 0);
                for k in 1..4 {
                    assert_eq!(d0, s.solve_one(&alg, rot, k), "DR y-invariance broken");
                }
            }
        }

        // 对面同轴:z0 == z2,z3 == z1,x3 == x1
        for seed in 10..20u64 {
            let alg = pseudo_scramble(seed, 20);
            let v = s.get_stats(&alg, &ROTS6);
            assert_eq!(v[0], v[1], "z0 != z2");
            assert_eq!(v[2], v[3], "z3 != z1");
            assert_eq!(v[4], v[5], "x3 != x1");
        }

        // 轴标签:3 种各 8 次;规范 (0,0) = UD
        let mut axes = std::collections::HashMap::new();
        for ri in 0..6 {
            for k in 0..4 {
                *axes.entry(dr_axis_label(ri, k)).or_insert(0) += 1;
            }
        }
        assert_eq!(axes.len(), 3);
        assert!(axes.values().all(|&c: &i32| c == 8));
        assert_eq!(dr_axis_label(0, 0), "UD");

        // 一致性:dr ≥ eo(同帧 FB 轴,跨模块对照 EOLineSolver)
        let eos = EOLineSolver::new();
        for seed in 20..35u64 {
            let alg = pseudo_scramble(seed, 20);
            for rot in ROTS6 {
                assert!(
                    s.solve_one(&alg, rot, 0) >= eos.solve_one_eo(&alg, rot, 0),
                    "dr < eo seed={}",
                    seed
                );
            }
        }
    }

    /// 纯 State 级 IDDFS(独立于 mt/pt):短打乱最优性。
    #[test]
    fn optimality_spot_check_iddfs() {
        let s = DrSolver::new();

        fn dfs(st: &State, depth: u32, prev: usize) -> bool {
            if depth == 0 {
                return state_dr_done(st);
            }
            let (vmoves, vcnt) = valid_moves();
            let row = &vmoves[prev];
            for k in 0..vcnt[prev] as usize {
                let m = row[k] as usize;
                let ns = st.applied(Move::from_index(m));
                if dfs(&ns, depth - 1, m) {
                    return true;
                }
            }
            false
        }

        for seed in 900..910u64 {
            let alg = pseudo_scramble(seed, 5);
            let got = s.solve_one(&alg, "", 0);
            assert!(got <= 5, "5-move scramble dist > 5");
            let mut st = State::SOLVED;
            for &m in &alg {
                st.apply(m);
            }
            let mut want = 99;
            for d in 0..=5u32 {
                if dfs(&st, d, 18) {
                    want = d;
                    break;
                }
            }
            assert_eq!(got, want, "seed={}", seed);
        }
    }

    #[test]
    fn enumerate_face_solutions_are_valid() {
        let s = DrSolver::new();
        let rm = rot_map();

        for seed in 1000..1006u64 {
            let alg = pseudo_scramble(seed, 20);
            for (ri, rot) in ROTS6.iter().enumerate() {
                let stats_min = s.solve_face(&alg, rot);
                let (best, sols) = s.enumerate_face(&alg, rot, 0, 8);
                assert_eq!(best, stats_min, "best mismatch seed={} rot={}", seed, ri);
                if best == 0 {
                    assert!(sols.is_empty());
                    continue;
                }
                assert!(!sols.is_empty());
                assert!(sols.iter().all(|x| x.len == best));
                for sol in &sols {
                    let mut buf = conj_buf(&alg, rot, 0);
                    buf.extend_from_slice(&sol.moves);
                    let (eo, co, sl) = s.walk(&buf);
                    assert_eq!(s.h(eo, co, sl), 0, "sol doesn't reach DR");
                }
            }
        }

        // State 级二次验证:rot="" yk=0,解直接作用原帧
        let alg = string_to_alg("D B U B2 R2 U' L2 D2 R2 D' L D2 B D' L2 F' D L' D'");
        let (_best, sols) = s.enumerate_face(&alg, "", 0, 5);
        for sol in &sols {
            let mut st = State::SOLVED;
            for &m in &alg {
                st.apply(m);
            }
            for &m in &sol.moves {
                st.apply(Move::from_index(rm[0][m as usize] as usize));
            }
            assert!(state_dr_done(&st), "DR not physically reached");
        }
    }
}
