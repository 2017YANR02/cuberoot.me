//! pyraminx_solver: Pyraminx(金字塔)全空间最优求解器(key `pyraminx`)。
//!
//! 语义:对任意 WCA pyram 打乱(大写 U/L/R/B 核心 move + 小写 u/l/r/b 顶点 tip move,
//! 均带可选 ')求最优解步数 + 一条最优解。喂 /scramble 统计管道(每打乱最优长度分桶)。
//!
//! 状态模型(独立 puzzle,0 复用 cube_common;件集合/循环从 cstimer pyraminx.js +
//! 四面体几何独立推导,两者逐项吻合):
//!   - 6 棱:位置 0=FR 1=FL 2=FD 3=RL 4=RD 5=LD(面 F/R/L/D;R=右面 {U,R,B} 顶点,
//!     L=左面 {U,L,B},D=底面 {L,R,B},F=前面 {U,L,R})。偶置换 6!/2=360,
//!     翻转和恒偶 2^5=32(每个大写 move 恰翻 2 棱)。
//!   - 4 轴心块(axial centers,顶点正下方的大块):永不换位,只有朝向 3^4=81(自由)。
//!     轴序 0=U 1=L 2=R 3=B(= move 轴序)。
//!   - 核心全空间 = 360×32×81 = 933,120(全可达,测试闭包验证)。
//!   - 4 顶点 tips:朝向 3^4=81,独立 trivial。含 tips 全空间 = 933,120×81 = 75,582,720
//!     (测试用 16-move 联合 BFS 全枚举验证)。
//!
//! 大写 move 几何推导(WCA:U = 看着该顶点顺时针 120°;Rodrigues 实算顶点循环,
//! 与 cstimer movePieces/moveOris 完全一致):
//!   U cw: 棱 0→1→3→0,到位翻转 [1,1,0];轴心/tip U +1
//!   L cw: 棱 1→2→5→1,翻转 [1,1,0];轴心/tip L +1
//!   R cw: 棱 0→4→2→0,翻转 [0,1,1];轴心/tip R +1
//!   B cw: 棱 3→5→4→3,翻转 [0,1,1];轴心/tip B +1
//!   小写 tip move 只转该 tip(±1)。
//!
//! 步数口径(P3a 锁定,精确非近似):总 HTM = 核心最优(查表)+ #错位 tips,其中
//! 错位 tip 定义为 r_i = (tip_i − 轴心co_i) mod 3 ≠ 0。定理:大写 move 对 tip 与同轴
//! 轴心同加 ⇒ r_i 在大写下不变;任何解的大写子序列必须解核心(≥核心距离),且
//! Σ小写_i ≡ −r_i ⇒ r_i≠0 的轴至少 1 个小写;反向可达 ⇒ 联合最优恰 = 核心距离 + #{r_i≠0}。
//! (测试:短词 16-move 联合 IDDFS 对照 + 75,582,720 全空间联合 BFS 逐态对照。)
//!
//! 度量:HTM(120° 一步,无半转记号;X' = X²)。实测 God's number:核心 11
//! (距离分布与 jaapsch.net/puzzles/pyraminx.htm 公开表逐项锁定),含 tips 15。
//! 全表 BFS 零盘表:核心距离表 933,120 B ≈ 0.9MB 现场建,查长度 O(1),首达即最优。

/// 棱循环(content 在 CYC[a][i] → CYC[a][(i+1)%3],顺时针一步)。
const CYC: [[usize; 3]; 4] = [[0, 1, 3], [1, 2, 5], [0, 4, 2], [3, 5, 4]];
/// 到位翻转:FLP[a][i] = 从 CYC[a][i] 移到 CYC[a][(i+1)%3] 时 eo 异或值。
const FLP: [[u8; 3]; 4] = [[1, 1, 0], [1, 1, 0], [0, 1, 1], [0, 1, 1]];

/// 轴名(move 轴序 = 轴心/tip 下标序)。
pub const AXIS_NAMES: [char; 4] = ['U', 'L', 'R', 'B'];

/// 偶置换 360 × 翻转 32 × 轴心 81。
pub const PYRA_EP: usize = 360;
pub const PYRA_EO: usize = 32;
pub const PYRA_CO: usize = 81;
/// 核心全空间。
pub const PYRA_CORE_STATES: usize = PYRA_EP * PYRA_EO * PYRA_CO; // 933,120
/// 含 tips 全空间(仅测试联合 BFS 用)。
pub const PYRA_FULL_STATES: usize = PYRA_CORE_STATES * 81; // 75,582,720

/// 一个 pyraminx move:axis 0..4(U/L/R/B),prime = '(逆时针),tip = 小写。
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct PyraMove {
    pub axis: u8,
    pub prime: bool,
    pub tip: bool,
}

impl PyraMove {
    pub fn name(&self) -> String {
        let c = AXIS_NAMES[self.axis as usize];
        let c = if self.tip { c.to_ascii_lowercase() } else { c };
        format!("{}{}", c, if self.prime { "'" } else { "" })
    }
}

/// 解析 WCA pyram 记号(空白分隔;U L R B u l r b,后缀 '' / ' / 2,2 视作两次=逆)。
pub fn parse_pyraminx(s: &str) -> Result<Vec<PyraMove>, String> {
    let mut out = Vec::new();
    for tok in s.split_whitespace() {
        let mut ch = tok.chars();
        let head = ch.next().ok_or("empty token")?;
        let axis = match head.to_ascii_uppercase() {
            'U' => 0u8,
            'L' => 1,
            'R' => 2,
            'B' => 3,
            _ => return Err(format!("bad pyraminx token: {}", tok)),
        };
        let prime = match ch.as_str() {
            "" => false,
            "'" | "2" | "2'" | "'2" => true, // 阶 3:X2 = X'
            _ => return Err(format!("bad pyraminx suffix: {}", tok)),
        };
        out.push(PyraMove { axis, prime, tip: head.is_ascii_lowercase() });
    }
    Ok(out)
}

/// 件级全状态(棱 位置→件 / 位置→翻转,轴心朝向,tip 朝向)。
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub struct PyraState {
    pub ep: [u8; 6],
    pub eo: [u8; 6],
    pub co: [u8; 4],
    pub tips: [u8; 4],
}

impl PyraState {
    pub const SOLVED: PyraState =
        PyraState { ep: [0, 1, 2, 3, 4, 5], eo: [0; 6], co: [0; 4], tips: [0; 4] };

    /// 大写顺时针一步(120°)。
    fn apply_core_cw(&mut self, axis: usize) {
        let c = CYC[axis];
        let f = FLP[axis];
        let e = [self.ep[c[0]], self.ep[c[1]], self.ep[c[2]]];
        let o = [self.eo[c[0]], self.eo[c[1]], self.eo[c[2]]];
        self.ep[c[1]] = e[0];
        self.eo[c[1]] = o[0] ^ f[0];
        self.ep[c[2]] = e[1];
        self.eo[c[2]] = o[1] ^ f[1];
        self.ep[c[0]] = e[2];
        self.eo[c[0]] = o[2] ^ f[2];
        self.co[axis] = (self.co[axis] + 1) % 3;
        self.tips[axis] = (self.tips[axis] + 1) % 3;
    }

    pub fn apply(&mut self, mv: PyraMove) {
        let pow = if mv.prime { 2 } else { 1 };
        if mv.tip {
            let a = mv.axis as usize;
            self.tips[a] = (self.tips[a] + pow) % 3;
        } else {
            for _ in 0..pow {
                self.apply_core_cw(mv.axis as usize);
            }
        }
    }

    pub fn apply_all(&mut self, alg: &[PyraMove]) {
        for &m in alg {
            self.apply(m);
        }
    }

    /// 错位 tip 数:r_i = (tip_i − co_i) mod 3 ≠ 0 的轴数(大写 move 不变量,见模块注释)。
    pub fn bad_tips(&self) -> u32 {
        (0..4).filter(|&i| self.tips[i] != self.co[i]).count() as u32
    }
}

const FACT5: [usize; 5] = [120, 24, 6, 2, 1]; // (5-i)! for i=0..4

/// 偶置换 rank:Lehmer rank(0..719)>>1 双射到 0..359(相邻两 rank 必一奇一偶)。
fn ep_rank(ep: &[u8; 6]) -> usize {
    let mut r = 0usize;
    for i in 0..5 {
        let mut c = 0usize;
        for j in (i + 1)..6 {
            if ep[j] < ep[i] {
                c += 1;
            }
        }
        r += c * FACT5[i];
    }
    r >> 1
}

fn lehmer_decode(mut r: usize) -> ([u8; 6], usize) {
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

fn ep_unrank(idx: usize) -> [u8; 6] {
    let (p, sum) = lehmer_decode(idx << 1);
    if sum % 2 == 0 {
        p
    } else {
        let (p2, sum2) = lehmer_decode((idx << 1) | 1);
        debug_assert_eq!(sum2 % 2, 0);
        p2
    }
}

/// 翻转 rank:前 5 位(第 6 位由和恒偶定)。
fn eo_rank(eo: &[u8; 6]) -> usize {
    (0..5).fold(0usize, |a, i| a | ((eo[i] as usize) << i))
}

fn eo_unrank(idx: usize) -> [u8; 6] {
    let mut eo = [0u8; 6];
    let mut s = 0u8;
    for (i, v) in eo.iter_mut().enumerate().take(5) {
        *v = ((idx >> i) & 1) as u8;
        s ^= *v;
    }
    eo[5] = s;
    eo
}

/// 轴心朝向 rank:Σ co[i]·3^i。
fn co_rank(co: &[u8; 4]) -> usize {
    co.iter().rev().fold(0usize, |a, &x| a * 3 + x as usize)
}

fn co_unrank(mut idx: usize) -> [u8; 4] {
    let mut co = [0u8; 4];
    for v in co.iter_mut() {
        *v = (idx % 3) as u8;
        idx /= 3;
    }
    co
}

fn encode_core(st: &PyraState) -> usize {
    (ep_rank(&st.ep) * PYRA_EO + eo_rank(&st.eo)) * PYRA_CO + co_rank(&st.co)
}

fn decode_core(idx: usize) -> PyraState {
    let co = co_unrank(idx % PYRA_CO);
    let r = idx / PYRA_CO;
    PyraState { ep: ep_unrank(r / PYRA_EO), eo: eo_unrank(r % PYRA_EO), co, tips: [0; 4] }
}

/// 一条最优解:core 为大写 move 序列,tips 为小写收尾;len = core.len()+tips.len()。
#[derive(Clone, Debug)]
pub struct PyraminxSol {
    pub len: u32,
    pub core: Vec<PyraMove>,
    pub tips: Vec<PyraMove>,
}

impl PyraminxSol {
    pub fn to_string_moves(&self) -> String {
        self.core
            .iter()
            .chain(self.tips.iter())
            .map(|m| m.name())
            .collect::<Vec<_>>()
            .join(" ")
    }
}

pub struct PyraminxSolver {
    /// 核心联合移动表 933,120 × 8(U U' L L' R R' B B'),~29.9MB。
    mt: Vec<u32>,
    /// 核心全空间精确距离(0.9MB,现场 BFS,零盘表)。
    dist: Vec<u8>,
    solved: usize,
}

impl Default for PyraminxSolver {
    fn default() -> Self {
        Self::new()
    }
}

impl PyraminxSolver {
    /// 全自包含构造(移动表 + 全空间 BFS,~1s)。
    pub fn new() -> Self {
        let mut mt = vec![0u32; PYRA_CORE_STATES * 8];
        for idx in 0..PYRA_CORE_STATES {
            let st = decode_core(idx);
            for m in 0..8u8 {
                let mut s2 = st;
                s2.apply(PyraMove { axis: m / 2, prime: m % 2 == 1, tip: false });
                mt[idx * 8 + m as usize] = encode_core(&s2) as u32;
            }
        }

        let solved = encode_core(&PyraState::SOLVED);
        let mut dist = vec![255u8; PYRA_CORE_STATES];
        dist[solved] = 0;
        let mut frontier = vec![solved as u32];
        let mut d = 0u8;
        while !frontier.is_empty() {
            let mut next = Vec::new();
            for &i in &frontier {
                let base = i as usize * 8;
                for m in 0..8 {
                    let ni = mt[base + m] as usize;
                    if dist[ni] == 255 {
                        dist[ni] = d + 1;
                        next.push(ni as u32);
                    }
                }
            }
            d += 1;
            frontier = next;
        }

        PyraminxSolver { mt, dist, solved }
    }

    /// 核心距离表最大深度(实测核心 God's number)。
    pub fn max_depth(&self) -> u8 {
        self.dist.iter().copied().filter(|&v| v != 255).max().unwrap_or(0)
    }

    /// 核心各深度态数分布。
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

    fn state_after(alg: &[PyraMove]) -> PyraState {
        let mut st = PyraState::SOLVED;
        st.apply_all(alg);
        st
    }

    /// 核心最优步数(不含 tips)。
    pub fn core_len(&self, alg: &[PyraMove]) -> u32 {
        self.dist[encode_core(&Self::state_after(alg))] as u32
    }

    /// 总最优 = 核心最优 + #错位 tips(口径见模块注释,精确)。
    pub fn solve_one(&self, alg: &[PyraMove]) -> u32 {
        let st = Self::state_after(alg);
        self.dist[encode_core(&st)] as u32 + st.bad_tips()
    }

    /// (核心步数, tip 步数)拆分。
    pub fn solve_split(&self, alg: &[PyraMove]) -> (u32, u32) {
        let st = Self::state_after(alg);
        (self.dist[encode_core(&st)] as u32, st.bad_tips())
    }

    /// 一条最优解:核心回溯距离表 + 小写收尾(r_i=1 → x',r_i=2 → x)。
    pub fn enumerate(&self, alg: &[PyraMove]) -> PyraminxSol {
        let st0 = Self::state_after(alg);
        let mut cur = encode_core(&st0);
        let mut d = self.dist[cur];
        let mut core = Vec::with_capacity(d as usize);
        while d > 0 {
            let base = cur * 8;
            let mut stepped = false;
            for m in 0..8u8 {
                let ni = self.mt[base + m as usize] as usize;
                if self.dist[ni] == d - 1 {
                    core.push(PyraMove { axis: m / 2, prime: m % 2 == 1, tip: false });
                    cur = ni;
                    d -= 1;
                    stepped = true;
                    break;
                }
            }
            assert!(stepped, "distance table walk stuck");
        }
        debug_assert_eq!(cur, self.solved);
        let mut tips = Vec::new();
        for i in 0..4u8 {
            // 核心解后 tip_i = r_i(不随核心解选取变,见模块注释)。
            let r = (st0.tips[i as usize] + 3 - st0.co[i as usize]) % 3;
            if r != 0 {
                tips.push(PyraMove { axis: i, prime: r == 1, tip: true });
            }
        }
        let len = (core.len() + tips.len()) as u32;
        PyraminxSol { len, core, tips }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    /// jaapsch.net/puzzles/pyraminx.htm 公开核心距离分布(2026-06-11 抓取核对)。
    const JAAPSCH_CORE_HIST: [usize; 12] =
        [1, 8, 48, 288, 1728, 9896, 51808, 220111, 480467, 166276, 2457, 32];

    fn lcg(x: u64) -> u64 {
        x.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407)
    }

    /// 确定性伪随机词。core_only=true 只出大写。
    fn pseudo_word(seed: u64, len: usize, core_only: bool) -> Vec<PyraMove> {
        let mut x = lcg(seed);
        let mut out = Vec::with_capacity(len);
        for _ in 0..len {
            x = lcg(x);
            let v = (x >> 33) as usize % if core_only { 8 } else { 16 };
            out.push(PyraMove {
                axis: (v % 8 / 2) as u8,
                prime: v % 2 == 1,
                tip: v >= 8,
            });
        }
        out
    }

    fn parse(s: &str) -> Vec<PyraMove> {
        parse_pyraminx(s).unwrap()
    }

    #[test]
    fn pyraminx_basics() {
        let s = PyraminxSolver::new();

        assert_eq!(PYRA_CORE_STATES, 933_120);
        assert_eq!(PYRA_FULL_STATES, 75_582_720);
        assert_eq!(s.dist.len(), PYRA_CORE_STATES);

        // 全可达 + solved 唯一
        assert!(s.dist.iter().all(|&v| v != 255), "unreachable core state");
        assert_eq!(s.dist.iter().filter(|&&v| v == 0).count(), 1);

        // 阶 3:X X X = id;X X' = id(件级)
        for a in 0..4u8 {
            let mut st = PyraState::SOLVED;
            for _ in 0..3 {
                st.apply(PyraMove { axis: a, prime: false, tip: false });
            }
            assert_eq!(st, PyraState::SOLVED, "axis {} order != 3", a);
        }
        let mut st = PyraState::SOLVED;
        st.apply_all(&parse("U U' L L' R R' B B' u u' l l' r r' b b'"));
        assert_eq!(st, PyraState::SOLVED);

        // 每个大写 move 恰翻 2 棱(eo 和恒偶)
        for a in 0..4u8 {
            let mut st = PyraState::SOLVED;
            st.apply(PyraMove { axis: a, prime: false, tip: false });
            assert_eq!(st.eo.iter().filter(|&&o| o == 1).count(), 2, "axis {}", a);
        }

        // 已知值:单大写 1(tip 随轴同转,r=0 不加步);单小写 1;U u' = 2(核心 1 + 坏 tip 1)
        assert_eq!(s.solve_one(&[]), 0);
        assert_eq!(s.solve_one(&parse("U")), 1);
        assert_eq!(s.solve_one(&parse("L'")), 1);
        assert_eq!(s.solve_one(&parse("u")), 1);
        assert_eq!(s.solve_one(&parse("b'")), 1);
        assert_eq!(s.solve_one(&parse("U u'")), 2);
        assert_eq!(s.solve_one(&parse("R R'")), 0);
        assert_eq!(s.solve_split(&parse("u l r b")), (0, 4));

        // 核心 God's number = 11,分布与 jaapsch 公开表逐项锁定
        assert_eq!(s.max_depth(), 11);
        let h = s.depth_histogram();
        assert_eq!(h, JAAPSCH_CORE_HIST.to_vec());
        assert_eq!(h.iter().sum::<usize>(), PYRA_CORE_STATES);

        // 解析:WCA 真实样例形状 + 非法 token 报错
        assert!(parse_pyraminx("U' L R' B U' R L' B' u' l r b'").is_ok());
        assert!(parse_pyraminx("X").is_err());
        assert!(parse_pyraminx("U3").is_err());
    }

    /// 独立暴力对照(金标准):件级 HashMap 全空间 BFS(绕开坐标编码/移动表),
    /// 闭包态数 = 933,120,全空间逐态距离与坐标表对照。
    #[test]
    fn brute_force_full_space_compare() {
        let mut map: HashMap<PyraState, u8> = HashMap::with_capacity(1_000_000);
        map.insert(PyraState::SOLVED, 0);
        let mut frontier = vec![PyraState::SOLVED];
        let mut d = 0u8;
        while !frontier.is_empty() {
            let mut next = Vec::new();
            for st in &frontier {
                for m in 0..8u8 {
                    let mut ns = *st;
                    ns.apply(PyraMove { axis: m / 2, prime: m % 2 == 1, tip: false });
                    ns.tips = [0; 4]; // 核心闭包:tips 不参与(大写会动 tips,清零归核心)
                    if let std::collections::hash_map::Entry::Vacant(e) = map.entry(ns) {
                        e.insert(d + 1);
                        next.push(ns);
                    }
                }
            }
            d += 1;
            frontier = next;
        }
        assert_eq!(map.len(), PYRA_CORE_STATES, "brute closure size mismatch");

        let s = PyraminxSolver::new();
        assert_eq!(s.max_depth(), *map.values().max().unwrap());
        for (st, &dv) in &map {
            assert_eq!(s.dist[encode_core(st)], dv, "core mismatch {:?}", st);
        }
    }

    /// 口径独立验证:短打乱(全 16 记号)联合 IDDFS(直接搜大写+小写,目标全归位,
    /// 绕开「核心+tips 相加」公式)与 solve_one 逐一相等。
    #[test]
    fn joint_iddfs_matches_additive_metric() {
        let s = PyraminxSolver::new();

        fn dfs(st: &PyraState, depth: u32, prev: i32) -> bool {
            if depth == 0 {
                return *st == PyraState::SOLVED;
            }
            for v in 0..16u8 {
                let class = v / 2; // 同 (轴,大小写) 类连续两步必可合并,剪掉
                if prev >= 0 && class == prev as u8 / 2 {
                    continue;
                }
                let mut ns = *st;
                ns.apply(PyraMove { axis: v % 8 / 2, prime: v % 2 == 1, tip: v >= 8 });
                if dfs(&ns, depth - 1, v as i32) {
                    return true;
                }
            }
            false
        }

        for seed in 0..24u64 {
            let len = 1 + (seed as usize) % 5;
            let alg = pseudo_word(3000 + seed, len, false);
            let got = s.solve_one(&alg);
            assert!(got as usize <= len, "seed={}", seed);
            let mut st = PyraState::SOLVED;
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

    /// enumerate 物理 replay:打乱 + 核心解 + tip 解 → 全归位(含 tips);len 一致。
    #[test]
    fn enumerate_replay_to_solved() {
        let s = PyraminxSolver::new();
        for seed in 0..60u64 {
            let len = 1 + (seed as usize) % 25;
            let alg = pseudo_word(7000 + seed, len, false);
            let best = s.solve_one(&alg);
            let sol = s.enumerate(&alg);
            assert_eq!(sol.len, best, "seed={}", seed);
            assert_eq!(sol.len as usize, sol.core.len() + sol.tips.len());
            assert!(sol.core.iter().all(|m| !m.tip));
            assert!(sol.tips.iter().all(|m| m.tip));

            let mut st = PyraState::SOLVED;
            st.apply_all(&alg);
            st.apply_all(&sol.core);
            st.apply_all(&sol.tips);
            assert_eq!(st, PyraState::SOLVED, "solution not solved, seed={}", seed);

            // 解串可解析回同序列(P3d 在线求解器显示用)
            assert_eq!(parse(&sol.to_string_moves()).len(), sol.len as usize);
        }
        let sol = s.enumerate(&[]);
        assert_eq!(sol.len, 0);
    }

    /// 含 tips 全空间联合 BFS(16 move,75,582,720 态):闭包态数、God's number = 15、
    /// 逐态「联合距离 == 核心距离 + #错位 tips」(口径全空间证真)、分布 = 核心⊗tips 卷积。
    #[test]
    fn full_space_with_tips_bfs() {
        let s = PyraminxSolver::new();

        // 联合索引 = core*81 + Σ tips[i]·3^i;大写 m:core 走 mt,tip[axis] +1/+2;小写只动 tip。
        const P3: [usize; 4] = [1, 3, 9, 27];
        let start = s.solved * 81; // solved 核心 + tips 全 0
        let mut dist = vec![255u8; PYRA_FULL_STATES];
        dist[start] = 0;
        let mut frontier = vec![start as u32];
        let mut d = 0u8;
        let mut reached = 1usize;
        while !frontier.is_empty() {
            let mut next = Vec::new();
            for &i in &frontier {
                let idx = i as usize;
                let (core, tips) = (idx / 81, idx % 81);
                for m in 0..8usize {
                    // 大写:核心转移 + 同轴 tip 同加
                    let a = m / 2;
                    let add = 1 + m % 2; // cw=+1, ccw=+2
                    let td = (tips / P3[a]) % 3;
                    let nt = tips + ((td + add) % 3) * P3[a] - td * P3[a];
                    let ni = s.mt[core * 8 + m] as usize * 81 + nt;
                    if dist[ni] == 255 {
                        dist[ni] = d + 1;
                        reached += 1;
                        next.push(ni as u32);
                    }
                    // 小写:只动 tip
                    let ni = core * 81 + nt;
                    if dist[ni] == 255 {
                        dist[ni] = d + 1;
                        reached += 1;
                        next.push(ni as u32);
                    }
                }
            }
            d += 1;
            frontier = next;
        }
        assert_eq!(reached, PYRA_FULL_STATES, "joint closure size mismatch");

        // 逐态:联合距离 == 核心距离 + #{tip_i != co_i}(co = core 低 81 分量)
        let mut hist = vec![0usize; 16];
        for (idx, &dv) in dist.iter().enumerate() {
            let (core, tips) = (idx / 81, idx % 81);
            let co = core % 81;
            let mut bad = 0u8;
            for a in 0..4 {
                if (tips / P3[a]) % 3 != (co / P3[a]) % 3 {
                    bad += 1;
                }
            }
            assert_eq!(dv, s.dist[core] + bad, "additive metric mismatch idx={}", idx);
            hist[dv as usize] += 1;
        }

        // God's number 含 tips = 15;分布 = 核心分布 ⊗ tips 坏数分布 [1,8,24,32,16]
        assert_eq!(dist.iter().copied().max().unwrap(), 15);
        let tipdist = [1usize, 8, 24, 32, 16]; // C(4,k)·2^k
        let core_h = s.depth_histogram();
        let mut expect = vec![0usize; 16];
        for (dc, &nc) in core_h.iter().enumerate() {
            for (k, &nk) in tipdist.iter().enumerate() {
                expect[dc + k] += nc * nk;
            }
        }
        assert_eq!(hist, expect, "joint histogram != core ⊗ tips convolution");
        assert_eq!(hist.iter().sum::<usize>(), PYRA_FULL_STATES);
    }
}

