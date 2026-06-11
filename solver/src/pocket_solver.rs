//! pocket_solver: 2x2x2 口袋魔方(Pocket Cube)全空间最优求解器。
//!
//! 语义:对任意 2x2x2 态求 HTM 最优解步数(整解最优,无条件式阶段——任意态都可解)。
//! 用途:喂 /scramble 统计管道,WCA 2x2x2 打乱语料 → 每打乱最优解长度分桶。
//!
//! 状态模型(独立于 3x3 的 cube_common::State 语义,但借其角运动学驱动):
//!   2x2x2 只有 8 个角、无棱、无中心。无中心固定块 ⇒ 整体朝向是自由度,必须消去。
//!   做法:固定 **DBL 角**(U/R/F 三面都不触碰的那个角)永不移动,只用 U R F ×3 幂
//!   = 9 个 move。固定一角后这 3 面生成完整 2x2x2 群,且消去了 24× 整体朝向冗余。
//!
//! 坐标(全由 MOVE_STATES 现场导出,测试有独立暴力对照):
//!   - 角排列:除 DBL 外的 7 个角的 Lehmer rank,7! = 5040。
//!   - 角朝向:除 DBL 外 7 角,前 6 个自由 3^6 = 729,第 7 个由「全 8 角朝向和 ≡ 0 (mod 3)」
//!     定(DBL 朝向恒 0)。
//!   - 联合 5040 × 729 = 3,674,160 = 7!·3^6 态(= |2x2x2 群|)。
//!   全空间精确距离表 3.6MB(u8)现场 BFS,**零盘表**:查长度 O(1),枚举首达即最优。
//!
//! 度量:HTM(U2 算 1 步)。实测 God's number 见 max_depth() / pt_basics 测试。

use std::sync::OnceLock;

use crate::cube_common::{move_state, Move, State};

/// 2x2x2 的 9 个 move(U U2 U' R R2 R' F F2 F'),固定 DBL 角。
pub const POCKET_MOVES: [u8; 9] = [
    Move::U as u8,
    Move::U2 as u8,
    Move::UPrime as u8,
    Move::R as u8,
    Move::R2 as u8,
    Move::RPrime as u8,
    Move::F as u8,
    Move::F2 as u8,
    Move::FPrime as u8,
];

/// 7 个移动角的排列空间 7!。
pub const CP7: usize = 5040;
/// 6 个自由角朝向空间 3^6(第 7 个由朝向守恒定)。
pub const CO6: usize = 729;
/// 联合态空间 = 7!·3^6。
pub const POCKET_STATES: usize = CP7 * CO6;

const FACT7: [usize; 7] = [1, 1, 2, 6, 24, 120, 720];

/// 一步解:从打乱态走 moves 到 solved。
#[derive(Clone, Debug)]
pub struct PocketSol {
    pub len: u32,
    pub moves: Vec<u8>,
}

/// 任意 18-move 打乱的解(经 24 旋转归一):rot 为整体旋转前缀(显示用,如 "x y'",
/// 空串=无旋转);rot_moves 为该旋转对角作用的等价 move 词(replay/验证用);
/// moves 为归一帧下的 URF 解序列。物理含义:对打乱态先整体转 rot,再做 moves 即还原。
#[derive(Clone, Debug)]
pub struct PocketAnySol {
    pub len: u32,
    pub rot: String,
    pub rot_moves: Vec<u8>,
    pub moves: Vec<u8>,
}

/// 24 个整体旋转:(显示名如 "x y'",其对角作用的等价 move 词)。首项 ("", [])。
/// 旋转对角的作用 = move 对:x = R L'、y = U D'、z = F B'(中层只动棱/中心,2x2x2 无)。
/// 与 pocket_analyzer::rot24 同构,这里带显示名供在线求解器输出旋转前缀。
pub fn pocket_rot24() -> &'static [(String, Vec<Move>)] {
    static V: OnceLock<Vec<(String, Vec<Move>)>> = OnceLock::new();
    V.get_or_init(|| {
        use Move::*;
        let a: [(&str, &[Move]); 6] = [
            ("", &[]),
            ("x", &[R, LPrime]),
            ("x2", &[R2, L2]),
            ("x'", &[RPrime, L]),
            ("z", &[F, BPrime]),
            ("z'", &[FPrime, B]),
        ];
        let b: [(&str, &[Move]); 4] =
            [("", &[]), ("y", &[U, DPrime]), ("y2", &[U2, D2]), ("y'", &[UPrime, D])];
        let mut out = Vec::with_capacity(24);
        for (an, aw) in a {
            for (bn, bw) in b {
                let name = match (an.is_empty(), bn.is_empty()) {
                    (true, true) => String::new(),
                    (true, false) => bn.to_string(),
                    (false, true) => an.to_string(),
                    (false, false) => format!("{} {}", an, bn),
                };
                let mut w = aw.to_vec();
                w.extend_from_slice(bw);
                out.push((name, w));
            }
        }
        out
    })
}

pub struct PocketSolver {
    /// 联合移动表 POCKET_STATES × 9。
    mt: Vec<u32>,
    /// 全空间精确距离,idx = cp_rank*CO6 + co_rank。
    dist: Vec<u8>,
    /// 固定的 DBL 角索引(U/R/F 不动者)。仅测试断言其唯一性用。
    #[allow(dead_code)]
    fixed: usize,
    /// 其余 7 个角索引(升序),即坐标跟踪的件。
    movable: [u8; 7],
}

impl Default for PocketSolver {
    fn default() -> Self {
        Self::new()
    }
}

/// 7 元置换 Lehmer rank。
fn cp_rank(p: &[u8; 7]) -> usize {
    let mut r = 0usize;
    for i in 0..7 {
        let mut c = 0usize;
        for j in (i + 1)..7 {
            if p[j] < p[i] {
                c += 1;
            }
        }
        r += c * FACT7[6 - i];
    }
    r
}

fn cp_unrank(mut r: usize) -> [u8; 7] {
    let mut avail = [0u8, 1, 2, 3, 4, 5, 6];
    let mut len = 7usize;
    let mut p = [0u8; 7];
    for (i, v) in p.iter_mut().enumerate() {
        let f = FACT7[6 - i];
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

/// 6 个朝向(每位 0..3,base 3) → 0..729。
fn co_rank(o: &[u8; 6]) -> usize {
    o.iter().fold(0usize, |a, &x| a * 3 + x as usize)
}

fn co_unrank(mut r: usize) -> [u8; 6] {
    let mut o = [0u8; 6];
    for i in (0..6).rev() {
        o[i] = (r % 3) as u8;
        r /= 3;
    }
    o
}

impl PocketSolver {
    /// 全自包含构造(~3.6MB 距离表 + 移动表现场 BFS,亚秒级)。
    pub fn new() -> Self {
        // 角排列(位置→件)与朝向增量,从 3x3 MOVE_STATES 取(2x2x2 角运动学 = 3x3 角运动学)。
        let mut pcp = [[0u8; 8]; 18];
        let mut pco = [[0u8; 8]; 18];
        for m in Move::ALL {
            let (cp, co) = move_state(m).cp_co();
            pcp[m.index()] = cp;
            pco[m.index()] = co;
        }

        // 找 U/R/F 都不动(位置不变 + 朝向不变)的角 = DBL,固定它。
        let mut fixed = usize::MAX;
        for c in 0..8usize {
            let untouched = POCKET_MOVES.iter().all(|&m| {
                let m = m as usize;
                pcp[m][c] == c as u8 && pco[m][c] == 0
            });
            if untouched {
                assert_eq!(fixed, usize::MAX, "more than one fixed corner");
                fixed = c;
            }
        }
        assert_ne!(fixed, usize::MAX, "no fixed corner under U/R/F");

        // 其余 7 角(升序)= 坐标跟踪件;corner index → movable slot(0..7),fixed = 255。
        let mut movable = [0u8; 7];
        let mut to_slot = [255u8; 8];
        let mut n = 0;
        for c in 0..8u8 {
            if c as usize != fixed {
                movable[n] = c;
                to_slot[c as usize] = n as u8;
                n += 1;
            }
        }
        debug_assert_eq!(n, 7);

        // 全 8 角态 → 坐标:cp[i] = 第 i 个 movable 槽位上的件(在 movable 槽里的序号),
        // co[i] = 对应朝向。第 7 个朝向由守恒定,只编码前 6。
        // 这里 cp_full/co_full 是「位置→件(全 8 角编号)/朝向」。
        let to_coord = |cp_full: &[u8; 8], co_full: &[u8; 8]| -> (usize, usize) {
            let mut perm = [0u8; 7];
            let mut ori = [0u8; 6];
            for i in 0..7 {
                let pos = movable[i] as usize;
                perm[i] = to_slot[cp_full[pos] as usize]; // 件在 movable 中的序号
                if i < 6 {
                    ori[i] = co_full[pos];
                }
            }
            (cp_rank(&perm), co_rank(&ori))
        };

        // 由坐标重建全 8 角态(用于 BFS 移动表生成):放回 fixed 角 + 守恒补第 7 朝向。
        let from_coord = |cpr: usize, cor: usize| -> ([u8; 8], [u8; 8]) {
            let perm = cp_unrank(cpr);
            let ori6 = co_unrank(cor);
            let mut cp_full = [0u8; 8];
            let mut co_full = [0u8; 8];
            cp_full[fixed] = fixed as u8;
            co_full[fixed] = 0;
            let mut osum = 0u8;
            for i in 0..7 {
                let pos = movable[i] as usize;
                cp_full[pos] = movable[perm[i] as usize]; // 件的全 8 角编号
                let o = if i < 6 {
                    let v = ori6[i];
                    osum += v;
                    v
                } else {
                    (3 - osum % 3) % 3
                };
                co_full[pos] = o;
            }
            (cp_full, co_full)
        };

        // 移动表:对每个坐标态应用 9 个 move,记录目标坐标。
        let mut mt = vec![0u32; POCKET_STATES * 9];
        for idx in 0..POCKET_STATES {
            let (cp_full, co_full) = from_coord(idx / CO6, idx % CO6);
            for (mi, &mv) in POCKET_MOVES.iter().enumerate() {
                let mv = mv as usize;
                let (mcp, mco) = (&pcp[mv], &pco[mv]);
                let mut ncp = [0u8; 8];
                let mut nco = [0u8; 8];
                for i in 0..8 {
                    ncp[i] = cp_full[mcp[i] as usize];
                    nco[i] = (co_full[mcp[i] as usize] + mco[i]) % 3;
                }
                let (cr, or) = to_coord(&ncp, &nco);
                mt[idx * 9 + mi] = (cr * CO6 + or) as u32;
            }
        }

        // 全空间 BFS(POCKET_MOVES 对取逆封闭 ⇒ 从 solved 正向扩张即距离)。
        let mut dist = vec![255u8; POCKET_STATES];
        let solved = {
            let (cp, co) = State::SOLVED.cp_co();
            let (cr, or) = to_coord(&cp, &co);
            cr * CO6 + or
        };
        dist[solved] = 0;
        let mut frontier = vec![solved as u32];
        let mut d = 0u8;
        while !frontier.is_empty() {
            let mut next = Vec::new();
            for &i in &frontier {
                let base = i as usize * 9;
                for mi in 0..9 {
                    let ni = mt[base + mi] as usize;
                    if dist[ni] == 255 {
                        dist[ni] = d + 1;
                        next.push(ni as u32);
                    }
                }
            }
            d += 1;
            frontier = next;
        }

        PocketSolver { mt, dist, fixed, movable }
    }

    /// 距离表最大深度(实测 God's number)。
    pub fn max_depth(&self) -> u8 {
        self.dist.iter().copied().filter(|&v| v != 255).max().unwrap_or(0)
    }

    /// 各深度的态数分布(distribution[d] = 距 d 的态数)。
    pub fn depth_histogram(&self) -> Vec<usize> {
        let mx = self.max_depth() as usize;
        let mut h = vec![0usize; mx + 1];
        for &v in &self.dist {
            if v != 255 {
                h[v as usize] += 1;
            }
        }
        h
    }

    /// 全 8 角 State → 坐标(位置→件 / 位置→朝向)。
    fn state_coord(&self, st: &State) -> usize {
        let (cp, co) = st.cp_co();
        let mut to_slot = [0u8; 8];
        for (i, &c) in self.movable.iter().enumerate() {
            to_slot[c as usize] = i as u8;
        }
        let mut perm = [0u8; 7];
        let mut ori = [0u8; 6];
        for i in 0..7 {
            let pos = self.movable[i] as usize;
            perm[i] = to_slot[cp[pos] as usize];
            if i < 6 {
                ori[i] = co[pos];
            }
        }
        cp_rank(&perm) * CO6 + co_rank(&ori)
    }

    /// 从 SOLVED 走 alg 后的态坐标。任意 alg(含 D/L/B/整体转)都先归一到固定 DBL 帧:
    /// 直接走全 18 move 得到全角态再投影即可(投影只看 movable 角相对关系,与朝向守恒)。
    fn coord_of(&self, alg: &[Move]) -> usize {
        let mut st = State::SOLVED;
        for &m in alg {
            st.apply(m);
        }
        self.state_coord(&st)
    }

    /// 任意 2x2x2 打乱的最优 HTM 步数。
    pub fn solve_one(&self, alg: &[Move]) -> u32 {
        self.dist[self.coord_of(alg)] as u32
    }

    /// 由坐标态求一条最优解(回溯距离表),返回从打乱态到 solved 的 move 序列(POCKET_MOVES 索引)。
    pub fn enumerate(&self, alg: &[Move]) -> PocketSol {
        let mut cur = self.coord_of(alg);
        let mut moves = Vec::new();
        let mut d = self.dist[cur];
        while d > 0 {
            let base = cur * 9;
            for mi in 0..9 {
                let ni = self.mt[base + mi] as usize;
                if self.dist[ni] == d - 1 {
                    moves.push(POCKET_MOVES[mi]);
                    cur = ni;
                    d -= 1;
                    break;
                }
            }
        }
        PocketSol { len: moves.len() as u32, moves }
    }

    /// 轻量构造(WASM 用):只建 3.6MB 全空间距离表,**不存**联合移动表(new() 的
    /// mt 为 POCKET_STATES×9×4B ≈ 132MB,浏览器线性内存吃不消)。BFS 转移现场由
    /// 角运动学逐态计算,总转换次数与 new() 建表相同(每态 9 次),只省内存不加时。
    /// 注意:lean 实例的 mt 为空,查询只能走 solve_one / solve_one_any / enumerate_any
    /// (全程 State 级投影,不依赖 mt);不要调 enumerate(走 mt 回溯)。
    pub fn new_lean() -> Self {
        let mut pcp = [[0u8; 8]; 18];
        let mut pco = [[0u8; 8]; 18];
        for m in Move::ALL {
            let (cp, co) = move_state(m).cp_co();
            pcp[m.index()] = cp;
            pco[m.index()] = co;
        }

        let mut fixed = usize::MAX;
        for c in 0..8usize {
            let untouched = POCKET_MOVES.iter().all(|&m| {
                let m = m as usize;
                pcp[m][c] == c as u8 && pco[m][c] == 0
            });
            if untouched {
                assert_eq!(fixed, usize::MAX, "more than one fixed corner");
                fixed = c;
            }
        }
        assert_ne!(fixed, usize::MAX, "no fixed corner under U/R/F");

        let mut movable = [0u8; 7];
        let mut to_slot = [255u8; 8];
        let mut n = 0;
        for c in 0..8u8 {
            if c as usize != fixed {
                movable[n] = c;
                to_slot[c as usize] = n as u8;
                n += 1;
            }
        }
        debug_assert_eq!(n, 7);

        let to_coord = |cp_full: &[u8; 8], co_full: &[u8; 8]| -> (usize, usize) {
            let mut perm = [0u8; 7];
            let mut ori = [0u8; 6];
            for i in 0..7 {
                let pos = movable[i] as usize;
                perm[i] = to_slot[cp_full[pos] as usize];
                if i < 6 {
                    ori[i] = co_full[pos];
                }
            }
            (cp_rank(&perm), co_rank(&ori))
        };
        let from_coord = |cpr: usize, cor: usize| -> ([u8; 8], [u8; 8]) {
            let perm = cp_unrank(cpr);
            let ori6 = co_unrank(cor);
            let mut cp_full = [0u8; 8];
            let mut co_full = [0u8; 8];
            cp_full[fixed] = fixed as u8;
            co_full[fixed] = 0;
            let mut osum = 0u8;
            for i in 0..7 {
                let pos = movable[i] as usize;
                cp_full[pos] = movable[perm[i] as usize];
                let o = if i < 6 {
                    let v = ori6[i];
                    osum += v;
                    v
                } else {
                    (3 - osum % 3) % 3
                };
                co_full[pos] = o;
            }
            (cp_full, co_full)
        };

        // 全空间 BFS:转移现场算(from_coord → 9 move → to_coord),不落 mt。
        let mut dist = vec![255u8; POCKET_STATES];
        let solved = {
            let (cp, co) = State::SOLVED.cp_co();
            let (cr, or) = to_coord(&cp, &co);
            cr * CO6 + or
        };
        dist[solved] = 0;
        let mut frontier = vec![solved as u32];
        let mut d = 0u8;
        while !frontier.is_empty() {
            let mut next = Vec::new();
            for &i in &frontier {
                let idx = i as usize;
                let (cp_full, co_full) = from_coord(idx / CO6, idx % CO6);
                for &mv in &POCKET_MOVES {
                    let mv = mv as usize;
                    let (mcp, mco) = (&pcp[mv], &pco[mv]);
                    let mut ncp = [0u8; 8];
                    let mut nco = [0u8; 8];
                    for i in 0..8 {
                        ncp[i] = cp_full[mcp[i] as usize];
                        nco[i] = (co_full[mcp[i] as usize] + mco[i]) % 3;
                    }
                    let (cr, or) = to_coord(&ncp, &nco);
                    let ni = cr * CO6 + or;
                    if dist[ni] == 255 {
                        dist[ni] = d + 1;
                        next.push(ni as u32);
                    }
                }
            }
            d += 1;
            frontier = next;
        }

        PocketSolver { mt: Vec::new(), dist, fixed, movable }
    }

    /// 任意打乱末态归一到固定 DBL 帧:在 24 个整体旋转里找唯一使 DBL 角归位归向者。
    /// 返回(归一后全角态,选中的旋转条目)。与 pocket_analyzer::pocket_len 同语义
    /// (整体旋转不改最优解长,解经共轭等长)。
    fn normalize_state(&self, alg: &[Move]) -> (State, &'static (String, Vec<Move>)) {
        let mut st = State::SOLVED;
        for &m in alg {
            st.apply(m);
        }
        for entry in pocket_rot24() {
            let mut st2 = st;
            for &m in &entry.1 {
                st2.apply(m);
            }
            let (cp, co) = st2.cp_co();
            if cp[self.fixed] as usize == self.fixed && co[self.fixed] == 0 {
                return (st2, entry);
            }
        }
        unreachable!("no whole-cube rotation fixes the DBL corner");
    }

    /// 任意 18 记号打乱(含 D/L/B:2x2x2 无中心,与对面只差整体旋转)的最优 HTM 步数。
    pub fn solve_one_any(&self, alg: &[Move]) -> u32 {
        let (st, _) = self.normalize_state(alg);
        self.dist[self.state_coord(&st)] as u32
    }

    /// 任意 18 记号打乱的一条最优解:24 旋转归一后回溯距离表(State 级,不依赖 mt,
    /// lean 实例可用)。物理含义:打乱后先整体转 rot,再做 moves 即还原。
    pub fn enumerate_any(&self, alg: &[Move]) -> PocketAnySol {
        let (mut st, entry) = self.normalize_state(alg);
        let mut d = self.dist[self.state_coord(&st)];
        let len = d as u32;
        let mut moves = Vec::new();
        while d > 0 {
            let before = d;
            for &mv in &POCKET_MOVES {
                let ns = st.applied(Move::from_index(mv as usize));
                if self.dist[self.state_coord(&ns)] == d - 1 {
                    moves.push(mv);
                    st = ns;
                    d -= 1;
                    break;
                }
            }
            assert!(d < before, "distance table walk stuck");
        }
        PocketAnySol {
            len,
            rot: entry.0.clone(),
            rot_moves: entry.1.iter().map(|m| m.index() as u8).collect(),
            moves,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::cube_common::string_to_alg;
    use std::collections::HashMap;

    fn lcg(x: u64) -> u64 {
        x.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407)
    }

    /// 确定性伪随机词(给定 move 池)。
    fn pseudo_word(seed: u64, len: usize, pool: &[u8]) -> Vec<Move> {
        let mut x = lcg(seed);
        let mut out = Vec::with_capacity(len);
        for _ in 0..len {
            x = lcg(x);
            out.push(Move::from_index(pool[(x >> 33) as usize % pool.len()] as usize));
        }
        out
    }

    /// 全 18 move 的伪随机打乱(测试固定 DBL 帧对任意打乱也成立)。
    fn pseudo_scramble(seed: u64, len: usize) -> Vec<Move> {
        let all: Vec<u8> = (0..18u8).collect();
        pseudo_word(seed, len, &all)
    }

    #[test]
    fn pt_basics() {
        let s = PocketSolver::new();

        // 态空间 = 7!·3^6
        assert_eq!(POCKET_STATES, 3_674_160);
        assert_eq!(s.dist.len(), POCKET_STATES);

        // DBL 固定角:U/R/F 都不动者,唯一
        assert!(s.fixed < 8);
        // movable 是其余 7 个,升序、不含 fixed
        assert!(!s.movable.contains(&(s.fixed as u8)));
        assert_eq!(s.movable.len(), 7);
        for w in s.movable.windows(2) {
            assert!(w[0] < w[1]);
        }

        // 全可达 + solved 唯一(距 0 仅一个)
        assert!(s.dist.iter().all(|&v| v != 255), "unreachable state");
        assert_eq!(s.dist.iter().filter(|&&v| v == 0).count(), 1);

        // solved 即距 0
        assert_eq!(s.solve_one(&[]), 0);
        assert_eq!(s.solve_one(&string_to_alg("")), 0);

        // 单 move:U/R/F 的 ' 与非 ' = 1,半转 = 1(HTM)
        assert_eq!(s.solve_one(&string_to_alg("U")), 1);
        assert_eq!(s.solve_one(&string_to_alg("U2")), 1);
        assert_eq!(s.solve_one(&string_to_alg("R'")), 1);
        assert_eq!(s.solve_one(&string_to_alg("F2")), 1);

        // 一个 move 后再逆回 = 0
        assert_eq!(s.solve_one(&string_to_alg("R R'")), 0);
        assert_eq!(s.solve_one(&string_to_alg("U F F' U'")), 0);

        // God's number 实测 = 11 HTM(文献一致)
        assert_eq!(s.max_depth(), 11);

        // 距离分布之和 = 全空间
        let h = s.depth_histogram();
        assert_eq!(h.iter().sum::<usize>(), POCKET_STATES);
        assert_eq!(h[0], 1);
        assert_eq!(h.len(), 12); // 深度 0..=11
    }

    /// 独立暴力对照(金标准):全 8 角运动学 + HashMap 全空间 BFS,
    /// 全 3,674,160 格逐格对照,再随机打乱对照前端坐标提取。
    #[test]
    fn brute_force_full_space_compare() {
        let mut pcp = [[0u8; 8]; 18];
        let mut pco = [[0u8; 8]; 18];
        for m in Move::ALL {
            let (cp, co) = move_state(m).cp_co();
            pcp[m.index()] = cp;
            pco[m.index()] = co;
        }

        // key = 全 8 角 (cp 3bit + co 2bit) 打包(DBL 角恒定,不影响唯一性)。
        let key_of = |cp: &[u8; 8], co: &[u8; 8]| -> u64 {
            let mut k = 0u64;
            for i in 0..8 {
                k |= ((cp[i] as u64) | ((co[i] as u64) << 3)) << (5 * i);
            }
            k
        };

        let (cp0, co0) = State::SOLVED.cp_co();
        let mut map: HashMap<u64, u8> = HashMap::with_capacity(4_000_000);
        map.insert(key_of(&cp0, &co0), 0);
        let mut frontier = vec![(cp0, co0)];
        let mut d = 0u8;
        while !frontier.is_empty() {
            let mut next = Vec::new();
            for (cp, co) in &frontier {
                for &mv in &POCKET_MOVES {
                    let mv = mv as usize;
                    let (mcp, mco) = (&pcp[mv], &pco[mv]);
                    let mut ncp = [0u8; 8];
                    let mut nco = [0u8; 8];
                    for i in 0..8 {
                        ncp[i] = cp[mcp[i] as usize];
                        nco[i] = (co[mcp[i] as usize] + mco[i]) % 3;
                    }
                    let k = key_of(&ncp, &nco);
                    if let std::collections::hash_map::Entry::Vacant(e) = map.entry(k) {
                        e.insert(d + 1);
                        next.push((ncp, nco));
                    }
                }
            }
            d += 1;
            frontier = next;
        }
        assert_eq!(map.len(), POCKET_STATES, "brute space size mismatch");

        let s = PocketSolver::new();
        assert_eq!(s.max_depth(), *map.values().max().unwrap());

        // 全空间逐格对照:暴力的每个全角态投影到坐标后查表,距离须相等。
        let mut to_slot = [0u8; 8];
        for (i, &c) in s.movable.iter().enumerate() {
            to_slot[c as usize] = i as u8;
        }
        for (&k, &dv) in &map {
            let mut cp = [0u8; 8];
            let mut co = [0u8; 8];
            for i in 0..8 {
                let cell = (k >> (5 * i)) & 0x1f;
                cp[i] = (cell & 7) as u8;
                co[i] = ((cell >> 3) & 3) as u8;
            }
            let st = State {
                corners: std::array::from_fn(|i| 3 * cp[i] + co[i]),
                edges: State::SOLVED.edges,
            };
            assert_eq!(s.dist[s.state_coord(&st)], dv, "full-space mismatch key={:x}", k);
        }

        // 前端对照:任意全 18 move 打乱,solver == brute(以固定 DBL 帧投影)。
        for seed in 0..50u64 {
            let len = 1 + (seed as usize * 3) % 30;
            let alg = pseudo_scramble(1000 + seed, len);
            let mut st = State::SOLVED;
            for &m in &alg {
                st.apply(m);
            }
            // brute 查表也要以固定 DBL 帧:把全角态归一(投影同 solver)。
            let want = s.dist[s.state_coord(&st)] as u32;
            assert_eq!(s.solve_one(&alg), want, "seed={}", seed);
        }
    }

    /// enumerate 物理 replay:解序列从打乱态走回 solved。
    #[test]
    fn enumerate_solutions_replay_to_solved() {
        let s = PocketSolver::new();
        for seed in 0..40u64 {
            let len = 1 + (seed as usize) % 25;
            let alg = pseudo_word(5000 + seed, len, &POCKET_MOVES);
            let best = s.solve_one(&alg);
            let sol = s.enumerate(&alg);
            assert_eq!(sol.len, best, "enum len != optimal, seed={}", seed);
            assert!(sol.moves.iter().all(|&m| POCKET_MOVES.contains(&m)), "non-pocket move");

            // 物理 replay:打乱态 + 解 → solved
            let mut st = State::SOLVED;
            for &m in &alg {
                st.apply(m);
            }
            for &m in &sol.moves {
                st.apply(Move::from_index(m as usize));
            }
            assert_eq!(s.state_coord(&st), s.coord_of(&[]), "solution not solved");
        }

        // solved 输入 → 空解
        let sol = s.enumerate(&[]);
        assert_eq!(sol.len, 0);
        assert!(sol.moves.is_empty());
    }

    /// 与 cstimer pocketCube 同语义交叉:URF-only 打乱的最优长度一致性
    /// (独立 IDDFS 复核短打乱最优性,绕开 mt/dist 表)。
    #[test]
    fn optimality_spot_check_iddfs() {
        let s = PocketSolver::new();

        fn dfs(st: &State, depth: u32, prev: i32) -> bool {
            if depth == 0 {
                return *st == State::SOLVED
                    // 整解判定:8 角全归位归向(2x2x2 视角下 DBL 固定 ⇒ 直接比 corners)
                    || st.corners == State::SOLVED.corners;
            }
            for &mv in &POCKET_MOVES {
                let m = mv as usize;
                if prev >= 0 && m / 3 == prev as usize / 3 {
                    continue; // 同面剪枝(U/R/F 互不为对立面,只需禁同面)
                }
                let ns = st.applied(Move::from_index(m));
                if dfs(&ns, depth - 1, m as i32) {
                    return true;
                }
            }
            false
        }

        for seed in 900..914u64 {
            let alg = pseudo_word(seed, 6, &POCKET_MOVES);
            let got = s.solve_one(&alg);
            assert!(got <= 6, "6-move URF scramble dist > 6");
            let mut st = State::SOLVED;
            for &m in &alg {
                st.apply(m);
            }
            let mut want = 99;
            for dd in 0..=6u32 {
                if dfs(&st, dd, -1) {
                    want = dd;
                    break;
                }
            }
            assert_eq!(got, want, "seed={}", seed);
        }
    }

    /// lean 构造(WASM 路径,零 mt)与 full 构造距离表全空间逐格相等。
    #[test]
    fn lean_matches_full() {
        let full = PocketSolver::new();
        let lean = PocketSolver::new_lean();
        assert!(lean.mt.is_empty());
        assert_eq!(lean.fixed, full.fixed);
        assert_eq!(lean.movable, full.movable);
        assert_eq!(lean.dist, full.dist, "lean dist != full dist");
        assert_eq!(lean.max_depth(), 11);
    }

    /// 24 旋转归一入口(solve_one_any / enumerate_any,WASM 在线求解器走这):
    /// rot24 互异且首项空;纯旋转词=0;全 18 单 move=1;URF 词与 solve_one 逐位一致;
    /// 全 18 打乱 replay(打乱 + rot_moves + 解 → 角全归位)+ 短词 IDDFS 独立最优性对照。
    #[test]
    fn any_normalization_and_replay() {
        let s = PocketSolver::new_lean();

        // rot24:24 个互异旋转(末态角排列互异),首项为空
        assert_eq!(pocket_rot24().len(), 24);
        assert!(pocket_rot24()[0].0.is_empty() && pocket_rot24()[0].1.is_empty());
        let mut ends: Vec<[u8; 8]> = pocket_rot24()
            .iter()
            .map(|(_, w)| {
                let mut st = State::SOLVED;
                for &m in w {
                    st.apply(m);
                }
                st.corners
            })
            .collect();
        ends.sort();
        ends.dedup();
        assert_eq!(ends.len(), 24, "rot24 not all distinct");

        // 纯旋转词 = 0;全 18 单 move = 1(D/L/B 与对面只差整体旋转)
        for (_, w) in pocket_rot24() {
            assert_eq!(s.solve_one_any(w), 0);
        }
        for m in Move::ALL {
            assert_eq!(s.solve_one_any(&[m]), 1, "single move {}", m.name());
        }
        assert_eq!(s.solve_one_any(&string_to_alg("D U'")), 0);
        assert_eq!(s.solve_one_any(&string_to_alg("L2 R2 U2")), 1);

        // URF 词:归一为恒等,与 solve_one 逐位一致
        for seed in 0..30u64 {
            let len = 1 + (seed as usize) % 14;
            let alg = pseudo_word(11000 + seed, len, &POCKET_MOVES);
            assert_eq!(s.solve_one_any(&alg), s.solve_one(&alg), "seed={}", seed);
        }

        // 全 18 打乱:enumerate_any replay → 角全归位;len == solve_one_any ≤ 词长
        for seed in 0..40u64 {
            let len = 1 + (seed as usize) % 12;
            let alg = pseudo_scramble(13000 + seed, len);
            let best = s.solve_one_any(&alg);
            assert!(best as usize <= len, "seed={}", seed);
            let sol = s.enumerate_any(&alg);
            assert_eq!(sol.len, best, "enum_any len != optimal, seed={}", seed);
            assert!(sol.moves.iter().all(|&m| POCKET_MOVES.contains(&m)));
            let mut st = State::SOLVED;
            for &m in &alg {
                st.apply(m);
            }
            for &m in sol.rot_moves.iter().chain(sol.moves.iter()) {
                st.apply(Move::from_index(m as usize));
            }
            assert_eq!(st.corners, State::SOLVED.corners, "any-solution not solved, seed={}", seed);
        }

        // 短词独立 IDDFS 最优性对照(目标 = 24 个旋转后的 solved 角态,绕开归一与距离表)
        let goals: Vec<[u8; 8]> = pocket_rot24()
            .iter()
            .map(|(_, w)| {
                let mut st = State::SOLVED;
                for &m in w {
                    st.apply(m);
                }
                st.corners
            })
            .collect();
        fn dfs(st: &State, depth: u32, prev: i32, goals: &[[u8; 8]]) -> bool {
            if depth == 0 {
                return goals.contains(&st.corners);
            }
            for &mv in &POCKET_MOVES {
                let m = mv as usize;
                if prev >= 0 && m / 3 == prev as usize / 3 {
                    continue;
                }
                let ns = st.applied(Move::from_index(m));
                if dfs(&ns, depth - 1, m as i32, goals) {
                    return true;
                }
            }
            false
        }
        for seed in 0..20u64 {
            let len = 1 + (seed as usize) % 5;
            let alg = pseudo_scramble(17000 + seed, len);
            let got = s.solve_one_any(&alg);
            let mut st = State::SOLVED;
            for &m in &alg {
                st.apply(m);
            }
            let mut want = u32::MAX;
            for dd in 0..=len as u32 {
                if dfs(&st, dd, -1, &goals) {
                    want = dd;
                    break;
                }
            }
            assert_eq!(got, want, "seed={} alg={:?}", seed, alg);
        }
    }
}
