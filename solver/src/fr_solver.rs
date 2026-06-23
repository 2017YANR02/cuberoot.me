//! fr_solver: FR(Floppy Reduction)求解器 = mallard 链 HTR(G3) → FR 阶段。
//!
//! 语义:输入已处于 HTR 态(G3 = ⟨U2,D2,L2,R2,F2,B2⟩ 陪集满足),求降到 FR
//! ——floppy / 2-轴态:某一对面(UD 变体 = U/D)成为「floppy」轴,只剩另外两轴
//! 的半转(+ 该 floppy 轴半转)即可收尾。搜索只允许 G3 的 6 种双转
//! U2 D2 L2 R2 F2 B2(= G3_MOVES),零引擎扩展;与 htr_phase2_solver 同一套
//! 角(Hc=96)/ 棱(6912)闭包 + 6 双转移动表机制。
//!
//! FR 坐标(目标谓词的核心)—— 行为对照 cubelib steps/fr(FRUDWithSliceCoord),
//! 但不照搬其 SIMD;直接用本引擎语义自洽地把 FR 目标定义为:
//!
//!   FR-done(UD 变体)⟺ 当前 G3 态 g 可只用 ⟨R2,L2,F2,B2⟩(U/D 两面不动的
//!   「floppy 收尾」move 集 H)复原 ⟺ g ∈ H 子群。
//!
//! 推论:对 G3 上 6 双转的搜索,把 G3 划成 H 的右陪集 H\G3;两个 G3 态 FR 等价
//! ⟺ 同一右陪集(g1·g2⁻¹ ∈ H)。FR 坐标 = 右陪集 H·g 的紧凑编号,goal = 编号 0
//! (= H 本身)。该陪集空间从 SOLVED 出发用 6 双转 BFS 现场枚举,陪集规范代表用
//! 「H·g 的最小成员 key」(|H| 较小,枚举可承受);对陪集编号建 6 双转移动表 +
//! u8 精确距离表(自 0 正向 BFS,6 双转自逆 ⇒ 距离即步数)。
//!
//! 这一构造对「目标」无任何来自坐标内部位运算的循环依赖:goal 集 = H 闭包,
//! 测试侧用完全独立的 State 级 ⟨R2,L2,F2,B2⟩ BFS 判定 fr_done,与 enumerate 解
//! 物理回放对照(见 #[cfg(test)])。
//!
//! 视角:UD 变体用 rot=""(U/D floppy);FB / LR 变体经 X / Z 预旋转(同 htr 的
//! 各面 rot)归约到 UD 坐标——本引擎里直接对不同 rot 串走同一 UD 坐标即可
//! (rot 把目标面对换到 U/D)。FR 目标(陪集 0)对 y 不变(H 含 U2/D2 且对 y
//! 共轭封闭),只算 yk=0;对面同轴(z0≡z2)。非 HTR 输入返回 None(对应 wasm
//! u32::MAX 哨兵)。

use std::collections::HashMap;

use crate::cube_common::{valid_moves, Move, State};
use crate::htr_solver::G3_MOVES;
use crate::roux_s1_solver::{conj_buf, S1Sol};

/// Hc 角置换个数(6 双转角闭包),与 htr_phase2_solver 一致。
pub const HC: usize = 96;
/// G3 棱排列个数(三轨道偶约束),与 htr_phase2_solver 一致。
pub const EDGES: usize = 6912;
/// 联合 G3 态空间 = |G3|。
pub const G3_STATES: usize = HC * EDGES;

/// FR floppy 收尾 move 集(UD 变体):U/D 两面不动的 4 个半转。
/// 这 4 个生成的子群 H,其闭包 = FR 目标集。
pub const FR_FINISH_MOVES: [u8; 4] = [7, 10, 13, 16]; // L2 R2 F2 B2

#[inline]
fn is_g3(m: usize) -> bool {
    matches!(m, 1 | 4 | 7 | 10 | 13 | 16)
}

/// State 的 20 字节 key(corners 8 | edges 12)。
#[inline]
fn key_of(st: &State) -> [u8; 20] {
    let mut k = [0u8; 20];
    k[..8].copy_from_slice(&st.corners);
    k[8..].copy_from_slice(&st.edges);
    k
}

/// 从 SOLVED 用给定 move 池 BFS,返回可达 State 全集。
fn group_closure(pool: &[u8]) -> Vec<State> {
    let mut seen: HashMap<[u8; 20], ()> = HashMap::new();
    seen.insert(key_of(&State::SOLVED), ());
    let mut frontier = vec![State::SOLVED];
    let mut all = vec![State::SOLVED];
    while !frontier.is_empty() {
        let mut next = Vec::new();
        for st in &frontier {
            for &m in pool {
                let ns = st.applied(Move::from_index(m as usize));
                if let std::collections::hash_map::Entry::Vacant(e) = seen.entry(key_of(&ns)) {
                    e.insert(());
                    next.push(ns);
                    all.push(ns);
                }
            }
        }
        frontier = next;
    }
    all
}

pub struct FrSolver {
    /// H 子群成员的 cp(角置换)集合 —— 仅作 HTR/坐标合法性校验提示用。
    /// 陪集移动表 cosets×6(列 = G3_MOVES 序)。
    mt: Vec<u32>,
    /// 陪集空间精确距离,idx = 陪集编号。
    dist: Vec<u8>,
    /// H 子群成员(corners|edges key)→ 其在 H 闭包里的序号(陪集规范化用)。
    h_members: Vec<State>,
    /// G3 态 corners|edges key → 陪集编号(坐标提取用);非 G3 → 不在表里。
    coset_id: HashMap<[u8; 20], u32>,
}

impl Default for FrSolver {
    fn default() -> Self {
        Self::new()
    }
}

impl FrSolver {
    /// 全自包含构造(native/wasm 同路径,陪集表现场 BFS)。
    pub fn new() -> Self {
        // 1) H = ⟨L2,R2,F2,B2⟩ 闭包(FR 目标集 / 陪集 0 的成员)。
        let h_members = group_closure(&FR_FINISH_MOVES);

        // 陪集规范代表:H·g 的最小 key。预取 H 的逆元乘子。
        // H·g = { h·g : h ∈ H };key 走 State 层 compose(h, g)。
        let canon = |g: &State, h_members: &[State]| -> [u8; 20] {
            let mut best = [u8::MAX; 20];
            for h in h_members {
                let hg = h.compose(g);
                let k = key_of(&hg);
                if k < best {
                    best = k;
                }
            }
            best
        };

        // 2) 陪集空间 BFS:从 SOLVED 的陪集(= H,canon = SOLVED 所在陪集最小 key)
        //    出发,用 6 双转扩张,陪集编号 + 移动表 + 距离一次性现场建。
        let mut coset_canon: HashMap<[u8; 20], u32> = HashMap::new();
        let mut coset_rep: Vec<State> = Vec::new(); // 编号 → 一个代表 State(走 move 用)
        let mut dist: Vec<u8> = Vec::new();
        let mut mt: Vec<u32> = Vec::new();

        let c0 = canon(&State::SOLVED, &h_members);
        coset_canon.insert(c0, 0);
        coset_rep.push(State::SOLVED);
        dist.push(0);
        mt.extend_from_slice(&[u32::MAX; 6]);

        let mut frontier: Vec<u32> = vec![0];
        let mut d = 0u8;
        while !frontier.is_empty() {
            let mut next = Vec::new();
            for &ci in &frontier {
                let rep = coset_rep[ci as usize];
                for (col, &m) in G3_MOVES.iter().enumerate() {
                    let ns = rep.applied(Move::from_index(m as usize));
                    let ck = canon(&ns, &h_members);
                    let nci = match coset_canon.get(&ck) {
                        Some(&id) => id,
                        None => {
                            let id = coset_rep.len() as u32;
                            coset_canon.insert(ck, id);
                            coset_rep.push(ns);
                            dist.push(d + 1);
                            mt.extend_from_slice(&[u32::MAX; 6]);
                            next.push(id);
                            id
                        }
                    };
                    mt[ci as usize * 6 + col] = nci;
                }
            }
            d += 1;
            frontier = next;
        }

        // 3) 把每个 G3 态映射到陪集编号(坐标提取查表用)。遍历 G3 全闭包。
        let g3 = group_closure(&G3_MOVES);
        let mut coset_id: HashMap<[u8; 20], u32> = HashMap::with_capacity(g3.len());
        for g in &g3 {
            let ck = canon(g, &h_members);
            let id = *coset_canon.get(&ck).expect("G3 state coset missing");
            coset_id.insert(key_of(g), id);
        }

        FrSolver { mt, dist, h_members, coset_id }
    }

    /// 陪集数(= 距离表长度,= |G3|/|H|)。
    pub fn coset_count(&self) -> usize {
        self.dist.len()
    }

    /// FR 子群 H 的阶。
    pub fn h_size(&self) -> usize {
        self.h_members.len()
    }

    /// 距离表最大深度(FR God's number,FR 坐标空间上的)。
    pub fn max_depth(&self) -> u8 {
        self.dist.iter().copied().max().unwrap_or(0)
    }

    /// HTR 检查 + FR 坐标(陪集编号)提取(规范帧 State)。非 HTR → None。
    fn state_coord(&self, st: &State) -> Option<usize> {
        let (_, co) = st.cp_co();
        let (_, eo) = st.ep_eo();
        if co.iter().any(|&v| v != 0) || eo.iter().any(|&v| v != 0) {
            return None;
        }
        self.coset_id.get(&key_of(st)).map(|&id| id as usize)
    }

    /// 从 SOLVED 走 buf 后提取坐标;非 HTR → None。
    fn coord(&self, buf: &[u8]) -> Option<usize> {
        let mut st = State::SOLVED;
        for &m in buf {
            st.apply(Move::from_index(m as usize));
        }
        self.state_coord(&st)
    }

    /// 该 (视角, yk) 下是否处于 HTR(FR 求解的前置条件)。
    pub fn is_fr(&self, alg: &[Move], rot: &str, yk: usize) -> bool {
        self.coord(&conj_buf(alg, rot, yk)).is_some()
    }

    /// 单 (视角, yk) 最优步数(精确表直查);该视角非 HTR → None。
    pub fn solve_one(&self, alg: &[Move], rot: &str, yk: usize) -> Option<u32> {
        let c = self.coord(&conj_buf(alg, rot, yk))?;
        Some(self.dist[c] as u32)
    }

    /// 单视角:FR 目标对 y 不变,只算 yk=0。
    pub fn solve_face(&self, alg: &[Move], rot: &str) -> Option<u32> {
        self.solve_one(alg, rot, 0)
    }

    /// 各视角统计(同 HtrPhase2Solver::get_stats 形状);该视角非 HTR → None。
    pub fn get_stats(&self, alg: &[Move], rots: &[&str]) -> Vec<Option<u32>> {
        rots.iter().map(|r| self.solve_face(alg, r)).collect()
    }

    /// 整轮 solve:6 视角(ROTS6),非 HTR 视角 = u32::MAX 哨兵。
    pub fn solve(&self, alg: &[Move]) -> Vec<u32> {
        crate::block222_solver::ROTS6
            .iter()
            .map(|r| self.solve_face(alg, r).unwrap_or(u32::MAX))
            .collect()
    }

    /// 走一个陪集编号 + col 得新编号(供 enum)。
    #[inline]
    fn step(&self, c: usize, col: usize) -> usize {
        self.mt[c * 6 + col] as usize
    }

    /// 枚举恰好 depth 步的解(只走 6 双转)。
    #[allow(clippy::too_many_arguments)]
    fn enum_paths(
        &self,
        c: usize,
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
            let nc = self.step(c, col);
            let h = self.dist[nc] as u32;
            if h >= depth {
                continue;
            }
            path.push(m as u8);
            if depth == 1 {
                out.push(path.clone());
            } else if h > 0 {
                // h==0 且 depth>1:已解却还要再走 depth-1 步 → 更短解 + 无效尾动,跳过。
                self.enum_paths(nc, depth - 1, m as u8, path, out, cap);
            }
            path.pop();
        }
    }

    /// 单视角多解(yk=0,FR 目标对 y 不变):预算 = 最优 + extra,cap 截断;
    /// 该视角非 HTR → None。
    pub fn enumerate_face(
        &self,
        alg: &[Move],
        rot: &str,
        extra: u32,
        cap: usize,
    ) -> Option<(u32, Vec<S1Sol>)> {
        let c = self.coord(&conj_buf(alg, rot, 0))?;
        let best = self.dist[c] as u32;
        let mut sols: Vec<S1Sol> = Vec::new();
        if best == 0 {
            return Some((0, sols));
        }
        let mut out = Vec::new();
        let mut path = Vec::new();
        for d in best..=(best + extra) {
            self.enum_paths(c, d, 18, &mut path, &mut out, cap);
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
    use crate::htr_phase2_solver::HtrPhase2Solver;
    use crate::roux_s1_solver::tests::pseudo_scramble;
    use std::collections::{HashMap, HashSet};
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

    fn key_of_st(st: &State) -> [u8; 20] {
        let mut k = [0u8; 20];
        k[..8].copy_from_slice(&st.corners);
        k[8..].copy_from_slice(&st.edges);
        k
    }

    // ---------- 独立结构推导(State 级,绕开 solver 内部陪集编码) ----------

    /// State 级 G3 闭包(从 SOLVED 用 6 个半转 BFS,全 663,552 元素)。
    fn g3_closure() -> &'static Vec<State> {
        static V: OnceLock<Vec<State>> = OnceLock::new();
        V.get_or_init(|| {
            let mut seen: HashSet<[u8; 20]> = HashSet::new();
            seen.insert(key_of_st(&State::SOLVED));
            let mut frontier = vec![State::SOLVED];
            let mut all = vec![State::SOLVED];
            while !frontier.is_empty() {
                let mut next = Vec::new();
                for st in &frontier {
                    for &m in &G3_MOVES {
                        let ns = st.applied(Move::from_index(m as usize));
                        if seen.insert(key_of_st(&ns)) {
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

    /// **独立** FR 目标谓词(完全不用 solver 的陪集坐标):
    /// fr_done(st) ⟺ st 可只用 ⟨L2,R2,F2,B2⟩(U/D 不动)复原 ⟺ st ∈ H 闭包。
    /// H 闭包用独立的 State 级 BFS 现算(与 solver 的 group_closure 是不同代码路径,
    /// 但即便相同,这里作金标准是「state ∈ H」的直接定义,无坐标位运算参与)。
    fn h_set() -> &'static HashSet<[u8; 20]> {
        static V: OnceLock<HashSet<[u8; 20]>> = OnceLock::new();
        V.get_or_init(|| {
            let mut seen: HashSet<[u8; 20]> = HashSet::new();
            seen.insert(key_of_st(&State::SOLVED));
            let mut frontier = vec![State::SOLVED];
            while !frontier.is_empty() {
                let mut next = Vec::new();
                for st in &frontier {
                    for &m in &FR_FINISH_MOVES {
                        let ns = st.applied(Move::from_index(m as usize));
                        if seen.insert(key_of_st(&ns)) {
                            next.push(ns);
                        }
                    }
                }
                frontier = next;
            }
            seen
        })
    }

    fn fr_done(st: &State) -> bool {
        h_set().contains(&key_of_st(st))
    }

    // ===================================================================
    //  独立 FB/LR 视角金标准(mallard P1b) —— 闭合「reframing 未验证」缺口。
    //
    //  现状(a37f2c910):fr_golden_independent_brute_force 只对 rot∈["","z2"]
    //  (UD / z2-不变路径)独立核对距离值 + 只物理回放 rot=""。FB/LR(x/z 系)
    //  视角的 FR 距离「值」从未被任何独立预言机验证——只有 is_fr 布尔被查。
    //  FR 目标 H_UD=⟨F2,B2,L2,R2⟩ 仅 y / z2 不变(不像 htr2 全对称解态那样对
    //  x/z 不变),故 x/z(FB/LR)视角给出真正不同的距离,reframing/轴 bug 会漏检。
    //
    //  下面的预言机:(1) 在 HOME 帧独立建三套 floppy 收尾子群 H_UD/H_FB/H_LR
    //  (各自纯 State 级 4-双转 BFS 闭包,无陪集坐标、无旋转代码);(2) 由「距离
    //  到该 floppy 态 == 0 ⟺ 输入 ∈ 该 H」自证哪个 rot 对应哪条轴;(3) 对每条轴
    //  独立 6-双转全空间 BFS(以整 H 为种子),逐态对照 solver 的对应视角距离;
    //  (4) 物理回放:取 FB / LR 视角 enumerate_face 解,用本测试自建(不调
    //  alg_rotation / rot_map / conj_buf)的逆向 face-relabel 把解 move 映回
    //  HOME 帧物理施于输入态,断言落入 H_FB / H_LR ——reframing 有 bug 必落空。
    // ===================================================================

    /// FB floppy 收尾子群 H_FB = ⟨U2,D2,L2,R2⟩(F/B 不动)的 State 级闭包成员集。
    fn h_fb_set() -> &'static HashSet<[u8; 20]> {
        static V: OnceLock<HashSet<[u8; 20]>> = OnceLock::new();
        V.get_or_init(|| state_subgroup_closure(&[1, 4, 7, 10])) // U2 D2 L2 R2
    }

    /// LR floppy 收尾子群 H_LR = ⟨U2,D2,F2,B2⟩(L/R 不动)的 State 级闭包成员集。
    fn h_lr_set() -> &'static HashSet<[u8; 20]> {
        static V: OnceLock<HashSet<[u8; 20]>> = OnceLock::new();
        V.get_or_init(|| state_subgroup_closure(&[1, 4, 13, 16])) // U2 D2 F2 B2
    }

    /// 纯 State 级:从 SOLVED 用给定双转 BFS,返回闭包成员 key 集(独立,无坐标/无旋转)。
    fn state_subgroup_closure(gens: &[u8]) -> HashSet<[u8; 20]> {
        let mut seen: HashSet<[u8; 20]> = HashSet::new();
        seen.insert(key_of_st(&State::SOLVED));
        let mut frontier = vec![State::SOLVED];
        while !frontier.is_empty() {
            let mut next = Vec::new();
            for st in &frontier {
                for &m in gens {
                    let ns = st.applied(Move::from_index(m as usize));
                    if seen.insert(key_of_st(&ns)) {
                        next.push(ns);
                    }
                }
            }
            frontier = next;
        }
        seen
    }

    /// 独立 6-双转全空间 BFS:以整个 H 为距离 0 种子,返回每个 G3 态 key → 该轴 FR 距离。
    /// 与 solver 的陪集表完全不同代码路径,纯 State 20-byte 成员。
    fn axis_brute_dist(h: &HashSet<[u8; 20]>) -> HashMap<[u8; 20], u8> {
        let mut bdist: HashMap<[u8; 20], u8> = HashMap::with_capacity(700_000);
        let mut frontier: Vec<State> = Vec::new();
        for &k in h {
            bdist.insert(k, 0);
            frontier.push(state_from_key(&k));
        }
        let mut d = 0u8;
        while !frontier.is_empty() {
            let mut next = Vec::new();
            for st in &frontier {
                for &m in &G3_MOVES {
                    let ns = st.applied(Move::from_index(m as usize));
                    let k = key_of_st(&ns);
                    if let std::collections::hash_map::Entry::Vacant(e) = bdist.entry(k) {
                        e.insert(d + 1);
                        next.push(ns);
                    }
                }
            }
            d += 1;
            frontier = next;
        }
        bdist
    }

    fn state_from_key(k: &[u8; 20]) -> State {
        let mut corners = [0u8; 8];
        let mut edges = [0u8; 12];
        corners.copy_from_slice(&k[..8]);
        edges.copy_from_slice(&k[8..]);
        State { corners, edges }
    }

    /// 本测试**自建**的旋转 face-relabel(独立于 solver 的 alg_rotation)。
    /// 返回 6 元 face 置换 f:原 move 的 type t → f[t](type 序 U,D,L,R,F,B = 0..6)。
    /// 数值与几何旋转一致:对解 move 取逆置换即可把「rot 帧」解映回 HOME 帧物理 move。
    fn rot_face_perm(rot: &str) -> [u8; 6] {
        // 单 rotation token 的 face 置换(独立手写,与 cube_common::alg_rotation 同几何)。
        let single = |t: &str| -> [u8; 6] {
            match t {
                "x" => [5, 4, 2, 3, 0, 1],
                "x2" => [1, 0, 2, 3, 5, 4],
                "x'" => [4, 5, 2, 3, 1, 0],
                "y" => [0, 1, 5, 4, 2, 3],
                "y2" => [0, 1, 3, 2, 5, 4],
                "y'" => [0, 1, 4, 5, 3, 2],
                "z" => [3, 2, 0, 1, 4, 5],
                "z2" => [1, 0, 3, 2, 4, 5],
                "z'" => [2, 3, 1, 0, 4, 5],
                _ => [0, 1, 2, 3, 4, 5],
            }
        };
        let mut f = [0u8, 1, 2, 3, 4, 5];
        for tok in rot.split_whitespace() {
            let g = single(tok);
            // 复合:新 f'[t] = g[f[t]](先 f 再 g,顺序与逐 token relabel 一致)。
            let mut nf = [0u8; 6];
            for t in 0..6 {
                nf[t] = g[f[t] as usize];
            }
            f = nf;
        }
        f
    }

    /// face 置换的逆。
    fn inv_face_perm(f: &[u8; 6]) -> [u8; 6] {
        let mut inv = [0u8; 6];
        for t in 0..6 {
            inv[f[t] as usize] = t as u8;
        }
        inv
    }

    /// 用 face 置换把单 move 重标(type t → fp[t],power 不变)。独立,不调 alg_convert_rotation。
    fn relabel_move(m: u8, fp: &[u8; 6]) -> u8 {
        let t = (m / 3) as usize;
        let p = m % 3;
        3 * fp[t] + p
    }

    /// **金标准(非循环)— FB / LR 视角 FR 距离 + 物理回放**。
    ///
    /// 不复用 solver 的陪集坐标(距离对照走独立 6-双转 BFS),也不复用 solver 的
    /// rotation/reframing 代码判定回放结果(H_FB/H_LR 成员判定 + 本测试自建逆 relabel)。
    #[test]
    fn fr_fb_lr_independent_oracle() {
        let s = FrSolver::new();

        // ---- 0) 轴↔rot 自证:某视角到其 floppy 态距离 == 0 ⟺ 输入 ∈ 该 H。----
        // ROTS6 = ["", "z2", "z'", "z", "x'", "x"];本测试需独立确认 x/z 系归属哪条轴。
        let h_ud = h_set();
        let h_fb = h_fb_set();
        let h_lr = h_lr_set();
        // 三套 H 互不同(否则下面的区分无意义),且都是 ⟨4 双转⟩ floppy 子群(阶 192)。
        assert_eq!(h_ud.len(), 192, "|H_UD| changed");
        assert_eq!(h_fb.len(), 192, "|H_FB| changed");
        assert_eq!(h_lr.len(), 192, "|H_LR| changed");
        assert_ne!(h_ud, h_fb, "H_UD == H_FB?!");
        assert_ne!(h_ud, h_lr, "H_UD == H_LR?!");
        assert_ne!(h_fb, h_lr, "H_FB == H_LR?!");

        // 取若干 HTR fixture(G3 词),按其在三套 H 的成员资格自证 rot 归属。
        // 规则:某 rot 视角 dist==0 当且仅当 HOME 态 ∈ 该轴 H,则该 rot 对应该轴。
        let classify = |alg: &[Move]| -> (State, bool, bool, bool) {
            let mut st = State::SOLVED;
            for &m in alg {
                st.apply(m);
            }
            let k = key_of_st(&st);
            (st, h_ud.contains(&k), h_fb.contains(&k), h_lr.contains(&k))
        };
        // 对每个 ROTS6 索引,统计「视角 dist==0」与「∈H_axis」是否对每条轴一致。
        // 找出每个 rot 唯一匹配的轴(三套 H 各不同 ⇒ 唯一)。
        let mut axis_of_rot: [Option<&str>; 6] = [None; 6]; // "UD"/"FB"/"LR"
        for (ri, rot) in ROTS6.iter().enumerate() {
            // 收集足够多 fixture 区分:既要有 ∈ 又要有 ∉ 该 H 的样本。
            let mut ok_ud = true;
            let mut ok_fb = true;
            let mut ok_lr = true;
            for seed in 0..200u64 {
                // 多样 fixture:有的就在某 H 里(短词),有的不在。
                let alg = pseudo_word(9000 + seed, (seed % 6) as usize, &G3_MOVES);
                let d0 = s.solve_one(&alg, rot, 0);
                assert!(d0.is_some(), "G3 fixture must be HTR rot={}", rot);
                let zero = d0.unwrap() == 0;
                let (_, in_ud, in_fb, in_lr) = classify(&alg);
                if zero != in_ud {
                    ok_ud = false;
                }
                if zero != in_fb {
                    ok_fb = false;
                }
                if zero != in_lr {
                    ok_lr = false;
                }
            }
            let matches: Vec<&str> = [("UD", ok_ud), ("FB", ok_fb), ("LR", ok_lr)]
                .iter()
                .filter(|(_, ok)| *ok)
                .map(|(n, _)| *n)
                .collect();
            assert_eq!(
                matches.len(),
                1,
                "rot {} (idx {}) must map to exactly one axis, got {:?}",
                rot,
                ri,
                matches
            );
            axis_of_rot[ri] = Some(matches[0]);
        }
        // 锁基线:派生的轴归属(同时也是「reframing 把哪条物理轴搬到 UD 坐标」的真值)。
        let labels: Vec<&str> = axis_of_rot.iter().map(|a| a.unwrap()).collect();
        assert_eq!(
            labels,
            vec!["UD", "UD", "LR", "LR", "FB", "FB"],
            "ROTS6 axis mapping changed (reframing semantics drift!)"
        );

        // ---- 1) FB / LR 各一条全空间独立 BFS(以整 H 为种子,663,552 态)。----
        // 代表 rot:FB → "x"(idx5);LR → "z"(idx3)。
        let fb_rot = ROTS6[5]; // "x"
        let lr_rot = ROTS6[3]; // "z"
        assert_eq!(axis_of_rot[5], Some("FB"));
        assert_eq!(axis_of_rot[3], Some("LR"));

        let bdist_fb = axis_brute_dist(h_fb);
        let bdist_lr = axis_brute_dist(h_lr);
        assert_eq!(bdist_fb.len(), G3_STATES, "FB brute space != |G3|");
        assert_eq!(bdist_lr.len(), G3_STATES, "LR brute space != |G3|");

        // 全空间一致性:零距离集恰为对应 H。
        assert_eq!(
            bdist_fb.values().filter(|&&v| v == 0).count(),
            h_fb.len(),
            "FB zero set != H_FB"
        );
        assert_eq!(
            bdist_lr.values().filter(|&&v| v == 0).count(),
            h_lr.len(),
            "LR zero set != H_LR"
        );

        // 大量随机 G3 词:HOME 态 = walk(alg);solver 该视角距离 == 独立 BFS[HOME 态]。
        for seed in 0..600u64 {
            let alg = pseudo_word(20_000 + seed, 16, &G3_MOVES);
            let mut st = State::SOLVED;
            for &m in &alg {
                st.apply(m);
            }
            let k = key_of_st(&st);

            let d_fb = s.solve_one(&alg, fb_rot, 0).expect("HTR (FB)");
            assert_eq!(
                d_fb, bdist_fb[&k] as u32,
                "FB view dist mismatch seed={} (solver {} vs indep {})",
                seed, d_fb, bdist_fb[&k]
            );
            let d_lr = s.solve_one(&alg, lr_rot, 0).expect("HTR (LR)");
            assert_eq!(
                d_lr, bdist_lr[&k] as u32,
                "LR view dist mismatch seed={} (solver {} vs indep {})",
                seed, d_lr, bdist_lr[&k]
            );

            // 跨索引一致性:同轴的两个 rot 必给同距离(z' 与 z 同 LR;x' 与 x 同 FB)。
            assert_eq!(
                s.solve_one(&alg, ROTS6[2], 0),
                s.solve_one(&alg, ROTS6[3], 0),
                "LR two-rot disagree seed={}",
                seed
            );
            assert_eq!(
                s.solve_one(&alg, ROTS6[4], 0),
                s.solve_one(&alg, ROTS6[5], 0),
                "FB two-rot disagree seed={}",
                seed
            );
        }

        // ---- 3) 物理回放(关键反 reframing 检查)。----
        // 取 FB / LR 视角 enumerate_face 解,用本测试自建的逆 face-relabel 把解 move 映回
        // HOME 帧物理 move,施于输入态,断言落入 H_FB / H_LR(独立成员判定,不调 solver coord)。
        // 自建逆 relabel 几何须先自证 == solver 的 conj 帧效果(对 alg 端):
        for (rot, h, bdist, axis) in [
            (fb_rot, h_fb, &bdist_fb, "FB"),
            (lr_rot, h_lr, &bdist_lr, "LR"),
        ] {
            let fp = rot_face_perm(rot);
            let inv = inv_face_perm(&fp);

            for seed in 0..40u64 {
                let alg = pseudo_word(30_000 + seed, 14, &G3_MOVES);

                // HOME 态。
                let mut st_home = State::SOLVED;
                for &m in &alg {
                    st_home.apply(m);
                }
                let best_indep = bdist[&key_of_st(&st_home)] as u32;

                let (best, sols) = s.enumerate_face(&alg, rot, 1, 24).unwrap();
                assert_eq!(
                    best, best_indep,
                    "{} best != independent min seed={}",
                    axis, seed
                );
                // best 也须 == solve_one(独立查表一致)。
                assert_eq!(best, s.solve_one(&alg, rot, 0).unwrap());

                if best == 0 {
                    assert!(sols.is_empty(), "{} best==0 → no enumerated sol", axis);
                    assert!(h.contains(&key_of_st(&st_home)), "{} best==0 ∉ H", axis);
                    continue;
                }
                assert!(!sols.is_empty(), "{} no sols seed={}", axis, seed);
                assert!(sols.iter().any(|x| x.len == best), "{} optimal missing", axis);

                for sol in &sols {
                    assert!(sol.len >= best && sol.len <= best + 1, "{} budget", axis);
                    assert!(
                        sol.moves.iter().all(|&m| is_g3(m as usize)),
                        "{} non-G3 move",
                        axis
                    );
                    // 物理回放:解 move(在 rot 视角帧)→ 逆 relabel → HOME 帧物理 move,
                    // 施于 HOME 态,独立断言 ∈ 该轴 H。reframing/轴 bug 会令此处落空。
                    let mut st = st_home;
                    for &m in &sol.moves {
                        let pm = relabel_move(m, &inv);
                        assert!(is_g3(pm as usize), "{} relabeled non-G3", axis);
                        st.apply(Move::from_index(pm as usize));
                    }
                    assert!(
                        h.contains(&key_of_st(&st)),
                        "{} replayed sol does NOT land in H_{} (reframing bug!) seed={}",
                        axis,
                        axis,
                        seed
                    );
                    // 步数也独立核对:回放后 HOME 态距该轴 floppy = 0(已在 H)。
                    assert_eq!(bdist[&key_of_st(&st)], 0, "{} replayed dist != 0", axis);
                }
            }
        }

        // ---- 4) 自证逆 relabel 正确:对 alg 做 (rot 帧) 等价 ⟺ solver conj_buf。----
        // 这是把「自建逆 relabel」与 solver reframing 对接的桥;若不等,上面的回放
        // 几何前提就站不住。用 solver 公开的 solve_one(经 conj_buf)与「自建 fp 重标
        // 后从 SOLVED 走、再判该轴 H」对照,确保两条路径同义(但成员判定仍独立)。
        for (rot, h, axis) in [(fb_rot, h_fb, "FB"), (lr_rot, h_lr, "LR")] {
            let fp = rot_face_perm(rot);
            for seed in 0..60u64 {
                let alg = pseudo_word(40_000 + seed, 13, &G3_MOVES);
                // 自建:把 alg 各 move 用 fp 重标后从 SOLVED 走得 State_relabel。
                let mut st_rl = State::SOLVED;
                for &m in &alg {
                    let rm = relabel_move(m.index() as u8, &fp);
                    st_rl.apply(Move::from_index(rm as usize));
                }
                // solver 视角 dist==0 ⟺ conj_buf(alg,rot,0) 走到的 State ∈ H_UD。
                // 自建路径:relabel 后的 State ∈ H_UD(同一几何),应一致。
                let solver_zero = s.solve_one(&alg, rot, 0).unwrap() == 0;
                let selfbuilt_zero = h_set().contains(&key_of_st(&st_rl));
                assert_eq!(
                    solver_zero, selfbuilt_zero,
                    "{} self-built relabel disagrees with solver conj frame seed={}",
                    axis, seed
                );
                // 并且:HOME 态 ∈ 该轴 H ⟺ relabel 态 ∈ H_UD(轴↔UD 的几何对应)。
                let mut st_home = State::SOLVED;
                for &m in &alg {
                    st_home.apply(m);
                }
                assert_eq!(
                    h.contains(&key_of_st(&st_home)),
                    h_set().contains(&key_of_st(&st_rl)),
                    "{} axis-H vs relabeled-H_UD disagree seed={}",
                    axis,
                    seed
                );
            }
        }
    }

    /// 复用闭包尺寸断言(锁住与 htr2 共享的 Hc / G3-edge 机制)。
    #[test]
    fn fr_reused_closure_sizes() {
        // 复用 htr_phase2_solver 的 96 / 6912 闭包常量,且其 solver 现场表尺寸一致。
        assert_eq!(HC, 96);
        assert_eq!(EDGES, 6912);
        assert_eq!(G3_STATES, 663_552);
        let h = HtrPhase2Solver::new();
        // htr2 角表 96 行、棱表 6912 行(各 ×6 列)—— 与本模块声明一致。
        assert_eq!(h.solve_one(&[], "", 0), Some(0)); // sanity:htr2 可构造且 solved=0
        // 直接断言两个闭包群的 State 级大小。
        let hc_cps: HashSet<[u8; 8]> =
            g3_closure().iter().map(|st| st.cp_co().0).collect();
        assert_eq!(hc_cps.len(), HC, "corner closure (Hc) != 96");
        let g3_eps: HashSet<[u8; 12]> =
            g3_closure().iter().map(|st| st.ep_eo().0).collect();
        assert_eq!(g3_eps.len(), EDGES, "G3 edge closure != 6912");
        assert_eq!(g3_closure().len(), G3_STATES);
    }

    /// FR 坐标空间 + BFS 表 max-depth(FR God's number),用 assert_eq! 锁基线。
    #[test]
    fn fr_coord_space_and_god_number() {
        let s = FrSolver::new();

        // 陪集数 = |G3| / |H|;两者都从 State 级闭包独立核对。
        let h = h_set();
        assert_eq!(s.h_size(), h.len(), "H size mismatch vs independent BFS");
        assert_eq!(G3_STATES % s.h_size(), 0, "|G3| not divisible by |H|");
        assert_eq!(
            s.coset_count(),
            G3_STATES / s.h_size(),
            "coset count != |G3|/|H|"
        );
        // 实测基线锁死:|H|=192(=⟨L2,R2,F2,B2⟩ 阶),陪集 3456(=663552/192)。
        assert_eq!(s.h_size(), 192, "FR finish subgroup |H| changed");
        assert_eq!(s.coset_count(), 3456, "FR coordinate space size changed");

        // 距离表全可达 + 唯一目标(陪集 0 = H)。
        assert!(s.dist.iter().all(|&v| v != 255), "unreachable coset");
        assert_eq!(s.dist.iter().filter(|&&v| v == 0).count(), 1, "目标陪集应唯一");

        // 锁基线:观测到的 FR 最大 BFS 深度(FR God's number)。
        let md = s.max_depth();
        assert_eq!(md, FR_GOD_NUMBER, "FR God number changed: observed {}", md);
    }

    /// 实测 FR coord 空间上的 BFS 最大深度(FR God's number),锁死作基线。
    const FR_GOD_NUMBER: u8 = 11;

    /// 子群 / 单 move 基本语义。
    #[test]
    fn fr_basics() {
        let s = FrSolver::new();

        // G3_MOVES = 6 双转,且均自逆。
        let g3_self_inv: Vec<u8> =
            (0..18u8).filter(|&m| is_g3(m as usize) && INV_MOVE[m as usize] == m).collect();
        assert_eq!(g3_self_inv, G3_MOVES.to_vec());

        // FR 目标 move(L2 R2 F2 B2)单步 → 0(已在 H 内)。
        let one = |scr: &str| s.solve_one(&string_to_alg(scr), "", 0);
        assert_eq!(one(""), Some(0));
        assert_eq!(one("L2"), Some(0));
        assert_eq!(one("R2"), Some(0));
        assert_eq!(one("F2"), Some(0));
        assert_eq!(one("B2"), Some(0));
        // U2 / D2 单步:离开 H(U/D 动了)⇒ 距离 1(一步 U2/D2 即回 H)。
        assert_eq!(one("U2"), Some(1));
        assert_eq!(one("D2"), Some(1));
        // 破 HTR 的 quarter turn → None。
        assert_eq!(one("U"), None);
        assert_eq!(one("R'"), None);
        assert_eq!(one("F"), None);

        // 任意 6 双转词 → 仍 HTR,solve_one 给合法步数。
        for seed in 0..30u64 {
            let alg = pseudo_word(seed, 14, &G3_MOVES);
            assert!(s.solve_one(&alg, "", 0).is_some(), "G3 word not HTR");
        }

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

        // is_fr 一致性:任意打乱 × 全 (rot,yk),与 State 级 HTR 判定对照。
        let g3_keys: HashSet<[u8; 20]> =
            g3_closure().iter().map(key_of_st).collect();
        for seed in 0..10u64 {
            let alg = pseudo_scramble(seed, 18);
            for (ri, rot) in ROTS6.iter().enumerate() {
                for k in 0..4 {
                    let buf = conj_buf(&alg, rot, k);
                    let mut st = State::SOLVED;
                    for &m in &buf {
                        st.apply(Move::from_index(m as usize));
                    }
                    let htr = g3_keys.contains(&key_of_st(&st));
                    assert_eq!(
                        s.solve_one(&alg, rot, k).is_some(),
                        htr,
                        "is_fr mismatch seed={} rot={} yk={}",
                        seed,
                        ri,
                        k
                    );
                    assert_eq!(s.is_fr(&alg, rot, k), htr);
                }
            }
        }

        // solve(): 6 视角,非 HTR = u32::MAX。
        let v = s.solve(&pseudo_word(7, 12, &G3_MOVES));
        assert_eq!(v.len(), 6);
        assert!(v.iter().all(|&x| x != u32::MAX), "G3 word: all views HTR");
        let v2 = s.solve(&string_to_alg("R U F"));
        assert!(v2.iter().all(|&x| x == u32::MAX), "non-HTR: all sentinel");
    }

    /// **金标准(非循环)**:用完全独立的 State 级 fr_done(∈⟨L2,R2,F2,B2⟩)
    /// 全空间逐态对照 solver 距离表 + 验证 enumerate 解物理回放到 fr_done。
    #[test]
    fn fr_golden_independent_brute_force() {
        let s = FrSolver::new();

        // (A) 独立全空间 BFS:从 H(fr_done 集)出发用 6 双转扩张,得每个 G3 态
        //     的真实 FR 距离,逐态对照 solver。完全不碰 solver 的陪集坐标。
        let mut bdist: HashMap<[u8; 20], u8> = HashMap::with_capacity(700_000);
        let mut frontier: Vec<State> = Vec::new();
        for &k in h_set() {
            bdist.insert(k, 0);
            let mut corners = [0u8; 8];
            let mut edges = [0u8; 12];
            corners.copy_from_slice(&k[..8]);
            edges.copy_from_slice(&k[8..]);
            frontier.push(State { corners, edges });
        }
        let mut d = 0u8;
        while !frontier.is_empty() {
            let mut next = Vec::new();
            for st in &frontier {
                for &m in &G3_MOVES {
                    let ns = st.applied(Move::from_index(m as usize));
                    let k = key_of_st(&ns);
                    if let std::collections::hash_map::Entry::Vacant(e) = bdist.entry(k) {
                        e.insert(d + 1);
                        next.push(ns);
                    }
                }
            }
            d += 1;
            frontier = next;
        }
        assert_eq!(bdist.len(), G3_STATES, "FR brute space != |G3|");
        assert_eq!(*bdist.values().max().unwrap(), s.max_depth(), "god number mismatch");

        // 逐态:对每个 G3 态,solver.state_coord → dist 必等于独立 BFS 距离;
        // 且 dist==0 ⟺ fr_done(完全独立判定)。
        for (&k, &dv) in &bdist {
            let mut corners = [0u8; 8];
            let mut edges = [0u8; 12];
            corners.copy_from_slice(&k[..8]);
            edges.copy_from_slice(&k[8..]);
            let st = State { corners, edges };
            let c = s.state_coord(&st).expect("G3 state must have FR coord");
            assert_eq!(s.dist[c] as u32, dv as u32, "FR dist mismatch");
            assert_eq!(
                s.dist[c] == 0,
                fr_done(&st),
                "coord==0 must match independent fr_done"
            );
        }

        // (B) enumerate_face 解的物理金标准:对 HTR 态 fixture,每个解的 Vec<Move>
        //     经 State::apply 施于输入态后,fr_done()==true;且 best == 真实最小。
        let rm = rot_map();
        for seed in 0..24u64 {
            // fixture:G3 词(确保是 HTR 态)。
            let alg = pseudo_word(5000 + seed, 14, &G3_MOVES);

            for rot in ["", "z2"] {
                let best_d = s.solve_one(&alg, rot, 0).unwrap();
                let (best, sols) = s.enumerate_face(&alg, rot, 1, 16).unwrap();
                assert_eq!(best, best_d, "best mismatch seed={} rot={}", seed, rot);

                // best 是真实最小:独立 BFS 距离对照(经 conj 帧走到的 State)。
                let buf = conj_buf(&alg, rot, 0);
                let mut st = State::SOLVED;
                for &m in &buf {
                    st.apply(Move::from_index(m as usize));
                }
                assert_eq!(bdist[&key_of_st(&st)] as u32, best, "best != independent min");

                if best == 0 {
                    assert!(sols.is_empty());
                    assert!(fr_done(&st), "best==0 fixture must already be FR-done");
                    continue;
                }
                assert!(!sols.is_empty());
                assert!(sols.iter().any(|x| x.len == best), "optimal missing");
                for sol in &sols {
                    assert!(sol.len >= best && sol.len <= best + 1);
                    assert_eq!(sol.moves.len() as u32, sol.len);
                    assert!(sol.moves.iter().all(|&m| is_g3(m as usize)), "non-G3 move");
                    // 在 conj 帧上把解 move 接到 buf 后,必落 fr_done。
                    let mut st2 = st;
                    for &m in &sol.moves {
                        st2.apply(Move::from_index(m as usize));
                    }
                    assert!(fr_done(&st2), "enumerated sol does not reach FR-done");
                }
            }

            // rot="" 解:从打乱态(rm[0] 帧下)物理回放,独立 fr_done 判定。
            let (_, sols) = s.enumerate_face(&alg, "", 0, 8).unwrap();
            for sol in &sols {
                let mut st = State::SOLVED;
                for &m in &alg {
                    st.apply(m);
                }
                for &m in &sol.moves {
                    st.apply(Move::from_index(rm[0][m as usize] as usize));
                }
                assert!(fr_done(&st), "FR not physically reached (rot=\"\")");
            }
        }

        // 非 HTR 输入 → None。
        assert!(s.enumerate_face(&string_to_alg("R U F"), "", 0, 5).is_none());
        assert_eq!(s.solve_one(&string_to_alg("R U F"), "", 0), None);
    }
}
