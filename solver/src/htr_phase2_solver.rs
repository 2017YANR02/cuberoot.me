//! htr_phase2_solver: HTR phase-2 求解器 = Thistlethwaite 最后一阶段 G3→G4。
//!
//! 语义:输入已处于 HTR 态(G3 = ⟨U2,D2,L2,R2,F2,B2⟩ 陪集满足),求降到 solved
//! (G4 = identity)的最优步数;搜索只允许 6 种双转 U2 D2 L2 R2 F2 B2。这 6 个
//! 双转全在现有 18-move 编码里(G3_MOVES),零引擎扩展。
//!
//! 坐标推导(全由 MOVE_STATES + 6 双转现场导出,测试有独立暴力对照):
//! - G3 = 这 6 双转生成的群,从 solved 出发用 6 双转可达整个 G3 ⇒ HTR phase-2
//!   的可达态空间 = |G3| = 663,552(htr_solver 的 g3_closure 测试已证)。
//! - 角:G3 角置换 ∈ Hc(6 双转角置换闭包,|Hc| = 96,全偶 ⊂ A8)。给 Hc 的 96
//!   个 cp 编紧凑 rank(BFS 编号),角移动表 96×6。
//! - 棱:G3 棱置换 ∈ {三轨道(E / UD-A / UD-B)各保持、总宇称偶} = 6912 = 24³/2。
//!   从 solved 用 6 双转 BFS 枚举可达棱排列编紧凑 rank(恰得 6912),棱移动表 6912×6。
//! - 联合 idx = hc_rank*6912 + edge_rank,空间 96×6912 = 663,552;u8 精确距离表
//!   648KB 现场 BFS:查长度 O(1),枚举首达即最优。6 双转集对取逆封闭(每个双转
//!   自逆)⇒ 自 solved 正向扩张即距离。
//!
//! 视角:G4 目标(solved)对任意旋转不变,本阶段对 y 不变(同 htr),只算 yk=0;
//! 对面底色同轴(z0≡z2)。非 HTR 输入返回 None(对应 wasm u32::MAX 哨兵)。

use std::collections::HashMap;

use crate::cube_common::{move_state, valid_moves, Move, State};
use crate::htr_solver::G3_MOVES;
use crate::roux_s1_solver::{conj_buf, S1Sol};

/// Hc 角置换个数(6 双转角闭包)。
pub const HC: usize = 96;
/// G3 棱排列个数(三轨道偶约束)。
pub const EDGES: usize = 6912;
/// 联合态空间 = |G3|。
pub const G4_STATES: usize = HC * EDGES;

#[inline]
fn is_g3(m: usize) -> bool {
    matches!(m, 1 | 4 | 7 | 10 | 13 | 16)
}

/// 给定 6 双转的件置换闭包(约定 cp/ep = 位置→件,与 State::cp_co / ep_eo 一致),
/// 从 identity BFS,返回 (有序元素表, 件→rank 映射)。N = 8(角)或 12(棱)。
fn closure<const N: usize>(perm_of: &[[u8; N]; 18]) -> (Vec<[u8; N]>, HashMap<[u8; N], u32>) {
    let mut id = [0u8; N];
    for (i, v) in id.iter_mut().enumerate() {
        *v = i as u8;
    }
    let mut rank: HashMap<[u8; N], u32> = HashMap::new();
    rank.insert(id, 0);
    let mut all = vec![id];
    let mut frontier = vec![id];
    while !frontier.is_empty() {
        let mut next = Vec::new();
        for p in &frontier {
            for &m in &G3_MOVES {
                let mp = &perm_of[m as usize];
                let mut np = [0u8; N];
                for i in 0..N {
                    np[i] = p[mp[i] as usize];
                }
                if let std::collections::hash_map::Entry::Vacant(e) = rank.entry(np) {
                    e.insert(all.len() as u32);
                    all.push(np);
                    next.push(np);
                }
            }
        }
        frontier = next;
    }
    (all, rank)
}

pub struct HtrPhase2Solver {
    /// 角紧凑移动表 96×6(列 = G3_MOVES 序)。
    mt_corn: Vec<u32>,
    /// 棱紧凑移动表 6912×6(列 = G3_MOVES 序)。
    mt_edge: Vec<u32>,
    /// 全空间精确距离,idx = hc_rank*EDGES + edge_rank。
    dist: Vec<u8>,
    /// Hc 角置换 → 紧凑 rank(坐标提取用);非 Hc 即非 HTR。
    corn_rank: HashMap<[u8; 8], u32>,
    /// G3 棱排列 → 紧凑 rank;非 G3 棱即非 HTR。
    edge_rank: HashMap<[u8; 12], u32>,
}

impl Default for HtrPhase2Solver {
    fn default() -> Self {
        Self::new()
    }
}

impl HtrPhase2Solver {
    /// 全自包含构造(native/wasm 同路径,~648KB 表现场 BFS 亚秒级)。
    pub fn new() -> Self {
        // 件置换基:cp 与 ep(位置→件)。
        let mut pcp = [[0u8; 8]; 18];
        let mut pep = [[0u8; 12]; 18];
        for m in Move::ALL {
            pcp[m.index()] = move_state(m).cp_co().0;
            pep[m.index()] = move_state(m).ep_eo().0;
        }

        let (corns, corn_rank) = closure::<8>(&pcp);
        let (edges, edge_rank) = closure::<12>(&pep);
        assert_eq!(corns.len(), HC, "|Hc| != 96");
        assert_eq!(edges.len(), EDGES, "|G3 edges| != 6912");

        // 紧凑移动表(只 6 双转列)。
        let mut mt_corn = vec![0u32; HC * 6];
        for (r, cp) in corns.iter().enumerate() {
            for (col, &m) in G3_MOVES.iter().enumerate() {
                let mp = &pcp[m as usize];
                let mut ncp = [0u8; 8];
                for i in 0..8 {
                    ncp[i] = cp[mp[i] as usize];
                }
                mt_corn[r * 6 + col] = corn_rank[&ncp];
            }
        }
        let mut mt_edge = vec![0u32; EDGES * 6];
        for (r, ep) in edges.iter().enumerate() {
            for (col, &m) in G3_MOVES.iter().enumerate() {
                let mp = &pep[m as usize];
                let mut nep = [0u8; 12];
                for i in 0..12 {
                    nep[i] = ep[mp[i] as usize];
                }
                mt_edge[r * 6 + col] = edge_rank[&nep];
            }
        }

        // 全空间 BFS(6 双转自逆 ⇒ 自 solved 正向扩张即距离)。
        // solved: hc_rank=0(identity)、edge_rank=0(identity)。
        let mut dist = vec![255u8; G4_STATES];
        dist[0] = 0;
        let mut frontier: Vec<u32> = vec![0];
        let mut d = 0u8;
        while !frontier.is_empty() {
            let mut next = Vec::new();
            for &i in &frontier {
                let c = i as usize / EDGES;
                let e = i as usize % EDGES;
                for col in 0..6 {
                    let nc = mt_corn[c * 6 + col] as usize;
                    let ne = mt_edge[e * 6 + col] as usize;
                    let ni = nc * EDGES + ne;
                    if dist[ni] == 255 {
                        dist[ni] = d + 1;
                        next.push(ni as u32);
                    }
                }
            }
            d += 1;
            frontier = next;
        }

        HtrPhase2Solver { mt_corn, mt_edge, dist, corn_rank, edge_rank }
    }

    /// 距离表最大深度(HTR phase-2 / Thistlethwaite phase-4 God's number)。
    pub fn max_depth(&self) -> u8 {
        self.dist.iter().copied().filter(|&v| v != 255).max().unwrap_or(0)
    }

    /// HTR 检查 + 坐标提取(规范帧 State)。非 HTR → None。
    fn state_coords(&self, st: &State) -> Option<(usize, usize)> {
        let (cp, co) = st.cp_co();
        let (ep, eo) = st.ep_eo();
        if co.iter().any(|&v| v != 0) || eo.iter().any(|&v| v != 0) {
            return None;
        }
        let c = *self.corn_rank.get(&cp)? as usize;
        let e = *self.edge_rank.get(&ep)? as usize;
        Some((c, e))
    }

    /// 从 SOLVED 走 buf 后提取坐标;非 HTR → None。
    fn coords(&self, buf: &[u8]) -> Option<(usize, usize)> {
        let mut st = State::SOLVED;
        for &m in buf {
            st.apply(Move::from_index(m as usize));
        }
        self.state_coords(&st)
    }

    /// 该 (视角, yk) 下是否处于 HTR。
    pub fn is_htr(&self, alg: &[Move], rot: &str, yk: usize) -> bool {
        self.coords(&conj_buf(alg, rot, yk)).is_some()
    }

    /// 单 (视角, yk) 最优步数(精确表直查);该视角非 HTR → None。
    pub fn solve_one(&self, alg: &[Move], rot: &str, yk: usize) -> Option<u32> {
        let (c, e) = self.coords(&conj_buf(alg, rot, yk))?;
        Some(self.dist[c * EDGES + e] as u32)
    }

    /// 单视角:对 y 不变,只算 yk=0。
    pub fn solve_face(&self, alg: &[Move], rot: &str) -> Option<u32> {
        self.solve_one(alg, rot, 0)
    }

    /// 各视角统计(同 HtrSolver::get_stats 形状);该视角非 HTR → None。
    pub fn get_stats(&self, alg: &[Move], rots: &[&str]) -> Vec<Option<u32>> {
        rots.iter().map(|r| self.solve_face(alg, r)).collect()
    }

    /// 枚举恰好 depth 步的解(只走 6 双转)。
    #[allow(clippy::too_many_arguments)]
    fn enum_paths(
        &self,
        c: usize,
        e: usize,
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
            if !is_g3(m) {
                continue;
            }
            let col = G3_MOVES.iter().position(|&g| g as usize == m).unwrap();
            let nc = self.mt_corn[c * 6 + col] as usize;
            let ne = self.mt_edge[e * 6 + col] as usize;
            if self.dist[nc * EDGES + ne] as u32 >= depth {
                continue;
            }
            path.push(m as u8);
            if depth == 1 {
                out.push(path.clone());
            } else {
                self.enum_paths(nc, ne, depth - 1, m as u8, path, out, cap);
            }
            path.pop();
        }
    }

    /// 单视角多解(yk=0,对 y 不变):预算 = 最优 + extra,cap 截断;
    /// 该视角非 HTR → None。
    pub fn enumerate_face(
        &self,
        alg: &[Move],
        rot: &str,
        extra: u32,
        cap: usize,
    ) -> Option<(u32, Vec<S1Sol>)> {
        let (c, e) = self.coords(&conj_buf(alg, rot, 0))?;
        let best = self.dist[c * EDGES + e] as u32;
        let mut sols: Vec<S1Sol> = Vec::new();
        if best == 0 {
            return Some((0, sols));
        }
        let mut out = Vec::new();
        let mut path = Vec::new();
        for d in best..=(best + extra) {
            self.enum_paths(c, e, d, 18, &mut path, &mut out, cap);
            if out.len() >= cap {
                break;
            }
        }
        sols.extend(out.into_iter().map(|moves| S1Sol {
            yk: 0,
            len: moves.len() as u32,
            moves,
        }));
        sols.sort_by_key(|x| x.len);
        sols.truncate(cap);
        Some((best, sols))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::block222_solver::ROTS6;
    use crate::cube_common::{rot_map, string_to_alg, INV_MOVE};
    use crate::roux_s1_solver::tests::pseudo_scramble;
    use std::collections::HashSet;
    use std::sync::OnceLock;

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

    // ---------- 独立结构推导(State 级,绕开 solver 内部编码) ----------

    /// State 级 G3 闭包(从 SOLVED 用 6 个半转 BFS,全 663,552 元素)。
    fn g3_closure() -> &'static Vec<State> {
        static V: OnceLock<Vec<State>> = OnceLock::new();
        V.get_or_init(|| {
            let key = |st: &State| -> [u8; 20] {
                let mut k = [0u8; 20];
                k[..8].copy_from_slice(&st.corners);
                k[8..].copy_from_slice(&st.edges);
                k
            };
            let mut seen: HashSet<[u8; 20]> = HashSet::new();
            seen.insert(key(&State::SOLVED));
            let mut frontier = vec![State::SOLVED];
            let mut all = vec![State::SOLVED];
            while !frontier.is_empty() {
                let mut next = Vec::new();
                for st in &frontier {
                    for &m in &G3_MOVES {
                        let ns = st.applied(Move::from_index(m as usize));
                        if seen.insert(key(&ns)) {
                            next.push(ns);
                            all.push(ns);
                        }
                    }
                }
                frontier = next;
            }
            all
        })
    }

    #[test]
    fn pt_basics() {
        let s = HtrPhase2Solver::new();

        // move 集合语义:G3 = 6 双转,且 = 18-move 中 U2/D2/L2/R2/F2/B2;均自逆。
        let g3_self_inv: Vec<u8> =
            (0..18u8).filter(|&m| is_g3(m as usize) && INV_MOVE[m as usize] == m).collect();
        assert_eq!(g3_self_inv, G3_MOVES.to_vec());
        for m in 0..18usize {
            assert_eq!(is_g3(m), G3_MOVES.contains(&(m as u8)));
        }

        // 表尺寸 + 全可达 + 唯一目标。
        assert_eq!(s.dist.len(), G4_STATES);
        assert_eq!(G4_STATES, 663_552);
        assert!(s.dist.iter().all(|&v| v != 255), "unreachable states found");
        assert_eq!(s.dist.iter().filter(|&&v| v == 0).count(), 1, "目标应唯一(solved)");
        assert_eq!(s.corn_rank.len(), HC);
        assert_eq!(s.edge_rank.len(), EDGES);
        // HTR phase-2 / Thistlethwaite phase-4 God's number(只数双转步)实测 15。
        assert_eq!(s.max_depth(), 15);

        // 子群测试:任意 6 双转词 → 仍 HTR,且 solve_one 给合法步数。
        for seed in 0..30u64 {
            let alg = pseudo_word(seed, 14, &G3_MOVES);
            assert!(s.solve_one(&alg, "", 0).is_some(), "G3 word not HTR");
        }

        // 单 move:空 → 0;单个双转 → 1;破 HTR 的 quarter turn → None。
        let one = |scr: &str| s.solve_one(&string_to_alg(scr), "", 0);
        assert_eq!(one(""), Some(0));
        assert_eq!(one("U2"), Some(1));
        assert_eq!(one("D2"), Some(1));
        assert_eq!(one("L2"), Some(1));
        assert_eq!(one("R2"), Some(1));
        assert_eq!(one("F2"), Some(1));
        assert_eq!(one("B2"), Some(1));
        assert_eq!(one("U"), None);
        assert_eq!(one("R'"), None);
        assert_eq!(one("F"), None);

        // y 不变 + 对面同轴(z2)。
        for seed in 0..15u64 {
            let alg = pseudo_word(100 + seed, 25, &G3_MOVES);
            let d0 = s.solve_one(&alg, "", 0);
            assert!(d0.is_some());
            for k in 1..4 {
                assert_eq!(d0, s.solve_one(&alg, "", k), "y-invariance broken");
            }
            for k in 0..4 {
                assert_eq!(d0, s.solve_one(&alg, "z2", k), "z0 != z2");
            }
        }

        // is_htr 一致性:任意打乱 × 全 (rot,yk),与 State 级 HTR 判定对照。
        let g3 = g3_closure();
        let g3_keys: HashSet<[u8; 20]> = g3
            .iter()
            .map(|st| {
                let mut k = [0u8; 20];
                k[..8].copy_from_slice(&st.corners);
                k[8..].copy_from_slice(&st.edges);
                k
            })
            .collect();
        for seed in 0..10u64 {
            let alg = pseudo_scramble(seed, 18);
            for (ri, rot) in ROTS6.iter().enumerate() {
                for k in 0..4 {
                    let buf = conj_buf(&alg, rot, k);
                    let mut st = State::SOLVED;
                    for &m in &buf {
                        st.apply(Move::from_index(m as usize));
                    }
                    let mut key = [0u8; 20];
                    key[..8].copy_from_slice(&st.corners);
                    key[8..].copy_from_slice(&st.edges);
                    let htr = g3_keys.contains(&key);
                    assert_eq!(
                        s.solve_one(&alg, rot, k).is_some(),
                        htr,
                        "is_htr mismatch seed={} rot={} yk={}",
                        seed,
                        ri,
                        k
                    );
                    assert_eq!(s.is_htr(&alg, rot, k), htr);
                }
            }
        }
    }

    /// 独立暴力对照(金标准):State 级 6 双转全空间 BFS(663,552 态,HashMap),
    /// 与 solver dist 表逐态对照,再随机 6 双转词 × 视角对照前端。
    #[test]
    fn brute_force_full_space_compare() {
        // State 级 BFS,key = corners(8) | edges(12)。
        let key_of = |st: &State| -> [u8; 20] {
            let mut k = [0u8; 20];
            k[..8].copy_from_slice(&st.corners);
            k[8..].copy_from_slice(&st.edges);
            k
        };
        let mut map: HashMap<[u8; 20], u8> = HashMap::with_capacity(700_000);
        map.insert(key_of(&State::SOLVED), 0);
        let mut frontier = vec![State::SOLVED];
        let mut d = 0u8;
        while !frontier.is_empty() {
            let mut next = Vec::new();
            for st in &frontier {
                for &m in &G3_MOVES {
                    let ns = st.applied(Move::from_index(m as usize));
                    if let std::collections::hash_map::Entry::Vacant(e) = map.entry(key_of(&ns)) {
                        e.insert(d + 1);
                        next.push(ns);
                    }
                }
            }
            d += 1;
            frontier = next;
        }
        assert_eq!(map.len(), G4_STATES, "brute space size mismatch");

        let s = HtrPhase2Solver::new();
        assert_eq!(s.max_depth(), *map.values().max().unwrap());

        // 全空间逐态对照:对 brute 的每个态,提取 (cp,ep) → solver 坐标 → dist。
        for (&k, &dv) in &map {
            let mut corners = [0u8; 8];
            let mut edges = [0u8; 12];
            corners.copy_from_slice(&k[..8]);
            edges.copy_from_slice(&k[8..]);
            let st = State { corners, edges };
            let (c, e) = s.state_coords(&st).expect("brute state must be HTR");
            assert_eq!(s.dist[c * EDGES + e], dv, "full-space mismatch");
        }

        // 前端对照:随机 6 双转词 × {"", "z2"} × yk,solver == brute 查表。
        for seed in 0..40u64 {
            let len = 1 + (seed as usize * 7) % 30;
            let alg = pseudo_word(3000 + seed, len, &G3_MOVES);
            for rot in ["", "z2"] {
                for k in 0..4 {
                    let buf = conj_buf(&alg, rot, k);
                    let mut st = State::SOLVED;
                    for &m in &buf {
                        st.apply(Move::from_index(m as usize));
                    }
                    let want = map[&key_of(&st)] as u32;
                    assert_eq!(
                        s.solve_one(&alg, rot, k),
                        Some(want),
                        "seed={} rot={} yk={}",
                        seed,
                        rot,
                        k
                    );
                }
            }
        }
    }

    /// 纯 State 级 IDDFS(独立于 mt/dist 表):短 6 双转词最优性。
    #[test]
    fn optimality_spot_check_iddfs() {
        let s = HtrPhase2Solver::new();

        fn dfs(st: &State, depth: u32, prev: usize) -> bool {
            if depth == 0 {
                return *st == State::SOLVED;
            }
            for &m in &G3_MOVES {
                let m = m as usize;
                if prev < 18 && m / 3 == prev / 3 {
                    continue;
                }
                let ns = st.applied(Move::from_index(m));
                if dfs(&ns, depth - 1, m) {
                    return true;
                }
            }
            false
        }

        for seed in 900..914u64 {
            let alg = pseudo_word(seed, 6, &G3_MOVES);
            let got = s.solve_one(&alg, "", 0).expect("G3 word must be HTR");
            assert!(got <= 6, "6-move G3 scramble dist > 6");
            let mut st = State::SOLVED;
            for &m in &alg {
                st.apply(m);
            }
            let mut want = 99;
            for dd in 0..=6u32 {
                if dfs(&st, dd, 18) {
                    want = dd;
                    break;
                }
            }
            assert_eq!(got, want, "seed={}", seed);
        }
    }

    #[test]
    fn enumerate_face_solutions_are_valid() {
        let s = HtrPhase2Solver::new();
        let rm = rot_map();

        for seed in 2000..2008u64 {
            let alg = pseudo_word(seed, 16, &G3_MOVES);
            for rot in ["", "z2"] {
                let best_d = s.solve_one(&alg, rot, 0).unwrap();
                let (best, sols) = s.enumerate_face(&alg, rot, 1, 12).unwrap();
                assert_eq!(best, best_d, "best mismatch seed={} rot={}", seed, rot);
                if best == 0 {
                    assert!(sols.is_empty());
                    continue;
                }
                assert!(!sols.is_empty());
                assert!(sols.iter().any(|x| x.len == best), "optimal missing");
                for sol in &sols {
                    assert!(sol.len >= best && sol.len <= best + 1);
                    assert_eq!(sol.moves.len() as u32, sol.len);
                    assert!(sol.moves.iter().all(|&m| is_g3(m as usize)), "non-G3 move in sol");
                    let mut buf = conj_buf(&alg, rot, 0);
                    buf.extend_from_slice(&sol.moves);
                    let (c, e) = s.coords(&buf).expect("sol must stay HTR");
                    assert_eq!(s.dist[c * EDGES + e], 0, "sol doesn't reach solved");
                }
            }

            // rot="" 的解做 State 级物理验证:从打乱态走解的真实 move 必到 SOLVED。
            let (_, sols) = s.enumerate_face(&alg, "", 0, 5).unwrap();
            for sol in &sols {
                let mut st = State::SOLVED;
                for &m in &alg {
                    st.apply(m);
                }
                for &m in &sol.moves {
                    st.apply(Move::from_index(rm[0][m as usize] as usize));
                }
                assert_eq!(st, State::SOLVED, "solved not physically reached");
            }
        }

        // 非 HTR 输入 → None。
        assert!(s.enumerate_face(&string_to_alg("R U F"), "", 0, 5).is_none());
        assert_eq!(s.solve_one(&string_to_alg("R U F"), "", 0), None);
    }
}
