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
//! **五张全空间投影精确表取 max**(各表均为到 solved 轨道的精确投影距离,max 均 9):
//! - comb:(shape × 角归层 mask × 棱归层 mask × ml)。角/棱各恒 4 件 home 上层 ⇒
//!   mask 落 C(8,4)=70 组合秩,3678×70×70(nibble 打包 ml 对折)= 18MB;
//! - c4/e4:(shape × 4 个上层 home 角/棱的具体落位 × ml),落位 = 8 槽取 4 排列
//!   8·7·6·5=1680 秩,各 6.2MB;c4b/e4b:对称的下层 home 版(逐态值与 c4/e4 互补)。
//! 历史教训:先前只用 max(角归层, 棱归层) 两张 mask 投影(max 8/9),深度 12-13 时
//! gap 4-5,16 刀随机态 IDDFS 跑 49min 不可用;现五表 max + 子节点按 h 升序扩展
//! (同 h 方形子优先,成功迭代尽快踩中解路径),16 刀单态 ≤ ~7s、浅态毫秒级。
//! 对位枚举借 cstimer Shape_TopMove 增量思路换成 LUT:pattern → 件边界 bitmask B,
//! 合法对位 a ⟺ {a, a+6} ⊆ B(两切缝都落件边界),搜索热路径零堆分配;
//! shape id 由 cstimer 二分查找改 O(1) 两表直查(base[pt] + rank[pb])。
//! 遇方形态尝试 phase-2 = 限方形子群的精确搜索(剪枝 = 角/棱 8 排列 × ml 双
//! 80KB 投影表 + canon memo,cstimer SquarePrun 同构;入口先以 sq_h+奇偶便宜判废,
//! 再算 canon)。phase-2 限制表只在方形子群内可采纳,绝不能当全局启发式
//! (最优解可能离开方形 shape)。全部表内存现场建,**零盘表**,合计 ≈ 43MB。

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
    /// cstimer FullCube_getShapeIdx 同款 nibble-LSB 聚拢位技巧(f: bit 4k → bit k)。
    #[inline]
    fn layer_pattern(v: u64) -> u16 {
        #[inline]
        fn f(mut x: u32) -> u32 {
            x |= x >> 3;
            x |= x >> 6;
            (x & 15) | ((x >> 12) & 48)
        }
        (f((v & 0x11_1111) as u32) | (f(((v >> 24) & 0x11_1111) as u32) << 6)) as u16
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

pub struct Sq1Solver {
    shapes: Vec<u32>,
    /// 合法层 pattern 表(13² 半层组合);仅测试基线断言读。
    #[allow(dead_code)]
    layer_valid: Vec<bool>,
    /// shape id O(1) 直查:sid = shape_base[pt] + rank_pb[pb](pb 在其 popcount 类内序)。
    shape_base: Vec<u32>,
    rank_pb: Vec<u16>,
    /// pattern(12bit) → 合法对位 a 的 bitmask:旋 a 后两切缝(0、6)都落件边界。
    /// 件边界集 B 由 pattern 自 slot 0 贪心铺 tiling 得出(对齐态下 tiling 唯一)。
    legal_rot: Vec<u16>,
    /// popcount=4 的 8bit mask → C(8,4)=70 组合秩(按 mask 数值序)。
    rank70: [u8; 256],
    /// 4 个 3bit 位置字段(field v = 件 v 的槽序号 0..7,互异)→ 8·7·6·5=1680 排列秩。
    rank1680: Vec<u16>,
    /// (shape × 角归层 mask × 棱归层 mask × ml) 全空间 twist 精确投影距离,
    /// 3678×70×70 字节(nibble 打包:低 nibble ml=0 / 高 ml=1;对位特定,
    /// 只在 slash 对齐态上查询)。
    comb: Vec<u8>,
    /// (shape × 4 个上层 home 角的具体落位 × ml) 全空间精确投影,3678×1680 字节(同打包)。
    c4: Vec<u8>,
    /// 同上,棱。
    e4: Vec<u8>,
    /// 对称版:4 个下层 home 角的落位(信息与 c4 互补,值逐态不同)。
    c4b: Vec<u8>,
    /// 同上,棱。五表取 max 作 phase-1 启发值。
    e4b: Vec<u8>,
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

        // O(1) shape id 两表(与 shapes 的 (pt<<12)|pb 升序一致)。
        let mut class_cnt = [0u32; 13];
        let mut rank_pb = vec![0u16; 4096];
        for p in 0..4096usize {
            if layer_valid[p] {
                let c = (p as u32).count_ones() as usize;
                rank_pb[p] = class_cnt[c] as u16;
                class_cnt[c] += 1;
            }
        }
        let mut shape_base = vec![0u32; 4096];
        let mut acc = 0u32;
        for t in 0..4096usize {
            shape_base[t] = acc;
            if layer_valid[t] {
                let need = 16usize.wrapping_sub((t as u32).count_ones() as usize);
                if need <= 12 {
                    acc += class_cnt[need];
                }
            }
        }
        assert_eq!(acc as usize, SHAPE_COUNT);

        // legal_rot:pattern → 自 slot 0 贪心铺 tiling(角占相邻 2 槽)取件边界集 B,
        // 合法对位 a ⟺ {a, a+6} ⊆ B。奇长角段(铺不平)= 非对齐 pattern,置 0。
        let mut legal_rot = vec![0u16; 4096];
        for p in 0..4096u16 {
            let mut bset = 0u16;
            let mut i = 0usize;
            let mut ok = true;
            while i < 12 {
                bset |= 1 << i;
                if (p >> (11 - i)) & 1 == 1 {
                    if i + 1 >= 12 || (p >> (11 - (i + 1))) & 1 == 0 {
                        ok = false;
                        break;
                    }
                    i += 2;
                } else {
                    i += 1;
                }
            }
            if ok {
                legal_rot[p as usize] = bset & ((bset >> 6) | (bset << 6)) & 0xFFF;
            }
        }

        let mut rank70 = [0u8; 256];
        let mut r = 0u8;
        for m in 0..256usize {
            if (m as u32).count_ones() == 4 {
                rank70[m] = r;
                r += 1;
            }
        }
        assert_eq!(r, 70);

        let mut rank1680 = vec![u16::MAX; 4096];
        let mut rr = 0u16;
        for p0 in 0..8usize {
            for p1 in 0..8usize {
                for p2 in 0..8usize {
                    for p3 in 0..8usize {
                        if p0 != p1 && p0 != p2 && p0 != p3 && p1 != p2 && p1 != p3 && p2 != p3 {
                            rank1680[p0 | (p1 << 3) | (p2 << 6) | (p3 << 9)] = rr;
                            rr += 1;
                        }
                    }
                }
            }
        }
        assert_eq!(rr, 1680);

        let mut s = Sq1Solver {
            shapes,
            layer_valid,
            shape_base,
            rank_pb,
            legal_rot,
            rank70,
            rank1680,
            comb: Vec::new(),
            c4: Vec::new(),
            e4: Vec::new(),
            c4b: Vec::new(),
            e4b: Vec::new(),
            csq: Vec::new(),
            esq: Vec::new(),
            identity_canon: Sq1State::SOLVED.canon_key(),
        };
        // 三张投影表的种子 = solved 的对应投影 id(见各 idx 函数注释)。
        let pj = |v: u64, f: &dyn Fn(u64) -> u64| -> u64 {
            let mut o = 0u64;
            for i in 0..12 {
                let n = (v >> ((11 - i) * 4)) & 0xF;
                o |= f(n) << ((11 - i) * 4);
            }
            o
        };
        let comb_map = |n: u64| (n & 1) | (n & 8);
        let c4_map = |n: u64| if n & 1 == 1 { if n < 8 { n } else { 9 } } else { 0 };
        let e4_map = |n: u64| if n & 1 == 1 { 1 } else if n < 8 { n } else { 8 };
        let c4b_map = |n: u64| if n & 1 == 1 { if n < 8 { 1 } else { n } } else { 0 };
        let e4b_map = |n: u64| if n & 1 == 1 { 1 } else if n < 8 { 0 } else { n };
        let seed = |f: &dyn Fn(u64) -> u64| Sq1State {
            top: pj(SOLVED_TOP, f),
            bottom: pj(SOLVED_BOTTOM, f),
            ml: 0,
        };
        // BFS 用展开表(×2 ml),完工后 nibble 对折打包(低 nibble ml=0,高 ml=1;
        // 255→15 哨兵),61MB → 30MB,h 查询大部分驻 L3。
        let pack_ml = |unp: Vec<u8>| -> Vec<u8> {
            let n = unp.len() / 2;
            let mut out = vec![0u8; n];
            for (j, o) in out.iter_mut().enumerate() {
                *o = unp[2 * j].min(15) | (unp[2 * j + 1].min(15) << 4);
            }
            out
        };
        s.comb = pack_ml(s.build_proj(SHAPE_COUNT * 70 * 70 * 2, seed(&comb_map), &Self::comb_idx));
        s.c4 = pack_ml(s.build_proj(SHAPE_COUNT * 1680 * 2, seed(&c4_map), &Self::c4_idx));
        s.e4 = pack_ml(s.build_proj(SHAPE_COUNT * 1680 * 2, seed(&e4_map), &Self::e4_idx));
        s.c4b = pack_ml(s.build_proj(SHAPE_COUNT * 1680 * 2, seed(&c4b_map), &Self::c4b_idx));
        s.e4b = pack_ml(s.build_proj(SHAPE_COUNT * 1680 * 2, seed(&e4b_map), &Self::e4b_idx));
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

    /// O(1) shape id(调用方保证 pt/pb 是切缝对齐合法 pattern 且总 popcount 16)。
    #[inline]
    fn shape_id(&self, pt: u16, pb: u16) -> usize {
        (self.shape_base[pt as usize] + self.rank_pb[pb as usize] as u32) as usize
    }

    /// 单层扫描:按 pattern tiling 序提取(角 home 位串, 棱 home 位串, 角数, 棱数)。
    /// 只对切缝对齐的层调用(贪心铺与真实 tiling 一致)。
    #[inline]
    fn layer_scan(v: u64, p: u16) -> (u8, u8, u32, u32) {
        let (mut cb, mut eb) = (0u8, 0u8);
        let (mut nc, mut ne) = (0u32, 0u32);
        let mut i = 0usize;
        while i < 12 {
            let home_top = (Sq1State::nib(v, i) & 8) == 0;
            if (p >> (11 - i)) & 1 == 1 {
                cb |= (home_top as u8) << nc;
                nc += 1;
                i += 2;
            } else {
                eb |= (home_top as u8) << ne;
                ne += 1;
                i += 1;
            }
        }
        (cb, eb, nc, ne)
    }

    /// 联合表索引(((sid×70 + 角 mask 秩)×70 + 棱 mask 秩)×2 + ml)。
    /// 角/棱 mask 各恒 popcount 4(home 上层的角/棱各 4 件)⇒ 秩落 [0,70)。
    /// 只对切缝对齐态调用(贪心 tiling 才与真实一致)。
    fn comb_idx(&self, s: &Sq1State) -> usize {
        let pt = Sq1State::layer_pattern(s.top);
        let pb = Sq1State::layer_pattern(s.bottom);
        let sid = self.shape_id(pt, pb);
        let (cbt, ebt, nct, net) = Self::layer_scan(s.top, pt);
        let (cbb, ebb, _, _) = Self::layer_scan(s.bottom, pb);
        let cmask = (cbt | (cbb << nct)) as usize;
        let emask = (ebt | (ebb << net)) as usize;
        ((sid * 70 + self.rank70[cmask] as usize) * 70 + self.rank70[emask] as usize) * 2
            + s.ml as usize
    }

    /// 4 个上层 home 角(id 1,3,5,7)在 8 个角槽(tiling 扫描序)的落位 → 1680 秩。
    fn c4_idx(&self, s: &Sq1State) -> usize {
        let pt = Sq1State::layer_pattern(s.top);
        let pb = Sq1State::layer_pattern(s.bottom);
        let sid = self.shape_id(pt, pb);
        let mut code = 0usize;
        let mut ck = 0usize;
        for (v, p) in [(s.top, pt), (s.bottom, pb)] {
            let mut i = 0;
            while i < 12 {
                if (p >> (11 - i)) & 1 == 1 {
                    let n = Sq1State::nib(v, i);
                    if n < 8 {
                        code |= ck << (((n >> 1) as usize) * 3);
                    }
                    ck += 1;
                    i += 2;
                } else {
                    i += 1;
                }
            }
        }
        (sid * 1680 + self.rank1680[code] as usize) * 2 + s.ml as usize
    }

    /// 对称版:4 个下层 home 角(id 9,b,d,f)的落位((n>>1)&3 ∈ 0..3)。
    fn c4b_idx(&self, s: &Sq1State) -> usize {
        let pt = Sq1State::layer_pattern(s.top);
        let pb = Sq1State::layer_pattern(s.bottom);
        let sid = self.shape_id(pt, pb);
        let mut code = 0usize;
        let mut ck = 0usize;
        for (v, p) in [(s.top, pt), (s.bottom, pb)] {
            let mut i = 0;
            while i < 12 {
                if (p >> (11 - i)) & 1 == 1 {
                    let n = Sq1State::nib(v, i);
                    if n >= 8 {
                        code |= ck << ((((n >> 1) & 3) as usize) * 3);
                    }
                    ck += 1;
                    i += 2;
                } else {
                    i += 1;
                }
            }
        }
        (sid * 1680 + self.rank1680[code] as usize) * 2 + s.ml as usize
    }

    /// 对称版:4 个下层 home 棱(id 8,a,c,e)的落位。
    fn e4b_idx(&self, s: &Sq1State) -> usize {
        let pt = Sq1State::layer_pattern(s.top);
        let pb = Sq1State::layer_pattern(s.bottom);
        let sid = self.shape_id(pt, pb);
        let mut code = 0usize;
        let mut ek = 0usize;
        for (v, p) in [(s.top, pt), (s.bottom, pb)] {
            let mut i = 0;
            while i < 12 {
                if (p >> (11 - i)) & 1 == 1 {
                    i += 2;
                } else {
                    let n = Sq1State::nib(v, i);
                    if n >= 8 {
                        code |= ek << ((((n >> 1) & 3) as usize) * 3);
                    }
                    ek += 1;
                    i += 1;
                }
            }
        }
        (sid * 1680 + self.rank1680[code] as usize) * 2 + s.ml as usize
    }

    /// 4 个上层 home 棱(id 0,2,4,6)在 8 个棱槽(tiling 扫描序)的落位 → 1680 秩。
    fn e4_idx(&self, s: &Sq1State) -> usize {
        let pt = Sq1State::layer_pattern(s.top);
        let pb = Sq1State::layer_pattern(s.bottom);
        let sid = self.shape_id(pt, pb);
        let mut code = 0usize;
        let mut ek = 0usize;
        for (v, p) in [(s.top, pt), (s.bottom, pb)] {
            let mut i = 0;
            while i < 12 {
                if (p >> (11 - i)) & 1 == 1 {
                    i += 2;
                } else {
                    let n = Sq1State::nib(v, i);
                    if n < 8 {
                        code |= ek << (((n >> 1) as usize) * 3);
                    }
                    ek += 1;
                    i += 1;
                }
            }
        }
        (sid * 1680 + self.rank1680[code] as usize) * 2 + s.ml as usize
    }

    /// 全 8 角 PDB 索引:(shape × 8 角全排列 rank8 ∈ [0,40320) × ml)。
    /// 角按 tiling 扫描序读 id>>1 ∈ 0..7(恒为排列)。联合 8 角 ⇒ 严格强于 max(c4,c4b)。
    fn corn_idx(&self, s: &Sq1State) -> usize {
        let pt = Sq1State::layer_pattern(s.top);
        let pb = Sq1State::layer_pattern(s.bottom);
        let sid = self.shape_id(pt, pb);
        let mut cp = [0u8; 8];
        let mut ck = 0usize;
        for (v, p) in [(s.top, pt), (s.bottom, pb)] {
            let mut i = 0;
            while i < 12 {
                if (p >> (11 - i)) & 1 == 1 {
                    cp[ck] = Sq1State::nib(v, i) >> 1;
                    ck += 1;
                    i += 2;
                } else {
                    i += 1;
                }
            }
        }
        (sid * 40320 + rank8(&cp)) * 2 + s.ml as usize
    }

    /// 全 8 棱 PDB 索引:(shape × 8 棱全排列 rank8 × ml)。棱按扫描序读 id>>1。
    fn edge_idx(&self, s: &Sq1State) -> usize {
        let pt = Sq1State::layer_pattern(s.top);
        let pb = Sq1State::layer_pattern(s.bottom);
        let sid = self.shape_id(pt, pb);
        let mut ep = [0u8; 8];
        let mut ek = 0usize;
        for (v, p) in [(s.top, pt), (s.bottom, pb)] {
            let mut i = 0;
            while i < 12 {
                if (p >> (11 - i)) & 1 == 1 {
                    i += 2;
                } else {
                    ep[ek] = Sq1State::nib(v, i) >> 1;
                    ek += 1;
                    i += 1;
                }
            }
        }
        (sid * 40320 + rank8(&ep)) * 2 + s.ml as usize
    }

    /// phase-1 启发值 = 五张投影表取 max(单次融合扫描,一次 shape 查找,
    /// 任一表超过 bound 立即短路返回 None,省后续随机访存)。各表可采纳 ⇒ max 可采纳。
    fn h_le(&self, s: &Sq1State, pt: u16, pb: u16, bound: u8) -> Option<u8> {
        let sid = self.shape_id(pt, pb);
        let (mut cmask, mut emask) = (0usize, 0usize);
        let (mut codec, mut codee) = (0usize, 0usize);
        let (mut codecb, mut codeeb) = (0usize, 0usize);
        let (mut ck, mut ek) = (0usize, 0usize);
        for (v, p) in [(s.top, pt), (s.bottom, pb)] {
            let mut i = 0;
            while i < 12 {
                let n = Sq1State::nib(v, i);
                if (p >> (11 - i)) & 1 == 1 {
                    if n < 8 {
                        cmask |= 1 << ck;
                        codec |= ck << (((n >> 1) as usize) * 3);
                    } else {
                        codecb |= ck << ((((n >> 1) & 3) as usize) * 3);
                    }
                    ck += 1;
                    i += 2;
                } else {
                    if n < 8 {
                        emask |= 1 << ek;
                        codee |= ek << (((n >> 1) as usize) * 3);
                    } else {
                        codeeb |= ek << ((((n >> 1) & 3) as usize) * 3);
                    }
                    ek += 1;
                    i += 1;
                }
            }
        }
        // 打包表查询(小表在前,尽早短路省大表访存)。
        let ml4 = (s.ml as u32) * 4;
        let h4 = (self.c4[sid * 1680 + self.rank1680[codec] as usize] >> ml4) & 15;
        if h4 > bound {
            return None;
        }
        let h4b = (self.c4b[sid * 1680 + self.rank1680[codecb] as usize] >> ml4) & 15;
        if h4b > bound {
            return None;
        }
        let he = (self.e4[sid * 1680 + self.rank1680[codee] as usize] >> ml4) & 15;
        if he > bound {
            return None;
        }
        let heb = (self.e4b[sid * 1680 + self.rank1680[codeeb] as usize] >> ml4) & 15;
        if heb > bound {
            return None;
        }
        let ci = (sid * 70 + self.rank70[cmask] as usize) * 70 + self.rank70[emask] as usize;
        let hc = (self.comb[ci] >> ml4) & 15;
        if hc > bound {
            return None;
        }
        Some(hc.max(h4).max(he).max(h4b).max(heb))
    }

    /// 投影全空间 BFS(轨道图:层转 0 步 ⇒ 轨道间无向,自 solved 投影轨道逐层扩展,
    /// 每发现新轨道把全部合法对位成员标同距)。投影态用真 Sq1State 位打包跑。
    fn build_proj(
        &self,
        size: usize,
        seed: Sq1State,
        idx_of: &dyn Fn(&Self, &Sq1State) -> usize,
    ) -> Vec<u8> {
        let mut dist = vec![255u8; size];
        let mark = |y: &Sq1State, d: u8, dist: &mut Vec<u8>| {
            let ta = self.legal_rot[Sq1State::layer_pattern(y.top) as usize];
            let tb = self.legal_rot[Sq1State::layer_pattern(y.bottom) as usize];
            let mut am = ta;
            while am != 0 {
                let a = am.trailing_zeros();
                am &= am - 1;
                let mut bm = tb;
                while bm != 0 {
                    let b = bm.trailing_zeros();
                    bm &= bm - 1;
                    let idx = idx_of(self, &y.turned(a, b));
                    if dist[idx] == 255 {
                        dist[idx] = d;
                    }
                }
            }
        };
        mark(&seed, 0, &mut dist);
        let mut frontier = vec![seed];
        let mut d = 0u8;
        while !frontier.is_empty() {
            let mut next = Vec::new();
            for z in &frontier {
                let ta = self.legal_rot[Sq1State::layer_pattern(z.top) as usize];
                let tb = self.legal_rot[Sq1State::layer_pattern(z.bottom) as usize];
                let mut am = ta;
                while am != 0 {
                    let a = am.trailing_zeros();
                    am &= am - 1;
                    let mut bm = tb;
                    while bm != 0 {
                        let b = bm.trailing_zeros();
                        bm &= bm - 1;
                        let y = z.turned(a, b).slashed();
                        let idx = idx_of(self, &y);
                        if dist[idx] == 255 {
                            mark(&y, d + 1, &mut dist);
                            next.push(y);
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
        // 方形层的合法对位 = 保方形对位(切缝对齐 ⟺ pattern 仍是 A/B),共 8 个。
        let ta = self.legal_rot[Sq1State::layer_pattern(s.top) as usize];
        let tb = self.legal_rot[Sq1State::layer_pattern(s.bottom) as usize];
        let mut am = ta;
        while am != 0 {
            let a = am.trailing_zeros();
            am &= am - 1;
            let mut bm = tb;
            while bm != 0 {
                let b = bm.trailing_zeros();
                bm &= bm - 1;
                if !allow00 && a == 0 && b == 0 {
                    continue; // 撤销上一刀,冗余(更短解在更小 T 已搜过)
                }
                let c = s.turned(a, b).slashed();
                if !c.is_square_shape() {
                    continue; // 两层半相位不配,slash 交换半层后破方形
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
        let mut t = self.sq_h(s);
        if (t ^ s.ml) & 1 == 1 {
            t += 1; // twist 距离奇偶 ≡ ml
        }
        if t > cap {
            return None; // 便宜下界已判废,省 canon_key(144 旋转)+ memo 查询
        }
        let key = s.canon_key();
        if let Some(&d) = memo.exact.get(&key) {
            if d <= cap {
                let ok = self.p2_dfs(s, d, true, path);
                debug_assert!(ok, "memoized p2 distance not reproducible");
                return Some(d);
            }
            return None;
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

    /// phase-1 DFS(全态 slash 枚举 + 联合投影表剪枝 + 方形处试 phase-2 收尾)。
    /// 入参 pt/pb = s 的两层 pattern(调用方已算);h 剪枝在父节点对子节点做
    /// (h_le 短路),存活子按 h 升序扩展(成功迭代尽快踩中解路径)。
    fn dfs1(
        &self,
        s: &Sq1State,
        pt: u16,
        pb: u16,
        rem: u8,
        allow00: bool,
        memo: &mut P2Memo,
        path: &mut Vec<(u8, u8)>,
    ) -> bool {
        let square = (pt == SQ_PAT_A || pt == SQ_PAT_B) && (pb == SQ_PAT_A || pb == SQ_PAT_B);
        if square && self.p2_dist_le(s, rem, memo, path).is_some() {
            return true;
        }
        if rem == 0 {
            return false;
        }
        // 收集存活子节点 (h, a, b, pt, pb),≤ 144 个,栈上定长。
        let mut kids = [(0u8, 0u8, 0u8, 0u16, 0u16); 144];
        let mut n = 0usize;
        let ta = self.legal_rot[pt as usize];
        let tb = self.legal_rot[pb as usize];
        let mut am = ta;
        while am != 0 {
            let a = am.trailing_zeros();
            am &= am - 1;
            let mut bm = tb;
            while bm != 0 {
                let b = bm.trailing_zeros();
                bm &= bm - 1;
                if !allow00 && a == 0 && b == 0 {
                    continue;
                }
                let c = s.turned(a, b).slashed();
                let cpt = Sq1State::layer_pattern(c.top);
                let cpb = Sq1State::layer_pattern(c.bottom);
                if let Some(ch) = self.h_le(&c, cpt, cpb, rem - 1) {
                    // 排序键:h 升序,同 h 方形子优先(p2 有机会直接收尾)。
                    let sq = (cpt == SQ_PAT_A || cpt == SQ_PAT_B)
                        && (cpb == SQ_PAT_A || cpb == SQ_PAT_B);
                    kids[n] = ((ch << 1) | (!sq as u8), a as u8, b as u8, cpt, cpb);
                    n += 1;
                }
            }
        }
        kids[..n].sort_unstable_by_key(|k| k.0);
        for &(_, a, b, cpt, cpb) in &kids[..n] {
            let c = s.turned(a as u32, b as u32).slashed();
            path.push((a, b));
            if self.dfs1(&c, cpt, cpb, rem - 1, false, memo, path) {
                return true;
            }
            path.pop();
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
        let rpt = Sq1State::layer_pattern(root.top);
        let rpb = Sq1State::layer_pattern(root.bottom);
        let mut t = self.h_le(&root, rpt, rpb, 255).unwrap().max(1);
        if (t ^ root.ml) & 1 == 1 {
            t += 1;
        }
        let mut memo = P2Memo { exact: HashMap::new(), fail_below: HashMap::new() };
        loop {
            let mut path: Vec<(u8, u8)> = Vec::new();
            if self.dfs1(&root, rpt, rpb, t, true, &mut memo, &mut path) {
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

/// 方形子群单件类 WCA 距离 BFS(40320×2):边 = 方形→方形 slash(moves,cost 1,翻 ml)
/// + 方形保形旋转(rots,cost 1,不翻 ml),从 solved 起。**禁** 旋转 0-cost 闭包
/// (那是 twist 专属);终局对齐(rotation of solved → exact)自然由旋转边编码(dist 1)。
fn build_sq_wca(moves: &[[u8; 8]], rots: &[[u8; 8]]) -> Vec<u8> {
    let mut dist = vec![255u8; 80640];
    let id: [u8; 8] = [0, 1, 2, 3, 4, 5, 6, 7];
    dist[rank8(&id) * 2] = 0; // solved, ml=0
    let mut frontier: Vec<([u8; 8], u8)> = vec![(id, 0)];
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
                    next.push((q, qml));
                }
            }
            for r in rots {
                let q = apply_action(p, r);
                let qi = rank8(&q) * 2 + *ml as usize;
                if dist[qi] == 255 {
                    dist[qi] = d + 1;
                    next.push((q, *ml));
                }
            }
        }
        d += 1;
        frontier = next;
    }
    dist
}

// ===========================================================================
// Sq1WcaSolver:WCA 12c4 度量精确最优求解器。
//
// WCA cost = #(非恒等层转) + #(slash);每个动作恰好 1 步 ⇒ uniform-cost,
// WCA 距离 = slash-aligned 态图上的 BFS 深度。复用 Sq1Solver 的索引/枚举设施
// (同模块私有可达),twist 求解器零改动。完整设计 / 上帝之数路线见
// `solver/SQ1_WCA_GODS_NUMBER.md`。
//
// 移动(均 1 步,只落脚 slash-legal 对位):
//   - slash:           z → slash(z)
//   - turn 到合法对位:  z → turn(z,a,b),(a,b)≠0,a∈legal_rot[pt] b∈legal_rot[pb]
// 最优解 turn/slash 严格交替(同类相邻冗余:slash∘slash=id、turn∘turn 合并),
// 据此剪枝不损最优。
//
// 剪枝表 = 5 张投影(comb/c4/e4/c4b/e4b),用 uniform BFS(上述边)重建,值 =
// 该投影的 WCA 距离(投影是「移动+代价」同态 ⇒ 表值 ≤ 真 WCA dist ⇒ 可采纳);
// h = 5 表 max。搜索 = IDA*(g 每步 +1,turn/slash 交替剪枝,子按 h 升序)。
// 可证区间 13 ≤ D_WCA ≤ 27(后者 = 2·twist_God+1),故 bound 越过 27 即 bug。
// ===========================================================================

const LM_NONE: u8 = 0;
const LM_TURN: u8 = 1;
const LM_SLASH: u8 = 2;

#[inline]
fn is_exact_solved(s: &Sq1State) -> bool {
    s.ml == 0 && s.top == SOLVED_TOP && s.bottom == SOLVED_BOTTOM
}

/// A2 诊断:运行时门控(默认关 ⇒ 求解热路径零成本,只一条 relaxed atomic load)的 phase-1
/// IDA* profiler。开 `ON` 后用 `solve_profile` 跑;node/time cap 保证**不挂**(深态本就 >5min)。
/// findings 见笔记 §5。只 native(wasm 不导出本求解器)。
#[cfg(not(target_arch = "wasm32"))]
mod wca_profile {
    use std::cell::RefCell;
    use std::sync::atomic::AtomicBool;
    use std::time::Instant;
    pub static ON: AtomicBool = AtomicBool::new(false);
    pub struct Prof {
        pub nodes: u64,
        pub per_bound: u64,
        pub node_cap: u64,
        pub start: Instant,
        pub time_cap_ms: u128,
        pub first_square_depth: Option<u8>,
        pub aborted: bool,
    }
    thread_local! {
        pub static STATE: RefCell<Option<Prof>> = RefCell::new(None);
    }
}

pub struct Sq1WcaSolver {
    base: &'static Sq1Solver,
    /// 5 张全空间 WCA 投影距离表(未打包,*2 含 ml;索引复用 base 的 *_idx 函数)。
    comb: Vec<u8>, // SHAPE_COUNT*70*70*2
    c4: Vec<u8>,   // SHAPE_COUNT*1680*2
    e4: Vec<u8>,
    c4b: Vec<u8>,
    e4b: Vec<u8>,
    /// 方形子群内(角 / 棱 8 排列 × ml)WCA 精确距离(phase-2 尾解,80640 each)。
    /// 边 = 方形保形旋转(cost 1)+ 方形→方形 slash(cost 1),从 solved BFS。
    csq: Vec<u8>,
    esq: Vec<u8>,
    /// 全 8 角 / 全 8 棱 WCA PDB((shape × 8! × ml),各 ~283MB)。比 c4/c4b/e4/e4b(各 4 件)
    /// 联合更强 ⇒ 深态 h 抬高、IDA* 节点锐减。盘缓存 tables/sq1_wca_{corn,edge}p.bin;
    /// 缺表且非 SQ1_BUILD_PDB=1 时为空,h 回退 5 小表(wasm 恒空)。
    cornp: Vec<u8>,
    edgep: Vec<u8>,
}

impl Default for Sq1WcaSolver {
    fn default() -> Self {
        Self::new()
    }
}

impl Sq1WcaSolver {
    pub fn shared() -> &'static Sq1WcaSolver {
        static S: OnceLock<Sq1WcaSolver> = OnceLock::new();
        S.get_or_init(Sq1WcaSolver::new)
    }

    pub fn new() -> Sq1WcaSolver {
        let base = Sq1Solver::shared();
        // 投影 seed = solved 的对应投影(与 Sq1Solver::new 同款 map,值映射逐 nibble)。
        let pj = |v: u64, f: &dyn Fn(u64) -> u64| -> u64 {
            let mut o = 0u64;
            for i in 0..12 {
                let n = (v >> ((11 - i) * 4)) & 0xF;
                o |= f(n) << ((11 - i) * 4);
            }
            o
        };
        let comb_map = |n: u64| (n & 1) | (n & 8);
        let c4_map = |n: u64| if n & 1 == 1 { if n < 8 { n } else { 9 } } else { 0 };
        let e4_map = |n: u64| if n & 1 == 1 { 1 } else if n < 8 { n } else { 8 };
        let c4b_map = |n: u64| if n & 1 == 1 { if n < 8 { 1 } else { n } } else { 0 };
        let e4b_map = |n: u64| if n & 1 == 1 { 1 } else if n < 8 { 0 } else { n };
        let seed = |f: &dyn Fn(u64) -> u64| Sq1State {
            top: pj(SOLVED_TOP, f),
            bottom: pj(SOLVED_BOTTOM, f),
            ml: 0,
        };
        let comb =
            Self::build_proj_wca_auto(base, SHAPE_COUNT * 70 * 70 * 2, seed(&comb_map), |b, s| {
                b.comb_idx(s)
            });
        let c4 =
            Self::build_proj_wca_auto(base, SHAPE_COUNT * 1680 * 2, seed(&c4_map), |b, s| b.c4_idx(s));
        let e4 =
            Self::build_proj_wca_auto(base, SHAPE_COUNT * 1680 * 2, seed(&e4_map), |b, s| b.e4_idx(s));
        let c4b = Self::build_proj_wca_auto(base, SHAPE_COUNT * 1680 * 2, seed(&c4b_map), |b, s| {
            b.c4b_idx(s)
        });
        let e4b = Self::build_proj_wca_auto(base, SHAPE_COUNT * 1680 * 2, seed(&e4b_map), |b, s| {
            b.e4b_idx(s)
        });
        // phase-2 方形子群表(复用 twist 求解器的 action 推导,但 WCA 加权:旋转 cost 1)。
        let (sig, tau, rhoc, rhoe) = derive_sq_actions();
        let csq = build_sq_wca(&sig, &rhoc);
        let esq = build_sq_wca(&tau, &rhoe);
        let (cornp, edgep) = Self::load_or_build_pdbs(base);
        Sq1WcaSolver { base, comb, c4, e4, c4b, e4b, csq, esq, cornp, edgep }
    }

    /// 大 PDB(角/棱全 8 件)加载或按需构建。盘缓存命中即直读;缺表且 `SQ1_BUILD_PDB=1`
    /// 时 BFS 构建并落盘(各 ~283MB,一次性),否则返回空(h 回退 5 小表)。
    /// CI / 无表环境零额外开销;wasm 不编译此路径。
    #[cfg(not(target_arch = "wasm32"))]
    fn load_or_build_pdbs(base: &'static Sq1Solver) -> (Vec<u8>, Vec<u8>) {
        let size = SHAPE_COUNT * 40320 * 2;
        let corn = Self::load_or_build_one("sq1_wca_cornp.bin", size, base, |b, s| b.corn_idx(s));
        let edge = Self::load_or_build_one("sq1_wca_edgep.bin", size, base, |b, s| b.edge_idx(s));
        (corn, edge)
    }

    #[cfg(not(target_arch = "wasm32"))]
    fn load_or_build_one(
        name: &str,
        size: usize,
        base: &'static Sq1Solver,
        idx_of: impl Fn(&Sq1Solver, &Sq1State) -> usize + Sync,
    ) -> Vec<u8> {
        let path = crate::move_tables::table_path(name);
        if let Ok(bytes) = std::fs::read(&path) {
            if bytes.len() == size {
                eprintln!("[sq1] loaded {} ({} bytes)", path.display(), bytes.len());
                return bytes;
            }
        }
        if std::env::var("SQ1_BUILD_PDB").as_deref() != Ok("1") {
            return Vec::new();
        }
        eprintln!("[sq1] building {} ({} entries, parallel) ...", name, size);
        let t = Self::build_proj_wca_par(base, size, Sq1State::SOLVED, idx_of);
        if let Some(dir) = path.parent() {
            let _ = std::fs::create_dir_all(dir);
        }
        match std::fs::write(&path, &t) {
            Ok(_) => eprintln!("[sq1] wrote {} ({} bytes)", path.display(), t.len()),
            Err(e) => eprintln!("[sq1] WARN failed to write {}: {}", path.display(), e),
        }
        t
    }

    #[cfg(target_arch = "wasm32")]
    fn load_or_build_pdbs(_base: &'static Sq1Solver) -> (Vec<u8>, Vec<u8>) {
        (Vec::new(), Vec::new())
    }

    /// 全局共享实例(表现场建,首次 ~秒级;含 Sq1Solver 的 twist 表)。
    /// uniform-cost BFS 投影表:从 solved 投影起,turn(到合法对位)+slash 边均 1 步,
    /// dist = BFS 层。投影同态 ⇒ 表值 ≤ 真 WCA dist。**禁** free-rotation 闭包
    /// (那是 twist 专属;WCA 每对位独立)。
    fn build_proj_wca(
        base: &Sq1Solver,
        size: usize,
        seed: Sq1State,
        idx_of: impl Fn(&Sq1Solver, &Sq1State) -> usize,
    ) -> Vec<u8> {
        let mut dist = vec![255u8; size];
        dist[idx_of(base, &seed)] = 0;
        let mut frontier = vec![seed];
        let mut d = 0u8;
        while !frontier.is_empty() {
            let mut next = Vec::new();
            for z in &frontier {
                let pt = Sq1State::layer_pattern(z.top);
                let pb = Sq1State::layer_pattern(z.bottom);
                // slash 边(z 必 slash-legal:seed/turn 到合法对位/slash 结果皆 slash-ready)。
                let y = z.slashed();
                let iy = idx_of(base, &y);
                if dist[iy] == 255 {
                    dist[iy] = d + 1;
                    next.push(y);
                }
                // turn 边(到合法对位,(a,b)≠0)。
                let ta = base.legal_rot[pt as usize];
                let tb = base.legal_rot[pb as usize];
                let mut am = ta;
                while am != 0 {
                    let a = am.trailing_zeros();
                    am &= am - 1;
                    let mut bm = tb;
                    while bm != 0 {
                        let b = bm.trailing_zeros();
                        bm &= bm - 1;
                        if a == 0 && b == 0 {
                            continue;
                        }
                        let y = z.turned(a, b);
                        let iy = idx_of(base, &y);
                        if dist[iy] == 255 {
                            dist[iy] = d + 1;
                            next.push(y);
                        }
                    }
                }
            }
            d += 1;
            frontier = next;
        }
        dist
    }

    /// build_proj_wca 的并行版(rayon + AtomicU8 dist,CAS 抢占首达 ⇒ 与单线程逐位相同的
    /// BFS 距离)。大 PDB(296M)单线程 ~10min/张、内存重;并行 ~7× 加速。native-only。
    /// 正确性:test `pdb_par_matches_serial` 锁死与单线程逐字节相等。
    #[cfg(not(target_arch = "wasm32"))]
    fn build_proj_wca_par(
        base: &Sq1Solver,
        size: usize,
        seed: Sq1State,
        idx_of: impl Fn(&Sq1Solver, &Sq1State) -> usize + Sync,
    ) -> Vec<u8> {
        use rayon::prelude::*;
        use std::sync::atomic::{AtomicU8, Ordering};
        let dist: Vec<AtomicU8> = (0..size).map(|_| AtomicU8::new(255)).collect();
        dist[idx_of(base, &seed)].store(0, Ordering::Relaxed);
        let mut frontier = vec![seed];
        let mut d = 0u8;
        while !frontier.is_empty() {
            let next: Vec<Sq1State> = frontier
                .par_iter()
                .fold(Vec::new, |mut acc, z| {
                    let pt = Sq1State::layer_pattern(z.top);
                    let pb = Sq1State::layer_pattern(z.bottom);
                    // CAS 255→d+1:抢到(首达此索引)才入 next,与单线程 BFS 距离一致。
                    let claim = |y: Sq1State, acc: &mut Vec<Sq1State>| {
                        if dist[idx_of(base, &y)]
                            .compare_exchange(255, d + 1, Ordering::Relaxed, Ordering::Relaxed)
                            .is_ok()
                        {
                            acc.push(y);
                        }
                    };
                    claim(z.slashed(), &mut acc);
                    let ta = base.legal_rot[pt as usize];
                    let tb = base.legal_rot[pb as usize];
                    let mut am = ta;
                    while am != 0 {
                        let a = am.trailing_zeros();
                        am &= am - 1;
                        let mut bm = tb;
                        while bm != 0 {
                            let b = bm.trailing_zeros();
                            bm &= bm - 1;
                            if a == 0 && b == 0 {
                                continue;
                            }
                            claim(z.turned(a, b), &mut acc);
                        }
                    }
                    acc
                })
                .reduce(Vec::new, |mut a, mut b| {
                    a.append(&mut b);
                    a
                });
            d += 1;
            frontier = next;
        }
        dist.into_iter().map(|a| a.into_inner()).collect()
    }

    /// 投影表构建分派:native 走并行(快 ~7×),wasm 走单线程(Sq1WcaSolver 不导出到 wasm,
    /// 此分支实为死代码,仅供编译)。5 张小表也用它,把 native init 从 ~3min 砍到 ~15s。
    #[cfg(not(target_arch = "wasm32"))]
    fn build_proj_wca_auto(
        base: &Sq1Solver,
        size: usize,
        seed: Sq1State,
        idx_of: impl Fn(&Sq1Solver, &Sq1State) -> usize + Sync,
    ) -> Vec<u8> {
        Self::build_proj_wca_par(base, size, seed, idx_of)
    }

    #[cfg(target_arch = "wasm32")]
    fn build_proj_wca_auto(
        base: &Sq1Solver,
        size: usize,
        seed: Sq1State,
        idx_of: impl Fn(&Sq1Solver, &Sq1State) -> usize + Sync,
    ) -> Vec<u8> {
        Self::build_proj_wca(base, size, seed, idx_of)
    }

    /// 融合剪枝(移植 Sq1Solver::h_le 的单次扫描 + 早短路):一次扫描算 5 张投影码,
    /// 任一表值 > bound 立即 None(省后续随机访存)。s 必须 slash-aligned(shape ∈ 3678);
    /// 搜索里只对 slash-legal 子节点调用。Some(5 表 max) 当且仅当全部 ≤ bound。
    #[inline]
    fn h_le_wca(&self, s: &Sq1State, pt: u16, pb: u16, bound: u8) -> Option<u8> {
        let base = self.base;
        let sid = base.shape_id(pt, pb);
        let (mut cmask, mut emask) = (0usize, 0usize);
        let (mut codec, mut codee) = (0usize, 0usize);
        let (mut codecb, mut codeeb) = (0usize, 0usize);
        let (mut ck, mut ek) = (0usize, 0usize);
        let mut cp = [0u8; 8];
        let mut ep = [0u8; 8];
        for (v, p) in [(s.top, pt), (s.bottom, pb)] {
            let mut i = 0;
            while i < 12 {
                let n = Sq1State::nib(v, i);
                if (p >> (11 - i)) & 1 == 1 {
                    cp[ck] = n >> 1;
                    if n < 8 {
                        cmask |= 1 << ck;
                        codec |= ck << (((n >> 1) as usize) * 3);
                    } else {
                        codecb |= ck << ((((n >> 1) & 3) as usize) * 3);
                    }
                    ck += 1;
                    i += 2;
                } else {
                    ep[ek] = n >> 1;
                    if n < 8 {
                        emask |= 1 << ek;
                        codee |= ek << (((n >> 1) as usize) * 3);
                    } else {
                        codeeb |= ek << ((((n >> 1) & 3) as usize) * 3);
                    }
                    ek += 1;
                    i += 1;
                }
            }
        }
        let ml = s.ml as usize;
        // 大 PDB(角/棱全 8 件)最强 ⇒ 先查、命中早剪省后续小表访存。wasm/无表时为空跳过。
        let mut hbig = 0u8;
        if !self.cornp.is_empty() {
            let hc8 = self.cornp[(sid * 40320 + rank8(&cp)) * 2 + ml];
            if hc8 > bound {
                return None;
            }
            let he8 = self.edgep[(sid * 40320 + rank8(&ep)) * 2 + ml];
            if he8 > bound {
                return None;
            }
            hbig = hc8.max(he8);
        }
        let h4 = self.c4[(sid * 1680 + base.rank1680[codec] as usize) * 2 + ml];
        if h4 > bound {
            return None;
        }
        let h4b = self.c4b[(sid * 1680 + base.rank1680[codecb] as usize) * 2 + ml];
        if h4b > bound {
            return None;
        }
        let he = self.e4[(sid * 1680 + base.rank1680[codee] as usize) * 2 + ml];
        if he > bound {
            return None;
        }
        let heb = self.e4b[(sid * 1680 + base.rank1680[codeeb] as usize) * 2 + ml];
        if heb > bound {
            return None;
        }
        let ci = (sid * 70 + base.rank70[cmask] as usize) * 70 + base.rank70[emask] as usize;
        let hc = self.comb[ci * 2 + ml];
        if hc > bound {
            return None;
        }
        Some(hbig.max(hc).max(h4).max(he).max(h4b).max(heb))
    }

    /// 投影剪枝下界(可采纳)= h_le_wca 无上界版(root / 测试用)。
    #[inline]
    fn h(&self, s: &Sq1State) -> u8 {
        let pt = Sq1State::layer_pattern(s.top);
        let pb = Sq1State::layer_pattern(s.bottom);
        self.h_le_wca(s, pt, pb, 255).unwrap()
    }

    /// 方形态 phase-2 启发值(仅方形子群内可采纳)= max(角, 棱 8 排列 WCA 距离)。
    /// s 必须方形(sq_proj_arrays 对非方形 debug_assert)。
    #[inline]
    fn sq_h_wca(&self, s: &Sq1State) -> u8 {
        let (cp, ep) = sq_proj_arrays(s);
        let ci = rank8(&cp) * 2 + s.ml as usize;
        let ei = rank8(&ep) * 2 + s.ml as usize;
        self.csq[ci].max(self.esq[ei])
    }

    /// phase-2 DFS:限方形子群(每步保方形),移动 = slash(cost1)+ 方形保形旋转(cost1),
    /// turn/slash 交替。成功(g..bound 内还原到精确 SOLVED)时 path 追加尾解 token。
    fn p2_dfs_wca(&self, s: Sq1State, g: u8, bound: u8, lm: u8, path: &mut Vec<Sq1Token>) -> bool {
        // 目标 = 精确 SOLVED,**不是** sq_h_wca==0。sq_proj_arrays 按扫描序读件 ⇒ 旋转不变,
        // csq/esq 量的是到 solved **轨道/陪集**的距离;一整类非 solved 方形态(角-棱对位不同)
        // 都有 sq_h_wca==0。终局对齐(轨道→精确,1 步旋转)由本搜索补上(故不能用 h==0 提前收尾)。
        if is_exact_solved(&s) {
            return true;
        }
        let h = self.sq_h_wca(&s);
        if g + h > bound {
            return false; // sq_h_wca 仍是可采纳下界(低估终局对齐,无害)
        }
        let pt = Sq1State::layer_pattern(s.top);
        let pb = Sq1State::layer_pattern(s.bottom);
        let cb = bound.saturating_sub(g + 1);
        let mut kids = [(0u8, Sq1Token::Slash, Sq1State::SOLVED, 0u8); 145];
        let mut n = 0usize;
        if lm != LM_SLASH {
            let c = s.slashed();
            if c.is_square_shape() {
                let ch = self.sq_h_wca(&c);
                if ch <= cb {
                    kids[n] = (ch, Sq1Token::Slash, c, LM_SLASH);
                    n += 1;
                }
            }
        }
        if lm != LM_TURN {
            let ta = self.base.legal_rot[pt as usize];
            let tb = self.base.legal_rot[pb as usize];
            let mut am = ta;
            while am != 0 {
                let a = am.trailing_zeros();
                am &= am - 1;
                let mut bm = tb;
                while bm != 0 {
                    let b = bm.trailing_zeros();
                    bm &= bm - 1;
                    if a == 0 && b == 0 {
                        continue;
                    }
                    let c = s.turned(a, b);
                    if c.is_square_shape() {
                        let ch = self.sq_h_wca(&c);
                        if ch <= cb {
                            kids[n] = (ch, Sq1Token::Turn(ser_amt(a), ser_amt(b)), c, LM_TURN);
                            n += 1;
                        }
                    }
                }
            }
        }
        kids[..n].sort_unstable_by_key(|k| k.0);
        for &(_, tok, c, clm) in &kids[..n] {
            path.push(tok);
            if self.p2_dfs_wca(c, g + 1, bound, clm, path) {
                return true;
            }
            path.pop();
        }
        false
    }

    /// 方形态精确 WCA 尾解(≤ cap 才 Some;成功时 path 追加尾解)。memo 跨 phase-1 节点复用。
    /// **memo 键 = 精确态**(非 canon_key):WCA 下旋转计 1 步,不同对位距离不同。
    fn p2_dist_le_wca(
        &self,
        s: &Sq1State,
        cap: u8,
        memo: &mut P2Memo,
        path: &mut Vec<Sq1Token>,
    ) -> Option<u8> {
        let h0 = self.sq_h_wca(s);
        if h0 > cap {
            return None;
        }
        let key = ((s.top as u128) << 49) | ((s.bottom as u128) << 1) | s.ml as u128;
        if let Some(&d) = memo.exact.get(&key) {
            if d <= cap {
                let ok = self.p2_dfs_wca(*s, 0, d, LM_NONE, path);
                debug_assert!(ok, "memoized p2 distance not reproducible");
                return Some(d);
            }
            return None;
        }
        let mut t = h0.max(memo.fail_below.get(&key).copied().unwrap_or(0));
        while t <= cap {
            if self.p2_dfs_wca(*s, 0, t, LM_NONE, path) {
                memo.exact.insert(key, t);
                return Some(t);
            }
            t += 1;
        }
        let e = memo.fail_below.entry(key).or_insert(0);
        *e = (*e).max(t);
        None
    }

    /// 任意态的 WCA 12c4 精确最优步数。
    pub fn solve_wca(&self, st: &Sq1State) -> u32 {
        self.solve_with_solution(st).0
    }

    /// 打乱串 → WCA 精确最优步数。
    pub fn solve_str(&self, scramble: &str) -> Result<u32, String> {
        Ok(self.solve_wca(&state_from_scramble(scramble)?))
    }

    /// 任意态的 WCA 精确最优步数 + 一条最优解(token 序列,从 st apply 回精确 SOLVED;
    /// 每个 token = 1 步 ⇒ token 数 = WCA cost)。
    pub fn solve_with_solution(&self, st: &Sq1State) -> (u32, Vec<Sq1Token>) {
        if is_exact_solved(st) {
            return (0, Vec::new());
        }
        // root 若 slash-legal,h(st) 是 admissible 起点;否则首步必为 turn(≥1 步)。
        let mut bound = if st.slash_legal() { self.h(st) } else { 1 };
        let mut memo = P2Memo { exact: HashMap::new(), fail_below: HashMap::new() };
        loop {
            let mut path: Vec<Sq1Token> = Vec::new();
            if let Some(cost) = self.dfs(*st, 0, bound, LM_NONE, &mut memo, &mut path) {
                debug_assert_eq!(cost as usize, path.len(), "WCA cost must equal token count");
                return (cost as u32, path);
            }
            bound += 1;
            assert!(bound <= 27, "WCA search exceeded proven bound D_WCA ≤ 27");
        }
    }

    /// A2 诊断:capped phase-1 IDA* profiler(**不改最优性 / 不改解**,默认关)。逐 bound 跑同一
    /// `dfs`,记每 bound phase-1 节点数 + 首个方形态深度;node_cap / time_cap 任一到即截断(深态
    /// 本就 >5min,截断保证不挂)。返回多行报告串。用于定位深态瓶颈(phase-1 太深 vs h 太弱)。
    #[cfg(not(target_arch = "wasm32"))]
    pub fn solve_profile(&self, st: &Sq1State, node_cap: u64, time_cap_ms: u128) -> String {
        use std::sync::atomic::Ordering;
        let h0 = if st.slash_legal() { self.h(st) } else { 1 };
        wca_profile::STATE.with(|c| {
            *c.borrow_mut() = Some(wca_profile::Prof {
                nodes: 0,
                per_bound: 0,
                node_cap,
                start: std::time::Instant::now(),
                time_cap_ms,
                first_square_depth: None,
                aborted: false,
            });
        });
        wca_profile::ON.store(true, Ordering::Relaxed);
        let mut out = format!("h0={}", h0);
        let mut bound = h0;
        let mut solved = None;
        loop {
            wca_profile::STATE.with(|c| {
                if let Some(p) = c.borrow_mut().as_mut() {
                    p.per_bound = 0;
                }
            });
            let mut memo = P2Memo { exact: HashMap::new(), fail_below: HashMap::new() };
            let mut path = Vec::new();
            let found = self.dfs(*st, 0, bound, LM_NONE, &mut memo, &mut path);
            let (pb, total, aborted, fsd, secs) = wca_profile::STATE.with(|c| {
                let b = c.borrow();
                let p = b.as_ref().unwrap();
                (
                    p.per_bound,
                    p.nodes,
                    p.aborted,
                    p.first_square_depth,
                    p.start.elapsed().as_secs_f64(),
                )
            });
            out.push_str(&format!(
                "\n  bound={:2} nodes={:>12} total={:>12} firstSq={:?} {:.2}s",
                bound, pb, total, fsd, secs
            ));
            if let Some(c) = found {
                solved = Some(c);
                break;
            }
            if aborted {
                out.push_str("  <ABORTED node/time cap>");
                break;
            }
            bound += 1;
            if bound > 27 {
                out.push_str("\n  bound>27 stop");
                break;
            }
        }
        wca_profile::ON.store(false, Ordering::Relaxed);
        wca_profile::STATE.with(|c| *c.borrow_mut() = None);
        if let Some(c) = solved {
            out.push_str(&format!("\n  SOLVED={}", c));
        }
        out
    }

    /// phase-1 IDA* DFS。调用方保证 g + h(s) ≤ bound(root 经 bound 起点、子经父 h_le_wca 剪枝)。
    /// 方形态先试 phase-2 精确尾解(memo 跨节点复用);失败再继续 shape-shift 子。
    fn dfs(
        &self,
        s: Sq1State,
        g: u8,
        bound: u8,
        lm: u8,
        memo: &mut P2Memo,
        path: &mut Vec<Sq1Token>,
    ) -> Option<u8> {
        // A2 profiler hook(默认关:一条 relaxed load 即返回,不影响最优性)。开则记节点 /
        // 首方形深度并在 node/time cap 处令整搜索快速 unwind(返 None,solve_profile 检 aborted 收尾)。
        #[cfg(not(target_arch = "wasm32"))]
        if wca_profile::ON.load(std::sync::atomic::Ordering::Relaxed) {
            let abort = wca_profile::STATE.with(|c| {
                if let Some(p) = c.borrow_mut().as_mut() {
                    p.nodes += 1;
                    p.per_bound += 1;
                    if s.is_square_shape() && p.first_square_depth.map_or(true, |d| g < d) {
                        p.first_square_depth = Some(g);
                    }
                    if p.nodes >= p.node_cap || p.start.elapsed().as_millis() >= p.time_cap_ms {
                        p.aborted = true;
                    }
                    p.aborted
                } else {
                    false
                }
            });
            if abort {
                return None;
            }
        }
        if is_exact_solved(&s) {
            return Some(g);
        }
        // phase-2:方形态尝试方形子群内精确尾解,踩中即收尾(关键加速点)。
        if s.is_square_shape() {
            if let Some(d) = self.p2_dist_le_wca(&s, bound.saturating_sub(g), memo, path) {
                return Some(g + d);
            }
        }
        let slash_ok = s.slash_legal();
        let pt = Sq1State::layer_pattern(s.top);
        let pb = Sq1State::layer_pattern(s.bottom);
        // 子的 h 须 ≤ bound-(g+1)(每步 +1)。
        let child_bound = bound.saturating_sub(g + 1);
        // 存活子:(h, token, state, lm)。≤ 1 slash + 144 turn。
        let mut kids = [(0u8, Sq1Token::Slash, Sq1State::SOLVED, 0u8); 145];
        let mut n = 0usize;
        if slash_ok && lm != LM_SLASH {
            let c = s.slashed();
            let cpt = Sq1State::layer_pattern(c.top);
            let cpb = Sq1State::layer_pattern(c.bottom);
            if let Some(h) = self.h_le_wca(&c, cpt, cpb, child_bound) {
                kids[n] = (h, Sq1Token::Slash, c, LM_SLASH);
                n += 1;
            }
        }
        if lm != LM_TURN {
            let ta = self.base.legal_rot[pt as usize];
            let tb = self.base.legal_rot[pb as usize];
            let mut am = ta;
            while am != 0 {
                let a = am.trailing_zeros();
                am &= am - 1;
                let mut bm = tb;
                while bm != 0 {
                    let b = bm.trailing_zeros();
                    bm &= bm - 1;
                    if a == 0 && b == 0 {
                        continue;
                    }
                    let c = s.turned(a, b);
                    let cpt = Sq1State::layer_pattern(c.top);
                    let cpb = Sq1State::layer_pattern(c.bottom);
                    if let Some(h) = self.h_le_wca(&c, cpt, cpb, child_bound) {
                        kids[n] = (h, Sq1Token::Turn(ser_amt(a), ser_amt(b)), c, LM_TURN);
                        n += 1;
                    }
                }
            }
        }
        debug_assert!(n <= 145);
        kids[..n].sort_unstable_by_key(|k| k.0);
        for &(_, tok, c, clm) in &kids[..n] {
            path.push(tok);
            if let Some(r) = self.dfs(c, g + 1, bound, clm, memo, path) {
                return Some(r);
            }
            path.pop();
        }
        None
    }
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

    /// 并行 BFS builder 必须与单线程逐字节相等(用 c4 投影,12M,~快)。
    /// 锁死后即可信赖 build_proj_wca_par 建 296M 角/棱 PDB。
    #[test]
    fn pdb_par_matches_serial() {
        let base = Sq1Solver::shared();
        let pj = |v: u64, f: &dyn Fn(u64) -> u64| -> u64 {
            let mut o = 0u64;
            for i in 0..12 {
                let n = (v >> ((11 - i) * 4)) & 0xF;
                o |= f(n) << ((11 - i) * 4);
            }
            o
        };
        let c4_map = |n: u64| if n & 1 == 1 { if n < 8 { n } else { 9 } } else { 0 };
        let seed = Sq1State {
            top: pj(SOLVED_TOP, &c4_map),
            bottom: pj(SOLVED_BOTTOM, &c4_map),
            ml: 0,
        };
        let size = SHAPE_COUNT * 1680 * 2;
        let serial = Sq1WcaSolver::build_proj_wca(base, size, seed, |b, s| b.c4_idx(s));
        let par = Sq1WcaSolver::build_proj_wca_par(base, size, seed, |b, s| b.c4_idx(s));
        assert_eq!(serial.len(), par.len());
        assert_eq!(serial, par, "parallel BFS must equal serial BFS byte-for-byte");
    }

    /// 大 PDB 效果报告(需 CUBE_TABLE_DIR 指向已建表,否则 h 回退 5 表)。非断言,打印。
    /// 跑:`CUBE_TABLE_DIR=...\tables cargo test --release --lib wca_bigtable_report -- --nocapture`
    #[test]
    fn wca_bigtable_report() {
        let w = Sq1WcaSolver::shared();
        let data = match std::fs::read_to_string("../core/.tmp/sq1_wca/sample.txt") {
            Ok(d) => d,
            Err(_) => {
                eprintln!("[bigtable] sample.txt missing, skip");
                return;
            }
        };
        let mut states: Vec<(u8, Sq1State)> = Vec::new();
        for line in data.lines() {
            let line = line.trim();
            if line.is_empty() {
                continue;
            }
            let scr = line.splitn(2, ',').nth(1).unwrap_or("");
            if let Ok(st) = state_from_scramble(scr) {
                if st.slash_legal() {
                    states.push((w.h(&st), st));
                }
            }
        }
        let n = states.len();
        let mut hist = [0u32; 32];
        let (mut sum, mut hmax) = (0u64, 0u8);
        for (h, _) in &states {
            hist[*h as usize] += 1;
            sum += *h as u64;
            hmax = hmax.max(*h);
        }
        eprintln!(
            "[bigtable] n={} mean_h={:.2} max_h={}  (旧 5 表基线: mean 14.82 max 18)",
            n,
            sum as f64 / n as f64,
            hmax
        );
        for (v, &c) in hist.iter().enumerate() {
            if c > 0 {
                eprintln!("  h={:2}: {:5} ({:.1}%)", v, c, 100.0 * c as f64 / n as f64);
            }
        }
        // 精确解最易的 5 个态(快),给真 gap + 解时 + 正确性。
        states.sort_by_key(|(h, _)| *h);
        eprintln!("--- exact solve (5 lowest-h, tractable) ---");
        for (h, st) in states.iter().take(5) {
            let t0 = std::time::Instant::now();
            let opt = w.solve_wca(st);
            eprintln!(
                "  h={} opt={} gap={} {:.3}s",
                h,
                opt,
                opt as i32 - *h as i32,
                t0.elapsed().as_secs_f64()
            );
        }
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
    /// 2026-06-12 表结构变更:phase-1 剪枝从 max(角表 max 8, 棱表 max 9) 换成联合表
    /// (shape × 角 mask × 棱 mask × ml,见模块头),16 刀深态搜索由 49min 级修到亚秒级;
    /// 旧 cmem/emem 基线 (514920, 8)/(514920, 9) 随表删除,csq/esq 不变。
    #[test]
    fn sq1_tables_baselines() {
        let s = Sq1Solver::shared();
        assert_eq!(s.comb.len(), SHAPE_COUNT * 70 * 70); // nibble 打包(ml 对折)
        assert_eq!(s.c4.len(), SHAPE_COUNT * 1680);
        assert_eq!(s.e4.len(), SHAPE_COUNT * 1680);
        assert_eq!(s.c4b.len(), SHAPE_COUNT * 1680);
        assert_eq!(s.e4b.len(), SHAPE_COUNT * 1680);
        assert_eq!(s.csq.len(), 80640);
        assert_eq!(s.esq.len(), 80640);
        // 打包表:逐 nibble 解包统计(15 = 不可达哨兵)。
        let stats_packed = |t: &[u8]| -> (usize, u8) {
            let mut reach = 0usize;
            let mut mx = 0u8;
            for &b in t {
                for v in [b & 15, b >> 4] {
                    if v != 15 {
                        reach += 1;
                        mx = mx.max(v);
                    }
                }
            }
            (reach, mx)
        };
        let stats = |t: &[u8]| -> (usize, u8) {
            let reach = t.iter().filter(|&&v| v != 255).count();
            let mx = t.iter().filter(|&&v| v != 255).copied().max().unwrap();
            (reach, mx)
        };
        let (k_reach, k_max) = stats_packed(&s.comb);
        let (c4_reach, c4_max) = stats_packed(&s.c4);
        let (e4_reach, e4_max) = stats_packed(&s.e4);
        let (c4b_reach, c4b_max) = stats_packed(&s.c4b);
        let (e4b_reach, e4b_max) = stats_packed(&s.e4b);
        let (cs_reach, cs_max) = stats(&s.csq);
        let (es_reach, es_max) = stats(&s.esq);
        eprintln!("comb reach={} max={}", k_reach, k_max);
        eprintln!("c4   reach={} max={}", c4_reach, c4_max);
        eprintln!("e4   reach={} max={}", e4_reach, e4_max);
        eprintln!("c4b  reach={} max={}", c4b_reach, c4b_max);
        eprintln!("e4b  reach={} max={}", e4b_reach, e4b_max);
        eprintln!("csq  reach={} max={}", cs_reach, cs_max);
        eprintln!("esq  reach={} max={}", es_reach, es_max);
        assert_eq!((k_reach, k_max), (36044400, 9)); // 全空间可达,投影直径 9
        assert_eq!((c4_reach, c4_max), (12358080, 9));
        assert_eq!((e4_reach, e4_max), (12358080, 9));
        assert_eq!((c4b_reach, c4b_max), (12358080, 9));
        assert_eq!((e4b_reach, e4b_max), (12358080, 9));
        assert_eq!((cs_reach, cs_max), (80640, 7));
        assert_eq!((es_reach, es_max), (80640, 7));
    }

    // ======================= WCA 12c4 度量精确求解器 =======================

    /// 暴力 WCA-BFS oracle:从 solved 起 raw 图 BFS(turn 到合法对位 / slash,均 1 步)。
    /// 返回 (态→精确 WCA 距离, 各深度态数)。**独立于求解器内部**(用 slash_legal 全枚举
    /// 144 对位,不碰 legal_rot / 投影表),作正确性金标准。
    fn wca_oracle_bfs(max_d: u32) -> (HashMap<(u64, u64, u8), u32>, Vec<usize>) {
        let key = |s: &Sq1State| (s.top, s.bottom, s.ml);
        let mut dist: HashMap<(u64, u64, u8), u32> = HashMap::new();
        dist.insert(key(&Sq1State::SOLVED), 0);
        let mut frontier = vec![Sq1State::SOLVED];
        let mut counts = vec![1usize];
        for d in 1..=max_d {
            let mut next = Vec::new();
            for z in &frontier {
                let mut push = |c: Sq1State, next: &mut Vec<Sq1State>| {
                    if !dist.contains_key(&key(&c)) {
                        dist.insert(key(&c), d);
                        next.push(c);
                    }
                };
                if z.slash_legal() {
                    push(z.slashed(), &mut next);
                }
                for a in 0..12u32 {
                    for b in 0..12u32 {
                        if a == 0 && b == 0 {
                            continue;
                        }
                        let c = z.turned(a, b);
                        if c.slash_legal() {
                            push(c, &mut next);
                        }
                    }
                }
            }
            counts.push(next.len());
            frontier = next;
        }
        (dist, counts)
    }

    /// WCA 求解器逐态等于独立 oracle 的精确 BFS 距离(== 证明最优)。
    #[test]
    fn wca_matches_oracle() {
        let w = Sq1WcaSolver::shared();
        let (dist, counts) = wca_oracle_bfs(4);
        eprintln!("WCA exact-state depth counts 0..=4: {:?}", counts);
        let items: Vec<(&(u64, u64, u8), &u32)> = dist.iter().collect();
        let stride = (items.len() / 40_000).max(1); // 上限 ~4 万次求解
        let mut checked = 0usize;
        for (i, (&(top, bottom, ml), &d)) in items.iter().enumerate() {
            if i % stride != 0 {
                continue;
            }
            let st = Sq1State { top, bottom, ml };
            assert_eq!(
                w.solve_wca(&st),
                d,
                "WCA mismatch ({:#014x},{:#014x},{}) oracle={}",
                top,
                bottom,
                ml,
                d
            );
            checked += 1;
        }
        eprintln!("WCA oracle cross-check: {} states (stride {})", checked, stride);
    }

    /// 表规模 / 可达 / 投影直径(回归锁;改表逻辑必须显式改这里)。
    #[test]
    fn wca_tables_baseline() {
        let w = Sq1WcaSolver::shared();
        assert_eq!(w.comb.len(), SHAPE_COUNT * 70 * 70 * 2);
        assert_eq!(w.c4.len(), SHAPE_COUNT * 1680 * 2);
        assert_eq!(w.e4.len(), SHAPE_COUNT * 1680 * 2);
        assert_eq!(w.c4b.len(), SHAPE_COUNT * 1680 * 2);
        assert_eq!(w.e4b.len(), SHAPE_COUNT * 1680 * 2);
        let stats = |t: &[u8]| -> (usize, u8) {
            let reach = t.iter().filter(|&&v| v != 255).count();
            let mx = t.iter().filter(|&&v| v != 255).copied().max().unwrap();
            (reach, mx)
        };
        for (name, t) in
            [("comb", &w.comb), ("c4", &w.c4), ("e4", &w.e4), ("c4b", &w.c4b), ("e4b", &w.e4b)]
        {
            let (r, m) = stats(t);
            eprintln!("WCA {:4} reach={} (len={}) max={}", name, r, t.len(), m);
        }
        // 全空间可达(无 255):投影态全覆盖。
        assert!(w.comb.iter().all(|&v| v != 255));
        assert!(w.c4.iter().all(|&v| v != 255));
    }

    /// 区间 + 还原 + 近最优交叉:13 ≤ twist ≤ WCA ≤ 2·twist+1 ≤ 27,解 replay 回精确 SOLVED,
    /// token 数 = WCA cost,且 WCA-opt ≤ cstimer 双阶段近最优 WCA(上界一致性)。
    #[test]
    fn wca_bracket_replay_and_near_opt_cross() {
        let w = Sq1WcaSolver::shared();
        let exact = Sq1Solver::shared();
        for seed in 0..300u64 {
            let tw = 2 + (seed as usize % 8); // 2..=9 刀,twist 精确秒解
            let (st, _) = random_walk(40_000 + seed, tw);
            let (wca, sol) = w.solve_with_solution(&st);
            let twist = exact.solve_one(&st);
            assert!(twist <= wca, "twist {} > wca {}, seed={}", twist, wca, seed);
            assert!(wca <= 2 * twist + 1, "wca {} > 2*twist+1={}, seed={}", wca, 2 * twist + 1, seed);
            assert!(wca <= 27, "wca {} > 27, seed={}", wca, seed);
            assert_eq!(sol.len() as u32, wca, "token count = wca, seed={}", seed);
            let mut r = st;
            for t in &sol {
                r.apply(*t).unwrap();
            }
            assert_eq!(
                (r.top, r.bottom, r.ml),
                (SOLVED_TOP, SOLVED_BOTTOM, 0),
                "replay to exact SOLVED, seed={}",
                seed
            );
        }
        // 81 真实 WCA 打乱(深态):WCA-opt ≤ 近最优 WCA、≤ 2·near_twist+1、≤27、replay。
        let txt = include_str!("../test_data/sq1_scrambles.txt");
        let mut n = 0;
        let mut sum = 0u32;
        let mut mx = 0u32;
        for line in txt.lines() {
            let line = line.trim();
            if line.is_empty() {
                continue;
            }
            let (id, scr) = line.split_once(',').unwrap();
            let st = state_from_scramble(scr).unwrap();
            let (wca, sol) = w.solve_with_solution(&st);
            let near = crate::sq1_twophase::solve_wca(&st);
            let near_tw = crate::sq1_twophase::solve_twist(&st);
            assert!(wca <= near, "id={} wca-opt {} > near {}", id, wca, near);
            assert!(wca <= 2 * near_tw + 1, "id={} wca {} > 2*near_tw+1", id, wca);
            assert!(wca <= 27, "id={} wca {} > 27", id, wca);
            assert_eq!(sol.len() as u32, wca);
            let mut r = st;
            for t in &sol {
                r.apply(*t).unwrap();
            }
            assert_eq!((r.top, r.bottom, r.ml), (SOLVED_TOP, SOLVED_BOTTOM, 0), "id={} replay", id);
            sum += wca;
            mx = mx.max(wca);
            n += 1;
        }
        assert_eq!(n, 81);
        eprintln!("WCA-opt on 81 real scrambles: mean={:.2} max={}", sum as f64 / 81.0, mx);
    }

    /// 诊断:逐步打印 seed=63 的解,定位 replay 偏离点。
    #[test]
    fn wca_debug_replay_trace() {
        let w = Sq1WcaSolver::shared();
        let (st, _) = random_walk(40_000 + 63, 9);
        let (wca, sol) = w.solve_with_solution(&st);
        eprintln!("scramble: top={:#x} bottom={:#x} ml={} square={}", st.top, st.bottom, st.ml, st.is_square_shape());
        eprintln!("wca={} sol={:?}", wca, sol);
        let mut r = st;
        for (i, t) in sol.iter().enumerate() {
            let before_sq = r.is_square_shape();
            r.apply(*t).unwrap();
            eprintln!(
                "  [{:2}] {:?}: top={:#x} bottom={:#x} ml={} sq={} (was_sq={})",
                i, t, r.top, r.bottom, r.ml, r.is_square_shape(), before_sq
            );
        }
        eprintln!(
            "final: top={:#x} bottom={:#x} ml={} | SOLVED top={:#x} bottom={:#x}",
            r.top, r.bottom, r.ml, SOLVED_TOP, SOLVED_BOTTOM
        );
        assert_eq!((r.top, r.bottom, r.ml), (SOLVED_TOP, SOLVED_BOTTOM, 0));
    }

    /// 分析(瞬时,不做精确解):phase-1 启发式 `h` vs 近最优 WCA 上界的 gap 分布。
    /// gap = near - h ≥ actual - h,是真实启发式松弛的上界。gap 大 = IDA* 深态炸点。
    /// 读 ../core/.tmp/sq1_wca/sample.txt(`id,scramble`);缺文件则 skip。
    #[test]
    fn wca_heuristic_gap_analysis() {
        let path = "../core/.tmp/sq1_wca/sample.txt";
        let data = match std::fs::read_to_string(path) {
            Ok(d) => d,
            Err(_) => {
                eprintln!("[skip] corpus not found: {}", path);
                return;
            }
        };
        let w = Sq1WcaSolver::shared();
        let (mut n, mut sum_h, mut sum_near, mut sum_gap) = (0u64, 0u64, 0u64, 0u64);
        let mut gap_hist = [0u64; 32];
        let mut near_hist = [0u64; 32];
        let mut h_hist = [0u64; 32];
        let mut max_near = 0u32;
        for line in data.lines() {
            let line = line.trim();
            if line.is_empty() {
                continue;
            }
            let scr = line.split_once(',').map(|(_, s)| s).unwrap_or(line);
            let st = match state_from_scramble(scr) {
                Ok(s) => s,
                Err(_) => continue,
            };
            let h = w.h(&st) as u32;
            let near = crate::sq1_twophase::solve_wca(&st);
            let gap = near.saturating_sub(h);
            n += 1;
            sum_h += h as u64;
            sum_near += near as u64;
            sum_gap += gap as u64;
            gap_hist[(gap as usize).min(31)] += 1;
            near_hist[(near as usize).min(31)] += 1;
            h_hist[(h as usize).min(31)] += 1;
            max_near = max_near.max(near);
        }
        if n == 0 {
            eprintln!("[skip] no scrambles parsed");
            return;
        }
        let pct = |c: u64| 100.0 * c as f64 / n as f64;
        eprintln!("=== heuristic gap analysis on {} real WCA scrambles ===", n);
        eprintln!(
            "mean h={:.2}  mean near-opt WCA={:.2}  mean gap(near-h)={:.2}  max near={}",
            sum_h as f64 / n as f64,
            sum_near as f64 / n as f64,
            sum_gap as f64 / n as f64,
            max_near
        );
        eprintln!("h (phase-1 lower bound) distribution:");
        for (i, &c) in h_hist.iter().enumerate() {
            if c > 0 {
                eprintln!("  h={:2}: {:6} ({:.1}%)", i, c, pct(c));
            }
        }
        eprintln!("near-opt WCA (upper bound) distribution:");
        for (i, &c) in near_hist.iter().enumerate() {
            if c > 0 {
                eprintln!("  near={:2}: {:6} ({:.1}%)", i, c, pct(c));
            }
        }
        eprintln!("gap (near - h) distribution  [b^gap ~ IDA* blowup per state]:");
        for (i, &c) in gap_hist.iter().enumerate() {
            if c > 0 {
                eprintln!("  gap={:2}: {:6} ({:.1}%)", i, c, pct(c));
            }
        }
    }

    /// 校准:挑 sample 里 h 最小(精确解最快)的 1 条,精确求解,
    /// 打印 真实最优 / h / 近最优,得真实 gap(actual-h)与近最优松弛(near-actual)。
    /// A2 诊断(手动,bounded):profile 前 ≤5 条真深态(id 774..),看 phase-1 逐 bound 节点爆炸 +
    /// 首方形深度 + h vs 近最优 gap。node_cap 20M / time_cap 15s 保证**不挂**(深态本就 >5min)。
    /// 跑:`CUBE_TABLE_DIR=...\tables cargo test --release --lib wca_profile_deep -- --ignored --nocapture`
    #[test]
    #[ignore]
    fn wca_profile_deep() {
        let w = Sq1WcaSolver::shared();
        let txt = include_str!("../test_data/sq1_scrambles.txt");
        for line in txt.lines().take(5) {
            let line = line.trim();
            if line.is_empty() {
                continue;
            }
            let (id, scr) = line.split_once(',').unwrap();
            let st = state_from_scramble(scr).unwrap();
            let h = w.h(&st);
            let near_tw = crate::sq1_twophase::solve_twist(&st);
            let near_wca = crate::sq1_twophase::solve_wca(&st);
            eprintln!(
                "=== id={} h={} near_twist={} near_wca={} gap≈{} (2*tw+1={}) ===",
                id,
                h,
                near_tw,
                near_wca,
                near_wca as i32 - h as i32,
                2 * near_tw + 1
            );
            eprintln!("{}", w.solve_profile(&st, 20_000_000, 15_000));
        }
    }

    #[test]
    #[ignore] // 手动:cargo test --release --lib -- --ignored --nocapture wca_calibrate_one
    fn wca_calibrate_one() {
        let path = "../core/.tmp/sq1_wca/sample.txt";
        let data = std::fs::read_to_string(path).expect("corpus");
        let w = Sq1WcaSolver::shared();
        // 选 h 最接近目标(默认 15 = 均值,代表典型硬态)的 1 条。SQ1_CALIB_H 可覆盖。
        let target: u32 = std::env::var("SQ1_CALIB_H").ok().and_then(|s| s.parse().ok()).unwrap_or(15);
        let mut best: Option<(u32, String, Sq1State)> = None;
        for line in data.lines() {
            let line = line.trim();
            if line.is_empty() {
                continue;
            }
            let scr = line.split_once(',').map(|(_, s)| s).unwrap_or(line);
            let st = match state_from_scramble(scr) {
                Ok(s) => s,
                Err(_) => continue,
            };
            let h = w.h(&st) as u32;
            let d = h.abs_diff(target);
            if best.as_ref().map_or(true, |b| d < b.0.abs_diff(target)) {
                best = Some((h, scr.to_string(), st));
            }
        }
        let (h, scr, st) = best.expect("some scramble");
        let near = crate::sq1_twophase::solve_wca(&st);
        let t0 = std::time::Instant::now();
        let actual = w.solve_wca(&st);
        let dt = t0.elapsed().as_secs_f64();
        eprintln!("=== calibrate ONE (min-h) scramble ===");
        eprintln!("scramble: {}", scr);
        eprintln!(
            "h(lower)={}  actual WCA optimal={}  near-opt(upper)={}",
            h, actual, near
        );
        eprintln!(
            "TRUE gap (actual-h) = {}    near-opt looseness (near-actual) = {}",
            actual as i64 - h as i64,
            near as i64 - actual as i64
        );
        eprintln!("exact solve time: {:.2}s", dt);
    }
}
