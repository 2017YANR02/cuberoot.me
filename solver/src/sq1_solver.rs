//! sq1_solver: Square-1 (SQ1) 最优求解器(twist metric,双阶段 search + 投影剪枝表,零盘表)。
//!
//! ## 状态模型(独立于 cube_common,0 复用 —— SQ1 非 3x3 puzzle)
//! 照 cstimer `scramble_sq1_new.js` 的 SqCubie:上下两层各 12 个 30° 槽位,每槽 4bit 件 id;
//! 角占相邻 2 槽(同 id 出现两次),棱占 1 槽。件 id(十六进制,cstimer 同款):
//! 上层棱 {0,2,4,6} 角 {1,3,5,7},下层棱 {8,a,c,e} 角 {9,b,d,f};id 奇 = 角,id<8 = 上层 home。
//! 中层 ml ∈ {0,1},每次 slash 翻转;solved 要求 ml = 0。
//! top/bottom 各打包 u64 低 48 位(槽 0 在最高 nibble);层转 = 48bit 循环左移(piece 槽 i ← 槽 i+k),
//! slash = 交换 top 低 24 位(槽 6..11)与 bottom 高 24 位(槽 12..17),合法当且仅当
//! 两层切缝(槽 5|6、11|0 及下层对应)都不劈开角块。
//!
//! ## 记号与方向(对 cstimer 锁死,勿凭直觉改)
//! WCA 记号 `(x,y)` + `/`。cstimer `image.js::scrImage` 权威语义:token (x,y) =
//! `doMove((x+12)%12)` + `doMove(-((y+12)%12))`,折算到本编码 = top rotl (x mod 12)、
//! bottom rotl (y mod 12);`/` = slash。序列化把转量 a∈0..12 规整为 x ∈ (-5..=6]。
//!
//! ## 步数口径(定死)
//! **twist metric**:`/`(slash)计 1 步,`(x,y)` 层转计 **0** 步(自由)。SQ1 文献中
//! "twist" 即 slash。公开数据(Jaap Scherphuis, https://www.jaapsch.net/puzzles/square1.htm,
//! God's algorithm 由 Mike Masonjones 计算):**God's number = 13 twists**(均值 10.615;
//! 忽略中层则 12 —— 与本实现"twist 距离奇偶 ≡ ml"的守恒一致:slash 翻转 ml,solved ml=0)。
//! 逐深度分布(按层转等价类计,总 435,891,456,000):0:1, 1:64, 2:1153, 3:17050, 4:235144 …
//! 浅层在测试里独立 BFS 逐项锁死。另一公开口径 face-turn metric(层转到另一合法对位计 1、
//! slash 计 1;态数 11,958,666,854,400 = 3678·8!·8!·2,God = 31)用来锁机械正确性:
//! 深度 0..6 = 1, 15, 69, 212, 1141, 3933, 14029(同页)。slash-ready shape 数 = 3678
//! (解析:每半层 13 种组合 = {1,2} 拆 6 的组合数,(1+5x+6x²+x³)⁴ 的 x⁸ 系数 = 3678)。
//!
//! ## 双阶段搜索(cstimer 同构,迭代加深到 twist 最优)
//! 任何解可分解为「前缀(任意 shape)+ 后缀(每个 slash 时刻都是方形)」:对总步数 T 做
//! 奇偶步进(T ≡ ml mod 2)的 IDDFS。phase-1 在全态枚举 slash 序列,可采纳剪枝 =
//! (shape × 角归层 mask × ml)/(shape × 棱归层 mask × ml) 两张全空间投影精确表(各 1.9MB,
//! 现场 BFS);遇方形态尝试 phase-2 = 限方形子群的精确搜索(剪枝 = 角/棱 8 排列 × ml 双
//! 80KB 投影表 + canon memo)。phase-2 限制表只在方形子群内可采纳,绝不能当全局启发式
//! (最优解可能离开方形 shape)。全部表内存现场建,**零盘表**,合计 < 4.1MB。

use std::collections::HashMap;
use std::sync::OnceLock;

const MASK48: u64 = (1 << 48) - 1;
const LO24: u64 = 0xFF_FFFF;
const HI24: u64 = LO24 << 24;

/// solved 上层(槽 0..11 = 0,1,1,2,3,3,4,5,5,6,7,7;槽 0 在最高 nibble)。
pub const SOLVED_TOP: u64 = 0x0112_3345_5677;
/// solved 下层(槽 12..23 = 9,9,8,b,b,a,d,d,c,f,f,e)。
pub const SOLVED_BOTTOM: u64 = 0x998b_badd_cffe;

/// 方形层仅有的两个合法 pattern(corner-first / edge-first;第三个旋转相位角跨缝,非法)。
const SQ_PAT_A: u16 = 0x6DB;
const SQ_PAT_B: u16 = 0xDB6;

/// 总 shape 数(slash-ready 24bit 角占位 pattern),公开/解析双重锁定。
pub const SHAPE_COUNT: usize = 3678;

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub struct Sq1State {
    pub top: u64,
    pub bottom: u64,
    pub ml: u8,
}

/// WCA 记号 token:`(x,y)` 层转对(0 步)或 `/`(1 步)。
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Sq1Token {
    Turn(i8, i8),
    Slash,
}

impl Sq1State {
    pub const SOLVED: Sq1State = Sq1State { top: SOLVED_TOP, bottom: SOLVED_BOTTOM, ml: 0 };

    #[inline]
    fn rotl(v: u64, k: u32) -> u64 {
        let k = k % 12;
        if k == 0 {
            v
        } else {
            ((v << (4 * k)) | (v >> (48 - 4 * k))) & MASK48
        }
    }

    #[inline]
    fn nib(v: u64, slot: usize) -> u8 {
        ((v >> ((11 - slot) * 4)) & 0xF) as u8
    }

    /// 层转(自由,0 步):top 左旋 a 槽、bottom 左旋 b 槽。
    #[inline]
    pub fn turned(&self, a: u32, b: u32) -> Sq1State {
        Sq1State { top: Self::rotl(self.top, a), bottom: Self::rotl(self.bottom, b), ml: self.ml }
    }

    /// 该层两个切缝(槽 5|6 与 11|0)都不劈角。
    #[inline]
    fn layer_clear(v: u64) -> bool {
        Self::nib(v, 5) != Self::nib(v, 6) && Self::nib(v, 11) != Self::nib(v, 0)
    }

    #[inline]
    pub fn slash_legal(&self) -> bool {
        Self::layer_clear(self.top) && Self::layer_clear(self.bottom)
    }

    /// slash:交换 top 槽 6..11 与 bottom 槽 12..17,翻转 ml。调用方保证合法。
    #[inline]
    pub fn slashed(&self) -> Sq1State {
        Sq1State {
            top: (self.top & HI24) | (self.bottom >> 24),
            bottom: (self.bottom & LO24) | ((self.top & LO24) << 24),
            ml: self.ml ^ 1,
        }
    }

    /// 12bit 角占位 pattern(bit (11-i) = 槽 i 是角;角 = 奇 id)。
    fn layer_pattern(v: u64) -> u16 {
        let mut p = 0u16;
        for i in 0..12 {
            p |= ((Self::nib(v, i) & 1) as u16) << (11 - i);
        }
        p
    }

    pub fn is_square_shape(&self) -> bool {
        let t = Self::layer_pattern(self.top);
        let b = Self::layer_pattern(self.bottom);
        (t == SQ_PAT_A || t == SQ_PAT_B) && (b == SQ_PAT_A || b == SQ_PAT_B)
    }

    /// 层转等价类的规范 key(144 个旋转里取最小;ml 计入)。
    pub fn canon_key(&self) -> u128 {
        let mut best = u128::MAX;
        for a in 0..12 {
            let t = Self::rotl(self.top, a);
            for b in 0..12 {
                let bo = Self::rotl(self.bottom, b);
                let k = ((t as u128) << 49) | ((bo as u128) << 1) | self.ml as u128;
                if k < best {
                    best = k;
                }
            }
        }
        best
    }

    /// 应用一个 token(Slash 检查合法性)。
    pub fn apply(&mut self, t: Sq1Token) -> Result<(), String> {
        match t {
            Sq1Token::Turn(x, y) => {
                let a = ((x as i32 % 12) + 12) as u32 % 12;
                let b = ((y as i32 % 12) + 12) as u32 % 12;
                *self = self.turned(a, b);
                Ok(())
            }
            Sq1Token::Slash => {
                if !self.slash_legal() {
                    return Err("illegal slash: corner straddles the cut".into());
                }
                *self = self.slashed();
                Ok(())
            }
        }
    }
}

/// 解析 WCA 打乱串("(x,y)/ (x,y)/ … (x,y)";容忍空白,'/' 可连写)。
pub fn parse_scramble(s: &str) -> Result<Vec<Sq1Token>, String> {
    let b = s.as_bytes();
    let mut i = 0;
    let mut out = Vec::new();
    fn int(b: &[u8], i: &mut usize) -> Result<i32, String> {
        while *i < b.len() && b[*i].is_ascii_whitespace() {
            *i += 1;
        }
        let neg = *i < b.len() && b[*i] == b'-';
        if neg {
            *i += 1;
        }
        let s0 = *i;
        while *i < b.len() && b[*i].is_ascii_digit() {
            *i += 1;
        }
        if *i == s0 {
            return Err(format!("expected number at byte {}", s0));
        }
        let v: i32 = std::str::from_utf8(&b[s0..*i]).unwrap().parse().unwrap();
        Ok(if neg { -v } else { v })
    }
    while i < b.len() {
        match b[i] {
            c if c.is_ascii_whitespace() => i += 1,
            b'/' => {
                out.push(Sq1Token::Slash);
                i += 1;
            }
            b'(' => {
                i += 1;
                let x = int(b, &mut i)?;
                while i < b.len() && b[i].is_ascii_whitespace() {
                    i += 1;
                }
                if i >= b.len() || b[i] != b',' {
                    return Err(format!("expected ',' at byte {}", i));
                }
                i += 1;
                let y = int(b, &mut i)?;
                while i < b.len() && b[i].is_ascii_whitespace() {
                    i += 1;
                }
                if i >= b.len() || b[i] != b')' {
                    return Err(format!("expected ')' at byte {}", i));
                }
                i += 1;
                if x.abs() > 11 || y.abs() > 11 {
                    return Err(format!("turn out of range: ({},{})", x, y));
                }
                out.push(Sq1Token::Turn(x as i8, y as i8));
            }
            c => return Err(format!("unexpected '{}' at byte {}", c as char, i)),
        }
    }
    Ok(out)
}

/// 序列化(cstimer 风格:slash 黏在前一个转量后,"(x,y)/ (x,y)/ … (x,y)")。
pub fn scramble_to_string(ts: &[Sq1Token]) -> String {
    let mut words: Vec<String> = Vec::new();
    for t in ts {
        match t {
            Sq1Token::Turn(x, y) => words.push(format!("({},{})", x, y)),
            Sq1Token::Slash => match words.last_mut() {
                Some(w) if !w.ends_with('/') => w.push('/'),
                _ => words.push("/".into()),
            },
        }
    }
    words.join(" ")
}

/// 打乱串 → 末态(从 SOLVED 起应用)。
pub fn state_from_scramble(s: &str) -> Result<Sq1State, String> {
    let ts = parse_scramble(s)?;
    let mut st = Sq1State::SOLVED;
    for t in ts {
        st.apply(t)?;
    }
    Ok(st)
}

/// 转量 0..11 → WCA 显示值 x ∈ (-5..=6]。
fn ser_amt(a: u32) -> i8 {
    if a > 6 {
        a as i8 - 12
    } else {
        a as i8
    }
}

const FACT8: [usize; 8] = [5040, 720, 120, 24, 6, 2, 1, 1];

fn rank8(p: &[u8; 8]) -> usize {
    let mut r = 0usize;
    for i in 0..8 {
        let mut c = 0usize;
        for j in (i + 1)..8 {
            if p[j] < p[i] {
                c += 1;
            }
        }
        r += c * FACT8[i];
    }
    r
}

fn invert8(p: &[u8; 8]) -> [u8; 8] {
    let mut inv = [0u8; 8];
    for (i, &v) in p.iter().enumerate() {
        inv[v as usize] = i as u8;
    }
    inv
}

#[inline]
fn apply_action(p: &[u8; 8], m: &[u8; 8]) -> [u8; 8] {
    std::array::from_fn(|i| p[m[i] as usize])
}

/// 方形态投影:角/棱各 8 件在扫描序(top 槽 0..11 → bottom)下的排列(id>>1 ∈ 0..7)。
fn sq_proj_arrays(s: &Sq1State) -> ([u8; 8], [u8; 8]) {
    let mut cp = [0u8; 8];
    let mut ep = [0u8; 8];
    let (mut ci, mut ei) = (0usize, 0usize);
    for v in [s.top, s.bottom] {
        let mut i = 0;
        while i < 12 {
            let n = Sq1State::nib(v, i);
            if n & 1 == 1 {
                cp[ci] = n >> 1;
                ci += 1;
                i += 2;
            } else {
                ep[ei] = n >> 1;
                ei += 1;
                i += 1;
            }
        }
    }
    debug_assert!(ci == 8 && ei == 8, "sq_proj on non-square state");
    (cp, ep)
}

/// 归层投影表的件类型。
#[derive(Clone, Copy, PartialEq, Eq)]
enum MemKind {
    Corner,
    Edge,
}

/// 投影 cells:槽值约定 —— 被跟踪类型 2|home(2=下层 home,3=上层 home);
/// 非跟踪角 = 1(Edge 表),非跟踪棱 = 0(Corner 表)。
type Cells = [u8; 24];

fn cells_of_state(s: &Sq1State, kind: MemKind) -> Cells {
    let mut c = [0u8; 24];
    for (li, v) in [s.top, s.bottom].into_iter().enumerate() {
        for i in 0..12 {
            let n = Sq1State::nib(v, i);
            let corner = n & 1 == 1;
            let home_top = n < 8;
            c[li * 12 + i] = match (kind, corner) {
                (MemKind::Corner, true) => 2 | home_top as u8,
                (MemKind::Corner, false) => 0,
                (MemKind::Edge, true) => 1,
                (MemKind::Edge, false) => 2 | home_top as u8,
            };
        }
    }
    c
}

fn cells_rot(c: &Cells, a: usize, b: usize) -> Cells {
    let mut o = [0u8; 24];
    for i in 0..12 {
        o[i] = c[(i + a) % 12];
        o[12 + i] = c[12 + (i + b) % 12];
    }
    o
}

fn cells_slash(c: &Cells) -> Cells {
    let mut o = *c;
    for i in 0..6 {
        o.swap(6 + i, 12 + i);
    }
    o
}

fn cells_patterns(c: &Cells, kind: MemKind) -> (u16, u16) {
    let is_corner = |v: u8| match kind {
        MemKind::Corner => v >= 2,
        MemKind::Edge => v == 1,
    };
    let mut pt = 0u16;
    let mut pb = 0u16;
    for i in 0..12 {
        pt |= (is_corner(c[i]) as u16) << (11 - i);
        pb |= (is_corner(c[12 + i]) as u16) << (11 - i);
    }
    (pt, pb)
}

pub struct Sq1Solver {
    shapes: Vec<u32>,
    layer_valid: Vec<bool>,
    /// (shape × 角归层 mask × ml) 全空间 twist 精确距离,3678×512,旋转不变。
    cmem: Vec<u8>,
    /// 同上,棱。
    emem: Vec<u8>,
    /// 方形子群内(角 8 排列 × ml)twist 精确距离(限方形,只给 phase-2 用)。
    csq: Vec<u8>,
    /// 同上,棱。
    esq: Vec<u8>,
    identity_canon: u128,
}

impl Default for Sq1Solver {
    fn default() -> Self {
        Self::new()
    }
}

/// phase-2 memo:canon → 精确距离 / 已证下界(fail_below = 已证 dist ≥ 该值)。
struct P2Memo {
    exact: HashMap<u128, u8>,
    fail_below: HashMap<u128, u8>,
}

impl Sq1Solver {
    pub fn new() -> Sq1Solver {
        // 半层 pattern:{1,2} 拆 6 的 13 种组合(角对不跨半层边界 = 不跨切缝)。
        let halves = {
            let mut out = Vec::new();
            fn rec(j: usize, acc: u8, out: &mut Vec<u8>) {
                if j >= 6 {
                    out.push(acc);
                    return;
                }
                rec(j + 1, acc, out);
                if j + 1 < 6 {
                    rec(j + 2, acc | (1 << (5 - j)) | (1 << (5 - (j + 1))), out);
                }
            }
            rec(0, 0, &mut out);
            out.sort_unstable();
            out
        };
        assert_eq!(halves.len(), 13);

        let mut layer_valid = vec![false; 4096];
        for &hi in &halves {
            for &lo in &halves {
                layer_valid[((hi as usize) << 6) | lo as usize] = true;
            }
        }

        let mut shapes = Vec::with_capacity(SHAPE_COUNT);
        for t in 0..4096u32 {
            if !layer_valid[t as usize] {
                continue;
            }
            for b in 0..4096u32 {
                if layer_valid[b as usize] && (t.count_ones() + b.count_ones()) == 16 {
                    shapes.push((t << 12) | b);
                }
            }
        }
        assert_eq!(shapes.len(), SHAPE_COUNT);

        let mut s = Sq1Solver {
            shapes,
            layer_valid,
            cmem: Vec::new(),
            emem: Vec::new(),
            csq: Vec::new(),
            esq: Vec::new(),
            identity_canon: Sq1State::SOLVED.canon_key(),
        };
        s.cmem = s.build_mem(MemKind::Corner);
        s.emem = s.build_mem(MemKind::Edge);
        let (sig, tau, rhoc, rhoe) = derive_sq_actions();
        s.csq = build_sq(&sig, &rhoc);
        s.esq = build_sq(&tau, &rhoe);
        s
    }

    /// 全局共享实例(表现场建,首次 ~秒级)。
    pub fn shared() -> &'static Sq1Solver {
        static S: OnceLock<Sq1Solver> = OnceLock::new();
        S.get_or_init(Sq1Solver::new)
    }

    fn shape_id(&self, pt: u16, pb: u16) -> Option<usize> {
        self.shapes.binary_search(&(((pt as u32) << 12) | pb as u32)).ok()
    }

    /// 真态 → 两张归层表索引(shape_id*512 + mask*2 + ml)。None = 当前对位非法。
    fn proj(&self, s: &Sq1State) -> Option<(usize, usize)> {
        let pt = Sq1State::layer_pattern(s.top);
        let pb = Sq1State::layer_pattern(s.bottom);
        let sid = self.shape_id(pt, pb)?;
        let mut cmask = 0usize;
        let mut emask = 0usize;
        let (mut ck, mut ek) = (0usize, 0usize);
        for (v, p) in [(s.top, pt), (s.bottom, pb)] {
            let mut i = 0;
            while i < 12 {
                if (p >> (11 - i)) & 1 == 1 {
                    if Sq1State::nib(v, i) < 8 {
                        cmask |= 1 << ck;
                    }
                    ck += 1;
                    i += 2;
                } else {
                    if Sq1State::nib(v, i) < 8 {
                        emask |= 1 << ek;
                    }
                    ek += 1;
                    i += 1;
                }
            }
        }
        let base = sid * 512 + s.ml as usize;
        Some((base + cmask * 2, base + emask * 2))
    }

    /// cells 投影态 → 表索引(扫描序与 proj 严格一致)。
    fn cells_encode(&self, c: &Cells, ml: u8, kind: MemKind) -> Option<usize> {
        let (pt, pb) = cells_patterns(c, kind);
        if !self.layer_valid[pt as usize] || !self.layer_valid[pb as usize] {
            return None;
        }
        let sid = self.shape_id(pt, pb)?;
        let mut mask = 0usize;
        let mut k = 0usize;
        for (off, p) in [(0usize, pt), (12, pb)] {
            let mut i = 0;
            while i < 12 {
                if (p >> (11 - i)) & 1 == 1 {
                    if kind == MemKind::Corner {
                        if c[off + i] == 3 {
                            mask |= 1 << k;
                        }
                        k += 1;
                    }
                    i += 2;
                } else {
                    if kind == MemKind::Edge {
                        if c[off + i] == 3 {
                            mask |= 1 << k;
                        }
                        k += 1;
                    }
                    i += 1;
                }
            }
        }
        Some(sid * 512 + mask * 2 + ml as usize)
    }

    /// (shape × 归层 mask × ml) 全空间投影 BFS(从 solved 轨道,旋转 0 步闭包)。
    fn build_mem(&self, kind: MemKind) -> Vec<u8> {
        let mut dist = vec![255u8; SHAPE_COUNT * 512];
        let id_cells = cells_of_state(&Sq1State::SOLVED, kind);
        let mut frontier: Vec<(Cells, u8)> = Vec::new();
        for a in 0..12 {
            for b in 0..12 {
                let c = cells_rot(&id_cells, a, b);
                if let Some(idx) = self.cells_encode(&c, 0, kind) {
                    if dist[idx] == 255 {
                        dist[idx] = 0;
                        frontier.push((c, 0));
                    }
                }
            }
        }
        let mut d = 0u8;
        while !frontier.is_empty() {
            let mut next = Vec::new();
            for (cells, ml) in &frontier {
                for a in 0..12 {
                    for b in 0..12 {
                        let rc = cells_rot(cells, a, b);
                        let (pt, pb) = cells_patterns(&rc, kind);
                        if !self.layer_valid[pt as usize] || !self.layer_valid[pb as usize] {
                            continue;
                        }
                        let ch = cells_slash(&rc);
                        let cml = ml ^ 1;
                        let idx = self.cells_encode(&ch, cml, kind).expect("post-slash encodes");
                        if dist[idx] == 255 {
                            dist[idx] = d + 1;
                            // 旋转闭包:同轨道全部合法对位同距(不入队,子代由代表覆盖)。
                            for ra in 0..12 {
                                for rb in 0..12 {
                                    if ra == 0 && rb == 0 {
                                        continue;
                                    }
                                    let rch = cells_rot(&ch, ra, rb);
                                    if let Some(ri) = self.cells_encode(&rch, cml, kind) {
                                        if dist[ri] == 255 {
                                            dist[ri] = d + 1;
                                        }
                                    }
                                }
                            }
                            next.push((ch, cml));
                        }
                    }
                }
            }
            d += 1;
            frontier = next;
        }
        dist
    }

    #[inline]
    fn is_goal(&self, s: &Sq1State) -> bool {
        s.ml == 0 && s.canon_key() == self.identity_canon
    }

    /// 方形态的 phase-2 启发值(只限方形子群内可采纳)。
    #[inline]
    fn sq_h(&self, s: &Sq1State) -> u8 {
        let (cp, ep) = sq_proj_arrays(s);
        let ci = rank8(&cp) * 2 + s.ml as usize;
        let ei = rank8(&ep) * 2 + s.ml as usize;
        self.csq[ci].max(self.esq[ei])
    }

    /// phase-2 DFS:限"每个 slash 时刻都是方形"。成功时 path 追加获胜后缀。
    fn p2_dfs(&self, s: &Sq1State, rem: u8, allow00: bool, path: &mut Vec<(u8, u8)>) -> bool {
        let h = self.sq_h(s);
        if h > rem {
            return false;
        }
        if rem == 0 {
            return self.is_goal(s);
        }
        let tas: Vec<u32> = (0..12)
            .filter(|&a| {
                let p = Sq1State::layer_pattern(Sq1State::rotl(s.top, a));
                p == SQ_PAT_A || p == SQ_PAT_B
            })
            .collect();
        let tbs: Vec<u32> = (0..12)
            .filter(|&b| {
                let p = Sq1State::layer_pattern(Sq1State::rotl(s.bottom, b));
                p == SQ_PAT_A || p == SQ_PAT_B
            })
            .collect();
        for &a in &tas {
            for &b in &tbs {
                if !allow00 && a == 0 && b == 0 {
                    continue; // 撤销上一刀,冗余(更短解在更小 T 已搜过)
                }
                let c = s.turned(a, b).slashed();
                if !c.is_square_shape() {
                    continue;
                }
                path.push((a as u8, b as u8));
                if self.p2_dfs(&c, rem - 1, false, path) {
                    return true;
                }
                path.pop();
            }
        }
        false
    }

    /// 方形态的精确限制距离(≤ cap 才返回;成功时 path 追加后缀)。
    fn p2_dist_le(
        &self,
        s: &Sq1State,
        cap: u8,
        memo: &mut P2Memo,
        path: &mut Vec<(u8, u8)>,
    ) -> Option<u8> {
        let key = s.canon_key();
        if let Some(&d) = memo.exact.get(&key) {
            if d <= cap {
                let ok = self.p2_dfs(s, d, true, path);
                debug_assert!(ok, "memoized p2 distance not reproducible");
                return Some(d);
            }
            return None;
        }
        let mut t = self.sq_h(s);
        if (t ^ s.ml) & 1 == 1 {
            t += 1; // twist 距离奇偶 ≡ ml
        }
        if let Some(&f) = memo.fail_below.get(&key) {
            t = t.max(f);
        }
        let mut ran = false;
        while t <= cap {
            ran = true;
            if self.p2_dfs(s, t, true, path) {
                memo.exact.insert(key, t);
                return Some(t);
            }
            t += 2;
        }
        if ran {
            let e = memo.fail_below.entry(key).or_insert(0);
            *e = (*e).max(t);
        }
        None
    }

    /// phase-1 DFS(全态 slash 枚举 + 投影表剪枝 + 方形处试 phase-2 收尾)。
    fn dfs1(
        &self,
        s: &Sq1State,
        rem: u8,
        allow00: bool,
        memo: &mut P2Memo,
        path: &mut Vec<(u8, u8)>,
    ) -> bool {
        if s.is_square_shape() {
            if self.p2_dist_le(s, rem, memo, path).is_some() {
                return true;
            }
        }
        if rem == 0 {
            return false;
        }
        let (ci, ei) = self.proj(s).expect("dfs1 state must be slash-ready");
        let h = self.cmem[ci].max(self.emem[ei]);
        if h > rem {
            return false;
        }
        let tas: Vec<u32> =
            (0..12).filter(|&a| Sq1State::layer_clear(Sq1State::rotl(s.top, a))).collect();
        let tbs: Vec<u32> =
            (0..12).filter(|&b| Sq1State::layer_clear(Sq1State::rotl(s.bottom, b))).collect();
        for &a in &tas {
            for &b in &tbs {
                if !allow00 && a == 0 && b == 0 {
                    continue;
                }
                let c = s.turned(a, b).slashed();
                path.push((a as u8, b as u8));
                if self.dfs1(&c, rem - 1, false, memo, path) {
                    return true;
                }
                path.pop();
            }
        }
        false
    }

    /// 任意态的最优 twist 数 + 一条最优解(WCA token,含末尾对位转量)。
    pub fn solve_with_solution(&self, st: &Sq1State) -> (u32, Vec<Sq1Token>) {
        if self.is_goal(st) {
            let align = self.exact_align(st);
            let mut sol = Vec::new();
            if align != (0, 0) {
                sol.push(Sq1Token::Turn(ser_amt(align.0), ser_amt(align.1)));
            }
            return (0, sol);
        }
        // root 归一到合法对位(自由旋转;解装配时并回首 token)
        let (ra, rb, root) = 'norm: {
            for a in 0..12u32 {
                for b in 0..12u32 {
                    let r = st.turned(a, b);
                    if r.slash_legal() {
                        break 'norm (a, b, r);
                    }
                }
            }
            unreachable!("every layer has a slash-ready alignment");
        };
        let (ci, ei) = self.proj(&root).expect("normalized root");
        let mut t = self.cmem[ci].max(self.emem[ei]).max(1);
        if (t ^ root.ml) & 1 == 1 {
            t += 1;
        }
        let mut memo = P2Memo { exact: HashMap::new(), fail_below: HashMap::new() };
        loop {
            let mut path: Vec<(u8, u8)> = Vec::new();
            if self.dfs1(&root, t, true, &mut memo, &mut path) {
                debug_assert_eq!(path.len(), t as usize);
                let found = path.len() as u32; // 首次成功的实长(= t,防御性取实测)
                // 装配:root 归一并入第一刀;逐刀 replay 取末态求对位。
                let mut cur = *st;
                let mut sol = Vec::new();
                for (k, &(a, b)) in path.iter().enumerate() {
                    let (mut aa, mut bb) = (a as u32, b as u32);
                    if k == 0 {
                        aa = (aa + ra) % 12;
                        bb = (bb + rb) % 12;
                    }
                    if (aa, bb) != (0, 0) {
                        sol.push(Sq1Token::Turn(ser_amt(aa), ser_amt(bb)));
                    }
                    sol.push(Sq1Token::Slash);
                    cur = cur.turned(aa, bb).slashed();
                }
                let align = self.exact_align(&cur);
                if align != (0, 0) {
                    sol.push(Sq1Token::Turn(ser_amt(align.0), ser_amt(align.1)));
                }
                return (found, sol);
            }
            t += 2;
            assert!(t <= 15, "search exceeded God's-number bound (13)");
        }
    }

    /// 任意态的最优 twist 数。
    pub fn solve_one(&self, st: &Sq1State) -> u32 {
        self.solve_with_solution(st).0
    }

    /// 打乱串 → 最优 twist 数(P5b analyzer 入口)。
    pub fn solve_str(&self, scramble: &str) -> Result<u32, String> {
        Ok(self.solve_one(&state_from_scramble(scramble)?))
    }

    /// 在 identity 轨道内的态 → 旋到精确 SOLVED 的 (a,b)。
    fn exact_align(&self, s: &Sq1State) -> (u32, u32) {
        for a in 0..12 {
            if Sq1State::rotl(s.top, a) == SOLVED_TOP {
                for b in 0..12 {
                    if Sq1State::rotl(s.bottom, b) == SOLVED_BOTTOM {
                        return (a, b);
                    }
                }
            }
        }
        unreachable!("exact_align called off the identity orbit");
    }
}

/// 从 identity 轨道(覆盖全部对位变体)trace 出方形子群的槽级 action 集:
/// (slash 角 action 集 σ, slash 棱 action 集 τ, 旋转角 action 集 ρc, 旋转棱 action 集 ρe)。
/// slash 合法性只依赖对位不依赖件内容 ⇒ 该集合对任意方形态完备。
fn derive_sq_actions() -> (Vec<[u8; 8]>, Vec<[u8; 8]>, Vec<[u8; 8]>, Vec<[u8; 8]>) {
    use std::collections::HashSet;
    let id = Sq1State::SOLVED;
    let mut sig: HashSet<[u8; 8]> = HashSet::new();
    let mut tau: HashSet<[u8; 8]> = HashSet::new();
    let mut rhoc: HashSet<[u8; 8]> = HashSet::new();
    let mut rhoe: HashSet<[u8; 8]> = HashSet::new();
    for a0 in 0..12 {
        for b0 in 0..12 {
            let base = id.turned(a0, b0);
            if !base.is_square_shape() {
                continue;
            }
            let (bc, be) = sq_proj_arrays(&base);
            let (inv_c, inv_e) = (invert8(&bc), invert8(&be));
            for a in 0..12 {
                for b in 0..12 {
                    let r = base.turned(a, b);
                    if !r.is_square_shape() {
                        continue;
                    }
                    let (rc, re) = sq_proj_arrays(&r);
                    rhoc.insert(apply_action(&inv_c, &rc));
                    rhoe.insert(apply_action(&inv_e, &re));
                    let c = r.slashed();
                    if !c.is_square_shape() {
                        continue;
                    }
                    let (cc, ce) = sq_proj_arrays(&c);
                    sig.insert(apply_action(&inv_c, &cc));
                    tau.insert(apply_action(&inv_e, &ce));
                }
            }
        }
    }
    (
        sig.into_iter().collect(),
        tau.into_iter().collect(),
        rhoc.into_iter().collect(),
        rhoe.into_iter().collect(),
    )
}

/// 方形子群单件类投影 BFS(40320×2;旋转 0 步闭包,slash 计 1)。
fn build_sq(moves: &[[u8; 8]], rots: &[[u8; 8]]) -> Vec<u8> {
    let mut dist = vec![255u8; 80640];
    let id: [u8; 8] = [0, 1, 2, 3, 4, 5, 6, 7];
    let mut frontier: Vec<([u8; 8], u8)> = Vec::new();
    for r in rots {
        let p = apply_action(&id, r);
        let idx = rank8(&p) * 2;
        if dist[idx] == 255 {
            dist[idx] = 0;
            frontier.push((p, 0));
        }
    }
    let mut d = 0u8;
    while !frontier.is_empty() {
        let mut next = Vec::new();
        for (p, ml) in &frontier {
            for m in moves {
                let q = apply_action(p, m);
                let qml = ml ^ 1;
                let qi = rank8(&q) * 2 + qml as usize;
                if dist[qi] == 255 {
                    dist[qi] = d + 1;
                    for r in rots {
                        let rq = apply_action(&q, r);
                        let ri = rank8(&rq) * 2 + qml as usize;
                        if dist[ri] == 255 {
                            dist[ri] = d + 1;
                        }
                    }
                    next.push((q, qml));
                }
            }
        }
        d += 1;
        frontier = next;
    }
    dist
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashSet;

    fn lcg(x: u64) -> u64 {
        x.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407)
    }

    /// 合法 (a,b)+slash 随机游走(确定性)。返回 (末态, 每刀的转量)。
    fn random_walk(seed: u64, twists: usize) -> (Sq1State, Vec<(u32, u32)>) {
        let mut st = Sq1State::SOLVED;
        let mut x = lcg(seed);
        let mut mv = Vec::new();
        for _ in 0..twists {
            let mut opts = Vec::new();
            for a in 0..12u32 {
                if !Sq1State::layer_clear(Sq1State::rotl(st.top, a)) {
                    continue;
                }
                for b in 0..12u32 {
                    if Sq1State::layer_clear(Sq1State::rotl(st.bottom, b)) {
                        opts.push((a, b));
                    }
                }
            }
            x = lcg(x);
            let (a, b) = opts[(x >> 33) as usize % opts.len()];
            st = st.turned(a, b).slashed();
            mv.push((a, b));
        }
        (st, mv)
    }

    // ---------- 独立 oracle:朴素 [u8;24] 实现(与位打包主实现零共享) ----------

    #[derive(Clone, Copy, PartialEq, Eq, Debug)]
    struct OState {
        c: [u8; 24],
        ml: u8,
    }

    /// solved 槽位独立硬编码(不从 SOLVED_TOP 派生)。
    const O_SOLVED: OState = OState {
        c: [
            0x0, 0x1, 0x1, 0x2, 0x3, 0x3, 0x4, 0x5, 0x5, 0x6, 0x7, 0x7, //
            0x9, 0x9, 0x8, 0xb, 0xb, 0xa, 0xd, 0xd, 0xc, 0xf, 0xf, 0xe,
        ],
        ml: 0,
    };

    fn o_turn(s: &OState, a: usize, b: usize) -> OState {
        let mut o = *s;
        for i in 0..12 {
            o.c[i] = s.c[(i + a) % 12];
            o.c[12 + i] = s.c[12 + (i + b) % 12];
        }
        o
    }

    fn o_slash_legal(s: &OState) -> bool {
        s.c[5] != s.c[6] && s.c[11] != s.c[0] && s.c[17] != s.c[18] && s.c[23] != s.c[12]
    }

    fn o_slash(s: &OState) -> OState {
        let mut o = *s;
        for i in 0..6 {
            o.c.swap(6 + i, 12 + i);
        }
        o.ml ^= 1;
        o
    }

    fn o_pack(s: &OState) -> [u8; 25] {
        let mut p = [0u8; 25];
        p[..24].copy_from_slice(&s.c);
        p[24] = s.ml;
        p
    }

    fn o_goal_set() -> HashSet<[u8; 25]> {
        let mut g = HashSet::new();
        for a in 0..12 {
            for b in 0..12 {
                g.insert(o_pack(&o_turn(&O_SOLVED, a, b)));
            }
        }
        g
    }

    fn o_dfs(s: &OState, rem: usize, goal: &HashSet<[u8; 25]>) -> bool {
        if rem == 0 {
            return goal.contains(&o_pack(s));
        }
        for a in 0..12 {
            for b in 0..12 {
                let r = o_turn(s, a, b);
                if !o_slash_legal(&r) {
                    continue;
                }
                if o_dfs(&o_slash(&r), rem - 1, goal) {
                    return true;
                }
            }
        }
        false
    }

    fn o_iddfs(s: &OState, max_d: usize, goal: &HashSet<[u8; 25]>) -> Option<usize> {
        (0..=max_d).find(|&t| o_dfs(s, t, goal))
    }

    fn state_to_ostate(s: &Sq1State) -> OState {
        let mut o = OState { c: [0; 24], ml: s.ml };
        for i in 0..12 {
            o.c[i] = Sq1State::nib(s.top, i);
            o.c[12 + i] = Sq1State::nib(s.bottom, i);
        }
        o
    }

    // ---------- 测试 ----------

    /// shape 枚举、记号 round-trip、基础机械、与 oracle 的逐步交叉核对。
    #[test]
    fn sq1_shapes_notation_basics() {
        let s = Sq1Solver::shared();
        assert_eq!(s.shapes.len(), SHAPE_COUNT); // 3678,解析推导 + cstimer 一致
        assert_eq!(s.layer_valid.iter().filter(|&&v| v).count(), 169); // 13²

        // solved 自身
        assert!(Sq1State::SOLVED.slash_legal());
        assert!(Sq1State::SOLVED.is_square_shape());
        assert_eq!(s.solve_one(&Sq1State::SOLVED), 0);

        // 纯转量 = 0 twist;单刀 = 1
        assert_eq!(s.solve_str("(1,0)").unwrap(), 0);
        assert_eq!(s.solve_str("(6,6)").unwrap(), 0);
        assert_eq!(s.solve_str("/").unwrap(), 1);
        assert_eq!(s.solve_str("//").unwrap(), 0);
        assert_eq!(s.solve_str("(0,-1)/").unwrap(), 1);

        // (2,0) 后角跨缝:slash 必须报错
        assert!(state_from_scramble("(2,0)/").is_err());
        // 纯转量永远合法
        assert!(state_from_scramble("(2,0)").is_ok());

        // 记号 round-trip(生成的合法串)
        for seed in 0..20u64 {
            let (_, mv) = random_walk(900 + seed, 6);
            let mut toks = Vec::new();
            for &(a, b) in &mv {
                if (a, b) != (0, 0) {
                    toks.push(Sq1Token::Turn(ser_amt(a), ser_amt(b)));
                }
                toks.push(Sq1Token::Slash);
            }
            let txt = scramble_to_string(&toks);
            assert_eq!(parse_scramble(&txt).unwrap(), toks, "round-trip: {}", txt);
            // 串 → 态 = 直接走 token 的态
            let st = state_from_scramble(&txt).unwrap();
            let (st2, _) = random_walk(900 + seed, 6);
            assert_eq!(st, st2);
        }
        // 显示值域 (-5..=6]
        assert_eq!(ser_amt(7), -5);
        assert_eq!(ser_amt(6), 6);
        assert_eq!(ser_amt(11), -1);

        // 与 oracle 的逐步机械交叉(位打包 vs 朴素数组)
        for seed in 0..30u64 {
            let (_, mv) = random_walk(2000 + seed, 10);
            let mut a_st = Sq1State::SOLVED;
            let mut o_st = O_SOLVED;
            for &(a, b) in &mv {
                a_st = a_st.turned(a, b);
                o_st = o_turn(&o_st, a as usize, b as usize);
                assert!(a_st.slash_legal());
                assert!(o_slash_legal(&o_st));
                a_st = a_st.slashed();
                o_st = o_slash(&o_st);
                assert_eq!(state_to_ostate(&a_st), o_st, "mechanics drift, seed={}", seed);
            }
        }
    }

    /// 公开数据锁 1:face-turn metric(层转到另一合法对位=1、slash=1,具体态计数)。
    /// jaapsch.net/puzzles/square1.htm:总态 11,958,666,854,400 = 3678·8!·8!·2,God=31,
    /// 深度 0..6 = 1, 15, 69, 212, 1141, 3933, 14029。
    #[test]
    fn sq1_face_turn_metric_matches_public() {
        let pack = |s: &Sq1State| -> u128 {
            ((s.top as u128) << 49) | ((s.bottom as u128) << 1) | s.ml as u128
        };
        let mut seen: HashSet<u128> = HashSet::new();
        seen.insert(pack(&Sq1State::SOLVED));
        let mut frontier = vec![Sq1State::SOLVED];
        let mut counts = vec![1usize];
        for _ in 1..=6 {
            let mut next = Vec::new();
            for st in &frontier {
                assert!(st.slash_legal());
                let mut push = |c: Sq1State, next: &mut Vec<Sq1State>| {
                    if seen.insert(pack(&c)) {
                        next.push(c);
                    }
                };
                for a in 1..12 {
                    let c = st.turned(a, 0);
                    if Sq1State::layer_clear(c.top) {
                        push(c, &mut next);
                    }
                }
                for b in 1..12 {
                    let c = st.turned(0, b);
                    if Sq1State::layer_clear(c.bottom) {
                        push(c, &mut next);
                    }
                }
                push(st.slashed(), &mut next);
            }
            counts.push(next.len());
            frontier = next;
        }
        assert_eq!(counts, [1, 15, 69, 212, 1141, 3933, 14029]);
    }

    /// 公开数据锁 2:twist metric(只数 slash,按层转等价类计)。
    /// 同页(Masonjones God's algorithm):深度 0..4 = 1, 64, 1153, 17050, 235144;
    /// God's number = 13(忽略中层 12 ⟺ 本实现 "dist 奇偶 ≡ ml" 守恒)。
    /// BFS 证明的逐层深度同时充当已知最优案例:逐层抽样喂 solver,必须逐个相等。
    #[test]
    fn sq1_twist_metric_classes_match_public_and_known_optimal() {
        let s = Sq1Solver::shared();
        let mut seen: HashSet<u128> = HashSet::new();
        seen.insert(Sq1State::SOLVED.canon_key());
        let mut frontier = vec![Sq1State::SOLVED];
        let mut counts = vec![1usize];
        let mut samples: Vec<(Sq1State, u32)> = Vec::new();
        for d in 1..=4u32 {
            let mut next = Vec::new();
            for st in &frontier {
                for a in 0..12 {
                    if !Sq1State::layer_clear(Sq1State::rotl(st.top, a)) {
                        continue;
                    }
                    for b in 0..12 {
                        if !Sq1State::layer_clear(Sq1State::rotl(st.bottom, b)) {
                            continue;
                        }
                        let c = st.turned(a, b).slashed();
                        assert_eq!(c.ml as u32, d & 1, "ml parity must track depth");
                        if seen.insert(c.canon_key()) {
                            next.push(c);
                        }
                    }
                }
            }
            counts.push(next.len());
            // 每层取 8 个 BFS 证明最优深度的态
            for (i, st) in next.iter().enumerate() {
                if i % (next.len() / 8).max(1) == 0 && samples.len() < (d as usize) * 8 {
                    samples.push((*st, d));
                }
            }
            frontier = next;
        }
        assert_eq!(counts, [1, 64, 1153, 17050, 235144]);
        for (st, d) in samples {
            assert_eq!(s.solve_one(&st), d, "known-optimal case at BFS depth {}", d);
        }
    }

    /// 独立浅层 IDDFS oracle(朴素实现)与 solver 最优长度逐个一致。
    #[test]
    fn sq1_solver_matches_iddfs_oracle() {
        let s = Sq1Solver::shared();
        let goal = o_goal_set();
        // 24 组 ≤3 刀 + 8 组 4 刀
        for seed in 0..32u64 {
            let tw = if seed < 24 { 1 + (seed as usize) % 3 } else { 4 };
            let (st, _) = random_walk(5000 + seed, tw);
            let want = o_iddfs(&state_to_ostate(&st), tw, &goal)
                .expect("oracle must solve within walk length") as u32;
            assert_eq!(s.solve_one(&st), want, "seed={} walk={}", seed, tw);
        }
    }

    /// 随机游走不变量:dist ≤ 刀数、≤ God 13、奇偶 ≡ ml、解 replay 到精确 SOLVED。
    #[test]
    fn sq1_random_walks_solver_invariants() {
        let s = Sq1Solver::shared();
        let mut cases: Vec<u64> = Vec::new();
        for seed in 0..12u64 {
            cases.push(seed);
        }
        for seed in cases {
            let tw = 5 + (seed as usize) % 6; // 5..=10
            let (st, _) = random_walk(7000 + seed, tw);
            let (d, sol) = s.solve_with_solution(&st);
            assert!(d as usize <= tw, "seed={}", seed);
            assert!(d <= 13, "God's number bound violated, seed={}", seed);
            assert_eq!(d % 2, st.ml as u32, "parity ≡ ml, seed={}", seed);
            assert_eq!(
                sol.iter().filter(|t| **t == Sq1Token::Slash).count() as u32,
                d,
                "solution slash count = dist"
            );
            let mut r = st;
            for t in &sol {
                r.apply(*t).unwrap();
            }
            assert_eq!(
                (r.top, r.bottom, r.ml),
                (SOLVED_TOP, SOLVED_BOTTOM, 0),
                "solution must replay to exact SOLVED, seed={}",
                seed
            );
        }
        // 两条 16 刀深游走(接近 WCA 随机态难度)
        for seed in [100u64, 101] {
            let (st, _) = random_walk(seed, 16);
            let (d, sol) = s.solve_with_solution(&st);
            assert!(d <= 13, "God's number bound violated, seed={}", seed);
            assert_eq!(d % 2, st.ml as u32);
            let mut r = st;
            for t in &sol {
                r.apply(*t).unwrap();
            }
            assert_eq!((r.top, r.bottom, r.ml), (SOLVED_TOP, SOLVED_BOTTOM, 0));
        }
    }

    /// 自基线(回归锁):投影表规模 / 最大值。改表逻辑必须显式改这里(review 信号)。
    #[test]
    fn sq1_tables_baselines() {
        let s = Sq1Solver::shared();
        assert_eq!(s.cmem.len(), SHAPE_COUNT * 512);
        assert_eq!(s.emem.len(), SHAPE_COUNT * 512);
        assert_eq!(s.csq.len(), 80640);
        assert_eq!(s.esq.len(), 80640);
        let stats = |t: &[u8]| -> (usize, u8) {
            let reach = t.iter().filter(|&&v| v != 255).count();
            let mx = t.iter().filter(|&&v| v != 255).copied().max().unwrap();
            (reach, mx)
        };
        let (c_reach, c_max) = stats(&s.cmem);
        let (e_reach, e_max) = stats(&s.emem);
        let (cs_reach, cs_max) = stats(&s.csq);
        let (es_reach, es_max) = stats(&s.esq);
        eprintln!("cmem reach={} max={}", c_reach, c_max);
        eprintln!("emem reach={} max={}", e_reach, e_max);
        eprintln!("csq  reach={} max={}", cs_reach, cs_max);
        eprintln!("esq  reach={} max={}", es_reach, es_max);
        assert_eq!((c_reach, c_max), (0, 0), "fill after first run");
        assert_eq!((e_reach, e_max), (0, 0), "fill after first run");
        assert_eq!((cs_reach, cs_max), (0, 0), "fill after first run");
        assert_eq!((es_reach, es_max), (0, 0), "fill after first run");
    }
}
