//! htr_solver: HTR(half-turn reduction)求解器 = Thistlethwaite 风格 DR→HTR 阶段。
//!
//! 语义:输入已处于 DR 状态(G2 = ⟨U,D,L2,R2,F2,B2⟩ 陪集满足,视角 UD 轴),
//! 求降到 HTR(G3 = ⟨U2,D2,L2,R2,F2,B2⟩ 陪集)的最优步数;
//! 搜索只允许 G2 的 10 种转动(U U2 U' D D2 D' L2 R2 F2 B2)。
//!
//! 坐标推导(全由 MOVE_STATES 现场导出,测试有独立暴力对照):
//! - 角:G3 角置换群 Hc = 6 个半转角置换的闭包,|Hc| = 96(全偶 ⊂ A8);
//!   「角可被半转词复原」⟺ cp ∈ Hc,且 dist 在左乘 Hc 下不变 ⇒ 直接用
//!   全角置换坐标 8! = 40320,目标集 = Hc 的 96 个元素(免陪集编码)。
//! - 棱:半转下 12 棱分 3 个轨道(E 层 4 + UD 两轨道各 4);DR 下 E 层已归位,
//!   HTR 只再要求 UD 8 棱按轨道分离 ⇒ 跟踪其中一个轨道 4 棱的位置组合 C(8,4)=70。
//!   轨道内排列无需跟踪:合法态角宇称 = 棱总宇称,cp ∈ Hc(偶)⟹ 棱总宇称偶
//!   ⟹ 轨道分离即落 G3(|G3| = 96×6912 = 663,552 积结构,见 g3 闭包测试)。
//! - 联合 40320 × 70 = 2,822,400 态 = |G2|/|G3| 的 29,400 陪集 × 96 纤维,
//!   全空间精确距离表 2.8MB 现场 BFS:查长度 O(1),枚举首达即最优。
//!
//! 视角:HTR 轴 = DR 轴,对 y 共轭不变(G2/G3 的 y 共轭 = 自身,同 dr_solver),
//! 只算 yk=0;对面底色同轴(z0≡z2)。该视角下非 DR 输入返回 None。

use std::collections::HashSet;

use crate::cube_common::{move_state, valid_moves, Move, State};
use crate::eoline_solver::edge_pos_dst;
use crate::roux_s1_solver::{conj_buf, S1Sol};

/// G2 的 10 个 move(U U2 U' D D2 D' L2 R2 F2 B2)。
pub const G2_MOVES: [u8; 10] = [0, 1, 2, 3, 4, 5, 7, 10, 13, 16];
/// G3 的 6 个半转(U2 D2 L2 R2 F2 B2)。
pub const G3_MOVES: [u8; 6] = [1, 4, 7, 10, 13, 16];

/// 全角置换坐标空间 8!。
pub const CP8: usize = 40320;
/// 跟踪轨道 4 棱在 UD 8 槽里的位置组合空间 C(8,4)。
pub const SPLIT: usize = 70;

#[inline]
fn is_g2(m: usize) -> bool {
    matches!(m, 0..=5 | 7 | 10 | 13 | 16)
}

const FACT: [usize; 8] = [1, 1, 2, 6, 24, 120, 720, 5040];

/// 8 元置换 Lehmer 编码(0..40320)。
fn perm8_rank(p: &[u8; 8]) -> usize {
    let mut r = 0usize;
    for i in 0..8 {
        let mut c = 0usize;
        for j in (i + 1)..8 {
            if p[j] < p[i] {
                c += 1;
            }
        }
        r += c * FACT[7 - i];
    }
    r
}

fn perm8_unrank(mut r: usize) -> [u8; 8] {
    let mut avail = [0u8, 1, 2, 3, 4, 5, 6, 7];
    let mut len = 8usize;
    let mut p = [0u8; 8];
    for (i, v) in p.iter_mut().enumerate() {
        let f = FACT[7 - i];
        let k = r / f;
        r %= f;
        *v = avail[k];
        for j in k..len - 1 {
            avail[j] = avail[j + 1];
        }
        len -= 1;
    }
    p
}

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

/// 4 槽组合 colex 编码(槽索引升序,0..8 → 0..70)。
fn split_rank(pos: &[usize; 4]) -> usize {
    comb(pos[0], 1) + comb(pos[1], 2) + comb(pos[2], 3) + comb(pos[3], 4)
}

fn split_unrank(mut r: usize) -> [usize; 4] {
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

/// G3 角置换闭包 Hc(cp 约定 = 位置→件,与 State::cp_co 一致),|Hc| = 96。
fn corner_htr_group() -> Vec<[u8; 8]> {
    let mut pcp = [[0u8; 8]; 18];
    for m in Move::ALL {
        pcp[m.index()] = move_state(m).cp_co().0;
    }
    let id = [0u8, 1, 2, 3, 4, 5, 6, 7];
    let mut seen: HashSet<[u8; 8]> = HashSet::new();
    seen.insert(id);
    let mut frontier = vec![id];
    let mut all = vec![id];
    while !frontier.is_empty() {
        let mut next = Vec::new();
        for cp in &frontier {
            for &m in &G3_MOVES {
                let mcp = &pcp[m as usize];
                let mut ncp = [0u8; 8];
                for i in 0..8 {
                    ncp[i] = cp[mcp[i] as usize];
                }
                if seen.insert(ncp) {
                    next.push(ncp);
                    all.push(ncp);
                }
            }
        }
        frontier = next;
    }
    all
}

/// 位置 start 在 6 个半转下的轨道(bitmask)。
fn orbit_of(dst: &[[u8; 12]; 18], start: usize) -> u16 {
    let mut mask = 1u16 << start;
    loop {
        let mut grew = false;
        for p in 0..12 {
            if mask >> p & 1 == 1 {
                for &m in &G3_MOVES {
                    let np = dst[m as usize][p] as usize;
                    if mask >> np & 1 == 0 {
                        mask |= 1 << np;
                        grew = true;
                    }
                }
            }
        }
        if !grew {
            return mask;
        }
    }
}

pub struct HtrSolver {
    /// 角置换移动表 40320×18(全 18 列都合法)。
    mt_cp: Vec<u32>,
    /// 轨道组合移动表 70×18(非 G2 列 = u32::MAX,棱会离开 UD 槽)。
    mt_split: Vec<u32>,
    /// 全空间精确距离,idx = cp_rank*70 + split。
    dist: Vec<u8>,
    /// 跟踪轨道的件/家位置 bitmask(位 = 棱编号)。
    orbit_a: u16,
    /// 位置 → UD 槽序号(0..8);E 槽 = 255。
    ud_index: [u8; 12],
}

impl Default for HtrSolver {
    fn default() -> Self {
        Self::new()
    }
}

impl HtrSolver {
    /// 全自包含构造(native/wasm 同路径,~2.8MB 表现场 BFS 亚秒级)。
    pub fn new() -> Self {
        // 角置换移动表
        let mut pcp = [[0u8; 8]; 18];
        for m in Move::ALL {
            pcp[m.index()] = move_state(m).cp_co().0;
        }
        let mut mt_cp = vec![0u32; CP8 * 18];
        for idx in 0..CP8 {
            let cp = perm8_unrank(idx);
            for (m, mcp) in pcp.iter().enumerate() {
                let mut ncp = [0u8; 8];
                for i in 0..8 {
                    ncp[i] = cp[mcp[i] as usize];
                }
                mt_cp[idx * 18 + m] = perm8_rank(&ncp) as u32;
            }
        }

        // E 槽 = U 与 D 都不动的位置;UD 槽 = 其余 8;轨道 A = 首个 UD 槽的半转轨道
        let dst = edge_pos_dst();
        let mut e_mask = 0u16;
        for p in 0..12 {
            if dst[Move::U.index()][p] == p as u8 && dst[Move::D.index()][p] == p as u8 {
                e_mask |= 1 << p;
            }
        }
        assert_eq!(e_mask.count_ones(), 4);
        let mut ud_index = [255u8; 12];
        let mut ud_pos = [0usize; 8];
        let mut n = 0;
        for p in 0..12 {
            if e_mask >> p & 1 == 0 {
                ud_index[p] = n as u8;
                ud_pos[n] = p;
                n += 1;
            }
        }
        let orbit_a = orbit_of(&dst, ud_pos[0]);
        assert_eq!(orbit_a.count_ones(), 4);
        assert_eq!(orbit_a & e_mask, 0);

        // 轨道组合移动表(只填 G2 列)
        let mut mt_split = vec![u32::MAX; SPLIT * 18];
        for r in 0..SPLIT {
            let loc = split_unrank(r);
            for &m in &G2_MOVES {
                let m = m as usize;
                let mut np = [0usize; 4];
                for (i, &li) in loc.iter().enumerate() {
                    let q = dst[m][ud_pos[li]] as usize;
                    assert_ne!(ud_index[q], 255, "G2 move left UD slots");
                    np[i] = ud_index[q] as usize;
                }
                np.sort_unstable();
                mt_split[r * 18 + m] = split_rank(&np) as u32;
            }
        }

        // 目标:cp ∈ Hc(96)× 轨道归位
        let mut home = [0usize; 4];
        let mut hi = 0;
        for p in 0..12 {
            if orbit_a >> p & 1 == 1 {
                home[hi] = ud_index[p] as usize;
                hi += 1;
            }
        }
        let split_solved = split_rank(&home);

        // 全空间 BFS(G2 move 集对取逆封闭 ⇒ 自目标正向扩张即距离)
        let mut dist = vec![255u8; CP8 * SPLIT];
        let mut frontier: Vec<u32> = Vec::new();
        for cp in corner_htr_group() {
            let idx = perm8_rank(&cp) * SPLIT + split_solved;
            if dist[idx] == 255 {
                dist[idx] = 0;
                frontier.push(idx as u32);
            }
        }
        let mut d = 0u8;
        while !frontier.is_empty() {
            let mut next = Vec::new();
            for &i in &frontier {
                let c = i as usize / SPLIT;
                let s = i as usize % SPLIT;
                for &m in &G2_MOVES {
                    let m = m as usize;
                    let ni =
                        mt_cp[c * 18 + m] as usize * SPLIT + mt_split[s * 18 + m] as usize;
                    if dist[ni] == 255 {
                        dist[ni] = d + 1;
                        next.push(ni as u32);
                    }
                }
            }
            d += 1;
            frontier = next;
        }

        HtrSolver { mt_cp, mt_split, dist, orbit_a, ud_index }
    }

    /// 距离表最大深度(DR→HTR God's number,信息用)。
    pub fn max_depth(&self) -> u8 {
        self.dist.iter().copied().filter(|&v| v != 255).max().unwrap_or(0)
    }

    /// DR 检查 + 坐标提取(规范帧 State)。非 DR → None。
    fn state_coords(&self, st: &State) -> Option<(usize, usize)> {
        let (cp, co) = st.cp_co();
        let (ep, eo) = st.ep_eo();
        if co.iter().any(|&v| v != 0) || eo.iter().any(|&v| v != 0) {
            return None;
        }
        let mut loc = [0usize; 4];
        let mut n = 0;
        for p in 0..12 {
            let pos_is_e = self.ud_index[p] == 255;
            let piece_is_e = self.ud_index[ep[p] as usize] == 255;
            if pos_is_e != piece_is_e {
                return None; // E 层棱未归层 ⇒ 非 DR
            }
            if !pos_is_e && self.orbit_a >> ep[p] & 1 == 1 {
                loc[n] = self.ud_index[p] as usize;
                n += 1;
            }
        }
        debug_assert_eq!(n, 4);
        Some((perm8_rank(&cp), split_rank(&loc)))
    }

    /// 从 SOLVED 走 buf 后提取坐标;非 DR → None。
    fn coords(&self, buf: &[u8]) -> Option<(usize, usize)> {
        let mut st = State::SOLVED;
        for &m in buf {
            st.apply(Move::from_index(m as usize));
        }
        self.state_coords(&st)
    }

    /// 该 (视角, yk) 下是否处于 DR。
    pub fn is_dr(&self, alg: &[Move], rot: &str, yk: usize) -> bool {
        self.coords(&conj_buf(alg, rot, yk)).is_some()
    }

    /// 单 (视角, yk) 最优步数(精确表直查);该视角非 DR → None。
    pub fn solve_one(&self, alg: &[Move], rot: &str, yk: usize) -> Option<u32> {
        let (c, s) = self.coords(&conj_buf(alg, rot, yk))?;
        Some(self.dist[c * SPLIT + s] as u32)
    }

    /// 单视角:HTR 对 y 不变,只算 yk=0。
    pub fn solve_face(&self, alg: &[Move], rot: &str) -> Option<u32> {
        self.solve_one(alg, rot, 0)
    }

    /// 各视角统计(同 DrSolver::get_stats 形状);该视角非 DR → None。
    pub fn get_stats(&self, alg: &[Move], rots: &[&str]) -> Vec<Option<u32>> {
        rots.iter().map(|r| self.solve_face(alg, r)).collect()
    }

    /// 枚举恰好 depth 步的解(只走 G2 move)。
    #[allow(clippy::too_many_arguments)]
    fn enum_paths(
        &self,
        c: usize,
        s: usize,
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
            if !is_g2(m) {
                continue;
            }
            let nc = self.mt_cp[c * 18 + m] as usize;
            let ns = self.mt_split[s * 18 + m] as usize;
            if self.dist[nc * SPLIT + ns] as u32 >= depth {
                continue;
            }
            path.push(m as u8);
            if depth == 1 {
                out.push(path.clone());
            } else {
                self.enum_paths(nc, ns, depth - 1, m as u8, path, out, cap);
            }
            path.pop();
        }
    }

    /// 单视角多解(yk=0,HTR 对 y 不变):预算 = 最优 + extra,cap 截断;
    /// 该视角非 DR → None。
    pub fn enumerate_face(
        &self,
        alg: &[Move],
        rot: &str,
        extra: u32,
        cap: usize,
    ) -> Option<(u32, Vec<S1Sol>)> {
        let (c, s) = self.coords(&conj_buf(alg, rot, 0))?;
        let best = self.dist[c * SPLIT + s] as u32;
        let mut sols: Vec<S1Sol> = Vec::new();
        if best == 0 {
            return Some((0, sols));
        }
        let mut out = Vec::new();
        let mut path = Vec::new();
        for d in best..=(best + extra) {
            self.enum_paths(c, s, d, 18, &mut path, &mut out, cap);
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
    use std::collections::HashMap;
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

    /// G3 角置换集(闭包 cp 投影,独立于 corner_htr_group 的数组合成路径)。
    fn hc_set() -> &'static HashSet<[u8; 8]> {
        static V: OnceLock<HashSet<[u8; 8]>> = OnceLock::new();
        V.get_or_init(|| g3_closure().iter().map(|st| st.cp_co().0).collect())
    }

    /// 独立重推:棱位置目的表 dst[m][p](局部从 MOVE_STATES 反查)。
    fn local_dst() -> [[u8; 12]; 18] {
        let mut t = [[0u8; 12]; 18];
        for m in Move::ALL {
            let (mep, _) = move_state(m).ep_eo();
            for (i, &src) in mep.iter().enumerate() {
                t[m.index()][src as usize] = i as u8;
            }
        }
        t
    }

    /// 独立重推:跟踪轨道(首个非 E 槽位置的半转轨道)。
    fn derive_orbit_a() -> u16 {
        let dst = local_dst();
        let mut e_mask = 0u16;
        for p in 0..12 {
            if dst[0][p] == p as u8 && dst[3][p] == p as u8 {
                e_mask |= 1 << p;
            }
        }
        let start = (0..12).find(|&p| e_mask >> p & 1 == 0).unwrap();
        let mut mask = 1u16 << start;
        loop {
            let mut grew = false;
            for p in 0..12 {
                if mask >> p & 1 == 1 {
                    for &m in &G3_MOVES {
                        let np = dst[m as usize][p] as usize;
                        if mask >> np & 1 == 0 {
                            mask |= 1 << np;
                            grew = true;
                        }
                    }
                }
            }
            if !grew {
                return mask;
            }
        }
    }

    fn perm_parity(p: &[u8]) -> u32 {
        let mut inv = 0u32;
        for i in 0..p.len() {
            for j in (i + 1)..p.len() {
                if p[j] < p[i] {
                    inv += 1;
                }
            }
        }
        inv & 1
    }

    /// State 级 HTR 判定(独立于坐标编码):cp ∈ Hc + 各棱在自己的半转轨道。
    fn state_htr_done(st: &State) -> bool {
        let (cp, co) = st.cp_co();
        let (ep, eo) = st.ep_eo();
        if co.iter().any(|&v| v != 0) || eo.iter().any(|&v| v != 0) {
            return false;
        }
        if !hc_set().contains(&cp) {
            return false;
        }
        let dst = local_dst();
        let mut e_mask = 0u16;
        for p in 0..12 {
            if dst[0][p] == p as u8 && dst[3][p] == p as u8 {
                e_mask |= 1 << p;
            }
        }
        let a = derive_orbit_a();
        for p in 0..12u16 {
            let piece = ep[p as usize] as u16;
            let cell = |x: u16| -> u8 {
                if e_mask >> x & 1 == 1 {
                    0
                } else if a >> x & 1 == 1 {
                    1
                } else {
                    2
                }
            };
            if cell(p) != cell(piece) {
                return false;
            }
        }
        true
    }

    /// G3 = Hc × {轨道保持的偶棱置换} 积结构(目标谓词的承重墙)。
    #[test]
    fn g3_structure_brute_closure() {
        let all = g3_closure();
        assert_eq!(all.len(), 663_552, "|G3| mismatch");

        // 角:96 个全偶置换;与 solver 侧数组合成闭包一致
        let hc = hc_set();
        assert_eq!(hc.len(), 96);
        assert!(hc.iter().all(|cp| perm_parity(cp) == 0));
        let solver_hc: HashSet<[u8; 8]> = corner_htr_group().into_iter().collect();
        assert_eq!(&solver_hc, hc);

        // 棱:全部轨道保持、总宇称偶,共 6912 = 4!^3 / 2 种 ⇒ 恰为全部偶轨道保持置换
        let a = derive_orbit_a();
        let dst = local_dst();
        let mut e_mask = 0u16;
        for p in 0..12 {
            if dst[0][p] == p as u8 && dst[3][p] == p as u8 {
                e_mask |= 1 << p;
            }
        }
        assert_eq!(e_mask.count_ones(), 4);
        assert_eq!(a.count_ones(), 4);
        assert_eq!(a & e_mask, 0);
        let mut eps: HashSet<[u8; 12]> = HashSet::new();
        for st in all {
            let (cp, co) = st.cp_co();
            let (ep, eo) = st.ep_eo();
            assert!(co.iter().all(|&v| v == 0));
            assert!(eo.iter().all(|&v| v == 0));
            assert_eq!(perm_parity(&cp), 0);
            assert_eq!(perm_parity(&ep), 0);
            for p in 0..12u16 {
                let piece = ep[p as usize] as u16;
                let cell = |x: u16| -> u8 {
                    if e_mask >> x & 1 == 1 {
                        0
                    } else if a >> x & 1 == 1 {
                        1
                    } else {
                        2
                    }
                };
                assert_eq!(cell(p), cell(piece), "edge left its half-turn orbit");
            }
            eps.insert(ep);
        }
        assert_eq!(eps.len(), 6912);
        assert_eq!(96 * 6912, 663_552); // 积结构闭合

        // 合法态宇称链:角宇称 = 棱宇称(随机打乱抽查)
        for seed in 0..20u64 {
            let alg = pseudo_scramble(seed, 19);
            let mut st = State::SOLVED;
            for &m in &alg {
                st.apply(m);
            }
            let (cp, _) = st.cp_co();
            let (ep, _) = st.ep_eo();
            assert_eq!(perm_parity(&cp), perm_parity(&ep));
        }
    }

    #[test]
    fn pt_basics() {
        let s = HtrSolver::new();

        // move 集合语义自检:G2 = DR 保持 move(co/eo 不变 + E 层封闭);G3 = G2 中自逆者
        for m in 0..18usize {
            let ms = move_state(Move::from_index(m));
            let (_, mco) = ms.cp_co();
            let (mep, meo) = ms.ep_eo();
            let dr_preserving = mco.iter().all(|&v| v == 0)
                && meo.iter().all(|&v| v == 0)
                && (0..12)
                    .all(|p| (s.ud_index[p] == 255) == (s.ud_index[mep[p] as usize] == 255));
            assert_eq!(dr_preserving, G2_MOVES.contains(&(m as u8)), "G2 set wrong at {}", m);
            assert_eq!(is_g2(m), G2_MOVES.contains(&(m as u8)));
        }
        let g3_derived: Vec<u8> = G2_MOVES
            .iter()
            .copied()
            .filter(|&m| INV_MOVE[m as usize] == m)
            .collect();
        assert_eq!(g3_derived, G3_MOVES.to_vec());

        // 全可达 + 目标恰 96 + max depth(实测 DR→HTR God's number)
        assert!(s.dist.iter().all(|&v| v != 255), "unreachable states found");
        assert_eq!(s.dist.iter().filter(|&&v| v == 0).count(), 96);
        // DR→HTR God's number(G2 move 集)实测 13,与 Thistlethwaite phase-3 文献一致
        assert_eq!(s.max_depth(), 13);

        // 子群测试:G3 随机词 → dist 0
        for seed in 0..30u64 {
            let alg = pseudo_word(seed, 14, &G3_MOVES);
            assert_eq!(s.solve_one(&alg, "", 0), Some(0), "G3 word not dist 0");
        }

        // 单 move:半转 → 0;U/D 四分之一 → 1;破 DR 的 → None
        let one = |scr: &str| s.solve_one(&string_to_alg(scr), "", 0);
        assert_eq!(one(""), Some(0));
        assert_eq!(one("U2"), Some(0));
        assert_eq!(one("D2"), Some(0));
        assert_eq!(one("L2"), Some(0));
        assert_eq!(one("F2"), Some(0));
        assert_eq!(one("U"), Some(1));
        assert_eq!(one("D'"), Some(1));
        assert_eq!(one("L"), None);
        assert_eq!(one("R'"), None);
        assert_eq!(one("F"), None);
        assert_eq!(one("B"), None);

        // y 不变 + 对面同轴(z2 保 UD 轴)
        for seed in 0..15u64 {
            let alg = pseudo_word(100 + seed, 25, &G2_MOVES);
            let d0 = s.solve_one(&alg, "", 0);
            assert!(d0.is_some());
            for k in 1..4 {
                assert_eq!(d0, s.solve_one(&alg, "", k), "HTR y-invariance broken");
            }
            for k in 0..4 {
                assert_eq!(d0, s.solve_one(&alg, "z2", k), "z0 != z2");
            }
        }

        // is_dr 一致性:任意打乱 × 全 (rot,yk),与 State 级 DR 判定对照
        for seed in 0..10u64 {
            let alg = pseudo_scramble(seed, 18);
            for (ri, rot) in ROTS6.iter().enumerate() {
                for k in 0..4 {
                    let buf = conj_buf(&alg, rot, k);
                    let mut st = State::SOLVED;
                    for &m in &buf {
                        st.apply(Move::from_index(m as usize));
                    }
                    let (_, co) = st.cp_co();
                    let (ep, eo) = st.ep_eo();
                    let dr = co.iter().all(|&v| v == 0)
                        && eo.iter().all(|&v| v == 0)
                        && (0..4).all(|i| ep[i] < 4);
                    assert_eq!(
                        s.solve_one(&alg, rot, k).is_some(),
                        dr,
                        "is_dr mismatch seed={} rot={} yk={}",
                        seed,
                        ri,
                        k
                    );
                    assert_eq!(s.is_dr(&alg, rot, k), dr);
                }
            }
        }
    }

    /// 独立暴力对照(金标准):MOVE_STATES 单件运动学 + HashMap 全空间 BFS,
    /// 全 2,822,400 格逐格对照,再随机 G2 词 × 视角对照前端(conj + 坐标提取)。
    #[test]
    fn brute_force_full_space_compare() {
        let dst = local_dst();
        let a = derive_orbit_a();
        let hc = hc_set();
        let mut pcp = [[0u8; 8]; 18];
        for m in Move::ALL {
            pcp[m.index()] = move_state(m).cp_co().0;
        }

        // key = cp 3bit×8 | 轨道件位置 mask << 32
        let key_of = |cp: &[u8; 8], mask: u16| -> u64 {
            let mut k = 0u64;
            for i in 0..8 {
                k |= (cp[i] as u64) << (3 * i);
            }
            k | (mask as u64) << 32
        };
        let mut map: HashMap<u64, u8> = HashMap::with_capacity(3_000_000);
        let mut frontier: Vec<([u8; 8], u16)> = Vec::new();
        for cp in hc {
            map.insert(key_of(cp, a), 0);
            frontier.push((*cp, a));
        }
        let mut d = 0u8;
        while !frontier.is_empty() {
            let mut next = Vec::new();
            for (cp, mask) in &frontier {
                for &m in &G2_MOVES {
                    let m = m as usize;
                    let mcp = &pcp[m];
                    let mut ncp = [0u8; 8];
                    for i in 0..8 {
                        ncp[i] = cp[mcp[i] as usize];
                    }
                    let mut nmask = 0u16;
                    for p in 0..12 {
                        if mask >> p & 1 == 1 {
                            nmask |= 1 << dst[m][p];
                        }
                    }
                    let k = key_of(&ncp, nmask);
                    if let std::collections::hash_map::Entry::Vacant(e) = map.entry(k) {
                        e.insert(d + 1);
                        next.push((ncp, nmask));
                    }
                }
            }
            d += 1;
            frontier = next;
        }
        assert_eq!(map.len(), CP8 * SPLIT, "brute space size mismatch");

        let s = HtrSolver::new();
        assert_eq!(s.max_depth(), map.values().copied().max().unwrap());

        // 全空间逐格对照
        for (&k, &dv) in &map {
            let mut cp = [0u8; 8];
            for (i, v) in cp.iter_mut().enumerate() {
                *v = ((k >> (3 * i)) & 7) as u8;
            }
            let mask = (k >> 32) as u16;
            let mut loc = [0usize; 4];
            let mut n = 0;
            for p in 0..12 {
                if mask >> p & 1 == 1 {
                    loc[n] = s.ud_index[p] as usize;
                    n += 1;
                }
            }
            assert_eq!(n, 4);
            assert_eq!(
                s.dist[perm8_rank(&cp) * SPLIT + split_rank(&loc)],
                dv,
                "full-space mismatch at key {:x}",
                k
            );
        }

        // 前端对照:随机 G2 词 × {"", "z2"} × yk,solver == brute 查表
        for seed in 0..40u64 {
            let len = 1 + (seed as usize * 7) % 35;
            let alg = pseudo_word(3000 + seed, len, &G2_MOVES);
            for rot in ["", "z2"] {
                for k in 0..4 {
                    let buf = conj_buf(&alg, rot, k);
                    let mut st = State::SOLVED;
                    for &m in &buf {
                        st.apply(Move::from_index(m as usize));
                    }
                    let (cp, _) = st.cp_co();
                    let (ep, _) = st.ep_eo();
                    let mut mask = 0u16;
                    for p in 0..12 {
                        if a >> ep[p] & 1 == 1 {
                            mask |= 1 << p;
                        }
                    }
                    let want = map[&key_of(&cp, mask)] as u32;
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

    /// 纯 State 级 IDDFS(独立于 mt/dist 表):短 G2 词最优性。
    #[test]
    fn optimality_spot_check_iddfs() {
        let s = HtrSolver::new();

        fn dfs(st: &State, depth: u32, prev: usize) -> bool {
            if depth == 0 {
                return state_htr_done(st);
            }
            for &m in &G2_MOVES {
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

        for seed in 900..912u64 {
            let alg = pseudo_word(seed, 5, &G2_MOVES);
            let got = s.solve_one(&alg, "", 0).expect("G2 word must be DR");
            assert!(got <= 5, "5-move G2 scramble dist > 5");
            let mut st = State::SOLVED;
            for &m in &alg {
                st.apply(m);
            }
            let mut want = 99;
            for dd in 0..=5u32 {
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
        let s = HtrSolver::new();
        let rm = rot_map();

        for seed in 2000..2008u64 {
            let alg = pseudo_word(seed, 18, &G2_MOVES);
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
                    assert!(sol.moves.iter().all(|&m| is_g2(m as usize)), "non-G2 move in sol");
                    let mut buf = conj_buf(&alg, rot, 0);
                    buf.extend_from_slice(&sol.moves);
                    let (c, sp) = s.coords(&buf).expect("sol must stay DR");
                    assert_eq!(s.dist[c * SPLIT + sp], 0, "sol doesn't reach HTR");
                }
            }

            // rot="" 的解做 State 级物理验证(独立谓词)
            let (_, sols) = s.enumerate_face(&alg, "", 0, 5).unwrap();
            for sol in &sols {
                let mut st = State::SOLVED;
                for &m in &alg {
                    st.apply(m);
                }
                for &m in &sol.moves {
                    st.apply(Move::from_index(rm[0][m as usize] as usize));
                }
                assert!(state_htr_done(&st), "HTR not physically reached");
            }
        }

        // 非 DR 输入 → None
        assert!(s.enumerate_face(&string_to_alg("R U F"), "", 0, 5).is_none());
        assert_eq!(s.solve_one(&string_to_alg("R U F"), "", 0), None);
    }
}
