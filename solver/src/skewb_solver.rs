//! skewb_solver: Skewb 全空间最优求解器(key `skewb`)。
//!
//! 语义:对任意 WCA skewb 打乱(U/L/R/B,可带 ',每步 ±120°)求最优步数 + 一条最优解。
//! 喂 /scramble 统计管道(每打乱最优长度分桶)。
//!
//! 状态模型(独立 puzzle,0 复用 cube_common;move 定义逐数组取自 cubing.js skewb
//! kpuzzle(2026-06-11 现场 dump,WCA 记号的事实标准),结构与 cstimer skewb.js
//! (4320×2187/3)交叉核对一致):
//!   - 8 角分轨道:WCA 4 个 move 的转轴角 = U→6 L→4 R→5 B→7(cubing.js 编号)。
//!     U/L/R 三轴角 {4,5,6} 同属一个四面体轨道并被 B 三循环(A3,3 态);
//!     角 {0,1,2,7} 为另一轨道被 U/L/R 三循环(A4,12 态);
//!     角 3(B 轴角的对角)在 ⟨U,L,R,B⟩ 下完全不动不扭——天然全局参照,
//!     无需再消整体朝向。8 角全部有扭转(mod 3)。
//!   - 6 中心:偶置换 6!/2 = 360(每 move 三循环中心)。
//!   - 扭转自由度 3^5 = 243(8 角 3^8 受 3 个约束,见下)。
//!   - 全空间 = 360 × 12 × 3 × 243 = 3,149,280(= cstimer 4320×2187/3;
//!     测试全空间件级闭包实算验证)。
//!
//! 扭转约束(由 move 数组逐项推导,brute-force 测试全空间证真):
//!   (1) co[3] ≡ 0(角 3 永不动不扭)。
//!   (2) Σ co{0,1,2,7} ≡ #B (mod 3):U/L/R 给该轨道 +2+2+2≡0,B 给角 7 +1;
//!       而 rq(轨道 {4,5,6} 的 A3 置换)恰记录 #B mod 3 ⇒ Σ = A[rq]。
//!   (3) Σ co{4,5,6} ≡ #U+#L+#R (mod 3):U/L/R 各 +1(轴角),B +2×3≡0;
//!       A4/V4 ≅ Z3 商映射下 U/L/R 同类 ⇒ Σ = B[rp](12 项查表,构造时小 BFS
//!       实算并断言良定义)。
//!
//! 度量:每 120° 转一步(X' = X²,X2 视作 X');实测 God's number = 11,
//! 距离分布与 jaapsch.net/puzzles/skewb.htm 公开表逐项锁定(2026-06-11 抓取;
//! jaap 用同四面体 4 轴 move 集,与 WCA 集经整体旋转共轭图同构,分布相同,实测证真)。
//!
//! 表大小(P4d lean 评估):零盘表;距离表 3,149,280 B ≈ 3.0MB 现场 BFS,
//! 转移现场件级 decode/apply/encode(无联合移动表)。若建全联合移动表为
//! 3,149,280×8×u32 ≈ 100.8MB(浏览器端不建议);子坐标拆分(置换 12,960×8 +
//! 扭转 2187×8 u16 ≈ 240KB)可作 P4d 加速备选。

/// 轴名(move 轴序 0..4 = U/L/R/B)。
pub const SKEWB_AXIS_NAMES: [char; 4] = ['U', 'L', 'R', 'B'];

/// 全空间态数 = 360 × 12 × 3 × 27 × 9。
pub const SKEWB_STATES: usize = 360 * 12 * 3 * 27 * 9; // 3,149,280

// cubing.js skewb kpuzzle move 数组(new[i] = old[P[i]];co_new[i] = co_old[P[i]] + D[i])。
// 行序 = U, L, R, B。
const CP: [[usize; 8]; 4] = [
    [1, 7, 2, 3, 4, 5, 6, 0],
    [7, 1, 0, 3, 4, 5, 6, 2],
    [0, 2, 7, 3, 4, 5, 6, 1],
    [0, 1, 2, 3, 6, 4, 5, 7],
];
const CD: [[u8; 8]; 4] = [
    [2, 2, 0, 0, 0, 0, 1, 2],
    [2, 0, 2, 0, 1, 0, 0, 2],
    [0, 2, 2, 0, 0, 1, 0, 2],
    [0, 0, 0, 0, 2, 2, 2, 1],
];
const XP: [[usize; 6]; 4] = [
    [0, 1, 2, 5, 3, 4],
    [4, 1, 0, 3, 2, 5],
    [0, 2, 5, 3, 4, 1],
    [0, 1, 4, 3, 5, 2],
];

/// 一个 skewb move:axis 0..4(U/L/R/B),prime = '(逆时针)。
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct SkewbMove {
    pub axis: u8,
    pub prime: bool,
}

impl SkewbMove {
    pub fn name(&self) -> String {
        format!("{}{}", SKEWB_AXIS_NAMES[self.axis as usize], if self.prime { "'" } else { "" })
    }
}

/// 解析 WCA skewb 记号(空白分隔;U L R B,后缀 ' / 2 / 2',阶 3:X2 = X')。
pub fn parse_skewb(s: &str) -> Result<Vec<SkewbMove>, String> {
    let mut out = Vec::new();
    for tok in s.split_whitespace() {
        let mut ch = tok.chars();
        let head = ch.next().ok_or("empty token")?;
        let axis = match head {
            'U' => 0u8,
            'L' => 1,
            'R' => 2,
            'B' => 3,
            _ => return Err(format!("bad skewb token: {}", tok)),
        };
        let prime = match ch.as_str() {
            "" => false,
            "'" | "2" | "2'" | "'2" => true, // 阶 3:X2 = X'
            _ => return Err(format!("bad skewb suffix: {}", tok)),
        };
        out.push(SkewbMove { axis, prime });
    }
    Ok(out)
}

/// 件级全状态(cubing.js 编号:角 0..7 / 中心 0..5;cp/centers = 位置→件,co mod 3)。
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub struct SkewbState {
    pub centers: [u8; 6],
    pub cp: [u8; 8],
    pub co: [u8; 8],
}

impl SkewbState {
    pub const SOLVED: SkewbState =
        SkewbState { centers: [0, 1, 2, 3, 4, 5], cp: [0, 1, 2, 3, 4, 5, 6, 7], co: [0; 8] };

    /// 顺时针一步(120°)。
    fn apply_cw(&mut self, axis: usize) {
        let old = *self;
        for i in 0..8 {
            self.cp[i] = old.cp[CP[axis][i]];
            self.co[i] = (old.co[CP[axis][i]] + CD[axis][i]) % 3;
        }
        for i in 0..6 {
            self.centers[i] = old.centers[XP[axis][i]];
        }
    }

    pub fn apply(&mut self, mv: SkewbMove) {
        let pow = if mv.prime { 2 } else { 1 };
        for _ in 0..pow {
            self.apply_cw(mv.axis as usize);
        }
    }

    pub fn apply_all(&mut self, alg: &[SkewbMove]) {
        for &m in alg {
            self.apply(m);
        }
    }
}

const FACT5: [usize; 5] = [120, 24, 6, 2, 1]; // (5-i)! for i=0..4

/// 偶置换 rank(6 元,中心):Lehmer rank(0..719)>>1 双射 0..359。
fn rank_even6(p: &[u8; 6]) -> usize {
    let mut r = 0usize;
    for i in 0..5 {
        let c = (i + 1..6).filter(|&j| p[j] < p[i]).count();
        r += c * FACT5[i];
    }
    r >> 1
}

fn lehmer6_decode(mut r: usize) -> ([u8; 6], usize) {
    let mut avail = [0u8, 1, 2, 3, 4, 5];
    let mut len = 6usize;
    let mut p = [0u8; 6];
    let mut digit_sum = 0usize;
    for i in 0..6 {
        let f = if i < 5 { FACT5[i] } else { 1 };
        let k = r / f;
        r %= f;
        digit_sum += k;
        p[i] = avail[k];
        for j in k..len - 1 {
            avail[j] = avail[j + 1];
        }
        len -= 1;
    }
    (p, digit_sum)
}

fn unrank_even6(idx: usize) -> [u8; 6] {
    let (p, sum) = lehmer6_decode(idx << 1);
    if sum % 2 == 0 {
        p
    } else {
        let (p2, sum2) = lehmer6_decode((idx << 1) | 1);
        debug_assert_eq!(sum2 % 2, 0);
        p2
    }
}

const FACT3: [usize; 3] = [6, 2, 1]; // (3-i)! for i=0..2

/// 偶置换 rank(4 元,轨道 O1 = 位置 {0,1,2,7} 的件,映射 7→3):0..11。
fn rank_even4(p: &[u8; 4]) -> usize {
    let mut r = 0usize;
    for i in 0..3 {
        let c = (i + 1..4).filter(|&j| p[j] < p[i]).count();
        r += c * FACT3[i];
    }
    r >> 1
}

fn lehmer4_decode(mut r: usize) -> ([u8; 4], usize) {
    let mut avail = [0u8, 1, 2, 3];
    let mut len = 4usize;
    let mut p = [0u8; 4];
    let mut digit_sum = 0usize;
    for i in 0..4 {
        let f = if i < 3 { FACT3[i] } else { 1 };
        let k = r / f;
        r %= f;
        digit_sum += k;
        p[i] = avail[k];
        for j in k..len - 1 {
            avail[j] = avail[j + 1];
        }
        len -= 1;
    }
    (p, digit_sum)
}

fn unrank_even4(idx: usize) -> [u8; 4] {
    let (p, sum) = lehmer4_decode(idx << 1);
    if sum % 2 == 0 {
        p
    } else {
        let (p2, sum2) = lehmer4_decode((idx << 1) | 1);
        debug_assert_eq!(sum2 % 2, 0);
        p2
    }
}

/// 轨道 O2 = 位置 {4,5,6} 的件(映射 -4):A3 三个旋转,rank = 件 0 所在下标。
const ROT3: [[u8; 3]; 3] = [[0, 1, 2], [2, 0, 1], [1, 2, 0]];

fn rank_rot3(p: &[u8; 3]) -> usize {
    p.iter().position(|&x| x == 0).unwrap()
}

/// 编码(co[3]/co[6]/co[7] 由约束确定,不入坐标)。
fn encode(st: &SkewbState) -> usize {
    let rc = rank_even6(&st.centers);
    let m = |p: u8| if p == 7 { 3u8 } else { p };
    let o1 = [m(st.cp[0]), m(st.cp[1]), m(st.cp[2]), m(st.cp[7])];
    let rp = rank_even4(&o1);
    let o2 = [st.cp[4] - 4, st.cp[5] - 4, st.cp[6] - 4];
    let rq = rank_rot3(&o2);
    let t012 = (st.co[0] as usize) * 9 + (st.co[1] as usize) * 3 + st.co[2] as usize;
    let t45 = (st.co[4] as usize) * 3 + st.co[5] as usize;
    (((rc * 12 + rp) * 3 + rq) * 27 + t012) * 9 + t45
}

/// 解码(需约束表 A=sum_o1_by_rq / B=sum_o2_by_rp 还原 co[7]/co[6])。
fn decode(mut idx: usize, sum_o1_by_rq: &[u8; 3], sum_o2_by_rp: &[u8; 12]) -> SkewbState {
    let t45 = idx % 9;
    idx /= 9;
    let t012 = idx % 27;
    idx /= 27;
    let rq = idx % 3;
    idx /= 3;
    let rp = idx % 12;
    let rc = idx / 12;

    let centers = unrank_even6(rc);
    let o1 = unrank_even4(rp);
    let o2 = ROT3[rq];
    let mb = |v: u8| if v == 3 { 7u8 } else { v };
    let mut cp = [0u8; 8];
    cp[0] = mb(o1[0]);
    cp[1] = mb(o1[1]);
    cp[2] = mb(o1[2]);
    cp[7] = mb(o1[3]);
    cp[3] = 3;
    cp[4] = o2[0] + 4;
    cp[5] = o2[1] + 4;
    cp[6] = o2[2] + 4;

    let mut co = [0u8; 8];
    co[0] = (t012 / 9) as u8;
    co[1] = (t012 / 3 % 3) as u8;
    co[2] = (t012 % 3) as u8;
    co[4] = (t45 / 3) as u8;
    co[5] = (t45 % 3) as u8;
    co[7] = (sum_o1_by_rq[rq] + 9 - co[0] - co[1] - co[2]) % 3;
    co[6] = (sum_o2_by_rp[rp] + 6 - co[4] - co[5]) % 3;

    SkewbState { centers, cp, co }
}

/// 一条最优解。
#[derive(Clone, Debug)]
pub struct SkewbSol {
    pub len: u32,
    pub moves: Vec<SkewbMove>,
}

impl SkewbSol {
    pub fn to_string_moves(&self) -> String {
        self.moves.iter().map(|m| m.name()).collect::<Vec<_>>().join(" ")
    }
}

pub struct SkewbSolver {
    /// 全空间精确距离(3.0MB,现场 BFS,零盘表)。
    dist: Vec<u8>,
    solved: usize,
}

impl Default for SkewbSolver {
    fn default() -> Self {
        Self::new()
    }
}

impl SkewbSolver {
    /// 全自包含构造:小 BFS 推约束表 → 全空间件级 BFS 填距离表(零盘表)。
    pub fn new() -> Self {
        // 约束表:深度 ≤4 件级 BFS(8^4 量级)覆盖全部 3 个 rq / 12 个 rp,
        // 每个访问态断言约束良定义(撞到不一致 = 模型错,直接 panic)。
        let mut sum_o1_by_rq = [255u8; 3];
        let mut sum_o2_by_rp = [255u8; 12];
        let mut frontier = vec![SkewbState::SOLVED];
        let mut seen = std::collections::HashSet::new();
        seen.insert(SkewbState::SOLVED);
        for _ in 0..=4 {
            let mut next = Vec::new();
            for st in &frontier {
                let m = |p: u8| if p == 7 { 3u8 } else { p };
                let rp = rank_even4(&[m(st.cp[0]), m(st.cp[1]), m(st.cp[2]), m(st.cp[7])]);
                let rq = rank_rot3(&[st.cp[4] - 4, st.cp[5] - 4, st.cp[6] - 4]);
                let s1 = (st.co[0] + st.co[1] + st.co[2] + st.co[7]) % 3;
                let s2 = (st.co[4] + st.co[5] + st.co[6]) % 3;
                assert!(st.cp[3] == 3 && st.co[3] == 0, "corner 3 must be fixed");
                assert!(
                    sum_o1_by_rq[rq] == 255 || sum_o1_by_rq[rq] == s1,
                    "sum_O1 not a function of rq"
                );
                assert!(
                    sum_o2_by_rp[rp] == 255 || sum_o2_by_rp[rp] == s2,
                    "sum_O2 not a function of rp"
                );
                sum_o1_by_rq[rq] = s1;
                sum_o2_by_rp[rp] = s2;
                for v in 0..8u8 {
                    let mut ns = *st;
                    ns.apply(SkewbMove { axis: v / 2, prime: v % 2 == 1 });
                    if seen.insert(ns) {
                        next.push(ns);
                    }
                }
            }
            frontier = next;
        }
        assert!(sum_o1_by_rq.iter().all(|&v| v != 255), "rq coverage incomplete");
        assert!(sum_o2_by_rp.iter().all(|&v| v != 255), "rp coverage incomplete");

        // 全空间 BFS(转移现场 decode/apply/encode,无移动表)。
        let solved = encode(&SkewbState::SOLVED);
        let mut dist = vec![255u8; SKEWB_STATES];
        dist[solved] = 0;
        let mut frontier = vec![solved as u32];
        let mut d = 0u8;
        while !frontier.is_empty() {
            let mut next = Vec::new();
            for &i in &frontier {
                let st = decode(i as usize, &sum_o1_by_rq, &sum_o2_by_rp);
                for v in 0..8u8 {
                    let mut ns = st;
                    ns.apply(SkewbMove { axis: v / 2, prime: v % 2 == 1 });
                    let ni = encode(&ns);
                    if dist[ni] == 255 {
                        dist[ni] = d + 1;
                        next.push(ni as u32);
                    }
                }
            }
            d += 1;
            frontier = next;
        }

        SkewbSolver { dist, solved }
    }

    /// 用预算好的全空间距离表(3,149,280 字节)即时构造,跳过现场 BFS + 约束表推导。
    /// 浏览器端「秒算」:静态资源直载距离表。查询走 solve_one / enumerate(全 State 级
    /// encode,不依赖约束表 — 约束表仅 decode/构造期用)。
    pub fn from_dist(dist: Vec<u8>) -> Self {
        assert_eq!(dist.len(), SKEWB_STATES, "skewb dist table size mismatch");
        SkewbSolver { dist, solved: encode(&SkewbState::SOLVED) }
    }

    /// 全空间距离表原始字节(落盘成静态资源用)。
    pub fn dist_bytes(&self) -> &[u8] {
        &self.dist
    }

    /// 距离表最大深度(实测 God's number)。
    pub fn max_depth(&self) -> u8 {
        self.dist.iter().copied().filter(|&v| v != 255).max().unwrap_or(0)
    }

    /// 各深度态数分布。
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

    fn state_after(alg: &[SkewbMove]) -> SkewbState {
        let mut st = SkewbState::SOLVED;
        st.apply_all(alg);
        st
    }

    /// 最优步数。
    pub fn solve_one(&self, alg: &[SkewbMove]) -> u32 {
        self.dist[encode(&Self::state_after(alg))] as u32
    }

    /// 一条最优解(回溯距离表)。
    pub fn enumerate(&self, alg: &[SkewbMove]) -> SkewbSol {
        let mut st = Self::state_after(alg);
        let mut cur = encode(&st);
        let mut d = self.dist[cur];
        let mut moves = Vec::with_capacity(d as usize);
        while d > 0 {
            let mut stepped = false;
            for v in 0..8u8 {
                let mv = SkewbMove { axis: v / 2, prime: v % 2 == 1 };
                let mut ns = st;
                ns.apply(mv);
                let ni = encode(&ns);
                if self.dist[ni] == d - 1 {
                    moves.push(mv);
                    st = ns;
                    cur = ni;
                    d -= 1;
                    stepped = true;
                    break;
                }
            }
            assert!(stepped, "distance table walk stuck");
        }
        debug_assert_eq!(cur, self.solved);
        SkewbSol { len: moves.len() as u32, moves }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    /// jaapsch.net/puzzles/skewb.htm 公开距离分布(2026-06-11 抓取核对;
    /// jaap 四轴 move 集与 WCA 集经整体旋转共轭同构,分布相同 — 本测试即实证)。
    const JAAPSCH_HIST: [usize; 12] =
        [1, 8, 48, 288, 1728, 10248, 59304, 315198, 1225483, 1455856, 81028, 90];

    fn lcg(x: u64) -> u64 {
        x.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407)
    }

    /// 确定性伪随机词。
    fn pseudo_word(seed: u64, len: usize) -> Vec<SkewbMove> {
        let mut x = lcg(seed);
        let mut out = Vec::with_capacity(len);
        for _ in 0..len {
            x = lcg(x);
            let v = (x >> 33) as usize % 8;
            out.push(SkewbMove { axis: (v / 2) as u8, prime: v % 2 == 1 });
        }
        out
    }

    fn parse(s: &str) -> Vec<SkewbMove> {
        parse_skewb(s).unwrap()
    }

    #[test]
    fn skewb_basics() {
        let s = SkewbSolver::new();

        assert_eq!(SKEWB_STATES, 3_149_280);
        assert_eq!(s.dist.len(), SKEWB_STATES);

        // 全可达(编码恰为闭包的双射)+ solved 唯一
        assert!(s.dist.iter().all(|&v| v != 255), "unreachable state in table");
        assert_eq!(s.dist.iter().filter(|&&v| v == 0).count(), 1);

        // 阶 3:X X X = id;X X' = id(件级)
        for a in 0..4u8 {
            let mut st = SkewbState::SOLVED;
            for _ in 0..3 {
                st.apply(SkewbMove { axis: a, prime: false });
            }
            assert_eq!(st, SkewbState::SOLVED, "axis {} order != 3", a);
        }
        let mut st = SkewbState::SOLVED;
        st.apply_all(&parse("U U' L L' R R' B B'"));
        assert_eq!(st, SkewbState::SOLVED);

        // 角 3 = 全局参照:任意词后位置/朝向不变
        let mut st = SkewbState::SOLVED;
        st.apply_all(&pseudo_word(42, 30));
        assert_eq!(st.cp[3], 3);
        assert_eq!(st.co[3], 0);

        // 已知值
        assert_eq!(s.solve_one(&[]), 0);
        assert_eq!(s.solve_one(&parse("U")), 1);
        assert_eq!(s.solve_one(&parse("L'")), 1);
        assert_eq!(s.solve_one(&parse("B2")), 1); // B2 = B'
        assert_eq!(s.solve_one(&parse("R R'")), 0);
        assert_eq!(s.solve_one(&parse("U L")), 2);

        // God's number = 11,分布与 jaapsch 公开表逐项锁定
        assert_eq!(s.max_depth(), 11);
        let h = s.depth_histogram();
        assert_eq!(h, JAAPSCH_HIST.to_vec());
        assert_eq!(h.iter().sum::<usize>(), SKEWB_STATES);

        // 解析:WCA 真实样例形状 + 非法 token 报错
        assert!(parse_skewb("U L' R B' U' R' B U L R' B' U").is_ok());
        assert!(parse_skewb("D").is_err());
        assert!(parse_skewb("U3").is_err());
        assert!(parse_skewb("u").is_err());
    }

    /// 独立暴力对照(金标准):件级 HashMap 全空间 BFS(绕开坐标编码/约束表),
    /// 闭包态数 = 3,149,280,全空间逐态距离与坐标表对照。
    #[test]
    fn skewb_brute_force_full_space_compare() {
        let mut map: HashMap<SkewbState, u8> = HashMap::with_capacity(3_200_000);
        map.insert(SkewbState::SOLVED, 0);
        let mut frontier = vec![SkewbState::SOLVED];
        let mut d = 0u8;
        while !frontier.is_empty() {
            let mut next = Vec::new();
            for st in &frontier {
                for v in 0..8u8 {
                    let mut ns = *st;
                    ns.apply(SkewbMove { axis: v / 2, prime: v % 2 == 1 });
                    if let std::collections::hash_map::Entry::Vacant(e) = map.entry(ns) {
                        e.insert(d + 1);
                        next.push(ns);
                    }
                }
            }
            d += 1;
            frontier = next;
        }
        assert_eq!(map.len(), SKEWB_STATES, "brute closure size mismatch");

        let s = SkewbSolver::new();
        assert_eq!(s.max_depth(), *map.values().max().unwrap());
        for (st, &dv) in &map {
            assert_eq!(s.dist[encode(st)], dv, "dist mismatch {:?}", st);
        }
    }

    /// 随机词 IDDFS oracle:短打乱直接件级迭代加深搜索(绕开距离表)与 solve_one 逐一相等。
    #[test]
    fn skewb_iddfs_oracle() {
        let s = SkewbSolver::new();

        fn dfs(st: &SkewbState, depth: u32, prev_axis: i32) -> bool {
            if depth == 0 {
                return *st == SkewbState::SOLVED;
            }
            for v in 0..8u8 {
                let axis = v / 2;
                // 同轴连续两步必可合并,剪掉(不破坏最优性)
                if prev_axis == axis as i32 {
                    continue;
                }
                let mut ns = *st;
                ns.apply(SkewbMove { axis, prime: v % 2 == 1 });
                if dfs(&ns, depth - 1, axis as i32) {
                    return true;
                }
            }
            false
        }

        for seed in 0..24u64 {
            let len = 1 + (seed as usize) % 5;
            let alg = pseudo_word(3000 + seed, len);
            let got = s.solve_one(&alg);
            assert!(got as usize <= len, "seed={}", seed);
            let mut st = SkewbState::SOLVED;
            st.apply_all(&alg);
            let mut want = u32::MAX;
            for dd in 0..=len as u32 {
                if dfs(&st, dd, -1) {
                    want = dd;
                    break;
                }
            }
            assert_eq!(got, want, "seed={} alg={:?}", seed, alg);
        }
    }

    /// enumerate 物理 replay:打乱 + 解 → 全归位;len 一致;解串可解析回同序列。
    #[test]
    fn skewb_enumerate_replay_to_solved() {
        let s = SkewbSolver::new();
        for seed in 0..60u64 {
            let len = 1 + (seed as usize) % 25;
            let alg = pseudo_word(7000 + seed, len);
            let best = s.solve_one(&alg);
            let sol = s.enumerate(&alg);
            assert_eq!(sol.len, best, "seed={}", seed);
            assert_eq!(sol.len as usize, sol.moves.len());

            let mut st = SkewbState::SOLVED;
            st.apply_all(&alg);
            st.apply_all(&sol.moves);
            assert_eq!(st, SkewbState::SOLVED, "solution not solved, seed={}", seed);

            // 解串可解析回同序列(P4d 在线求解器显示用)
            assert_eq!(parse(&sol.to_string_moves()), sol.moves);
        }
        let sol = s.enumerate(&[]);
        assert_eq!(sol.len, 0);
    }

    /// from_dist(落盘表直载,浏览器秒算路径)与全构造逐态相等,且解一致。
    #[test]
    fn from_dist_matches_full() {
        let full = SkewbSolver::new();
        let loaded = SkewbSolver::from_dist(full.dist_bytes().to_vec());
        assert_eq!(loaded.dist, full.dist, "from_dist dist != full dist");
        assert_eq!(loaded.solved, full.solved);
        for seed in 0..40u64 {
            let len = 1 + (seed as usize) % 25;
            let alg = pseudo_word(27000 + seed, len);
            assert_eq!(loaded.solve_one(&alg), full.solve_one(&alg), "seed={}", seed);
            let sol = loaded.enumerate(&alg);
            let mut st = SkewbState::SOLVED;
            st.apply_all(&alg);
            st.apply_all(&sol.moves);
            assert_eq!(st, SkewbState::SOLVED, "loaded solution not solved, seed={}", seed);
        }
    }
}
