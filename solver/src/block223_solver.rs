//! block223_solver: Petrus 2x2x3 块求解器(2 角 + 5 棱)。
//!
//! 规范块 = roux_s1 规范 1x2x3(DBL+DLF 角,BL+FL+DL 棱)再加 DB(8)+DF(10) 棱
//! ——即排除 U、R 两层的 2x2x3。全空间 504 × P(12,5)·2^5 ≈ 1.53G 态,放不下全表,
//! 走分解坐标 + 可采纳启发式 IDA*:
//!   h = max( pt_s1[c2,e3](1x2x3 精确距离,直接复用 RouxS1Solver 的 5.3M 全表),
//!            pt_ce2[c2,e2](2 角 + DB,DF 的精确距离,504×528 现场 BFS) )
//! 两者都是子目标的精确距离 ⇒ 可采纳 ⇒ 首达即最优;h == 0 ⟺ 块已成。
//!
//! 视角:24 个 (rot,yk) 中每块出现 2 次(2x2x3 由排除面对 {U,R} 确定,共 12 个);
//! 每底色 4 个块,标签 = 块核心棱名(D、L 原像组成的棱,如 "DL")。

use std::sync::{Arc, OnceLock};

use crate::block222_solver::{face_map, ROTS6};
use crate::cube_common::{array_to_index, state_space, valid_moves, Move};
use crate::move_tables::MoveTable;
use crate::roux_s1_solver::{
    build_pt_product, conj_buf, RouxS1Solver, S1Sol, EDGE_FACE_MASK, EDGE_NAMES,
};

/// 规范块在 1x2x3 之外的 2 条棱(DB, DF)。
pub const CANON_EDGES_DE: [usize; 2] = [8, 10];

const FACE_D: u8 = 1;
const FACE_L: u8 = 2;

/// IDA* 深度上限(2x2x3 God's number 远低于此,保险阈)。
const MAX_DEPTH: u32 = 20;

/// (rot,yk) 求的物理 2x2x3 块标签 = D、L 原像两面构成的棱名(如 "DL");
/// 12 个块,每个在 24 视角中出现恰 2 次。
pub fn block223_label(rot_idx: usize, yk: usize) -> &'static str {
    static V: OnceLock<[[&'static str; 4]; 6]> = OnceLock::new();
    V.get_or_init(|| {
        let mut tbl = [[""; 4]; 6];
        for (ri, rot) in ROTS6.iter().enumerate() {
            for k in 0..4 {
                let map = face_map(rot, k);
                let bottom = (0..6).find(|&t| map[t] == FACE_D).unwrap();
                let side = (0..6).find(|&t| map[t] == FACE_L).unwrap();
                let mask = (1u8 << bottom) | (1 << side);
                let e = EDGE_FACE_MASK.iter().position(|&m| m == mask).unwrap();
                tbl[ri][k] = EDGE_NAMES[e];
            }
        }
        tbl
    })[rot_idx][yk]
}

pub struct Block223Solver {
    /// 复用其 mt_corn2/mt_edge3/pt(1x2x3 精确全表)与 solved 索引。
    s1: RouxS1Solver,
    mt_edge2: Arc<MoveTable>,
    /// 2 角 + DB,DF 的精确距离表,idx = c2_idx * EDGE2 + e2_idx。
    pt_ce2: Vec<u8>,
    e2_solved: usize,
}

impl Block223Solver {
    /// native:走 manager。
    #[cfg(not(target_arch = "wasm32"))]
    pub fn new() -> Self {
        let mtm = crate::move_tables::instance();
        Self::from_s1(RouxS1Solver::new(), mtm.ensure_edge2())
    }

    /// 复用已构建的 RouxS1Solver(共享其 5.3M 距离表)+ mt_edge2。
    /// pt_ce2 现场 BFS(266,112 态,毫秒级)。
    pub fn from_s1(s1: RouxS1Solver, mt_edge2: Arc<MoveTable>) -> Self {
        let edges: Vec<i32> = CANON_EDGES_DE.iter().map(|&e| (2 * e) as i32).collect();
        let e2_solved = array_to_index(&edges, 2, 2, 12) as usize;
        let pt_ce2 = build_pt_product(
            s1.mt_corn2.as_u32(),
            mt_edge2.as_u32(),
            state_space::EDGE2,
            state_space::CORNER2 * state_space::EDGE2,
            s1.c2_solved * state_space::EDGE2 + e2_solved,
        );
        Block223Solver { s1, mt_edge2, pt_ce2, e2_solved }
    }

    /// pt_ce2 最大深度(信息用)。
    pub fn max_depth_ce2(&self) -> u8 {
        self.pt_ce2.iter().copied().filter(|&v| v != 255).max().unwrap_or(0)
    }

    /// 从 SOLVED 走 buf,返回 (c2, e3, e2)。
    fn walk(&self, buf: &[u8]) -> (usize, usize, usize) {
        let (c2, e3) = self.s1.walk(buf);
        let mt_e2 = self.mt_edge2.as_u32();
        let mut e2 = self.e2_solved;
        for &m in buf {
            e2 = mt_e2[e2 * 18 + m as usize] as usize;
        }
        (c2, e3, e2)
    }

    /// 可采纳下界(两子目标精确距离的 max);== 0 ⟺ 2x2x3 已成。
    #[inline]
    fn h(&self, c2: usize, e3: usize, e2: usize) -> u32 {
        let a = self.s1.pt[c2 * state_space::EDGE3 + e3];
        let b = self.pt_ce2[c2 * state_space::EDGE2 + e2];
        a.max(b) as u32
    }

    /// IDA* 一层:任一子目标 prune ≥ depth 即剪;depth==1 全过 ⇒ 两子目标全 0 ⇒ 块成。
    fn search(&self, c2: usize, e3: usize, e2: usize, depth: u32, prev: u8) -> bool {
        let (vmoves, vcnt) = valid_moves();
        let count = vcnt[prev as usize] as usize;
        let row = &vmoves[prev as usize];
        let mt_c2 = self.s1.mt_corn2.as_u32();
        let mt_e3 = self.s1.mt_edge3.as_u32();
        let mt_e2 = self.mt_edge2.as_u32();
        for k in 0..count {
            let m = row[k] as usize;
            let nc2 = mt_c2[c2 * 18 + m] as usize;
            let ne3 = mt_e3[e3 * 18 + m] as usize;
            if self.s1.pt[nc2 * state_space::EDGE3 + ne3] as u32 >= depth {
                continue;
            }
            let ne2 = mt_e2[e2 * 18 + m] as usize;
            if self.pt_ce2[nc2 * state_space::EDGE2 + ne2] as u32 >= depth {
                continue;
            }
            if depth == 1 || self.search(nc2, ne3, ne2, depth - 1, m as u8) {
                return true;
            }
        }
        false
    }

    /// 单 (视角, yk) 最优步数(IDA*,首达即最优)。
    pub fn solve_one(&self, alg: &[Move], rot: &str, yk: usize) -> u32 {
        let (c2, e3, e2) = self.walk(&conj_buf(alg, rot, yk));
        let h = self.h(c2, e3, e2);
        if h == 0 {
            return 0;
        }
        for d in h..=MAX_DEPTH {
            if self.search(c2, e3, e2, d, 18) {
                return d;
            }
        }
        99
    }

    /// 单视角(4 yk 最小):任务按根下界排序 + bound 传递,避免重复深搜。
    pub fn solve_face(&self, alg: &[Move], rot: &str) -> u32 {
        let mut tasks: Vec<(usize, (usize, usize, usize), u32)> = (0..4)
            .map(|k| {
                let (c2, e3, e2) = self.walk(&conj_buf(alg, rot, k));
                (k, (c2, e3, e2), self.h(c2, e3, e2))
            })
            .collect();
        tasks.sort_by_key(|t| t.2);
        if tasks[0].2 == 0 {
            return 0;
        }
        let mut min_v = MAX_DEPTH + 1;
        for &(_, (c2, e3, e2), h) in &tasks {
            if h >= min_v {
                continue;
            }
            for d in h..min_v {
                if self.search(c2, e3, e2, d, 18) {
                    min_v = d;
                    break;
                }
            }
        }
        min_v
    }

    /// 多视角批量统计,顺序与 `rots` 一致。
    pub fn get_stats(&self, alg: &[Move], rots: &[&str]) -> Vec<u32> {
        rots.iter().map(|r| self.solve_face(alg, r)).collect()
    }

    /// 枚举恰好 depth 步的解(可采纳剪枝;叶 = 两子目标全 0,即块成)。
    #[allow(clippy::too_many_arguments)]
    fn enum_paths(
        &self,
        c2: usize,
        e3: usize,
        e2: usize,
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
        let mt_c2 = self.s1.mt_corn2.as_u32();
        let mt_e3 = self.s1.mt_edge3.as_u32();
        let mt_e2 = self.mt_edge2.as_u32();
        for k in 0..count {
            if out.len() >= cap {
                return;
            }
            let m = row[k] as usize;
            let nc2 = mt_c2[c2 * 18 + m] as usize;
            let ne3 = mt_e3[e3 * 18 + m] as usize;
            let h1 = self.s1.pt[nc2 * state_space::EDGE3 + ne3] as u32;
            if h1 >= depth {
                continue;
            }
            let ne2 = mt_e2[e2 * 18 + m] as usize;
            let h2 = self.pt_ce2[nc2 * state_space::EDGE2 + ne2] as u32;
            if h2 >= depth {
                continue;
            }
            path.push(m as u8);
            if depth == 1 {
                out.push(path.clone());
            } else if h1 > 0 || h2 > 0 {
                // 两表皆 0 ⟺ 该块已解;depth>1 还要走步 = 更短解 + 无效尾动,跳过。
                self.enum_paths(nc2, ne3, ne2, depth - 1, m as u8, path, out, cap);
            }
            path.pop();
        }
    }

    /// 单视角多解:4 yk 各枚举(预算 = 全局最优 + extra),合并按 (len, yk) 排序,
    /// cap 截断。复用 S1Sol 形状。
    pub fn enumerate_face(
        &self,
        alg: &[Move],
        rot: &str,
        extra: u32,
        cap: usize,
    ) -> (u32, Vec<S1Sol>) {
        let mut ends = [(0usize, 0usize, 0usize); 4];
        let mut dists = [0u32; 4];
        for k in 0..4 {
            ends[k] = self.walk(&conj_buf(alg, rot, k));
            dists[k] = {
                let (c2, e3, e2) = ends[k];
                let h = self.h(c2, e3, e2);
                if h == 0 {
                    0
                } else {
                    let mut v = 99;
                    for d in h..=MAX_DEPTH {
                        if self.search(c2, e3, e2, d, 18) {
                            v = d;
                            break;
                        }
                    }
                    v
                }
            };
        }
        let best = dists.iter().copied().min().unwrap();
        let mut sols: Vec<S1Sol> = Vec::new();
        if best == 0 {
            return (0, sols);
        }
        let budget = best + extra;
        for k in 0..4 {
            if dists[k] > budget {
                continue;
            }
            let (c2, e3, e2) = ends[k];
            let mut out = Vec::new();
            let mut path = Vec::new();
            for d in dists[k]..=budget {
                self.enum_paths(c2, e3, e2, d, 18, &mut path, &mut out, cap);
                if out.len() >= cap {
                    break;
                }
            }
            sols.extend(out.into_iter().map(|moves| S1Sol {
                yk: k,
                len: moves.len() as u32,
                moves,
            }));
        }
        sols.sort_by_key(|s| (s.len, s.yk));
        sols.truncate(cap);
        (best, sols)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::cube_common::{rot_map, string_to_alg, test_env_lock, State};
    use crate::roux_s1_solver::tests::{
        corner_trans, edge_trans, pseudo_scramble, s1_block_pieces,
    };
    use crate::roux_s1_solver::s1_block_label;
    use std::path::PathBuf;

    fn setup_dir(name: &str) -> PathBuf {
        let dir = PathBuf::from("target").join("test-tables").join(name);
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        std::env::set_var("CUBE_TABLE_DIR", &dir);
        dir
    }

    /// 标签(棱名,如 "DL")→ 2x2x3 件集合:1x2x3(任一朝向)+ 底面两条非块棱。
    /// 用 s1 标签 (rot,yk) 对应的 (bottom, side) 推:2 角 = s1 的;5 棱 = s1 3 棱 +
    /// 底面上与 side 轴垂直的 2 棱(即含 bottom、不含 side/side^1 的棱)。
    fn block223_pieces(rot_idx: usize, yk: usize) -> ([usize; 2], [usize; 5]) {
        use crate::block222_solver::face_map;
        let map = face_map(ROTS6[rot_idx], yk);
        let bottom = (0..6).find(|&t| map[t] == FACE_D).unwrap() as u8;
        let side = (0..6).find(|&t| map[t] == FACE_L).unwrap() as u8;
        let (corners, e3) = s1_block_pieces(s1_block_label(rot_idx, yk));
        let mut edges = [0usize; 5];
        edges[..3].copy_from_slice(&e3);
        let mut n = 3;
        for (e, &m) in EDGE_FACE_MASK.iter().enumerate() {
            if m & (1 << bottom) != 0 && m & ((1u8 << side) | (1 << (side ^ 1))) == 0 {
                edges[n] = e;
                n += 1;
            }
        }
        assert_eq!(n, 5);
        (corners, edges)
    }

    #[test]
    fn basics_consistency_and_labels() {
        let _lock = test_env_lock().lock().unwrap_or_else(|e| e.into_inner());
        let dir = setup_dir("block223_basics");
        let s = Block223Solver::new();

        // pt_ce2 全可达
        assert!(s.pt_ce2.iter().all(|&v| v != 255));

        // 标签:12 个块名,每个出现恰 2 次;规范 (0,0) = DL
        let mut count = std::collections::HashMap::new();
        for ri in 0..6 {
            for k in 0..4 {
                *count.entry(block223_label(ri, k)).or_insert(0) += 1;
            }
        }
        assert_eq!(count.len(), 12);
        assert!(count.values().all(|&c: &i32| c == 2));
        assert_eq!(block223_label(0, 0), "DL");

        // 单 move:U/R 不碰规范块 → 0;D/L/F/B 各破 → 1
        let one = |scr: &str| s.solve_one(&string_to_alg(scr), "", 0);
        assert_eq!(one("U"), 0);
        assert_eq!(one("R"), 0);
        assert_eq!(one("D"), 1);
        assert_eq!(one("L"), 1);
        assert_eq!(one("F"), 1);
        assert_eq!(one("B"), 1);
        let z0 = |scr: &str| s.get_stats(&string_to_alg(scr), &[""])[0];
        assert_eq!(z0("U"), 0);
        assert_eq!(z0("D"), 1);

        // 一致性:2x2x3 ⊇ 1x2x3 ⇒ dist223 ≥ dist_s1(逐 (rot,yk))
        for seed in 0..15u64 {
            let alg = pseudo_scramble(seed, 20);
            for rot in ROTS6 {
                for k in 0..4 {
                    let d223 = s.solve_one(&alg, rot, k);
                    let ds1 = s.s1.solve_one(&alg, rot, k);
                    assert!(d223 >= ds1, "223 < s1: seed={} rot={} yk={}", seed, rot, k);
                }
            }
        }

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn pt_ce2_brute_force_check() {
        let _lock = test_env_lock().lock().unwrap_or_else(|e| e.into_inner());
        let dir = setup_dir("block223_ce2");
        let s = Block223Solver::new();

        // 独立暴力表:2 角(DBL,DLF)+ 2 棱(DB,DF),radix-24^4 Vec BFS
        let ct = corner_trans();
        let et = edge_trans();
        let start = [12u8, 21, 16, 20]; // 3*4, 3*7, 2*8, 2*10
        let key = |st: &[u8; 4]| st.iter().fold(0usize, |k, &v| k * 24 + v as usize);
        let mut dist = vec![255u8; 24usize.pow(4)];
        dist[key(&start)] = 0;
        let mut frontier = vec![start];
        let mut d = 0u8;
        while !frontier.is_empty() {
            let mut next = Vec::new();
            for st in &frontier {
                for m in 0..18 {
                    let ns = [
                        ct[st[0] as usize][m],
                        ct[st[1] as usize][m],
                        et[st[2] as usize][m],
                        et[st[3] as usize][m],
                    ];
                    let k = key(&ns);
                    if dist[k] == 255 {
                        dist[k] = d + 1;
                        next.push(ns);
                    }
                }
            }
            d += 1;
            frontier = next;
        }
        assert_eq!(
            dist.iter().filter(|&&v| v != 255).count(),
            state_space::CORNER2 * state_space::EDGE2
        );

        for seed in 0..50u64 {
            let alg = pseudo_scramble(seed, 20);
            let buf: Vec<u8> = alg.iter().map(|m| m.index() as u8).collect();
            let (c2, _e3, e2) = s.walk(&buf);
            let got = s.pt_ce2[c2 * state_space::EDGE2 + e2];
            let mut st = start;
            for &m in &alg {
                st = [
                    ct[st[0] as usize][m.index()],
                    ct[st[1] as usize][m.index()],
                    et[st[2] as usize][m.index()],
                    et[st[3] as usize][m.index()],
                ];
            }
            assert_eq!(got, dist[key(&st)], "seed={}", seed);
        }

        let _ = std::fs::remove_dir_all(&dir);
    }

    /// 纯运动学 IDDFS(独立于 mt/pt):确认 solve_one 最优性(短打乱)。
    #[test]
    fn optimality_spot_check_iddfs() {
        let _lock = test_env_lock().lock().unwrap_or_else(|e| e.into_inner());
        let dir = setup_dir("block223_iddfs");
        let s = Block223Solver::new();

        let ct = corner_trans();
        let et = edge_trans();
        let (corners, edges) = block223_pieces(0, 0);
        let home: Vec<u8> = corners
            .iter()
            .map(|&c| (3 * c) as u8)
            .chain(edges.iter().map(|&e| (2 * e) as u8))
            .collect();

        fn dfs(
            st: &[u8; 7],
            depth: u32,
            prev: usize,
            home: &[u8],
            ct: &[[u8; 18]; 24],
            et: &[[u8; 18]; 24],
        ) -> bool {
            if depth == 0 {
                return st[..] == *home;
            }
            let (vmoves, vcnt) = valid_moves();
            let row = &vmoves[prev];
            for k in 0..vcnt[prev] as usize {
                let m = row[k] as usize;
                let ns = [
                    ct[st[0] as usize][m],
                    ct[st[1] as usize][m],
                    et[st[2] as usize][m],
                    et[st[3] as usize][m],
                    et[st[4] as usize][m],
                    et[st[5] as usize][m],
                    et[st[6] as usize][m],
                ];
                if dfs(&ns, depth - 1, m, home, ct, et) {
                    return true;
                }
            }
            false
        }

        for seed in 300..310u64 {
            let alg = pseudo_scramble(seed, 5);
            let got = s.solve_one(&alg, "", 0);
            assert!(got <= 5, "5-move scramble dist > 5");
            let mut st = [0u8; 7];
            st.copy_from_slice(&home);
            for &m in &alg {
                st = [
                    ct[st[0] as usize][m.index()],
                    ct[st[1] as usize][m.index()],
                    et[st[2] as usize][m.index()],
                    et[st[3] as usize][m.index()],
                    et[st[4] as usize][m.index()],
                    et[st[5] as usize][m.index()],
                    et[st[6] as usize][m.index()],
                ];
            }
            let mut want = 99;
            for d in 0..=5u32 {
                if dfs(&st, d, 18, &home, &ct, &et) {
                    want = d;
                    break;
                }
            }
            assert_eq!(got, want, "seed={} alg={:?}", seed, alg);
        }

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn enumerate_face_solutions_are_valid() {
        let _lock = test_env_lock().lock().unwrap_or_else(|e| e.into_inner());
        let dir = setup_dir("block223_enum");
        let s = Block223Solver::new();

        for seed in 400..406u64 {
            let alg = pseudo_scramble(seed, 20);
            for (ri, rot) in ROTS6.iter().enumerate() {
                let stats_min = s.solve_face(&alg, rot);
                let (best, sols) = s.enumerate_face(&alg, rot, 1, 12);
                assert_eq!(best, stats_min, "best mismatch seed={} rot={}", seed, ri);
                if best == 0 {
                    assert!(sols.is_empty());
                    continue;
                }
                assert!(!sols.is_empty());
                assert!(sols.iter().any(|x| x.len == best));
                for sol in &sols {
                    assert!(sol.len >= best && sol.len <= best + 1);
                    let mut buf = conj_buf(&alg, rot, sol.yk);
                    buf.extend_from_slice(&sol.moves);
                    let (c2, e3, e2) = s.walk(&buf);
                    assert_eq!(s.h(c2, e3, e2), 0, "sol doesn't solve 223");
                }
            }
        }

        // State 级二次验证:rot="" 把解经 y^k 逆映射回原帧,验证 7 件物理归位
        let alg = string_to_alg("D B U B2 R2 U' L2 D2 R2 D' L D2 B D' L2 F' D L' D'");
        let (_best, sols) = s.enumerate_face(&alg, "", 0, 4);
        let rm = rot_map();
        for sol in &sols {
            let mut st = State::SOLVED;
            let inv_k = (4 - sol.yk) % 4;
            for &m in &alg {
                st.apply(m);
            }
            for &m in &sol.moves {
                st.apply(Move::from_index(rm[inv_k][m as usize] as usize));
            }
            let (corners, edges) = block223_pieces(0, sol.yk);
            let (cp, co) = st.cp_co();
            for &c in &corners {
                assert_eq!((cp[c], co[c]), (c as u8, 0), "corner {} not home", c);
            }
            let (ep, eo) = st.ep_eo();
            for &e in &edges {
                assert_eq!((ep[e], eo[e]), (e as u8, 0), "edge {} not home", e);
            }
        }

        let _ = std::fs::remove_dir_all(&dir);
    }
}
